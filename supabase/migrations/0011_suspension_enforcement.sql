-- 0011_suspension_enforcement.sql
-- Suspended users must not be able to create new purchases through RLS.

drop policy if exists "purchases: self create pending" on public.purchases;
create policy "purchases: self create pending" on public.purchases
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_suspended = false and p.deletion_requested_at is null
    )
  );
