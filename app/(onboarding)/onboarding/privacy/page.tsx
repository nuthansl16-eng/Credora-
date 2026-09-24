import { savePrivacySettings } from "../../actions";

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
    </label>
  );
}

export default function OnboardingPrivacyPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 4 of 5</p>
      <h1 className="mt-1 text-2xl font-semibold">Your privacy settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything defaults to private. Your religion/community affiliation is never shown to anyone
        unless you explicitly turn on the related settings below. You can change these any time.
      </p>

      <form action={savePrivacySettings} className="mt-6 space-y-2">
        <Toggle name="publicProfile" label="Make my profile page public" />
        <Toggle name="publicUsername" label="Show my username publicly" />
        <Toggle name="publicAvatar" label="Show my avatar publicly" />
        <Toggle name="showPointsPublicly" label="Show my points publicly" />
        <Toggle name="showCountryPublicly" label="Show my country publicly" />
        <Toggle name="appearInTop100" label="Allow me to appear in Top 100 supporter lists" />
        <Toggle name="anonymousDisplay" label="Display me as 'Anonymous Supporter' even if other settings are on" defaultChecked />

        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
