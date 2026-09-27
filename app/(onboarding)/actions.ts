"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  onboardingRegionSchema,
  onboardingUsernameSchema,
  privacySettingsSchema,
} from "@/lib/validation/schemas";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user!.id };
}

export async function saveRegion(formData: FormData) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const regionCode = formData.get("regionCode");
  const parsed = onboardingRegionSchema.safeParse({
    countryCode: regionCode,
    regionCode: regionCode,
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const { error } = await admin
    .from("profiles")
    .update({ country_code: parsed.data.countryCode, region_code: parsed.data.regionCode })
    .eq("id", userId);
  if (error) return { error: error.message };

  redirect("/onboarding/religion");
}

export async function savePreferredReligion(formData: FormData) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const religionId = formData.get("religionId");

  if (religionId && typeof religionId === "string") {
    const { error } = await admin
      .from("profiles")
      .update({ preferred_religion_id: religionId })
      .eq("id", userId);
    if (error) return { error: error.message };

    const { error: bonusError } = await admin.rpc("grant_welcome_bonus", {
      p_user_id: userId,
      p_religion_id: religionId,
    });
    if (bonusError) return { error: bonusError.message };

    const { error: referralError } = await admin.rpc("claim_referral_reward", {
      p_referred_user_id: userId,
    });
    if (referralError) return { error: referralError.message };

    const { error: pendingReferralError } = await admin.rpc("claim_pending_referral_rewards", {
      p_referrer_user_id: userId,
    });
    if (pendingReferralError) return { error: pendingReferralError.message };
  }

  redirect("/onboarding/username");
}

export async function saveUsername(formData: FormData) {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const parsed = onboardingUsernameSchema.safeParse({ username: formData.get("username") });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const { error } = await admin
    .from("profiles")
    .update({ username: parsed.data.username })
    .eq("id", userId);

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "That username is already taken." };
    }
    return { error: error.message };
  }

  redirect("/onboarding/privacy");
}

export async function savePrivacySettings(formData: FormData) {
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
    .upsert({
      user_id: userId,
      public_username: parsed.data.publicUsername,
      public_avatar: parsed.data.publicAvatar,
      show_points_publicly: parsed.data.showPointsPublicly,
      show_country_publicly: parsed.data.showCountryPublicly,
      appear_in_top_100: parsed.data.appearInTop100,
      anonymous_display: parsed.data.anonymousDisplay,
      public_profile: parsed.data.publicProfile,
    });
  if (error) return { error: error.message };

  redirect("/onboarding/terms");
}

export async function acceptTermsAndFinish() {
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString(), onboarding_completed: true })
    .eq("id", userId);
  if (error) return { error: error.message };

  redirect("/dashboard");
}
