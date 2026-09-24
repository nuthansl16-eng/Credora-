import "server-only";
import type { PaymentMethodId } from "./payment-methods";
import { paymentMethodOptions } from "./payment-methods";

export interface CreateOrderInput {
  purchaseId: string; amountMinorUnits: number; currency: string;
  metadata: Record<string, string>; preferredPaymentMethod?: PaymentMethodId;
}
export interface CreateOrderResult { providerOrderId: string; checkoutPayload: Record<string, unknown>; }
export interface VerifiedWebhookEvent {
  providerEventId: string;
  eventType: "payment.succeeded" | "payment.failed" | "payment.refunded";
  providerOrderId: string; providerPaymentId: string; amountMinorUnits: number; currency: string;
}
export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhookEvent>;
  refund(providerPaymentId: string, amountMinorUnits: number): Promise<{ providerRefundId: string }>;
}

export function isPaymentMethodId(value: string | undefined): value is PaymentMethodId {
  return !!value && paymentMethodOptions.some((m) => m.id === value);
}

export function getPaymentProvider(regionCode?: string): PaymentProvider {
  const configured = process.env.PAYMENT_PROVIDER ?? "mock";
  const providerName = configured === "auto"
    ? (regionCode?.toUpperCase() === "IN" ? "razorpay" : "stripe")
    : configured;
  if (providerName === "mock") {
    const { mockProvider } = require("./mock-provider"); return mockProvider;
  }
  if (providerName === "razorpay") { const { razorpayProvider } = require("./razorpay-provider"); return razorpayProvider; }
  if (providerName === "stripe") { const { stripeProvider } = require("./stripe-provider"); return stripeProvider; }
  throw new Error(`Unknown PAYMENT_PROVIDER: ${providerName}`);
}
