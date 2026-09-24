import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

async function updateUsername(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { usernameSchema } = await import("@/lib/validation/schemas");
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ username: parsed.data }).eq("id", user.id);
}

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user!.id).single();

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold">Account Settings</h1>

      <div className="mt-6 rounded-md border p-4 text-sm">
        <p className="text-muted-foreground">Email</p>
        <p className="font-medium">{user?.email}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Password changes and email changes go through Supabase Auth&apos;s standard flows — use{" "}
          <Link href="/forgot-password" className="underline">Forgot password</Link> to change your password.
        </p>
      </div>

      <form action={updateUsername} className="mt-6 space-y-3">
        <label className="text-sm font-medium">Username</label>
        <input name="username" defaultValue={profile?.username ?? ""} className="w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Save
        </button>
      </form>

      <Link href="/settings/delete-account" className="mt-8 block text-center text-sm text-red-600 underline">
        Delete my account
      </Link>
    </main>
  );
}
