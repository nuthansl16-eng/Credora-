import { createClient } from "@/lib/supabase/server";

export default async function ContributionsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("point_transactions")
    .select("id, points, transaction_type, status, created_at, religions ( name, slug )")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Contribution History</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Every entry here is a real, immutable record from your account — nothing is ever backfilled.
      </p>

      {(transactions ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No contributions yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {transactions!.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{t.religions?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.transaction_type} · {new Date(t.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`tabular-nums font-semibold ${Number(t.points) < 0 ? "text-red-600" : ""}`}>
                {Number(t.points) > 0 ? "+" : ""}
                {Number(t.points).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
