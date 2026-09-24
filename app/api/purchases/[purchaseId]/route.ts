import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: { purchaseId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("id, status, payment_provider, provider_order_id, currency, amount_minor_units")
    .eq("id", params.purchaseId).eq("user_id", user.id).single();
  if (error || !purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  return NextResponse.json({ purchase: {
    id: purchase.id, status: purchase.status, provider: purchase.payment_provider,
    orderId: purchase.provider_order_id, currency: purchase.currency,
    amountMinorUnits: Number(purchase.amount_minor_units)
  }});
}
