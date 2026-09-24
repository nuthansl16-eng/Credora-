-- 0014_referral_purchase_rewards.sql
-- Referral purchase rewards: the referrer earns 10% of the points on every
-- successfully paid purchase made by a referred user.
--
-- Rewards are integer points, so fractional rewards are rounded DOWN.
-- Example: 500 purchased points -> 50 referral points.
-- The reward is promotional, non-cash, non-transferable, and is reversed if
-- the underlying purchase is refunded/charged back.

alter type public.point_transaction_type
  add value if not exists 'REFERRAL_PURCHASE_BONUS';
alter type public.point_transaction_type
  add value if not exists 'REFERRAL_PURCHASE_REVERSAL';

create table if not exists public.referral_purchase_rewards (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.purchases(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  purchase_points numeric(20,0) not null check (purchase_points > 0),
  reward_points numeric(20,0) not null check (reward_points >= 0),
  religion_id uuid references public.religions(id),
  status text not null default 'pending'
    check (status in ('pending', 'rewarded', 'cancelled', 'reversed')),
  reward_transaction_id uuid references public.point_transactions(id),
  reversal_transaction_id uuid references public.point_transactions(id),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  reversed_at timestamptz
);

create index if not exists referral_purchase_rewards_referrer_idx
  on public.referral_purchase_rewards(referrer_user_id, created_at desc);
create index if not exists referral_purchase_rewards_status_idx
  on public.referral_purchase_rewards(status, created_at desc);

alter table public.referral_purchase_rewards enable row level security;
create policy "referral purchase rewards: referrer read"
  on public.referral_purchase_rewards
  for select using (referrer_user_id = auth.uid());
create policy "referral purchase rewards: referred user read"
  on public.referral_purchase_rewards
  for select using (referred_user_id = auth.uid());
create policy "referral purchase rewards: admin read"
  on public.referral_purchase_rewards
  for select using (public.is_admin());

-- Award one referral-purchase reward. This function is only callable by the
-- trusted server role and is invoked inside the same transaction as the
-- successful purchase credit.
create or replace function public.award_referral_purchase_bonus(
  p_purchase_id uuid
) returns public.referral_purchase_rewards
language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases%rowtype;
  v_referral public.referrals%rowtype;
  v_referrer public.profiles%rowtype;
  v_reward public.referral_purchase_rewards%rowtype;
  v_txn public.point_transactions%rowtype;
  v_reward_points numeric(20,0);
begin
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id
  for update;
  if not found then
    raise exception 'purchase % not found', p_purchase_id;
  end if;

  select * into v_reward
  from public.referral_purchase_rewards
  where purchase_id = p_purchase_id
  for update;
  if found then
    if v_reward.status = 'pending' then
      -- Continue below so a referrer who chooses a community later can be
      -- paid; other terminal states are already complete.
      null;
    else
      return v_reward;
    end if;
  else
    select * into v_referral
    from public.referrals
    where referred_user_id = v_purchase.user_id
      and status = 'rewarded'
    limit 1;

    if not found then
      return null;
    end if;

    v_reward_points := floor(v_purchase.points_granted * 0.10);

    insert into public.referral_purchase_rewards (
      purchase_id, referrer_user_id, referred_user_id,
      purchase_points, reward_points, status
    ) values (
      v_purchase.id, v_referral.referrer_user_id, v_purchase.user_id,
      v_purchase.points_granted, v_reward_points, 'pending'
    ) returning * into v_reward;
  end if;

  if v_purchase.status <> 'succeeded' then
    return v_reward;
  end if;

  select * into v_referrer
  from public.profiles
  where id = v_reward.referrer_user_id
  for update;
  if not found or v_referrer.is_suspended or v_referrer.deletion_requested_at is not null then
    update public.referral_purchase_rewards
    set status = 'cancelled'
    where id = v_reward.id and status = 'pending'
    returning * into v_reward;
    return v_reward;
  end if;

  if v_reward.reward_points = 0 then
    update public.referral_purchase_rewards
    set status = 'rewarded', rewarded_at = now()
    where id = v_reward.id and status = 'pending'
    returning * into v_reward;
    return v_reward;
  end if;

  if v_referrer.preferred_religion_id is null then
    return v_reward;
  end if;

  v_reward.religion_id := v_referrer.preferred_religion_id;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type,
    status, idempotency_key, reason, metadata
  ) values (
    v_referrer.id, v_reward.religion_id, v_purchase.id,
    v_reward.reward_points, 'REFERRAL_PURCHASE_BONUS', 'applied',
    'referral_purchase_bonus:' || v_purchase.id::text,
    '10% referral reward from referred-user purchase',
    jsonb_build_object(
      'reward_code', 'REFERRAL_PURCHASE_10',
      'purchase_id', v_purchase.id,
      'referred_user_id', v_purchase.user_id,
      'purchase_points', v_purchase.points_granted,
      'reward_points', v_reward.reward_points,
      'percentage', 10
    )
  ) returning * into v_txn;

  insert into public.supporter_contributions (
    user_id, religion_id, lifetime_points, contribution_count, is_verified
  ) values (
    v_referrer.id, v_reward.religion_id, v_reward.reward_points, 0, false
  )
  on conflict (user_id, religion_id) do update
    set lifetime_points = public.supporter_contributions.lifetime_points + excluded.lifetime_points;

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (v_reward.religion_id, v_reward.reward_points, 0)
  on conflict (religion_id) do update
    set lifetime_points = public.religion_scores.lifetime_points + excluded.lifetime_points,
        last_updated_at = now();

  update public.referral_purchase_rewards
  set status = 'rewarded',
      religion_id = v_reward.religion_id,
      reward_transaction_id = v_txn.id,
      rewarded_at = now()
  where id = v_reward.id and status = 'pending'
  returning * into v_reward;

  return v_reward;
