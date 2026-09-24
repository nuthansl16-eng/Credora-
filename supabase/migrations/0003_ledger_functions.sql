-- ============================================================================
-- 0003_ledger_functions.sql
-- These SECURITY DEFINER functions are the ONLY way points, aggregates,
-- and religion scores are ever changed. They run inside a single
-- transaction each, so a purchase either fully awards points or fully
-- fails — there is no partial state.
--
-- Callers: the webhook handler (service-role client) and admin
-- server actions that have already verified the caller is an admin.
-- Never expose these as callable directly by anon/authenticated roles
-- without the wrapping application-layer checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- award_purchase_points
-- Transitions a pending purchase to succeeded and awards points exactly
-- once. Idempotent: calling twice with the same purchase_id/idempotency_key
-- is a no-op the second time.
-- ----------------------------------------------------------------------------
create or replace function public.award_purchase_points(
  p_purchase_id uuid,
  p_provider_payment_id text,
  p_idempotency_key text
) returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases%rowtype;
  v_existing public.point_transactions%rowtype;
  v_txn public.point_transactions%rowtype;
begin
  -- Idempotency: if this exact key was already used, return the existing row.
  select * into v_existing from public.point_transactions
    where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'purchase % not found', p_purchase_id;
  end if;

  if v_purchase.status <> 'pending' then
    raise exception 'purchase % is not pending (status=%), refusing to award points twice',
      p_purchase_id, v_purchase.status;
  end if;

  update public.purchases
    set status = 'succeeded',
        provider_payment_id = p_provider_payment_id
    where id = p_purchase_id;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type,
    status, idempotency_key
  ) values (
    v_purchase.user_id, v_purchase.religion_id, v_purchase.id,
    v_purchase.points_granted, 'PURCHASE_CREDIT', 'applied', p_idempotency_key
  ) returning * into v_txn;

  insert into public.supporter_contributions (
    user_id, religion_id, lifetime_points, first_contribution_at,
    last_contribution_at, contribution_count, is_verified
  ) values (
    v_purchase.user_id, v_purchase.religion_id, v_purchase.points_granted,
    now(), now(), 1, true
  )
  on conflict (user_id, religion_id) do update
    set lifetime_points = public.supporter_contributions.lifetime_points + excluded.lifetime_points,
        last_contribution_at = now(),
        contribution_count = public.supporter_contributions.contribution_count + 1,
        is_verified = true;

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (v_purchase.religion_id, v_purchase.points_granted, 1)
  on conflict (religion_id) do update
    set lifetime_points = public.religion_scores.lifetime_points + excluded.lifetime_points,
        last_updated_at = now();

  -- Recompute verified_supporter_count precisely (avoids double-counting
  -- repeat supporters as new supporters).
  update public.religion_scores rs
    set verified_supporter_count = (
      select count(*) from public.supporter_contributions sc
      where sc.religion_id = rs.religion_id and sc.is_verified = true
    )
    where rs.religion_id = v_purchase.religion_id;

  return v_txn;
end;
$$;

-- ----------------------------------------------------------------------------
-- reverse_purchase_points  (refund / chargeback)
-- ----------------------------------------------------------------------------
create or replace function public.reverse_purchase_points(
  p_purchase_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_idempotency_key text
) returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases%rowtype;
  v_original public.point_transactions%rowtype;
  v_existing public.point_transactions%rowtype;
  v_reversal public.point_transactions%rowtype;
