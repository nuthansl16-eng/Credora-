# Security Checklist

Review every item before launch. Checked items describe what this
codebase implements; none of them substitute for your own independent
security review.

- [x] Row Level Security enabled on every table (`0002_rls_policies.sql`)
- [x] No client-side write path to `religion_scores`, `point_transactions`,
      or `supporter_contributions` — only SECURITY DEFINER functions write them
- [x] Service-role key only used in `lib/supabase/admin.ts`, guarded with
      `import "server-only"`; never referenced from a client component
- [x] Webhook signature verification before any parsing of event content
- [x] Idempotency at two layers: `payment_webhook_events` unique constraint,
      and `point_transactions.idempotency_key` unique constraint
- [x] Server-side re-validation of amount/currency against the original
      purchase record (never trusts the webhook body alone)
- [x] All user input validated with Zod before touching the database
- [x] Admin authorization re-checked server-side on every admin action
      (`lib/auth/require-admin.ts`), not just in middleware
- [x] Every admin correction requires a non-empty reason and writes an
      `admin_actions` audit row (DB-level `check` constraint enforces this)
- [x] Default-deny privacy settings (`user_privacy_settings` defaults)
- [x] **Database-backed rate limiting** on purchase and abuse-report APIs, with
      per-user and per-IP limits and fail-closed behavior. Supabase Auth's
      own provider-side rate limits must still be configured for signup/login/reset.
- [ ] **CAPTCHA / bot protection** — application-level hooks are not enabled yet.
      Configure Supabase Auth CAPTCHA/Turnstile or hCaptcha before public launch.
- [x] **No direct image upload path** — the current app stores image URLs only;
      if direct uploads are added later, validate type/size and scan before storing.
- [ ] **Dependency audit** — run `npm audit` and address findings before
      launch; this was not run in the environment that generated this
      code (no network access there).
- [ ] **Penetration test / third-party security review** before accepting real
      payments at scale.
- [ ] **Secrets rotation plan** — document how you'll rotate the
      Supabase service-role key and payment provider secrets if
      compromised.
- [ ] **Logging/monitoring** — wire up error tracking (e.g. Sentry) and
      alerting on repeated webhook signature failures, which may
      indicate an attack.
- [ ] **Backups** — confirm Supabase's point-in-time recovery is enabled
      and you've tested a restore.

## Abuse reporting

- [x] In-app report form at `/report`.
- [x] Rate-limited report API and private reporter/admin RLS queue.
- [ ] Configure an operational review process and administrator notifications.

## Account deletion

`user_privacy_settings` and `profiles.deletion_requested_at` exist, and
`app/(dashboard)/settings/delete-account` collects the request, but the
actual data-erasure job (deleting/anonymizing personal data after a
grace period, while preserving anonymized financial records for
accounting/audit purposes) is not implemented — build this before
launch in any jurisdiction with a "right to erasure" (e.g. GDPR).

## Additional launch requirements

- Enable Supabase Auth MFA for every administrator. The application now refuses admin operations unless the authenticated session has AAL2.
- Keep `PAYMENT_PROVIDER=mock` only for local development. The mock provider is hard-disabled in production.
- Use a long random `CRON_SECRET` (at least 32 random bytes) and store it only in the deployment secret store.
- Use production SMTP with a verified sending domain and enable Supabase Auth protections/rate limits.
- Run all supplied database migrations `0001` through `0017` before deploying the application.
- Regenerate `lib/supabase/types.ts` from the real Supabase schema before production so database operations are fully type-checked.
- Review the deployed security headers and payment-provider webhook configuration after deployment.

- Verify the deployed security headers, including HSTS, frame protection, content-type sniffing protection, referrer policy, and the minimal CSP directives included by the app.
