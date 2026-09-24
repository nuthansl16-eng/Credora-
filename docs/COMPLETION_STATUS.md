# Credora Completion Status

## Current implementation

The repository contains the core Credora application, including authentication, email verification, onboarding, leaderboard/community pages, Top 100 privacy controls, immutable point ledger, 50-point promotional welcome bonus, admin reconciliation, refund consistency, webhook idempotency, database-backed rate limiting, same-origin checks, bounded request bodies, security headers, admin MFA/AAL2 enforcement, and production disablement of the mock payment provider.

## Payment implementation

The payment layer now has two real-provider adapters using provider HTTPS APIs directly, so the repository does not require an SDK just to compile:

- **Razorpay** for INR/India checkout and UPI-oriented flows.
- **Stripe Checkout** for non-India/global checkout where the merchant account is eligible.
- **Mock** for local development only.
- `PAYMENT_PROVIDER=auto` routes IN packages to Razorpay and other package regions to Stripe.
- The server validates the requested payment method against the region catalogue before creating an order.
- The provider remains the authority for the payment methods actually available at checkout. A static catalogue must never be presented as a guarantee.

The real providers are still **not live until merchant approval, credentials, webhook configuration, tax/regulatory setup, and staging tests are complete**. The checkout UI now routes Stripe to its hosted Checkout session and Razorpay to its hosted checkout script; points are still awarded only by verified server-side webhooks.

## Verification status

A complete Next.js build/test run has not been performed in this environment because the dependency registry is unavailable. Do not claim `lint`, `typecheck`, `test`, `build`, or E2E as passing until they are run in network-enabled CI/local development.

## Remaining production work

1. Create/configure Supabase and apply all migrations `0001` through `0017`.
2. Generate real Supabase database types and replace the loose placeholder type file.
3. Configure production environment secrets.
4. Obtain payment-provider approval for the business model.
5. Complete Razorpay/Stripe merchant onboarding and webhook registration.
6. Run real staging payments, failures, refunds, and webhook retries.
7. Replace placeholder legal identity/support information.
8. Have Terms, Privacy, Refund, Acceptable Use, and charity disclosures reviewed for every launch jurisdiction.
9. Run dependency audit plus install, lint, typecheck, unit tests, build, and E2E in network-enabled CI.


### Referral purchase rewards
Referrers earn 10% of the whole points amount on every successfully paid purchase made by a referred user. Rewards are rounded down to whole points, recorded in the immutable ledger, and reversed/cancelled when the underlying purchase is refunded or charged back.
