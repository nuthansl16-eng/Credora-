import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin, timingSafeEqualText } from "@/lib/request-security";

/**
 * Recomputes ranks and records a real-data snapshot.
 *
 * Supports both POST (manual/admin) and GET (Vercel Cron). Cron access is
 * authenticated with CRON_SECRET through either x-cron-secret or the
 * standard Authorization: Bearer header.
 */
async function reconcile(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const authorization = req.headers.get("authorization");
  const bearerSecret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const configuredCronSecret = process.env.CRON_SECRET;
  const isCron = !!configuredCronSecret &&
    (timingSafeEqualText(cronSecret, configuredCronSecret) || timingSafeEqualText(bearerSecret, configuredCronSecret));

  if (!isCron) {
    if (!assertSameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") {
      return NextResponse.json({ error: "Admin MFA required" }, { status: 403 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin authorization required" }, { status: 403 });
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("run_scheduled_maintenance");
  if (error) {
    console.error("Reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  return reconcile(req);
}

export async function GET(req: NextRequest) {
  return reconcile(req);
}
