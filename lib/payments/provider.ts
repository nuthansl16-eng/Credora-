import "server-only";
import type { PaymentMethodId } from "./payment-methods";
import { paymentMethodOptions } from "./payment-methods";
import { mockProvider } from "./mock-provider";
import { razorpayProvider } from "./razorpay-provider";
import { stripeProvider } from "./stripe-provider";

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
  if (providerName === "mock") return mockProvider;
  if (providerName === "razorpay") return razorpayProvider;
  if (providerName === "stripe") return stripeProvider;
  throw new Error(`Unknown PAYMENT_PROVIDER: ${providerName}`);
}
