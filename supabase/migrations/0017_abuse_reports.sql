-- In-app abuse reporting queue. Reports are private to the reporter and admins.
create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('religion', 'profile', 'contribution', 'other')),
  target_id uuid,
  reason text not null check (length(reason) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists abuse_reports_status_idx on public.abuse_reports(status, created_at desc);
create index if not exists abuse_reports_reporter_idx on public.abuse_reports(reporter_user_id, created_at desc);
alter table public.abuse_reports enable row level security;
create policy "abuse reports: reporter insert" on public.abuse_reports for insert with check (reporter_user_id = auth.uid());
create policy "abuse reports: reporter read own" on public.abuse_reports for select using (reporter_user_id = auth.uid());
create policy "abuse reports: admin read" on public.abuse_reports for select using (public.is_admin());
create policy "abuse reports: admin update" on public.abuse_reports for update using (public.is_admin()) with check (public.is_admin());
