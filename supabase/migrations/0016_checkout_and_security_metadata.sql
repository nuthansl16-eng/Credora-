-- Store the provider-hosted checkout URL server-side so the browser never
-- needs to carry or invent payment-session URLs in query parameters.
alter table public.purchases
  add column if not exists provider_checkout_url text;

alter table public.purchases
  add constraint purchases_provider_checkout_url_length
  check (provider_checkout_url is null or length(provider_checkout_url) <= 2048);

create index if not exists purchases_provider_payment_idx
  on public.purchases(payment_provider, provider_payment_id)
  where provider_payment_id is not null;
