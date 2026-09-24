import "server-only";
import crypto from "node:crypto";
import type { PaymentProvider, CreateOrderInput, CreateOrderResult, VerifiedWebhookEvent } from "./provider";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function timingSafeHex(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function razorpay(path: string, init: RequestInit = {}) {
  const key = required("RAZORPAY_KEY_ID");
  const secret = required("RAZORPAY_KEY_SECRET");
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* provider error may not be JSON */ }
  if (!response.ok) throw new Error(`Razorpay API error ${response.status}: ${body?.error?.description ?? "request failed"}`);
  return body;
}

export const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (input.currency !== "INR") throw new Error("Razorpay India checkout requires INR for this deployment");
    const order = await razorpay("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountMinorUnits,
        currency: input.currency,
        receipt: input.purchaseId,
        notes: input.metadata,
      }),
    });
    return {
      providerOrderId: order.id,
      checkoutPayload: {
        provider: "razorpay",
        keyId: required("RAZORPAY_KEY_ID"),
        orderId: order.id,
        amountMinorUnits: order.amount,
        currency: order.currency,
        preferredPaymentMethod: input.preferredPaymentMethod ?? "upi",
      },
    };
  },

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhookEvent> {
    const signature = headers.get("x-razorpay-signature");
    const secret = required("RAZORPAY_WEBHOOK_SECRET");
    if (!signature) throw new Error("Missing Razorpay signature header");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!timingSafeHex(signature, expected)) throw new Error("Invalid Razorpay webhook signature");

    const body = JSON.parse(rawBody);
    const eventType = String(body.event ?? "");
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    if (!payment && !refund) throw new Error("Unsupported Razorpay webhook payload");

    const entity = payment ?? refund;
    const orderId = payment?.order_id ?? refund?.notes?.order_id ?? refund?.order_id;
    const paymentId = payment?.id ?? refund?.payment_id ?? entity.id;
    const amount = Number(payment?.amount ?? refund?.amount);
    const currency = String(payment?.currency ?? "INR").toUpperCase();
    if (!orderId || !paymentId || !Number.isSafeInteger(amount) || !currency) throw new Error("Malformed Razorpay webhook payload");

    let normalized: VerifiedWebhookEvent["eventType"];
    if (["payment.captured", "order.paid"].includes(eventType)) normalized = "payment.succeeded";
    else if (eventType === "payment.failed") normalized = "payment.failed";
    else if (["refund.processed", "refund.created"].includes(eventType)) normalized = "payment.refunded";
    else throw new Error(`Unsupported Razorpay event: ${eventType}`);

    return {
      providerEventId: String(body.id ?? `${eventType}:${paymentId}`),
      eventType: normalized,
      providerOrderId: String(orderId),
      providerPaymentId: String(paymentId),
      amountMinorUnits: amount,
      currency,
    };
  },

  async refund(providerPaymentId: string, amountMinorUnits: number) {
    const refund = await razorpay(`/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: "POST",
      body: JSON.stringify({ amount: amountMinorUnits }),
    });
    return { providerRefundId: refund.id };
  },
};
