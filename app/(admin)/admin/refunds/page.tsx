import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { processRefund } from "./actions";

export default async function AdminRefundsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: succeededPurchases } = await admin
    .from("purchases")
    .select("id, user_id, currency, amount_minor_units, points_granted, created_at")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Refunds / Reversals</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Reversing a purchase removes its points via an immutable ledger entry — history is never edited
        or deleted, only appended to. A reason is required and is permanently audit-logged.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Purchase</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Points</th>
            <th className="py-2">Reason</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(succeededPurchases ?? []).map((p) => (
            <tr key={p.id}>
              <td className="py-2 font-mono text-xs">{p.id.slice(0, 8)}…</td>
              <td className="py-2">
                {(p.amount_minor_units / 100).toFixed(2)} {p.currency}
              </td>
              <td className="py-2 tabular-nums">{Number(p.points_granted).toLocaleString()}</td>
              <td className="py-2">
                <form action={processRefund} className="flex items-center gap-2">
                  <input type="hidden" name="purchaseId" value={p.id} />
                  <input
                    name="reason"
                    required
                    minLength={10}
                    placeholder="Reason (min 10 chars)"
                    className="w-56 rounded-md border px-2 py-1 text-xs"
                  />
                  <button className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700">
                    Reverse
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
