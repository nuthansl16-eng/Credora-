import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider, isPaymentMethodId } from "@/lib/payments/provider";
import { getPaymentMethodsForCheckout } from "@/lib/payments/payment-methods";
import { createPurchaseSchema } from "@/lib/validation/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, clientIp, contentLengthWithin, hasJsonContentType } from "@/lib/request-security";

/**
 * Creates a pending purchase and a provider order.
 *
 * Security-critical: the client sends only religionId + pricingPackageId.
 * Price, currency, and points-granted are ALWAYS read from the
 * server-side pricing_packages table (steps 2-4 of the required payment
 * flow) — never accepted from the request body.
 */
export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  if (!hasJsonContentType(req) || !contentLengthWithin(req, 16 * 1024)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Rate limit per user: at most 10 purchase attempts per 5 minutes.
  // See lib/rate-limit.ts for the production-upgrade note.
  const [rl, ipRl] = await Promise.all([
    checkRateLimit(`purchase:${user.id}`, { limit: 10, windowMs: 5 * 60 * 1000 }),
    checkRateLimit(`purchase-ip:${clientIp(req)}`, { limit: 30, windowMs: 5 * 60 * 1000 }),
  ]);
  if (!rl.allowed || !ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many purchase attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { religionId, pricingPackageId, paymentMethod } = parsed.data;

  const { data: religion, error: religionError } = await supabase
    .from("religions")
    .select("id, is_active, is_approved")
    .eq("id", religionId)
    .single();
  if (religionError || !religion || !religion.is_active || !religion.is_approved) {
    return NextResponse.json({ error: "Religion/community not found or inactive" }, { status: 404 });
  }

  const { data: pkg, error: pkgError } = await supabase
    .from("pricing_packages")
    .select("*")
    .eq("id", pricingPackageId)
    .eq("is_active", true)
    .single();
  if (pkgError || !pkg) {
    return NextResponse.json({ error: "Pricing package not found or inactive" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("region_code, status")
    .eq("id", user.id)
    .single();
  if (profile?.status === "suspended" || profile?.status === "deletion_requested") {
    return NextResponse.json({ error: "Account is not permitted to make purchases" }, { status: 403 });
  }
  if (paymentMethod && !isPaymentMethodId(paymentMethod)) {
    return NextResponse.json({ error: "Unsupported payment method" }, { status: 400 });
  }
  if (profile?.region_code && profile.region_code !== pkg.region_code) {
    // Soft validation: mismatched region is allowed (users can support a
    // package listed for another region) but logged for review, since
    // billing-country/package mismatches are a common fraud signal.
    console.warn(`User ${user.id} (region ${profile.region_code}) purchasing package for region ${pkg.region_code}`);
  }

  const provider = getPaymentProvider(pkg.region_code);
  if (paymentMethod && !getPaymentMethodsForCheckout(pkg.region_code, provider.name as "mock" | "razorpay" | "stripe").some((m) => m.id === paymentMethod)) {
    return NextResponse.json({ error: "Payment method is not supported by the selected checkout provider" }, { status: 400 });
  }
  const idempotencyKey = crypto.randomUUID();

  const admin = (await import("@/lib/supabase/admin")).createAdminClient();
  const { data: purchase, error: purchaseError } = await admin
    .from("purchases")
    .insert({
      user_id: user.id,
      religion_id: religionId,
      pricing_package_id: pkg.id,
      currency: pkg.currency,
      amount_minor_units: pkg.amount_minor_units,
      points_granted: pkg.points_granted,
      status: "pending",
      payment_provider: provider.name,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single();

  if (purchaseError || !purchase) {
    console.error("Failed to create purchase", purchaseError);
    return NextResponse.json({ error: "Could not create purchase" }, { status: 500 });
  }

  try {
    const order = await provider.createOrder({
      purchaseId: purchase.id,
      amountMinorUnits: pkg.amount_minor_units,
      currency: pkg.currency,
      metadata: { purchaseId: purchase.id, userId: user.id, religionId, paymentMethod: paymentMethod ?? "auto" },
      preferredPaymentMethod: paymentMethod,
    });

    await admin
      .from("purchases")
      .update({
        provider_order_id: order.providerOrderId,
        provider_checkout_url: typeof order.checkoutPayload.url === "string" ? order.checkoutPayload.url : null,
      })
      .eq("id", purchase.id);

    return NextResponse.json({
      purchaseId: purchase.id,
      checkoutPayload: order.checkoutPayload,
    });
  } catch (err) {
    console.error("Failed to create provider order", err);
    await admin.from("purchases").update({ status: "failed", failure_reason: "order creation failed" }).eq("id", purchase.id);
    return NextResponse.json({ error: "Could not initiate payment" }, { status: 502 });
  }
}
