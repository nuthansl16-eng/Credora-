"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRefundSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";

export async function processRefund(formData: FormData) {
  const { userId: adminId } = await requireAdmin(); // throws if not an admin

  const parsed = adminRefundSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  const admin = createAdminClient();
  const idempotencyKey = `manual_refund:${parsed.data.purchaseId}`;

  const { error } = await admin.rpc("reverse_purchase_points", {
    p_purchase_id: parsed.data.purchaseId,
    p_admin_id: adminId,
    p_reason: parsed.data.reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/ledger");
  return { success: true };
}
