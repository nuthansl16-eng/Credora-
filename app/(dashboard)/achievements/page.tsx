import { createClient } from "@/lib/supabase/server";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: earned } = await supabase
    .from("user_achievements")
    .select("earned_at, achievements ( code, name, description ), religions ( name )")
    .eq("user_id", user!.id)
    .order("earned_at", { ascending: false });

  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("code, name, description")
    .eq("is_active", true);

  const earnedCodes = new Set((earned ?? []).map((e) => e.achievements?.code));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Achievements</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Earned only from real activity — never granted for anything else.
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(allAchievements ?? []).map((a) => (
          <li key={a.code} className={`rounded-lg border p-4 text-sm ${earnedCodes.has(a.code) ? "" : "opacity-40"}`}>
            <p className="font-medium">{a.name}</p>
            <p className="text-xs text-muted-foreground">{a.description}</p>
            <p className="mt-1 text-xs">{earnedCodes.has(a.code) ? "Earned" : "Not yet earned"}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
