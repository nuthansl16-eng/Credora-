# Pre-Launch Checklist

## Legal & compliance
- [ ] Have a qualified lawyer review every file in `docs/legal/`
- [ ] Confirm with a lawyer whether this business model requires money-
      transmitter licensing, gambling licensing, or other regulatory
      approval in each country you operate in — the product is designed
      to avoid these categories (no cash value, no withdrawal, no
      resale), but only a lawyer in your jurisdictions can confirm that
      holds up
- [ ] Confirm charity accounting structure with an accountant before
      publishing any specific percentage claim (e.g. "10% of eligible
      revenue") — the claim must match your actual books
- [ ] Register a real legal entity name and address in
      `lib/config.ts` (`legalEntityName`) and the legal templates

## Payments
- [ ] Complete `docs/PAYMENT_SETUP.md` in full for your chosen provider
- [ ] Confirm the provider has approved this business model in writing
- [ ] Test refund flow end-to-end in the provider's sandbox
- [ ] Confirm `SYSTEM_ACTOR_USER_ID` points to a real admin account

## Security
- [ ] Complete every unchecked item in `docs/SECURITY_CHECKLIST.md`
- [ ] Run `npm audit`, `npm run lint`, `npm run typecheck`, `npm run test`,
      and `npm run build` locally/in CI and fix all findings
- [ ] Confirm RLS is enabled on every table in the production project

## Data & privacy
- [ ] Confirm default privacy settings match your privacy policy
- [ ] Implement the real account-deletion erasure job (see Security
      Checklist)
- [ ] Confirm religious-affiliation data is never exposed in logs, error
      messages, or analytics tools

## Product
- [ ] Replace all example/placeholder communities with real, reviewed
      entries (neutral names, descriptions, and approved images)
- [ ] Have a second person review all religion/community descriptions
      for neutrality before publishing
- [ ] Confirm the charity disclosure wording on `/charity` matches your
      actual allocation percentage and process
- [ ] Load-test the leaderboard query path if you expect high traffic

## Operations
- [ ] Error tracking and alerting configured
- [ ] Backups verified with a test restore
- [ ] An on-call/incident process exists for payment or data issues
- [ ] Support email in `lib/config.ts` (`supportEmail`) is real and monitored

## Payment launch gate

- [ ] Business/legal entity approved by selected payment providers for the exact Credora model.
- [ ] Provider KYC completed and settlement bank account verified.
- [ ] Razorpay enabled for INR/India if India checkout is offered.
- [ ] Stripe account approved for the countries/currencies you intend to serve.
- [ ] For an India-based Stripe merchant accepting international payments, confirm current Stripe requirements including business structure, IEC where applicable, RBI transaction purpose code, KYC, and 3DS/export requirements.
- [ ] Production HTTPS domain configured.
- [ ] Razorpay and Stripe webhook endpoints configured with separate signing secrets.
- [ ] Successful payment tested.
- [ ] Failed payment tested.
- [ ] Duplicate webhook tested.
- [ ] Delayed webhook/retry tested.
- [ ] Full and partial refund behavior tested where supported.
- [ ] Chargeback/refund reversal tested.
- [ ] Provider payment-method availability verified in each target country/device.
- [ ] No UI copy promises a wallet/local method that the provider has not actually enabled for the merchant/customer.
- [ ] Production mock provider disabled.


### Referral purchase rewards
Referrers earn 10% of the whole points amount on every successfully paid purchase made by a referred user. Rewards are rounded down to whole points, recorded in the immutable ledger, and reversed/cancelled when the underlying purchase is refunded or charged back.
