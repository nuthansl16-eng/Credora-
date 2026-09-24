-- ============================================================================
-- 0008_welcome_bonus.sql
-- One-time 50-point welcome bonus for every user.
--
-- The bonus is not a purchase and carries no cash value. It is recorded in
-- the immutable point ledger as PROMOTIONAL_BONUS. If a user chooses a
-- preferred community during onboarding, the bonus is granted immediately.
-- If they skip that step, the first verified purchase grants the bonus to
-- the community they actually support. This guarantees one bonus per user
-- without forcing a religious/community choice during signup.
-- ============================================================================

create or replace function public.grant_welcome_bonus(
  p_user_id uuid,
  p_religion_id uuid
) returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.point_transactions%rowtype;
  v_txn public.point_transactions%rowtype;
  v_religion_exists boolean;
begin
  if p_user_id is null or p_religion_id is null then
    raise exception 'user_id and religion_id are required';
  end if;

  -- Lock the user's profile so concurrent onboarding/webhook requests cannot
  -- both grant the one-time bonus.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user % not found', p_user_id;
  end if;

  select exists(
    select 1 from public.religions
    where id = p_religion_id and is_active = true and is_approved = true
  ) into v_religion_exists;
  if not v_religion_exists then
    raise exception 'religion/community % is not active and approved', p_religion_id;
  end if;

  -- Deterministic idempotency key makes retries harmless.
  select * into v_existing
  from public.point_transactions
  where idempotency_key = 'welcome_bonus:' || p_user_id::text
  limit 1;
  if found then
    return v_existing;
  end if;

  -- Defense in depth: even if an old/manual record used a different key,
  -- never grant a second promotional welcome bonus.
  select * into v_existing
  from public.point_transactions
  where user_id = p_user_id
    and transaction_type = 'PROMOTIONAL_BONUS'
    and metadata->>'bonus_code' = 'WELCOME_50'
  order by created_at asc
  limit 1;
  if found then
    return v_existing;
  end if;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type,
    status, idempotency_key, reason, metadata
  ) values (
    p_user_id, p_religion_id, null, 50, 'PROMOTIONAL_BONUS',
    'applied', 'welcome_bonus:' || p_user_id::text,
    'One-time 50-point welcome bonus',
    jsonb_build_object('bonus_code', 'WELCOME_50', 'points', 50)
  ) returning * into v_txn;

  insert into public.supporter_contributions (
    user_id, religion_id, lifetime_points, contribution_count, is_verified
  ) values (
    p_user_id, p_religion_id, 50, 0, false
  )
  on conflict (user_id, religion_id) do update
    set lifetime_points = public.supporter_contributions.lifetime_points + 50;

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (p_religion_id, 50, 0)
  on conflict (religion_id) do update
    set lifetime_points = public.religion_scores.lifetime_points + 50,
        last_updated_at = now();

  return v_txn;
end;
$$;

-- Only the trusted server-side application can grant promotional points.
revoke execute on function public.grant_welcome_bonus(uuid, uuid) from public;
revoke execute on function public.grant_welcome_bonus(uuid, uuid) from anon;
revoke execute on function public.grant_welcome_bonus(uuid, uuid) from authenticated;
grant execute on function public.grant_welcome_bonus(uuid, uuid) to service_role;

-- Redefine the purchase award function after the bonus function exists.
-- This preserves the original payment/ledger behavior and makes a user's
-- first verified purchase claim the bonus when onboarding was skipped.
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

  -- First verified purchase claims the one-time welcome bonus if it has not
  -- already been granted during onboarding.
  perform public.grant_welcome_bonus(v_purchase.user_id, v_purchase.religion_id);

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
        first_contribution_at = coalesce(public.supporter_contributions.first_contribution_at, now()),
        last_contribution_at = now(),
        contribution_count = public.supporter_contributions.contribution_count + 1,
        is_verified = true;

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (v_purchase.religion_id, v_purchase.points_granted, 1)
  on conflict (religion_id) do update
    set lifetime_points = public.religion_scores.lifetime_points + excluded.lifetime_points,
        last_updated_at = now();

  update public.religion_scores rs
    set verified_supporter_count = (
      select count(*) from public.supporter_contributions sc
      where sc.religion_id = rs.religion_id and sc.is_verified = true
    )
    where rs.religion_id = v_purchase.religion_id;

  perform public.award_achievements_for_user(v_purchase.user_id, v_purchase.religion_id);

  return v_txn;
end;
$$;

revoke execute on function public.award_purchase_points(uuid, text, text) from public;
revoke execute on function public.award_purchase_points(uuid, text, text) from anon;
revoke execute on function public.award_purchase_points(uuid, text, text) from authenticated;
grant execute on function public.award_purchase_points(uuid, text, text) to service_role;
