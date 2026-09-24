import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminLedgerPage() {
  await requireAdmin(); // throws (-> error boundary) if caller is not an admin

  const admin = createAdminClient();
  const { data: transactions } = await admin
    .from("point_transactions")
    .select("id, user_id, religion_id, points, transaction_type, status, created_at, reason")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Point Ledger</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Append-only. Most recent 100 transactions across all users and communities.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Time</th>
            <th className="py-2">User</th>
            <th className="py-2">Religion</th>
            <th className="py-2">Type</th>
            <th className="py-2">Points</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(transactions ?? []).map((t) => (
            <tr key={t.id}>
              <td className="py-2">{new Date(t.created_at).toLocaleString()}</td>
              <td className="py-2 font-mono text-xs">{t.user_id.slice(0, 8)}…</td>
              <td className="py-2 font-mono text-xs">{t.religion_id.slice(0, 8)}…</td>
              <td className="py-2">{t.transaction_type}</td>
              <td className="py-2 tabular-nums">{Number(t.points).toLocaleString()}</td>
              <td className="py-2">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
