"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const schema = z.object({
  reportingPeriodStart: z.string(),
  reportingPeriodEnd: z.string(),
  eligibleRevenueMinorUnits: z.coerce.number().int().nonnegative(),
  currency: z.string().length(3),
  allocationPercentage: z.coerce.number().min(0).max(100),
  recipientOrganization: z.string().min(1),
  notes: z.string().optional(),
});

export async function createCharityAllocation(formData: FormData) {
  const { userId: adminId } = await requireAdmin();

  const parsed = schema.safeParse({
    reportingPeriodStart: formData.get("reportingPeriodStart"),
    reportingPeriodEnd: formData.get("reportingPeriodEnd"),
    eligibleRevenueMinorUnits: formData.get("eligibleRevenueMinorUnits"),
    currency: formData.get("currency"),
    allocationPercentage: formData.get("allocationPercentage"),
    recipientOrganization: formData.get("recipientOrganization"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const allocatedAmount = Math.round(
    (parsed.data.eligibleRevenueMinorUnits * parsed.data.allocationPercentage) / 100
  );

  const admin = createAdminClient();
  const { data: allocation, error } = await admin
    .from("charity_allocations")
    .insert({
      reporting_period_start: parsed.data.reportingPeriodStart,
      reporting_period_end: parsed.data.reportingPeriodEnd,
      eligible_revenue_minor_units: parsed.data.eligibleRevenueMinorUnits,
      currency: parsed.data.currency,
      allocation_percentage: parsed.data.allocationPercentage,
      allocated_amount_minor_units: allocatedAmount,
      recipient_organization: parsed.data.recipientOrganization,
      notes: parsed.data.notes,
      status: "pending",
      created_by: adminId,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "CREATE_CHARITY_ALLOCATION",
    target_table: "charity_allocations",
    target_id: allocation.id,
    reason: "Recorded via admin dashboard",
    after_state: allocation,
  });

  revalidatePath("/admin/charity");
  return { success: true };
}

export async function updateCharityStatus(id: string, status: "pending" | "allocated" | "paid" | "cancelled") {
  const { userId: adminId } = await requireAdmin();
  const admin = createAdminClient();
  const { data: before } = await admin.from("charity_allocations").select("*").eq("id", id).single();

  const { error } = await admin.from("charity_allocations").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "UPDATE_CHARITY_ALLOCATION_STATUS",
    target_table: "charity_allocations",
    target_id: id,
    reason: `Status changed to ${status}`,
    before_state: before,
    after_state: { ...before, status },
  });

  revalidatePath("/admin/charity");
  return { success: true };
}
