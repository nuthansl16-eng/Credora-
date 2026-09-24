-- 0013_referral_security_and_pending.sql
-- Protect referral identity fields from client-side tampering and ensure a
-- pending referral is paid when the referrer later chooses a community.

create or replace function public.can_self_update_profile(
  p_user_id uuid,
  p_is_admin boolean,
  p_is_suspended boolean,
  p_onboarding_completed boolean,
  p_terms_accepted_at timestamptz,
  p_deletion_requested_at timestamptz,
  p_referral_code text,
  p_referred_by_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v public.profiles%rowtype;
begin
  if p_user_id <> auth.uid() then return false; end if;
  select * into v from public.profiles where id = p_user_id;
  if not found then return false; end if;

  return p_is_admin = v.is_admin
    and p_is_suspended = v.is_suspended
    and p_onboarding_completed is not distinct from v.onboarding_completed
    and p_terms_accepted_at is not distinct from v.terms_accepted_at
    and p_deletion_requested_at is not distinct from v.deletion_requested_at
    and p_referral_code = v.referral_code
    and p_referred_by_user_id is not distinct from v.referred_by_user_id;
end;
$$;

drop policy if exists "profiles: self update safe fields" on public.profiles;
create policy "profiles: self update safe fields" on public.profiles
  for update using (id = auth.uid())
  with check (
    public.can_self_update_profile(
      id,
      is_admin,
      is_suspended,
      onboarding_completed,
      terms_accepted_at,
      deletion_requested_at,
      referral_code,
      referred_by_user_id
    )
  );

revoke execute on function public.can_self_update_profile(uuid, boolean, boolean, boolean, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.can_self_update_profile(uuid, boolean, boolean, boolean, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.can_self_update_profile(uuid, boolean, boolean, boolean, timestamptz, timestamptz, text, uuid) to authenticated;

create or replace function public.claim_pending_referral_rewards(p_referrer_user_id uuid)
returns integer
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
      -- One malformed/suspended referral must not block rewards for other
      -- valid referrals. It remains pending for later reconciliation.
      null;
    end;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.claim_pending_referral_rewards(uuid) from public, anon, authenticated;
grant execute on function public.claim_pending_referral_rewards(uuid) to service_role;
