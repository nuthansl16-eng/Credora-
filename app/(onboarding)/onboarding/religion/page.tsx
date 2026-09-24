import { createClient } from "@/lib/supabase/server";
import { savePreferredReligion } from "../../actions";

export default async function OnboardingReligionPage() {
  const supabase = await createClient();
  const { data: religions } = await supabase
    .from("religions")
    .select("id, name, slug")
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("name");

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 of 5</p>
      <h1 className="mt-1 text-2xl font-semibold">Choose a community (optional)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose a community to personalize your dashboard and receive your one-time 50-point welcome bonus.
        You can support any community later from the leaderboard. If you skip this step, your bonus will
        be applied to the community you choose for your first verified purchase.
      </p>

      <form action={savePreferredReligion} className="mt-6 space-y-4">
        <select name="religionId" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="">
          <option value="">I&apos;ll choose later</option>
          {(religions ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
