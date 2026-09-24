import { requestAccountDeletion } from "../actions";

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold text-red-700">Delete your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This immediately removes your username, avatar, and country from your profile and hides you
        from every public list, regardless of your current privacy settings. Your purchase and point
        history are kept in anonymized form for accounting and fraud-prevention records, as required
        by law — this does not restore your points to a leaderboard or make points transferable.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        This action cannot be undone from the app. You'll be signed out immediately.
      </p>

      <form action={requestAccountDeletion} className="mt-6 space-y-3">
        <label className="text-sm font-medium">
          Type <span className="font-mono">DELETE MY ACCOUNT</span> to confirm
        </label>
        <input name="confirmationPhrase" required className="w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-md bg-red-600 py-2.5 text-sm font-medium text-white">
          Permanently delete my account
        </button>
      </form>
    </main>
  );
}
