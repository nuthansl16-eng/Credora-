# Deployment Guide

## Recommended stack

- **Hosting:** Vercel (this app is built with the Next.js App Router and
  needs no special config beyond environment variables).
- **Database/Auth:** Supabase (hosted Postgres + Auth + RLS).

## Steps

1. **Create a Supabase project** (if you haven't already) at
   supabase.com. Note the project URL, anon key, and service-role key
   from Project Settings → API.

2. **Apply migrations** against the production project:
   ```bash
   supabase link --project-ref <prod-project-ref>
   supabase db push
   ```
   Review each migration file under `supabase/migrations/` before
   applying to production — do not blindly push.

3. **Do not run `npm run db:seed` against production** unless you
   intend the example communities in it to be real, live entries.
   Instead, create your real communities through the admin dashboard
   (`/admin/religions`) after deployment, or write a production-specific
   seed reviewed by your team.

4. **Create a Vercel project** from this repository.

5. **Set environment variables in Vercel** (Project Settings →
   Environment Variables), mirroring `.env.example`:
   - `NEXT_PUBLIC_APP_URL` — your production URL
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — mark the service-role key as a
     "sensitive"/server-only variable; never expose it with a
     `NEXT_PUBLIC_` prefix.
   - `PAYMENT_PROVIDER` — leave as `mock` until you have completed
     `PAYMENT_SETUP.md` for a real provider. **Do not deploy to
     production with a real payment provider until that document's
     checklist is fully satisfied.**
   - `SYSTEM_ACTOR_USER_ID` — create one real admin profile to act as
     the "system" actor for provider-initiated refund reversals
     (chargebacks), and use its UUID here.
   - `ADMIN_EMAILS`, `CHARITY_ALLOCATION_PERCENTAGE` as desired.

6. **Deploy.** Vercel will run `npm run build` automatically.

7. **Register the webhook URL** with your payment provider (once one is
   configured) as `https://<your-domain>/api/webhooks/payments`.

8. **Verify RLS is enabled** on every table (Supabase dashboard →
   Authentication → Policies, or `select relrowsecurity from pg_class
   where relname = '<table>'`). All migrations in this repo enable RLS,
   but re-verify after any manual schema changes.

9. **Smoke test in production** using a real (small) payment before
   announcing launch, if your provider supports a live-mode sandbox.

## Rollback

Because points are stored in an append-only ledger with aggregates that
are always reconcilable against it (see `recompute_leaderboard_ranks`
and `take_leaderboard_snapshot` in `0003_ledger_functions.sql`), a bad
deploy of application code does not corrupt leaderboard data — only a
bad migration can, so review migrations especially carefully.

## Email verification with a 6-digit code

Credora uses Supabase Auth for email verification. Signup sends a 6-digit OTP, which the user enters at `/verify-email`. The app also includes `/auth/callback` as a compatibility path for confirmation links.

In the Supabase Dashboard, configure the **Confirm signup** email template to display the token value using Supabase's `{{ .Token }}` variable. Keep the token clearly visible as a 6-digit code. Do not put passwords or service-role credentials in email templates.

For production email delivery, configure a verified sender/domain and a production SMTP provider in Supabase Auth. The development project should not rely on a personal mailbox or expose SMTP credentials in the repository.

## Administrator security requirements

Before granting anyone `profiles.is_admin = true`:

1. Enable a TOTP authenticator factor for that administrator in Supabase Auth.
2. Confirm the administrator can reach AAL2 after signing in.
3. Keep the `CRON_SECRET` as a long random deployment secret and never commit it.
4. Never enable the mock payment provider in production.

Credora server-side admin operations require an AAL2 session.
