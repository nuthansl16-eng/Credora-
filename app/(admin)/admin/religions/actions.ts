"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateReligionSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";

export async function createReligion(formData: FormData) {
  const { userId: adminId } = await requireAdmin();

  const parsed = adminCreateReligionSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription") || undefined,
    description: formData.get("description") || undefined,
    symbolImageUrl: formData.get("symbolImageUrl") || undefined,
    sacredSymbol: formData.get("sacredSymbol") || undefined,
    sacredSymbolLabel: formData.get("sacredSymbolLabel") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const admin = createAdminClient();
  const { data: religion, error } = await admin
    .from("religions")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      short_description: parsed.data.shortDescription,
      description: parsed.data.description,
      symbol_image_url: parsed.data.symbolImageUrl,
      sacred_symbol: parsed.data.sacredSymbol,
      sacred_symbol_label: parsed.data.sacredSymbolLabel,
      is_approved: false, // requires an explicit separate approval action
      created_by: adminId,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "CREATE_RELIGION",
    target_table: "religions",
    target_id: religion.id,
    reason: "Created via admin dashboard",
    after_state: religion,
  });

  revalidatePath("/admin/religions");
  return { success: true };
}

export async function setReligionApproval(religionId: string, isApproved: boolean, reason: string) {
  const { userId: adminId } = await requireAdmin();
  if (!reason || reason.trim().length === 0) return { error: "A reason is required." };

  const admin = createAdminClient();
  const { data: before } = await admin.from("religions").select("*").eq("id", religionId).single();

  const { error } = await admin.from("religions").update({ is_approved: isApproved }).eq("id", religionId);
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: isApproved ? "APPROVE_RELIGION" : "UNAPPROVE_RELIGION",
    target_table: "religions",
    target_id: religionId,
    reason,
    before_state: before,
    after_state: { ...before, is_approved: isApproved },
  });

  revalidatePath("/admin/religions");
  return { success: true };
}

export async function setReligionActive(religionId: string, isActive: boolean, reason: string) {
  const { userId: adminId } = await requireAdmin();
  if (!reason || reason.trim().length === 0) return { error: "A reason is required." };

  const admin = createAdminClient();
  const { data: before } = await admin.from("religions").select("*").eq("id", religionId).single();

  const { error } = await admin.from("religions").update({ is_active: isActive }).eq("id", religionId);
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: isActive ? "ACTIVATE_RELIGION" : "DEACTIVATE_RELIGION",
    target_table: "religions",
    target_id: religionId,
    reason,
    before_state: before,
    after_state: { ...before, is_active: isActive },
  });

  revalidatePath("/admin/religions");
  return { success: true };
}
