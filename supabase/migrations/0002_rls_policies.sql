-- ============================================================================
-- 0002_rls_policies.sql
-- Row Level Security. Default posture: deny, then allow narrowly.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.user_privacy_settings enable row level security;
alter table public.religions enable row level security;
alter table public.religion_scores enable row level security;
alter table public.supporter_contributions enable row level security;
alter table public.pricing_packages enable row level security;
alter table public.purchases enable row level security;
alter table public.point_transactions enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.charity_allocations enable row level security;
alter table public.admin_actions enable row level security;
alter table public.payment_webhook_events enable row level security;

-- Helper: is the current user an admin? Reads profiles.is_admin via
-- SECURITY DEFINER so it isn't itself blocked by the profiles RLS policy.
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------- profiles
create policy "profiles: self read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: public read of public profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.user_privacy_settings ps
      where ps.user_id = profiles.id and ps.public_profile = true
    )
  );
create policy "profiles: admin read" on public.profiles
  for select using (public.is_admin());
create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: self insert" on public.profiles
  for insert with check (id = auth.uid());

-- ------------------------------------------------- user_privacy_settings
create policy "privacy: self read" on public.user_privacy_settings
  for select using (user_id = auth.uid());
create policy "privacy: self upsert" on public.user_privacy_settings
  for insert with check (user_id = auth.uid());
create policy "privacy: self update" on public.user_privacy_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "privacy: admin read" on public.user_privacy_settings
  for select using (public.is_admin());

-- ------------------------------------------------------------- religions
create policy "religions: public read approved" on public.religions
  for select using (is_active = true and is_approved = true);
create policy "religions: admin full read" on public.religions
  for select using (public.is_admin());
create policy "religions: admin write" on public.religions
  for insert with check (public.is_admin());
create policy "religions: admin update" on public.religions
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------- religion_scores
create policy "scores: public read" on public.religion_scores for select using (true);
-- No insert/update/delete policy for any role: scores are only ever
-- written by SECURITY DEFINER functions (see 0003_ledger_functions.sql),
-- which bypass RLS deliberately and are the sole write path.

-- ------------------------------------------------ supporter_contributions
create policy "contributions: self read" on public.supporter_contributions
  for select using (user_id = auth.uid());
create policy "contributions: public read if opted in" on public.supporter_contributions
  for select using (
    exists (
      select 1 from public.user_privacy_settings ps
      where ps.user_id = supporter_contributions.user_id
        and ps.appear_in_top_100 = true
        and ps.show_points_publicly = true
    )
  );
create policy "contributions: admin read" on public.supporter_contributions
  for select using (public.is_admin());
-- Writes only via SECURITY DEFINER ledger functions.

-- --------------------------------------------------------- pricing_packages
create policy "pricing: public read active" on public.pricing_packages
  for select using (is_active = true);
create policy "pricing: admin full read" on public.pricing_packages
  for select using (public.is_admin());
create policy "pricing: admin write" on public.pricing_packages
  for insert with check (public.is_admin());
create policy "pricing: admin update" on public.pricing_packages
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- purchases
create policy "purchases: self read" on public.purchases
  for select using (user_id = auth.uid());
create policy "purchases: self create pending" on public.purchases
  for insert with check (user_id = auth.uid() and status = 'pending');
create policy "purchases: admin read" on public.purchases
  for select using (public.is_admin());
-- No client-side update policy at all: transitions from pending -> succeeded
-- /failed/refunded happen only in the webhook handler and admin refund
-- flow, both using the service-role client after independent verification.

-- ---------------------------------------------------------- point_transactions
create policy "ledger: self read" on public.point_transactions
  for select using (user_id = auth.uid());
create policy "ledger: admin read" on public.point_transactions
  for select using (public.is_admin());
-- No insert/update/delete policy for anon/authenticated: strictly
-- append-only via SECURITY DEFINER functions.

-- ------------------------------------------------------ leaderboard_snapshots
create policy "snapshots: public read" on public.leaderboard_snapshots
  for select using (true);

-- -------------------------------------------------------------- achievements
create policy "achievements: public read active" on public.achievements
  for select using (is_active = true);
create policy "achievements: admin write" on public.achievements
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- user_achievements
create policy "user_achievements: self read" on public.user_achievements
  for select using (user_id = auth.uid());
create policy "user_achievements: public read if opted in" on public.user_achievements
  for select using (
    exists (
      select 1 from public.user_privacy_settings ps
      where ps.user_id = user_achievements.user_id and ps.public_profile = true
    )
  );
create policy "user_achievements: admin read" on public.user_achievements
  for select using (public.is_admin());

-- ------------------------------------------------------- charity_allocations
create policy "charity: public read allocated" on public.charity_allocations
  for select using (status in ('allocated', 'paid'));
create policy "charity: admin full read" on public.charity_allocations
  for select using (public.is_admin());
create policy "charity: admin write" on public.charity_allocations
  for insert with check (public.is_admin());
create policy "charity: admin update" on public.charity_allocations
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- admin_actions
create policy "admin_actions: admin read" on public.admin_actions
  for select using (public.is_admin());
-- Inserts only via SECURITY DEFINER functions that log the calling admin.

-- ------------------------------------------------------ payment_webhook_events
create policy "webhook_events: admin read" on public.payment_webhook_events
  for select using (public.is_admin());
-- Inserts only via the service-role client in the webhook route handler.
