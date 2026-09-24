import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { signMockPayload } from "@/lib/payments/mock-provider";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, contentLengthWithin, hasJsonContentType } from "@/lib/request-security";

/**
 * DEVELOPMENT ONLY. Plays the role of "the payment provider calling our
 * webhook" for the mock provider, so the checkout page never calls the
 * webhook route directly with an unsigned request — the exact same
 * signature-verification path used in production is exercised here too.
 *
 * Refuses to run outside development, same as the mock provider itself.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Mock payments are disabled in production" }, { status: 403 });
  }

  if (!assertSameOrigin(req) || !hasJsonContentType(req) || !contentLengthWithin(req, 8 * 1024)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !["succeeded", "failed"].includes(body.outcome) || typeof body.purchaseId !== "string") {
    return NextResponse.json({ error: "Invalid mock payment request" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: purchase, error } = await admin
    .from("purchases")
    .select("id, user_id, status, payment_provider, provider_order_id, amount_minor_units, currency")
    .eq("id", body.purchaseId)
    .single();

  if (error || !purchase || purchase.user_id !== user.id) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
  if (purchase.payment_provider !== "mock" || purchase.status !== "pending" || !purchase.provider_order_id) {
    return NextResponse.json({ error: "Purchase is not available for mock checkout" }, { status: 409 });
  }

  const webhookBody = JSON.stringify({
    eventId: crypto.randomUUID(),
    outcome: body.outcome,
    orderId: purchase.provider_order_id,
    paymentId: `mock_payment_${crypto.randomUUID()}`,
    amountMinorUnits: purchase.amount_minor_units,
    currency: purchase.currency,
  });

  const signature = signMockPayload(webhookBody);

  const res = await fetch(new URL("/api/webhooks/payments", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-signature": signature },
    body: webhookBody,
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
