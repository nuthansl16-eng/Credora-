import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The real authorization boundary for every admin server action / route.
 * Middleware's admin check is a UX convenience only — this is what
 * actually gates privileged operations. Throws if the caller is not an
 * authenticated admin.
 */
export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    throw new Error("Admin MFA required");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_admin, is_suspended")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.is_admin || profile.is_suspended) {
    throw new Error("Admin authorization required");
  }

  return { userId: user.id };
}
