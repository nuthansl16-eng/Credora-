"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPricingPackageSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";

export async function createPricingPackage(formData: FormData) {
  const { userId: adminId } = await requireAdmin();

  const parsed = adminPricingPackageSchema.safeParse({
    regionCode: formData.get("regionCode"),
    currency: formData.get("currency"),
    amountMinorUnits: Number(formData.get("amountMinorUnits")),
    pointsGranted: Number(formData.get("pointsGranted")),
    displayName: formData.get("displayName"),
    isActive: true,
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const admin = createAdminClient();
  const { data: pkg, error } = await admin
    .from("pricing_packages")
    .insert({
      region_code: parsed.data.regionCode,
      currency: parsed.data.currency,
      amount_minor_units: parsed.data.amountMinorUnits,
      points_granted: parsed.data.pointsGranted,
      display_name: parsed.data.displayName,
      is_active: true,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "CREATE_PRICING_PACKAGE",
    target_table: "pricing_packages",
    target_id: pkg.id,
    reason: "Created via admin dashboard",
    after_state: pkg,
  });

  revalidatePath("/admin/pricing");
  return { success: true };
}

export async function togglePricingPackage(id: string, isActive: boolean) {
  const { userId: adminId } = await requireAdmin();
  const admin = createAdminClient();
  const { data: before } = await admin.from("pricing_packages").select("*").eq("id", id).single();

  const { error } = await admin.from("pricing_packages").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: isActive ? "ACTIVATE_PRICING_PACKAGE" : "DEACTIVATE_PRICING_PACKAGE",
    target_table: "pricing_packages",
    target_id: id,
    reason: "Toggled from admin dashboard",
    before_state: before,
    after_state: { ...before, is_active: isActive },
  });

  revalidatePath("/admin/pricing");
  return { success: true };
}
