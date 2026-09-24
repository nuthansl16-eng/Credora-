import { saveUsername } from "../../actions";

export default function OnboardingUsernamePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 3 of 5</p>
      <h1 className="mt-1 text-2xl font-semibold">Pick a username</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        3–20 characters: letters, numbers, and underscores. Shown publicly only if you allow it in the
        next step.
      </p>

      <form action={saveUsername} className="mt-6 space-y-4">
        <input
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          placeholder="your_username"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}
        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
