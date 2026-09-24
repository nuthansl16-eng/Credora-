-- 0012_referrals.sql
-- Referral program: a verified referred user who completes community selection
-- earns the referrer 30 promotional points. Each referred account can trigger
-- at most one reward. Referral rewards are non-cash, non-transferable points.

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references public.profiles(id);

create unique index if not exists profiles_referral_code_idx
  on public.profiles(referral_code)
  where referral_code is not null;

-- Existing users get a unique code. New users receive one in the trigger below.
update public.profiles
set referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where referral_code is null;

alter table public.profiles
  alter column referral_code set not null;

alter type public.point_transaction_type add value if not exists 'REFERRAL_BONUS';

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'rejected')),
  reward_points numeric(20,0) not null default 30 check (reward_points = 30),
  reward_transaction_id uuid references public.point_transactions(id),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index referrals_referrer_idx on public.referrals(referrer_user_id, created_at desc);
create index referrals_status_idx on public.referrals(status, created_at desc);

alter table public.referrals enable row level security;
create policy "referrals: referrer read" on public.referrals
  for select using (referrer_user_id = auth.uid());
create policy "referrals: referred user read" on public.referrals
  for select using (referred_user_id = auth.uid());
create policy "referrals: admin read" on public.referrals
  for select using (public.is_admin());

-- Create referral metadata when auth.users creates the profile. The referral
-- code is supplied as signup user metadata, but is only trusted after lookup
-- against an existing profile. Invalid/self codes simply produce no referral.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_code text;
begin
  v_code := lower(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));

  if v_code <> '' then
    select id into v_referrer
    from public.profiles
    where referral_code = v_code
      and id <> new.id
    limit 1;
  end if;

  insert into public.profiles (id, referral_code, referred_by_user_id)
  values (
    new.id,
    lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_referrer
  )
  on conflict (id) do update
    set referred_by_user_id = coalesce(public.profiles.referred_by_user_id, excluded.referred_by_user_id);

  insert into public.user_privacy_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  if v_referrer is not null then
    insert into public.referrals (referrer_user_id, referred_user_id, referral_code)
    values (v_referrer, new.id, v_code)
    on conflict (referred_user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Existing trigger already points at handle_new_user, so redefining the
-- function upgrades its behavior without creating a duplicate trigger.

create or replace function public.claim_referral_reward(p_referred_user_id uuid)
returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_referral public.referrals%rowtype;
  v_referrer public.profiles%rowtype;
  v_txn public.point_transactions%rowtype;
  v_religion uuid;
  v_confirmed_at timestamptz;
begin
  select email_confirmed_at into v_confirmed_at
  from auth.users where id = p_referred_user_id;
  if v_confirmed_at is null then
    raise exception 'referred account email is not verified';
  end if;

  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
  for update;
  if not found then
    return null;
  end if;

  if v_referral.status <> 'pending' then
    select * into v_txn
    from public.point_transactions
    where idempotency_key = 'referral_bonus:' || v_referral.id::text
    limit 1;
    return v_txn;
  end if;

  select * into v_referrer
  from public.profiles
  where id = v_referral.referrer_user_id
  for update;
  if not found or v_referrer.is_suspended or v_referrer.deletion_requested_at is not null then
    update public.referrals set status = 'rejected' where id = v_referral.id;
    return null;
  end if;

  -- A referral reward must be attributable to a community because all
  -- leaderboard points belong to a community. If the referrer has not chosen
  -- one yet, keep the referral pending until they do.
  v_religion := v_referrer.preferred_religion_id;
  if v_religion is null then
    return null;
  end if;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type,
    status, idempotency_key, reason, metadata
  ) values (
    v_referrer.id, v_religion, null, 30, 'REFERRAL_BONUS', 'applied',
    'referral_bonus:' || v_referral.id::text,
    '30-point successful referral reward',
    jsonb_build_object('referral_id', v_referral.id, 'reward_code', 'REFERRAL_30', 'points', 30)
  ) returning * into v_txn;

  insert into public.supporter_contributions (
    user_id, religion_id, lifetime_points, contribution_count, is_verified
  ) values (
    v_referrer.id, v_religion, 30, 0, false
  )
  on conflict (user_id, religion_id) do update
    set lifetime_points = public.supporter_contributions.lifetime_points + 30;

  insert into public.religion_scores (religion_id, lifetime_points, verified_supporter_count)
  values (v_religion, 30, 0)
  on conflict (religion_id) do update
    set lifetime_points = public.religion_scores.lifetime_points + 30,
        last_updated_at = now();

  update public.referrals
  set status = 'rewarded', reward_transaction_id = v_txn.id, rewarded_at = now()
  where id = v_referral.id;

  return v_txn;
exception
  when unique_violation then
    select * into v_txn
    from public.point_transactions
    where idempotency_key = 'referral_bonus:' || v_referral.id::text
    limit 1;
    return v_txn;
end;
$$;

revoke execute on function public.claim_referral_reward(uuid) from public;
revoke execute on function public.claim_referral_reward(uuid) from anon;
revoke execute on function public.claim_referral_reward(uuid) from authenticated;
grant execute on function public.claim_referral_reward(uuid) to service_role;
