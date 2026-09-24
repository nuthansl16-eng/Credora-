-- 0009_security_rate_limits.sql
-- Shared atomic rate limiting for server-side abuse-sensitive endpoints.

create table if not exists public.security_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;
-- No client-role policies. The table is only touched by the service role and
-- the SECURITY DEFINER function below.

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.security_rate_limits%rowtype;
  v_reset timestamptz;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 255 then
    raise exception 'invalid rate-limit key';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  insert into public.security_rate_limits(rate_key, window_started_at, request_count)
  values (p_key, v_now, 1)
  on conflict (rate_key) do nothing;

  select * into v_row
  from public.security_rate_limits
  where rate_key = p_key
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.security_rate_limits
      set window_started_at = v_now, request_count = 1, updated_at = v_now
      where rate_key = p_key
    returning * into v_row;
  elsif v_row.request_count < p_limit then
    update public.security_rate_limits
      set request_count = request_count + 1, updated_at = v_now
      where rate_key = p_key
    returning * into v_row;
  end if;

  v_reset := v_row.window_started_at + make_interval(secs => p_window_seconds);
  return query select
    (v_row.request_count <= p_limit),
    greatest(0, p_limit - v_row.request_count),
    v_reset;
end;
$$;

revoke all on table public.security_rate_limits from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Keep the table bounded. The maintenance job can safely prune old windows.
create or replace function public.prune_security_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.security_rate_limits
  where updated_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.prune_security_rate_limits() from public, anon, authenticated;
grant execute on function public.prune_security_rate_limits() to service_role;
