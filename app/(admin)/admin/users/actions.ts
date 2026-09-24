"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function setUserSuspension(userId: string, isSuspended: boolean, reason: string) {
  const { userId: adminId } = await requireAdmin();
  if (!reason || reason.trim().length < 5) return { error: "A meaningful reason is required." };

  const admin = createAdminClient();
  const { data: before } = await admin.from("profiles").select("*").eq("id", userId).single();

  const { error } = await admin
    .from("profiles")
    .update({ is_suspended: isSuspended, suspension_reason: isSuspended ? reason : null })
    .eq("id", userId);
  if (error) return { error: error.message };

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: isSuspended ? "SUSPEND_USER" : "UNSUSPEND_USER",
    target_table: "profiles",
    target_id: userId,
    reason,
    before_state: before,
    after_state: { ...before, is_suspended: isSuspended },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
