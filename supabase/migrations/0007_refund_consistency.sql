-- 0007_refund_consistency.sql
-- Keep supporter aggregates and verified-supporter counts consistent after
-- refunds/chargebacks.

create or replace function public.reverse_purchase_points(
  p_purchase_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_idempotency_key text
) returns public.point_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_purchase public.purchases%rowtype;
  v_original public.point_transactions%rowtype;
  v_existing public.point_transactions%rowtype;
  v_reversal public.point_transactions%rowtype;
  v_remaining_purchases int;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'refund reversal requires a non-empty reason';
  end if;

  select * into v_existing from public.point_transactions
    where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if not found then
    raise exception 'purchase % not found', p_purchase_id;
  end if;
  if v_purchase.status <> 'succeeded' then
    raise exception 'purchase % cannot be reversed from status %', p_purchase_id, v_purchase.status;
  end if;

  select * into v_original from public.point_transactions
    where purchase_id = p_purchase_id
      and transaction_type = 'PURCHASE_CREDIT'
    order by created_at asc
    limit 1;
  if not found then
    raise exception 'no original PURCHASE_CREDIT transaction for purchase %', p_purchase_id;
  end if;

  update public.purchases
    set status = 'refunded'
    where id = p_purchase_id;

  update public.point_transactions
    set status = 'reversed'
    where id = v_original.id;

  insert into public.point_transactions (
    user_id, religion_id, purchase_id, points, transaction_type, status,
    idempotency_key, reversal_of_transaction_id, reason, created_by
  ) values (
    v_purchase.user_id, v_purchase.religion_id, v_purchase.id,
    -v_original.points, 'REFUND_REVERSAL', 'applied',
    p_idempotency_key, v_original.id, p_reason, p_admin_id
  ) returning * into v_reversal;

  select count(*) into v_remaining_purchases
  from public.purchases
  where user_id = v_purchase.user_id
    and religion_id = v_purchase.religion_id
    and status = 'succeeded';

  update public.supporter_contributions
    set lifetime_points = greatest(0, lifetime_points - v_original.points),
        contribution_count = v_remaining_purchases,
        is_verified = v_remaining_purchases > 0
    where user_id = v_purchase.user_id
      and religion_id = v_purchase.religion_id;

  update public.religion_scores
    set lifetime_points = greatest(0, lifetime_points - v_original.points),
        verified_supporter_count = (
          select count(*)
          from public.supporter_contributions sc
          where sc.religion_id = v_purchase.religion_id
            and sc.is_verified = true
        ),
        last_updated_at = now()
    where religion_id = v_purchase.religion_id;

  insert into public.admin_actions (
    admin_id, action_type, target_table, target_id, reason, before_state, after_state
  ) values (
    p_admin_id, 'REFUND_PURCHASE', 'purchases', p_purchase_id, p_reason,
    to_jsonb(v_purchase), jsonb_build_object('status', 'refunded')
  );

  return v_reversal;
end;
$$;

revoke execute on function public.reverse_purchase_points(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reverse_purchase_points(uuid, uuid, text, text) to service_role;
