export type PaymentMethodId =
  | "upi"
  | "phonepe"
  | "paytm"
  | "bhim"
  | "card"
  | "netbanking"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "amazon_pay"
  | "alipay"
  | "wechat_pay"
  | "pix"
  | "ideal"
  | "blik"
  | "sepa"
  | "bancontact"
  | "klarna"
  | "paynow"
  | "grabpay"
  | "gopay"
  | "dana"
  | "kakaopay"
  | "naver_pay"
  | "mercado_pago";

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  regions: string[];
  icon?: string;
}

/**
 * Checkout preference catalog. Actual availability is ultimately determined
 * by the selected payment processor, country, currency, device and merchant
 * account. Never represent an unavailable method as guaranteed.
 */
export const paymentMethodOptions: PaymentMethodOption[] = [
  { id: "upi", label: "UPI", description: "Pay with a UPI app", regions: ["IN"] },
  { id: "google_pay", label: "Google Pay", description: "Google Pay / supported wallet checkout", regions: ["IN", "US", "GB", "AE", "SG", "AU", "CA", "BR", "JP", "KR"] },
  { id: "phonepe", label: "PhonePe", description: "PhonePe via UPI", regions: ["IN"] },
  { id: "paytm", label: "Paytm", description: "Paytm via UPI", regions: ["IN"] },
  { id: "bhim", label: "BHIM", description: "BHIM via UPI", regions: ["IN"] },
  { id: "amazon_pay", label: "Amazon Pay", description: "Amazon Pay where supported", regions: ["IN", "US", "GB", "DE", "FR", "IT", "ES", "JP"] },
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard and other supported cards", regions: ["*"] },
  { id: "paypal", label: "PayPal", description: "PayPal wallet checkout where supported", regions: ["US", "GB", "DE", "FR", "IT", "ES", "CA", "AU", "AE", "BR", "MX", "IN"] },
  { id: "apple_pay", label: "Apple Pay", description: "Apple Pay on supported devices", regions: ["US", "GB", "CA", "AU", "AE", "SG", "JP", "FR", "DE", "IT", "ES", "BR", "IN"] },
  { id: "alipay", label: "Alipay", description: "Alipay checkout", regions: ["CN", "SG", "HK", "JP"] },
  { id: "wechat_pay", label: "WeChat Pay", description: "WeChat Pay checkout", regions: ["CN", "SG", "HK"] },
  { id: "pix", label: "Pix", description: "Brazilian instant payment", regions: ["BR"] },
  { id: "ideal", label: "iDEAL", description: "Dutch bank payment", regions: ["NL"] },
  { id: "blik", label: "BLIK", description: "Polish mobile payment", regions: ["PL"] },
  { id: "sepa", label: "SEPA", description: "European bank payment", regions: ["DE", "FR", "IT", "ES", "NL", "BE", "AT"] },
  { id: "bancontact", label: "Bancontact", description: "Belgian payment method", regions: ["BE"] },
  { id: "klarna", label: "Klarna", description: "Klarna checkout where supported", regions: ["US", "GB", "DE", "FR", "NL", "SE", "NO", "FI", "AT"] },
  { id: "paynow", label: "PayNow", description: "Singapore instant payment", regions: ["SG"] },
  { id: "grabpay", label: "GrabPay", description: "GrabPay wallet", regions: ["SG", "MY", "PH"] },
  { id: "gopay", label: "GoPay", description: "GoPay wallet", regions: ["ID"] },
  { id: "dana", label: "DANA", description: "DANA wallet", regions: ["ID"] },
  { id: "kakaopay", label: "Kakao Pay", description: "Kakao Pay wallet", regions: ["KR"] },
  { id: "naver_pay", label: "Naver Pay", description: "Naver Pay wallet", regions: ["KR"] },
  { id: "mercado_pago", label: "Mercado Pago", description: "Mercado Pago wallet", regions: ["BR", "MX", "AR", "CL", "CO"] },
];

export function getPaymentMethodsForRegion(region: string): PaymentMethodOption[] {
  const code = region.toUpperCase();
  return paymentMethodOptions.filter((m) => m.regions.includes("*") || m.regions.includes(code));
}

export function getPaymentMethodsForCheckout(region: string, provider: "mock" | "razorpay" | "stripe") {
  const regionMethods = getPaymentMethodsForRegion(region);
  if (provider === "mock") return regionMethods;
  if (provider === "razorpay") {
    const ids = new Set<PaymentMethodId>(["upi", "phonepe", "paytm", "bhim", "card", "netbanking", "amazon_pay"]);
    return regionMethods.filter((m) => ids.has(m.id));
  }
  // Stripe's exact local-wallet availability is account/country/device dependent.
  // These are preference labels only; the hosted Checkout session remains the authority.
  const ids = new Set<PaymentMethodId>([
    "card", "paypal", "apple_pay", "google_pay", "amazon_pay", "alipay", "wechat_pay",
    "pix", "ideal", "blik", "sepa", "bancontact", "klarna", "paynow", "grabpay",
    "gopay", "dana", "kakaopay", "naver_pay", "mercado_pago",
  ]);
  return regionMethods.filter((m) => ids.has(m.id));
}
