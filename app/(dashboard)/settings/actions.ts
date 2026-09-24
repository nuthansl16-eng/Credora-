"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { privacySettingsSchema, accountDeletionRequestSchema } from "@/lib/validation/schemas";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user!.id };
}

export async function updatePrivacySettings(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = privacySettingsSchema.safeParse({
    publicUsername: formData.get("publicUsername") === "on",
    publicAvatar: formData.get("publicAvatar") === "on",
    showPointsPublicly: formData.get("showPointsPublicly") === "on",
    showCountryPublicly: formData.get("showCountryPublicly") === "on",
    appearInTop100: formData.get("appearInTop100") === "on",
    anonymousDisplay: formData.get("anonymousDisplay") === "on",
    publicProfile: formData.get("publicProfile") === "on",
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const { error } = await supabase
    .from("user_privacy_settings")
    .update({
      public_username: parsed.data.publicUsername,
      public_avatar: parsed.data.publicAvatar,
      show_points_publicly: parsed.data.showPointsPublicly,
      show_country_publicly: parsed.data.showCountryPublicly,
      appear_in_top_100: parsed.data.appearInTop100,
      anonymous_display: parsed.data.anonymousDisplay,
      public_profile: parsed.data.publicProfile,
    })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  return { success: true };
}

/**
 * Account deletion — immediate, real anonymization of personal
 * identifiers, while intentionally preserving the financial/point
 * ledger (point_transactions, purchases) for accounting and fraud
 * records, as most jurisdictions' "right to erasure" carve out
 * legally-required financial records.
 *
 * The underlying auth row is retained because purchases/ledger rows reference
 * the profile identity. Its email is anonymized, a new random password is
 * assigned, and the credential is permanently banned from signing in.
 */
export async function requestAccountDeletion(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = accountDeletionRequestSchema.safeParse({
    confirmationPhrase: formData.get("confirmationPhrase"),
  });
  if (!parsed.success) return { error: "Please type the confirmation phrase exactly." };

  const admin = createAdminClient();
  const anonymizedUsername = `deleted_user_${userId.slice(0, 8)}`;
  const anonymizedEmail = `deleted_${userId}@invalid.credora.local`;

  // Disable the credential as part of the same deletion request. The auth
  // row cannot be physically deleted because purchases/ledger records are
  // retained for accounting and fraud/audit requirements. Instead, remove
  // the login identity and make the credential unusable.
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: anonymizedEmail,
    password: crypto.randomUUID() + crypto.randomUUID(),
    ban_duration: "876000h",
    user_metadata: { deleted_account: true },
  });
  if (authError) return { error: "Could not disable the account credential. No account data was changed." };

  const { error } = await admin
    .from("profiles")
    .update({
      username: anonymizedUsername,
      display_name: null,
      avatar_url: null,
      country_code: null,
      deletion_requested_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await admin
    .from("user_privacy_settings")
    .update({
      public_username: false,
      public_avatar: false,
      show_points_publicly: false,
      show_country_publicly: false,
      appear_in_top_100: false,
      public_profile: false,
      anonymous_display: true,
    })
    .eq("user_id", userId);

  await supabase.auth.signOut();
  redirect("/");
}
