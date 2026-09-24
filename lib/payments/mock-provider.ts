import "server-only";
import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreateOrderInput,
  CreateOrderResult,
  VerifiedWebhookEvent,
} from "./provider";

const MOCK_SIGNING_SECRET = process.env.MOCK_PAYMENT_SECRET ?? "dev-only-mock-secret";

function assertNotProduction() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The mock payment provider is disabled in production. Set " +
        "PAYMENT_PROVIDER to a real provider before deploying live."
    );
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", MOCK_SIGNING_SECRET).update(payload).digest("hex");
}

/**
 * MOCK PROVIDER — LOCAL DEVELOPMENT ONLY.
 *
 * Simulates a hosted-checkout payment provider end to end, including a
 * signed webhook, so the exact same code path (webhook -> signature
 * verification -> idempotency -> award_purchase_points) is exercised as
 * with a real provider. It never touches real money and refuses to run with NODE_ENV=production.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    assertNotProduction();
    const providerOrderId = `mock_order_${crypto.randomUUID()}`;
    return {
      providerOrderId,
      checkoutPayload: {
        provider: "mock",
        orderId: providerOrderId,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        preferredPaymentMethod: input.preferredPaymentMethod ?? "auto",
        // The mock checkout page (app/(dashboard)/checkout) posts back to
        // /api/webhooks/payments itself with one of these outcomes,
        // simulating what a real provider's webhook would send.
        simulateOutcomes: ["succeeded", "failed"],
      },
    };
  },

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhookEvent> {
    assertNotProduction();
    const signature = headers.get("x-mock-signature");
    const expected = sign(rawBody);
    const signatureBuffer = signature ? Buffer.from(signature, "utf8") : null;
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (!signatureBuffer || signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw new Error("Invalid mock webhook signature");
    }
    const body = JSON.parse(rawBody) as {
      eventId: string;
      outcome: "succeeded" | "failed" | "refunded";
      orderId: string;
      paymentId: string;
      amountMinorUnits: number;
      currency: string;
    };

    const eventType =
      body.outcome === "succeeded"
        ? "payment.succeeded"
        : body.outcome === "refunded"
          ? "payment.refunded"
          : "payment.failed";

    return {
      providerEventId: body.eventId,
      eventType,
      providerOrderId: body.orderId,
      providerPaymentId: body.paymentId,
      amountMinorUnits: body.amountMinorUnits,
      currency: body.currency,
    };
  },

  async refund(providerPaymentId: string) {
    assertNotProduction();
    return { providerRefundId: `mock_refund_${crypto.randomUUID()}` };
  },
};

/** Exported so the mock checkout UI can build a correctly signed request body. */
export function signMockPayload(payload: string): string {
  return sign(payload);
}
