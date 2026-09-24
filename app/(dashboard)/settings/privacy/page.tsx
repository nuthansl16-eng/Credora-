import { createClient } from "@/lib/supabase/server";
import { updatePrivacySettings } from "../actions";

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
    </label>
  );
}

export default async function PrivacySettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: settings } = await supabase
    .from("user_privacy_settings")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold">Privacy Settings</h1>
      <form action={updatePrivacySettings} className="mt-6 space-y-2">
        <Toggle name="publicProfile" label="Make my profile page public" defaultChecked={settings?.public_profile} />
        <Toggle name="publicUsername" label="Show my username publicly" defaultChecked={settings?.public_username} />
        <Toggle name="publicAvatar" label="Show my avatar publicly" defaultChecked={settings?.public_avatar} />
        <Toggle name="showPointsPublicly" label="Show my points publicly" defaultChecked={settings?.show_points_publicly} />
        <Toggle name="showCountryPublicly" label="Show my country publicly" defaultChecked={settings?.show_country_publicly} />
        <Toggle name="appearInTop100" label="Allow me to appear in Top 100 lists" defaultChecked={settings?.appear_in_top_100} />
        <Toggle name="anonymousDisplay" label="Always display me as 'Anonymous Supporter'" defaultChecked={settings?.anonymous_display} />
        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Save changes
        </button>
      </form>
    </main>
  );
}
