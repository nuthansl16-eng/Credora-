-- 0010_maintenance_prune.sql
-- Extend the scheduled maintenance entry point to prune rate-limit buckets.

create or replace function public.run_scheduled_maintenance()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.take_leaderboard_snapshot();
  perform public.prune_security_rate_limits();
end;
$$;

revoke execute on function public.run_scheduled_maintenance() from public, anon, authenticated;
grant execute on function public.run_scheduled_maintenance() to service_role;
