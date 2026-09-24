-- ============================================================================
-- 0001_init_schema.sql
-- Global Community Leaderboard — initial schema
-- Apply with: supabase db push  (or supabase migration up locally)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. profiles
-- One row per authenticated user, 1:1 with auth.users.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  username_lower text generated always as (lower(username)) stored,
  display_name text,
  avatar_url text,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  onboarding_completed boolean not null default false,
  terms_accepted_at timestamptz,
  is_admin boolean not null default false,
  is_suspended boolean not null default false,
  suspension_reason text,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$')
);
create unique index profiles_username_lower_idx on public.profiles(username_lower) where username is not null;

-- ----------------------------------------------------------------------------
-- 2. user_privacy_settings
-- Default-deny (privacy-protective) settings, one row per user.
-- ----------------------------------------------------------------------------
create table public.user_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_username boolean not null default false,
  public_avatar boolean not null default false,
  show_points_publicly boolean not null default false,
  show_country_publicly boolean not null default false,
  appear_in_top_100 boolean not null default false,
  anonymous_display boolean not null default true,
  public_profile boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. religions  (religions / communities)
-- ----------------------------------------------------------------------------
create table public.religions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  short_description text,
  description text,
  symbol_image_url text,
  is_active boolean not null default true,
  is_approved boolean not null default false, -- admin must approve before it appears publicly
  display_order int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. religion_scores
-- Denormalised aggregate per religion, kept in sync only via the ledger
-- functions below (never written directly by the frontend).
-- ----------------------------------------------------------------------------
create table public.religion_scores (
  religion_id uuid primary key references public.religions(id) on delete cascade,
  lifetime_points numeric(20,0) not null default 0 check (lifetime_points >= 0),
  verified_supporter_count int not null default 0 check (verified_supporter_count >= 0),
  current_rank int,
  last_updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. supporter_contributions
-- Per-user, per-religion aggregate (a user can support multiple religions;
-- tracked separately for each).
-- ----------------------------------------------------------------------------
create table public.supporter_contributions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  religion_id uuid not null references public.religions(id) on delete cascade,
  lifetime_points numeric(20,0) not null default 0 check (lifetime_points >= 0),
  first_contribution_at timestamptz,
  last_contribution_at timestamptz,
  contribution_count int not null default 0 check (contribution_count >= 0),
  is_verified boolean not null default false,
  primary key (user_id, religion_id)
);
create index supporter_contributions_religion_points_idx
  on public.supporter_contributions(religion_id, lifetime_points desc, first_contribution_at asc);

