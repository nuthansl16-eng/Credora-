-- 0006_security_hardening.sql
-- Security hardening for self-service profile writes, privileged RPCs,
-- and public leaderboard data. Run after 0005.

-- ---------------------------------------------------------------------------
-- Profile self-service writes
--
-- The original policy allowed an authenticated user to update any column on
-- their own profile, including is_admin/is_suspended. That is an account
-- takeover-by-boolean, which is impressively bad even by software standards.
-- Keep the existing server actions working, but make protected fields
-- immutable to the client role. Trusted server actions use the service role.
-- ---------------------------------------------------------------------------
create or replace function public.can_self_update_profile(
  p_user_id uuid,
  p_is_admin boolean,
  p_is_suspended boolean,
  p_onboarding_completed boolean,
  p_terms_accepted_at timestamptz,
  p_deletion_requested_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v public.profiles%rowtype;
begin
  if p_user_id <> auth.uid() then
    return false;
  end if;

  select * into v from public.profiles where id = p_user_id;
  if not found then
    return false;
  end if;

  return p_is_admin = v.is_admin
    and p_is_suspended = v.is_suspended
    and p_onboarding_completed is not distinct from v.onboarding_completed
    and p_terms_accepted_at is not distinct from v.terms_accepted_at
    and p_deletion_requested_at is not distinct from v.deletion_requested_at;
end;
$$;

drop policy if exists "profiles: self insert" on public.profiles;
drop policy if exists "profiles: self update" on public.profiles;

-- Profiles are created by the auth trigger. Client roles cannot create their
-- own profile rows or alter privileged/account-state fields.
create policy "profiles: self update safe fields" on public.profiles
  for update using (id = auth.uid())
  with check (
    public.can_self_update_profile(
      id,
      is_admin,
      is_suspended,
      onboarding_completed,
      terms_accepted_at,
      deletion_requested_at
    )
  );

-- ---------------------------------------------------------------------------
-- Public score/snapshot visibility must not expose unapproved communities.
-- ---------------------------------------------------------------------------
drop policy if exists "scores: public read" on public.religion_scores;
create policy "scores: public read approved" on public.religion_scores
  for select using (
    exists (
      select 1 from public.religions r
      where r.id = religion_scores.religion_id
        and r.is_active = true
        and r.is_approved = true
    )
  );

drop policy if exists "snapshots: public read" on public.leaderboard_snapshots;
create policy "snapshots: public read approved" on public.leaderboard_snapshots
  for select using (
    exists (
      select 1 from public.religions r
      where r.id = leaderboard_snapshots.religion_id
        and r.is_active = true
        and r.is_approved = true
    )
  );

-- Public supporter data requires all relevant opt-ins. The application uses
-- the service role for the public Top 100 query so it can enforce the exact
-- display fields without exposing the privacy-settings row itself.
drop policy if exists "contributions: public read if opted in" on public.supporter_contributions;
create policy "contributions: public read if fully opted in" on public.supporter_contributions
  for select using (
    exists (
      select 1 from public.user_privacy_settings ps
      where ps.user_id = supporter_contributions.user_id
        and ps.public_profile = true
        and ps.appear_in_top_100 = true
        and ps.show_points_publicly = true
    )
  );

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER RPCs that mutate the ledger must never be callable by
-- browser roles. The application invokes them through the service-role
-- client after its own authentication/authorization checks.
-- ---------------------------------------------------------------------------
revoke execute on function public.award_purchase_points(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reverse_purchase_points(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_correct_points(uuid, uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.recompute_leaderboard_ranks() from public, anon, authenticated;
revoke execute on function public.take_leaderboard_snapshot() from public, anon, authenticated;
revoke execute on function public.run_scheduled_maintenance() from public, anon, authenticated;
revoke execute on function public.award_achievements_for_user(uuid, uuid) from public, anon, authenticated;

grant execute on function public.award_purchase_points(uuid, text, text) to service_role;
grant execute on function public.reverse_purchase_points(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_correct_points(uuid, uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.recompute_leaderboard_ranks() to service_role;
grant execute on function public.take_leaderboard_snapshot() to service_role;
grant execute on function public.run_scheduled_maintenance() to service_role;
grant execute on function public.award_achievements_for_user(uuid, uuid) to service_role;

-- RLS helper functions are used by policies, so authenticated/anonymous roles
-- need only these read-only boolean helpers.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.can_self_update_profile(uuid, boolean, boolean, boolean, timestamptz, timestamptz) to authenticated;

-- Do not expose the full profiles row to anonymous readers. A profile row
-- contains country/avatar fields whose visibility is controlled separately.
-- Public Top 100 rendering is handled by the explicit server-side projection
-- in app/(public)/religions/[slug]/page.tsx.
drop policy if exists "profiles: public read of public profiles" on public.profiles;
