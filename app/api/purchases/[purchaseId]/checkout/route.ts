import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("id, status, payment_provider, provider_order_id, provider_checkout_url, currency, amount_minor_units")
    .eq("id", purchaseId).eq("user_id", user.id).single();
  if (error || !purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (purchase.status !== "pending") return NextResponse.json({ error: "This purchase is no longer payable." }, { status: 409 });
  if (purchase.payment_provider === "stripe") {
    if (!purchase.provider_checkout_url) return NextResponse.json({ error: "Stripe Checkout session is unavailable. Please create a new purchase." }, { status: 409 });
    return NextResponse.json({ provider: "stripe", url: purchase.provider_checkout_url });
  }
  if (purchase.payment_provider === "razorpay") {
    if (!purchase.provider_order_id || !process.env.RAZORPAY_KEY_ID) return NextResponse.json({ error: "Payment order is unavailable." }, { status: 409 });
    return NextResponse.json({ checkoutPayload: {
      provider: "razorpay", keyId: process.env.RAZORPAY_KEY_ID,
      orderId: purchase.provider_order_id, amountMinorUnits: Number(purchase.amount_minor_units), currency: purchase.currency
    }});
  }
  return NextResponse.json({ error: "Mock checkout is available only in local development." }, { status: 409 });
}
