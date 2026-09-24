import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { contentLengthWithin, hasJsonContentType } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!hasJsonContentType(req) || !contentLengthWithin(req, 256 * 1024)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > 256 * 1024) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const provider = getPaymentProvider();
  const admin = createAdminClient();

  let event;
  try {
    event = await provider.verifyWebhook(rawBody, req.headers);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    event.providerEventId.length > 255 ||
    event.providerOrderId.length > 255 ||
    event.providerPaymentId.length > 255 ||
    !Number.isSafeInteger(event.amountMinorUnits) ||
    event.amountMinorUnits < 0 ||
    !/^[A-Z]{3}$/.test(event.currency)
  ) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  let inserted: { id: string; processed: boolean };
  const { data: createdEvent, error: insertError } = await admin
    .from("payment_webhook_events")
    .insert({
      provider: provider.name,
      provider_event_id: event.providerEventId,
      event_type: event.eventType,
      payload,
      signature_verified: true,
    })
    .select("id, processed")
    .single();

  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("Failed to record webhook event", insertError);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }

    const { data: existingEvent, error: existingError } = await admin
      .from("payment_webhook_events")
      .select("id, processed")
      .eq("provider", provider.name)
      .eq("provider_event_id", event.providerEventId)
      .single();

    if (existingError || !existingEvent) {
      console.error("Could not load duplicate webhook event", existingError);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }

    if (existingEvent.processed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    inserted = existingEvent;
  } else {
    if (!createdEvent) {
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    inserted = createdEvent;
  }

  try {
    const purchaseQuery = admin
      .from("purchases")
      .select("*")
      .eq("payment_provider", provider.name)
      .eq("provider_order_id", event.providerOrderId);

    let { data: purchase, error: purchaseError } = await purchaseQuery.single();

    if ((purchaseError || !purchase) && event.eventType === "payment.refunded") {
      const fallback = await admin
        .from("purchases")
        .select("*")
        .eq("payment_provider", provider.name)
        .eq("provider_payment_id", event.providerPaymentId)
        .single();
      purchase = fallback.data;
      purchaseError = fallback.error;
    }

    if (purchaseError || !purchase) {
      throw new Error(`No purchase found for order ${event.providerOrderId}`);
    }

    const amountValid =
      event.eventType === "payment.refunded"
        ? event.amountMinorUnits > 0 &&
          event.amountMinorUnits <= purchase.amount_minor_units
        : event.amountMinorUnits === purchase.amount_minor_units;

    if (!amountValid || purchase.currency !== event.currency) {
      throw new Error(
        `Amount/currency mismatch for purchase ${purchase.id}: ` +
          `expected ${purchase.amount_minor_units} ${purchase.currency}, ` +
          `got ${event.amountMinorUnits} ${event.currency}`
      );
    }

    if (event.eventType === "payment.succeeded") {
      const { error: rpcError } = await admin.rpc("award_purchase_points", {
        p_purchase_id: purchase.id,
        p_provider_payment_id: event.providerPaymentId,
        p_idempotency_key: `purchase_credit:${purchase.id}`,
      });
      if (rpcError) throw rpcError;
    } else if (event.eventType === "payment.failed") {
      await admin
        .from("purchases")
        .update({ status: "failed", failure_reason: "provider reported failure" })
        .eq("id", purchase.id)
        .eq("status", "pending");
    } else if (event.eventType === "payment.refunded") {
      const systemActorId = process.env.SYSTEM_ACTOR_USER_ID;
      if (!systemActorId) {
        throw new Error(
          "SYSTEM_ACTOR_USER_ID is not configured; cannot attribute an " +
            "automated refund reversal. Configure it or process this " +
            "refund manually from the admin dashboard."
        );
      }

      const { error: rpcError } = await admin.rpc("reverse_purchase_points", {
        p_purchase_id: purchase.id,
        p_admin_id: systemActorId,
        p_reason: "Provider-reported refund/chargeback",
        p_idempotency_key: `refund_reversal:${purchase.id}`,
      });
      if (rpcError) throw rpcError;
    }

    await admin
      .from("payment_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", inserted.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("Webhook processing failed", message);

    await admin
      .from("payment_webhook_events")
      .update({ processing_error: message })
      .eq("id", inserted.id);

    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
