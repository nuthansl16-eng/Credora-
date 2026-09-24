import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * SERVICE-ROLE client. Bypasses Row Level Security.
 *
 * Rules:
 * - Never import this file from a Client Component or anything bundled
 *   to the browser (the `server-only` import will throw a build error
 *   if that happens).
 * - Only use inside: webhook handlers, admin-authorized API routes, and
 *   trusted server actions that have already verified the caller is an
 *   admin (see lib/auth/require-admin.ts).
 * - Every write made with this client that mutates points, purchases,
 *   or scores must also write an audit/ledger row in the same
 *   transaction (see lib/ledger).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "The admin client must never be constructed without both."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
