# Payment Setup

## Recommended architecture

Use `PAYMENT_PROVIDER=auto` for production:

- India (`IN` package): Razorpay. This is the path for INR/UPI-oriented checkout.
- Other supported regions: Stripe Checkout, subject to Stripe account eligibility and the payment methods Stripe actually enables.
- Local development: `PAYMENT_PROVIDER=mock` only.

Do not hard-code claims that Google Pay, PhonePe, PayPal, Apple Pay, Pix, etc. are guaranteed. The provider/device/country/merchant account determines actual availability.

## Razorpay

Required secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Configure webhook URL:

`https://YOUR_DOMAIN/api/webhooks/payments`

Subscribe to the payment success/failure and refund events used by the adapter. Test signature verification and retries before production.

## Stripe

Required secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Configure webhook URL:

`https://YOUR_DOMAIN/api/webhooks/payments`

The adapter creates hosted Checkout Sessions and handles successful/expired sessions and refunds. Stripe availability varies by merchant country, customer country, currency, device, and account eligibility.

For Indian merchants, review Stripe's current India onboarding and international-payment requirements before enabling global checkout, including business structure, KYC, IEC/purpose-code requirements where applicable, and 3DS requirements.

## What is still needed before accepting real money

1. Registered business/merchant identity and bank settlement account.
2. Payment-provider approval for Credora's exact business model.
3. Provider KYC and required regulatory/tax information.
4. Production domain and HTTPS.
5. Supabase production project.
6. SMTP/email sender configuration.
7. Provider API keys and webhook signing secrets stored only in deployment secrets.
8. Webhook endpoints configured in each provider dashboard.
9. Staging tests for successful payment, failure, duplicate webhook, delayed webhook, partial/full refund, and chargeback/refund reversal behavior.
10. Final Terms, Privacy, Refund, Acceptable Use, and charity disclosures.
11. Production monitoring and alerting for failed webhooks and reconciliation failures.