-- ----------------------------------------------------------------------------
-- 6. pricing_packages
-- Server-controlled catalog. Frontend never decides points-per-currency.
-- ----------------------------------------------------------------------------
create table public.pricing_packages (
  id uuid primary key default gen_random_uuid(),
  region_code text not null check (region_code ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor_units bigint not null check (amount_minor_units > 0),
  points_granted numeric(20,0) not null check (points_granted > 0),
  display_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pricing_packages_region_active_idx on public.pricing_packages(region_code, is_active);

-- ----------------------------------------------------------------------------
-- 7. purchases
-- One purchase belongs to one user and one religion. Snapshots the package
-- at time of purchase so later catalog edits never rewrite history.
-- ----------------------------------------------------------------------------
create type public.purchase_status as enum (
  'pending', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded'
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  religion_id uuid not null references public.religions(id),
  pricing_package_id uuid not null references public.pricing_packages(id),

  -- Immutable snapshot of the package at purchase time.
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor_units bigint not null check (amount_minor_units > 0),
  points_granted numeric(20,0) not null check (points_granted > 0),

  status public.purchase_status not null default 'pending',
  payment_provider text not null,               -- 'mock' | 'razorpay' | 'stripe'
  provider_order_id text,                        -- provider-side order/session id
  provider_payment_id text,                      -- provider-side payment/charge id
  idempotency_key text not null unique,

  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases(user_id, created_at desc);
create index purchases_status_idx on public.purchases(status, created_at desc);
create unique index purchases_provider_order_idx
  on public.purchases(payment_provider, provider_order_id) where provider_order_id is not null;

-- ----------------------------------------------------------------------------
-- 8. point_transactions
-- Append-only ledger. Never updated or deleted after insert.
-- ----------------------------------------------------------------------------
create type public.point_transaction_type as enum (
  'PURCHASE_CREDIT', 'REFUND_REVERSAL', 'ADMIN_CORRECTION', 'PROMOTIONAL_BONUS'
);
create type public.point_transaction_status as enum ('applied', 'reversed');

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  religion_id uuid not null references public.religions(id),
  purchase_id uuid references public.purchases(id),
  points numeric(20,0) not null,  -- negative for REFUND_REVERSAL
  transaction_type public.point_transaction_type not null,
  status public.point_transaction_status not null default 'applied',
  idempotency_key text not null unique,
  reversal_of_transaction_id uuid references public.point_transactions(id),
  reason text, -- required for ADMIN_CORRECTION, enforced in application layer + check below
  created_by uuid references public.profiles(id), -- admin id for corrections; null for automated purchase credits
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_correction_requires_reason check (
    transaction_type <> 'ADMIN_CORRECTION' or (reason is not null and length(reason) > 0)
  )
);
create index point_transactions_user_religion_idx on public.point_transactions(user_id, religion_id);
create index point_transactions_religion_idx on public.point_transactions(religion_id, created_at desc);
create index point_transactions_purchase_idx on public.point_transactions(purchase_id);

-- ----------------------------------------------------------------------------
-- 9. leaderboard_snapshots
-- Historical record, written by a scheduled job or admin reconciliation —
-- never fabricated.
-- ----------------------------------------------------------------------------
create table public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  religion_id uuid not null references public.religions(id) on delete cascade,
  rank int not null,
  lifetime_points numeric(20,0) not null,
  verified_supporter_count int not null,
  snapshot_at timestamptz not null default now()
);
create index leaderboard_snapshots_religion_idx on public.leaderboard_snapshots(religion_id, snapshot_at desc);

-- ----------------------------------------------------------------------------
-- 10. achievements (catalog) and 11. user_achievements (earned)
-- ----------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id),
  religion_id uuid references public.religions(id),
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id, religion_id)
);

-- ----------------------------------------------------------------------------
-- 12. charity_allocations
-- ----------------------------------------------------------------------------
create table public.charity_allocations (
  id uuid primary key default gen_random_uuid(),
  reporting_period_start date not null,
  reporting_period_end date not null,
  eligible_revenue_minor_units bigint not null check (eligible_revenue_minor_units >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  allocation_percentage numeric(5,2) not null check (allocation_percentage >= 0 and allocation_percentage <= 100),
  allocated_amount_minor_units bigint not null check (allocated_amount_minor_units >= 0),
  recipient_organization text not null,
  allocation_date date,
  receipt_reference text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'allocated', 'paid', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint period_valid check (reporting_period_end >= reporting_period_start)
);

-- ----------------------------------------------------------------------------
-- 13. admin_actions (audit log)
-- ----------------------------------------------------------------------------
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action_type text not null, -- e.g. 'ADJUST_POINTS', 'APPROVE_RELIGION', 'REFUND_PURCHASE'
  target_table text not null,
  target_id uuid,
  reason text not null check (length(reason) > 0),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_admin_idx on public.admin_actions(admin_id, created_at desc);
create index admin_actions_target_idx on public.admin_actions(target_table, target_id);

-- ----------------------------------------------------------------------------
-- 14. payment_webhook_events
-- Every inbound webhook is recorded before processing; unique constraint on
-- provider + event id enforces "processed exactly once".
-- ----------------------------------------------------------------------------
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.religions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pricing_packages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.purchases
  for each row execute function public.set_updated_at();
