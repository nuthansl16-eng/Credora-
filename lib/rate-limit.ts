import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared, database-backed rate limiting. The old in-memory limiter only
 * protected one serverless instance, which is not much of a shield when a
 * deployment can fan out across several instances.
 */
export async function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error("Invalid rate-limit configuration");
  }

  const admin = createAdminClient();
  const storageKey = crypto.createHash("sha256").update(key).digest("hex");
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: storageKey,
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });

  if (error || !data?.[0]) {
    // Fail closed for abuse-sensitive operations. A database outage should not
    // silently turn the endpoint into an unlimited public hammer.
    console.error("Rate-limit check failed", error);
    return { allowed: false, remaining: 0, resetAt: Date.now() + 60_000 };
  }

  const row = data[0] as { allowed: boolean; remaining: number; reset_at: string };
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining),
    resetAt: new Date(row.reset_at).getTime(),
  };
}
