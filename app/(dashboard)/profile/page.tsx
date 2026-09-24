import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, country_code, created_at")
    .eq("id", user!.id)
    .single();
  const { data: privacy } = await supabase
    .from("user_privacy_settings")
    .select("public_profile")
    .eq("user_id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-medium">{profile?.username ?? "Not set"}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Country</dt>
          <dd className="font-medium">{profile?.country_code ?? "—"}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Member since</dt>
          <dd className="font-medium">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</dd>
        </div>
        <div className="flex justify-between border-b pb-2">
          <dt className="text-muted-foreground">Public profile</dt>
          <dd className="font-medium">{privacy?.public_profile ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <Link href="/settings/privacy" className="mt-6 block text-center text-sm text-primary underline">
        Edit privacy settings
      </Link>
    </main>
  );
}
