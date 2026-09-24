import "server-only";
import crypto from "node:crypto";
import type { PaymentProvider, CreateOrderInput, CreateOrderResult, VerifiedWebhookEvent } from "./provider";

type StripeResponse = {
  id?: string;
  url?: string;
  amount_total?: number;
  amount_refunded?: number;
  amount?: number;
  currency?: string;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
  error?: { message?: string };
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: StripeResponse };
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function formEncode(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

async function stripeApi(path: string, body: Record<string, string>): Promise<StripeResponse> {
  const key = required("STRIPE_SECRET_KEY");
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(body),
    cache: "no-store",
  });
  const text = await response.text();
  let data: StripeResponse = {};
  try { data = JSON.parse(text) as StripeResponse; } catch { /* ignore */ }
  if (!response.ok) throw new Error(`Stripe API error ${response.status}: ${data.error?.message ?? "request failed"}`);
  return data;
}

function verifyStripeSignature(rawBody: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) throw new Error("Malformed Stripe signature");
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("Expired Stripe webhook signature");
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!signatures.some((candidate) => {
    const a = Buffer.from(candidate); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  })) throw new Error("Invalid Stripe webhook signature");
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const appUrl = required("NEXT_PUBLIC_APP_URL");
    const session = await stripeApi("/checkout/sessions", {
      mode: "payment",
      "automatic_payment_methods[enabled]": "true",
      success_url: `${appUrl}/payment/success?purchase=${encodeURIComponent(input.purchaseId)}`,
      cancel_url: `${appUrl}/payment/failed?purchase=${encodeURIComponent(input.purchaseId)}`,
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(input.amountMinorUnits),
      "line_items[0][price_data][product_data][name]": "Credora points",
      "line_items[0][quantity]": "1",
      "metadata[purchaseId]": input.purchaseId,
      "metadata[userId]": input.metadata.userId ?? "",
      "metadata[religionId]": input.metadata.religionId ?? "",
      "payment_intent_data[metadata][purchaseId]": input.purchaseId,
      "payment_intent_data[metadata][userId]": input.metadata.userId ?? "",
      ...(input.preferredPaymentMethod && input.preferredPaymentMethod !== "card"
        ? { "metadata[paymentMethod]": input.preferredPaymentMethod }
        : {}),
    });
    if (!session.id || !session.url) throw new Error("Stripe did not return a checkout session URL");
    return { providerOrderId: session.id, checkoutPayload: { provider: "stripe", url: session.url } };
  },

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhookEvent> {
    const signature = headers.get("stripe-signature");
    if (!signature) throw new Error("Missing Stripe signature header");
    verifyStripeSignature(rawBody, signature, required("STRIPE_WEBHOOK_SECRET"));
    const event = JSON.parse(rawBody) as StripeEvent;
    const object = event.data?.object;
    if (!event.id || !object) throw new Error("Malformed Stripe event");

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const purchaseId = object.metadata?.purchaseId;
      if (!purchaseId || !object.id) throw new Error("Stripe session missing purchase metadata");
      return {
        providerEventId: String(event.id),
        eventType: "payment.succeeded",
        providerOrderId: String(object.id),
        providerPaymentId: String(object.payment_intent ?? object.id),
        amountMinorUnits: Number(object.amount_total),
        currency: String(object.currency).toUpperCase(),
      };
    }

    if (event.type === "checkout.session.expired") {
      return {
        providerEventId: String(event.id),
        eventType: "payment.failed",
        providerOrderId: String(object.id),
        providerPaymentId: String(object.payment_intent ?? object.id),
        amountMinorUnits: Number(object.amount_total ?? 0),
        currency: String(object.currency).toUpperCase(),
      };
    }

    if (event.type === "charge.refunded") {
      return {
        providerEventId: String(event.id),
        eventType: "payment.refunded",
        providerOrderId: String(object.metadata?.purchaseId ?? object.payment_intent ?? object.id),
        providerPaymentId: String(object.payment_intent ?? object.id),
        amountMinorUnits: Number(object.amount_refunded ?? object.amount),
        currency: String(object.currency).toUpperCase(),
      };
    }
    throw new Error(`Unsupported Stripe event: ${event.type}`);
  },

  async refund(providerPaymentId: string, amountMinorUnits: number) {
    const refund = await stripeApi("/refunds", {
      payment_intent: providerPaymentId,
      amount: String(amountMinorUnits),
    });
    if (!refund.id) throw new Error("Malformed Stripe refund response");
    return { providerRefundId: refund.id };
  },
};
