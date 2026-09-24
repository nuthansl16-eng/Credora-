import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUSES = ["pending", "succeeded", "failed", "cancelled", "expired", "refunded"] as const;

export default async function AdminPurchasesPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("purchases")
    .select("id, user_id, religion_id, currency, amount_minor_units, points_granted, status, payment_provider, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (searchParams.status && (STATUSES as readonly string[]).includes(searchParams.status)) {
    query = query.eq("status", searchParams.status);
  }
  const { data: purchases } = await query;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Purchases</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/admin/purchases" className={`rounded-md border px-3 py-1.5 text-xs ${!searchParams.status ? "border-primary text-primary" : ""}`}>
          All
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/admin/purchases?status=${s}`}
            className={`rounded-md border px-3 py-1.5 text-xs capitalize ${searchParams.status === s ? "border-primary text-primary" : ""}`}
          >
            {s}
          </a>
        ))}
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Time</th>
            <th className="py-2">User</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Points</th>
            <th className="py-2">Provider</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(purchases ?? []).map((p) => (
            <tr key={p.id}>
              <td className="py-2">{new Date(p.created_at).toLocaleString()}</td>
              <td className="py-2 font-mono text-xs">{p.user_id.slice(0, 8)}…</td>
              <td className="py-2">
                {(p.amount_minor_units / 100).toFixed(2)} {p.currency}
              </td>
              <td className="py-2 tabular-nums">{Number(p.points_granted).toLocaleString()}</td>
              <td className="py-2">{p.payment_provider}</td>
              <td className="py-2 capitalize">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
