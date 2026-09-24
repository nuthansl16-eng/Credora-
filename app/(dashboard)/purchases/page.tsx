import { createClient } from "@/lib/supabase/server";

export default async function PurchaseHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("id, currency, amount_minor_units, points_granted, status, payment_provider, created_at, religions ( name )")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Purchase History</h1>

      {(purchases ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No purchases yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {purchases!.map((p: any) => (
            <li key={p.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{p.religions?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()} · {p.payment_provider}
                  {p.payment_provider === "mock" && " (development only)"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {(p.amount_minor_units / 100).toFixed(2)} {p.currency}
                </p>
                <p className="text-xs capitalize text-muted-foreground">{p.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