begin
  select * into v_existing from public.point_transactions
    where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'purchase % not found', p_purchase_id;
  end if;
  if v_purchase.status <> 'succeeded' then
    raise exception 'purchase % cannot be reversed from status %', p_purchase_id, v_purchase.status;
  end if;

  select * into v_original from public.point_transactions
    where purchase_id = p_purchase_id and transaction_type = 'PURCHASE_CREDIT'
    order by created_at asc limit 1;
  if not found then
    raise exception 'no original PURCHASE_CREDIT transaction for purchase %', p_purchase_id;
  end if;

  update public.purchases set status = 'refunded' where id = p_purchase_id;
  update public.point_transactions set status = 'reversed' where id = v_original.id;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type, status,
    idempotency_key, reversal_of_transaction_id, reason, created_by
  ) values (
    v_purchase.user_id, v_purchase.religion_id, v_purchase.id,
    -v_original.points, 'REFUND_REVERSAL', 'applied',
    p_idempotency_key, v_original.id, p_reason, p_admin_id
  ) returning * into v_reversal;

  update public.supporter_contributions
    set lifetime_points = greatest(0, lifetime_points - v_original.points)
    where user_id = v_purchase.user_id and religion_id = v_purchase.religion_id;

  update public.religion_scores
    set lifetime_points = greatest(0, lifetime_points - v_original.points),
        last_updated_at = now()
    where religion_id = v_purchase.religion_id;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, reason, before_state, after_state)
  values (
    p_admin_id, 'REFUND_PURCHASE', 'purchases', p_purchase_id, p_reason,
    to_jsonb(v_purchase), jsonb_build_object('status', 'refunded')
  );

  return v_reversal;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_correct_points  (manual correction, always audited)
-- ----------------------------------------------------------------------------
create or replace function public.admin_correct_points(
  p_admin_id uuid,
  p_user_id uuid,
  p_religion_id uuid,
  p_points numeric,
  p_reason text,
  p_idempotency_key text
) returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.point_transactions%rowtype;
  v_txn public.point_transactions%rowtype;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = p_admin_id;
  if not coalesce(v_is_admin, false) then
    raise exception 'actor % is not an admin', p_admin_id;
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'admin corrections require a non-empty reason';
  end if;

  select * into v_existing from public.point_transactions where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  insert into public.point_transactions (
    user_id, religion_id, points, transaction_type, status,
    idempotency_key, reason, created_by
  ) values (
    p_user_id, p_religion_id, p_points, 'ADMIN_CORRECTION', 'applied',
    p_idempotency_key, p_reason, p_admin_id
  ) returning * into v_txn;

  insert into public.supporter_contributions (user_id, religion_id, lifetime_points, contribution_count, is_verified)
  values (p_user_id, p_religion_id, greatest(p_points, 0), 0, false)
  on conflict (user_id, religion_id) do update
    set lifetime_points = greatest(0, public.supporter_contributions.lifetime_points + p_points);

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (p_religion_id, greatest(p_points, 0), 0)
  on conflict (religion_id) do update
    set lifetime_points = greatest(0, public.religion_scores.lifetime_points + p_points),
        last_updated_at = now();

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, reason, after_state)
  values (p_admin_id, 'ADMIN_CORRECTION', 'point_transactions', v_txn.id, p_reason, to_jsonb(v_txn));

  return v_txn;
end;
$$;

-- ----------------------------------------------------------------------------
-- recompute_leaderboard_ranks
-- Deterministic ordering: lifetime_points desc, then religion id asc as a
-- stable tie-breaker (never random). Call from a scheduled job or admin
-- "reconcile" action.
-- ----------------------------------------------------------------------------
create or replace function public.recompute_leaderboard_ranks()
returns void
language plpgsql security definer set search_path = public as $$
begin
  with ranked as (
    select religion_id,
           row_number() over (order by lifetime_points desc, religion_id asc) as rn
    from public.religion_scores
  )
  update public.religion_scores rs
    set current_rank = ranked.rn
    from ranked
    where rs.religion_id = ranked.religion_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- take_leaderboard_snapshot
-- Writes today's real state into leaderboard_snapshots. Never fabricates
-- data — reads only from religion_scores.
-- ----------------------------------------------------------------------------
create or replace function public.take_leaderboard_snapshot()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_leaderboard_ranks();
  insert into public.leaderboard_snapshots (religion_id, rank, lifetime_points, verified_supporter_count)
  select religion_id, current_rank, lifetime_points, verified_supporter_count
  from public.religion_scores
  where current_rank is not null;
end;
$$;
