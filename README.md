# Credora — Global Community Leaderboard

A permanent, all-time leaderboard for religions/communities, funded by
non-transferable digital points that users purchase after real, verified
payment. See `lib/config.ts` to rename the app and adjust the theme.

**Legal note:** everything under `docs/legal/` is a starting-point
template, not legal advice. Have a qualified lawyer review it — and your
accountant/compliance advisor review the charity and payment sections —
before taking real payments.

## Status of this build

The implementation pass is complete for the development/mock-payment path,
with additional security, privacy, webhook-retry, refund-consistency, and
leaderboard fixes applied. The repository still requires a real dependency
install and deployment environment for runtime verification. See
`docs/COMPLETION_STATUS.md` for the exact boundary between implemented code
and external launch requirements.

## Prerequisites

- Node.js 18.18+
- A Supabase project (free tier is fine for development)
- Supabase CLI (`npm install -g supabase`) if you want to run migrations locally

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's API settings.
Leave `PAYMENT_PROVIDER=mock` for local development.

## 3. Apply database migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This runs, in order:
- `0001_init_schema.sql` — all 14 tables, constraints, indexes
- `0002_rls_policies.sql` — Row Level Security for every table
- `0003_ledger_functions.sql` — the only functions allowed to write points/scores
- `0004_profile_creation_trigger.sql` — auto-creates a profile on signup, seeds the achievement catalog

## 4. Seed non-production reference data

```bash
npm run db:seed
```

This creates a few example communities and the initial pricing catalog
from the spec. It does **not** create fake users, purchases, or points.

## 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`. Sign up, complete onboarding, pick a
community, and go through checkout — the mock provider will let you
simulate a successful or failed payment, exercising the exact same
webhook → signature verification → idempotency → ledger code path a
real provider would use.

## 6. Checks (run these yourself — see note above)

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Fix whatever surfaces. If you hit dependency version conflicts, check
each package's changelog — the versions in `package.json` were current
and mutually compatible as of this writing but should be re-verified
with `npm outdated` before launch.

## 7. Promote yourself to admin (local dev)

There is no self-service admin signup by design. After signing up,
run in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true where id = '<your-auth-user-id>';
```

## Project structure

```
app/            Next.js App Router routes, grouped by (public), (auth),
                (onboarding), (dashboard), (admin)
lib/            config, Supabase clients, payments, ledger helpers, validation
supabase/       SQL migrations (schema, RLS, ledger functions, triggers)
scripts/        seed.ts (non-production reference data only)
tests/unit/     Vitest unit tests
tests/e2e/      Playwright scaffolding (see docs/COMPLETION_STATUS.md)
docs/           deployment guide, payment setup guide, security checklist,
                pre-launch checklist, legal policy templates
```

## Further reading

- `docs/DEPLOYMENT.md` — deploying to Vercel + Supabase
- `docs/PAYMENT_SETUP.md` — switching from mock to Razorpay/Stripe
- `docs/SECURITY_CHECKLIST.md`
- `docs/PRE_LAUNCH_CHECKLIST.md`
- `docs/COMPLETION_STATUS.md` — **read this first**: exactly what's built vs. outstanding

## Payment methods

The checkout now has a country-aware payment-method preference layer. India shows UPI plus major UPI-app choices such as Google Pay, PhonePe, Paytm and BHIM, alongside cards/netbanking where configured. International regions can expose cards, PayPal, Apple Pay, Google Pay and local methods such as Alipay/WeChat Pay, Pix, iDEAL, BLIK, SEPA, PayNow, GrabPay, GoPay/DANA, Kakao Pay and Naver Pay where applicable.

These are preferences, not guarantees: the actual methods shown/usable in production must be confirmed by the selected payment processor, merchant account, customer country, currency, device and regulatory eligibility. BharatPe is not presented as a generic consumer checkout method because its common role is merchant payments rather than a universal consumer wallet checkout.


## Referral rewards

Each account has a unique referral link. A referral becomes successful only after the referred user has verified their email and completed community selection; if the referrer had not selected a community yet, the reward remains pending until the referrer selects one. The referrer receives exactly 30 promotional points, recorded in the immutable ledger as `REFERRAL_BONUS`. Each referred account can reward at most one referrer. The reward is non-cash, non-transferable, and attributable to the referrer's selected community. Invalid, self, suspended, or deleted-account referrals are not rewarded.


### Referral purchase rewards
Referrers earn 10% of the whole points amount on every successfully paid purchase made by a referred user. Rewards are rounded down to whole points, recorded in the immutable ledger, and reversed/cancelled when the underlying purchase is refunded or charged back.

## Current hardening status (v10)

The current codebase includes:

- email verification by 6-digit Supabase OTP
- one-time 50-point welcome bonus
- referral signup reward of 30 points
- referral purchase reward of 10% of referred-user purchased points
- immutable point ledger and server-side reward calculations
- database-backed abuse-sensitive rate limiting
- same-origin protection and bounded request bodies
- protected routes through Supabase SSR middleware
- admin MFA/AAL2 enforcement
- Razorpay hosted checkout integration for India
- Stripe hosted Checkout integration for eligible international checkout
- server-side webhook verification and idempotency
- provider checkout URLs stored server-side
- refund/reversal handling
- 3D/interactive UI and admin-curated sacred/traditional symbols
- in-app abuse reporting queue

Before production launch, configure Supabase/SMTP, merchant accounts and webhooks, CAPTCHA/bot protection, generated Supabase types, production legal identity, monitoring, backups, and run the full dependency/typecheck/lint/test/build/E2E pipeline in network-enabled CI.