exception
  when unique_violation then
    select * into v_reward
    from public.referral_purchase_rewards
    where purchase_id = p_purchase_id;
    return v_reward;
end;
$$;

-- Claim pending purchase rewards after a referrer chooses a community.
create or replace function public.claim_pending_referral_purchase_rewards(
  p_referrer_user_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_reward public.referral_purchase_rewards%rowtype;
  v_count integer := 0;
begin
  for v_reward in
    select rpr.*
    from public.referral_purchase_rewards rpr
    join public.purchases p on p.id = rpr.purchase_id
    where rpr.referrer_user_id = p_referrer_user_id
      and rpr.status = 'pending'
      and p.status = 'succeeded'
    order by rpr.created_at asc
    for update of rpr
  loop
    begin
      perform public.award_referral_purchase_bonus(v_reward.purchase_id);
      if exists (
        select 1 from public.referral_purchase_rewards
        where id = v_reward.id and status = 'rewarded'
      ) then
        v_count := v_count + 1;
      end if;
    exception when others then
      null;
    end;
  end loop;
  return v_count;
end;
$$;

-- Re-run both the original referral reward and purchase-reward reconciliation
-- whenever a referrer completes community selection.
create or replace function public.claim_pending_referral_rewards(
  p_referrer_user_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_referral public.referrals%rowtype;
  v_count integer := 0;
begin
  for v_referral in
    select r.*
    from public.referrals r
    join auth.users u on u.id = r.referred_user_id
    where r.referrer_user_id = p_referrer_user_id
      and r.status = 'pending'
      and u.email_confirmed_at is not null
    order by r.created_at asc
    for update of r
  loop
    begin
      perform public.claim_referral_reward(v_referral.referred_user_id);
      if exists (select 1 from public.referrals where id = v_referral.id and status = 'rewarded') then
        v_count := v_count + 1;
      end if;
    exception when others then
      null;
    end;
  end loop;

  perform public.claim_pending_referral_purchase_rewards(p_referrer_user_id);
  return v_count;
end;
$$;

-- Reverse/cancel the referral purchase reward when its underlying purchase is
-- refunded or charged back. This prevents referral farming through refundable
-- purchases.
create or replace function public.reverse_referral_purchase_bonus(
  p_purchase_id uuid,
  p_actor_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reward public.referral_purchase_rewards%rowtype;
  v_original public.point_transactions%rowtype;
  v_reversal public.point_transactions%rowtype;
begin
  select * into v_reward
  from public.referral_purchase_rewards
  where purchase_id = p_purchase_id
  for update;
  if not found then
    return;
  end if;

  if v_reward.status = 'pending' then
    update public.referral_purchase_rewards
    set status = 'cancelled', reversed_at = now()
    where id = v_reward.id;
    return;
  end if;

  if v_reward.status <> 'rewarded' or v_reward.reward_transaction_id is null then
    return;
  end if;

  select * into v_original
  from public.point_transactions
  where id = v_reward.reward_transaction_id
  for update;
  if not found then
    raise exception 'referral reward transaction % not found', v_reward.reward_transaction_id;
  end if;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type,
    status, idempotency_key, reversal_of_transaction_id, reason, created_by,
    metadata
  ) values (
    v_original.user_id, v_original.religion_id, p_purchase_id,
    -v_original.points, 'REFERRAL_PURCHASE_REVERSAL', 'applied',
    'referral_purchase_reversal:' || p_purchase_id::text,
    v_original.id, p_reason, p_actor_id,
    jsonb_build_object('purchase_id', p_purchase_id, 'reversed_reward_points', v_original.points)
  ) returning * into v_reversal;

  update public.point_transactions
  set status = 'reversed'
  where id = v_original.id;

  update public.supporter_contributions
  set lifetime_points = greatest(0, lifetime_points - v_original.points)
  where user_id = v_original.user_id
    and religion_id = v_original.religion_id;

  update public.religion_scores
  set lifetime_points = greatest(0, lifetime_points - v_original.points),
      last_updated_at = now()
  where religion_id = v_original.religion_id;

  update public.referral_purchase_rewards
  set status = 'reversed',
      reversal_transaction_id = v_reversal.id,
      reversed_at = now()
  where id = v_reward.id;
end;
$$;

-- Redefine purchase award so every successful referred-user purchase triggers
-- exactly one 10% referral reward in the same transaction.
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

  perform public.grant_welcome_bonus(v_purchase.user_id, v_purchase.religion_id);

  update public.purchases
    set status = 'succeeded', provider_payment_id = p_provider_payment_id
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
  perform public.award_referral_purchase_bonus(v_purchase.id);

  return v_txn;
end;
$$;

-- Redefine refund reversal so referral rewards are reversed/cancelled together
-- with the underlying purchase.
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
  v_remaining_purchases int;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'refund reversal requires a non-empty reason';
  end if;

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

  select count(*) into v_remaining_purchases
  from public.purchases
  where user_id = v_purchase.user_id
    and religion_id = v_purchase.religion_id
    and status = 'succeeded';

  update public.supporter_contributions
    set lifetime_points = greatest(0, lifetime_points - v_original.points),
        contribution_count = v_remaining_purchases,
        is_verified = v_remaining_purchases > 0
    where user_id = v_purchase.user_id and religion_id = v_purchase.religion_id;

  update public.religion_scores
    set lifetime_points = greatest(0, lifetime_points - v_original.points),
        verified_supporter_count = (
          select count(*) from public.supporter_contributions sc
          where sc.religion_id = v_purchase.religion_id and sc.is_verified = true
        ),
        last_updated_at = now()
    where religion_id = v_purchase.religion_id;

  perform public.reverse_referral_purchase_bonus(
    v_purchase.id,
    p_admin_id,
    'Underlying purchase refunded: ' || p_reason
  );

  insert into public.admin_actions (
    admin_id, action_type, target_table, target_id, reason, before_state, after_state
  ) values (
    p_admin_id, 'REFUND_PURCHASE', 'purchases', p_purchase_id, p_reason,
    to_jsonb(v_purchase), jsonb_build_object('status', 'refunded')
  );

  return v_reversal;
end;
$$;

revoke execute on function public.award_referral_purchase_bonus(uuid) from public, anon, authenticated;
revoke execute on function public.claim_pending_referral_purchase_rewards(uuid) from public, anon, authenticated;
revoke execute on function public.reverse_referral_purchase_bonus(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.award_purchase_points(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reverse_purchase_points(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.award_referral_purchase_bonus(uuid) to service_role;
grant execute on function public.claim_pending_referral_purchase_rewards(uuid) to service_role;
grant execute on function public.reverse_referral_purchase_bonus(uuid, uuid, text) to service_role;
grant execute on function public.award_purchase_points(uuid, text, text) to service_role;
grant execute on function public.reverse_purchase_points(uuid, uuid, text, text) to service_role;
