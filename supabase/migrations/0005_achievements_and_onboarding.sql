-- ============================================================================
-- 0005_achievements_and_onboarding.sql
-- Adds: a preferred-community column used by onboarding (personalization
-- only — it does NOT grant points), automatic achievement awarding
-- wired into award_purchase_points, and a cron-safe wrapper for taking
-- leaderboard snapshots.
-- ============================================================================

alter table public.profiles
  add column if not exists preferred_religion_id uuid references public.religions(id);

-- ----------------------------------------------------------------------------
-- award_achievements_for_user
-- Reads real activity only (supporter_contributions, purchases) and
-- grants achievements the user has actually earned. Idempotent via the
-- unique (user_id, achievement_id, religion_id) constraint on
-- user_achievements.
-- ----------------------------------------------------------------------------
create or replace function public.award_achievements_for_user(
  p_user_id uuid,
  p_religion_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_contribution public.supporter_contributions%rowtype;
  v_achievement_id uuid;
  v_rank int;
  v_early_supporter_threshold int := 100; -- first N verified supporters of a community
begin
  select * into v_contribution from public.supporter_contributions
    where user_id = p_user_id and religion_id = p_religion_id;
  if not found then
    return;
  end if;

  -- VERIFIED_SUPPORTER: at least one verified contribution.
  if v_contribution.is_verified then
    select id into v_achievement_id from public.achievements where code = 'VERIFIED_SUPPORTER';
    insert into public.user_achievements (user_id, achievement_id, religion_id)
      values (p_user_id, v_achievement_id, p_religion_id)
      on conflict do nothing;
  end if;

  -- COMMUNITY_CONTRIBUTOR: same as verified supporter, kept distinct in
  -- the catalog for display purposes (contributed at all vs. verified).
  if v_contribution.contribution_count >= 1 then
    select id into v_achievement_id from public.achievements where code = 'COMMUNITY_CONTRIBUTOR';
    insert into public.user_achievements (user_id, achievement_id, religion_id)
      values (p_user_id, v_achievement_id, p_religion_id)
      on conflict do nothing;
  end if;

  -- CONSISTENT_SUPPORTER: contributed on more than one occasion.
  if v_contribution.contribution_count >= 3 then
    select id into v_achievement_id from public.achievements where code = 'CONSISTENT_SUPPORTER';
    insert into public.user_achievements (user_id, achievement_id, religion_id)
      values (p_user_id, v_achievement_id, p_religion_id)
      on conflict do nothing;
  end if;

  -- EARLY_SUPPORTER: among the first N verified supporters of this
  -- community, based on real recorded contribution order.
  select count(*) into v_rank from public.supporter_contributions
    where religion_id = p_religion_id
      and is_verified = true
      and (first_contribution_at, user_id) <= (v_contribution.first_contribution_at, p_user_id);
  if v_rank <= v_early_supporter_threshold then
    select id into v_achievement_id from public.achievements where code = 'EARLY_SUPPORTER';
    insert into public.user_achievements (user_id, achievement_id, religion_id)
      values (p_user_id, v_achievement_id, p_religion_id)
      on conflict do nothing;
  end if;

  -- TOP_100_SUPPORTER: currently ranked in the top 100 supporters of
  -- this community by lifetime points.
  select count(*) into v_rank from public.supporter_contributions
    where religion_id = p_religion_id
      and is_verified = true
      and (lifetime_points, first_contribution_at) >
          (v_contribution.lifetime_points, v_contribution.first_contribution_at);
  if v_rank < 100 then
    select id into v_achievement_id from public.achievements where code = 'TOP_100_SUPPORTER';
    insert into public.user_achievements (user_id, achievement_id, religion_id)
      values (p_user_id, v_achievement_id, p_religion_id)
      on conflict do nothing;
  end if;
end;
$$;

-- Redefine award_purchase_points to also award achievements, in the same
-- transaction, after the ledger/aggregate updates. CREATE OR REPLACE
-- keeps the exact same signature and idempotency behaviour as before.
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

-- ----------------------------------------------------------------------------
-- run_scheduled_maintenance
-- Single entry point for a cron job (Vercel Cron, Supabase pg_cron, or
-- any external scheduler) to call once a day. Wraps rank recomputation
-- and snapshotting; safe to call more than once a day.
-- ----------------------------------------------------------------------------
create or replace function public.run_scheduled_maintenance()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.take_leaderboard_snapshot(); -- also recomputes ranks internally
end;
$$;
