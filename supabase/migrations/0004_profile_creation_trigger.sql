-- ============================================================================
-- 0004_profile_creation_trigger.sql
-- Automatically creates a profiles row (and privacy-protective default
-- settings) whenever a new auth.users row is created, so the app never
-- has a user with no profile.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.user_privacy_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed the initial achievement catalog (not fake user activity — just the
-- catalog definitions themselves).
insert into public.achievements (code, name, description, icon) values
  ('EARLY_SUPPORTER', 'Early Supporter', 'Among the first verified supporters of a community.', 'sparkles'),
  ('COMMUNITY_CONTRIBUTOR', 'Community Contributor', 'Made a verified contribution to a community.', 'heart-handshake'),
  ('CONSISTENT_SUPPORTER', 'Consistent Supporter', 'Contributed to the same community on multiple occasions.', 'calendar-check'),
  ('TOP_100_SUPPORTER', 'Top 100 Supporter', 'Ranked in the top 100 verified supporters of a community.', 'trophy'),
  ('VERIFIED_SUPPORTER', 'Verified Supporter', 'Completed at least one verified contribution.', 'badge-check')
on conflict (code) do nothing;
