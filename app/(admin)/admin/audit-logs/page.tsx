import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAuditLogsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("admin_actions")
    .select("id, admin_id, action_type, target_table, target_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Every admin action that changes points, scores, religions, users, or pricing is recorded here,
        immutably, with the reason given at the time.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Time</th>
            <th className="py-2">Admin</th>
            <th className="py-2">Action</th>
            <th className="py-2">Target</th>
            <th className="py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(logs ?? []).map((l) => (
            <tr key={l.id}>
              <td className="py-2">{new Date(l.created_at).toLocaleString()}</td>
              <td className="py-2 font-mono text-xs">{l.admin_id.slice(0, 8)}…</td>
              <td className="py-2">{l.action_type}</td>
              <td className="py-2 font-mono text-xs">
                {l.target_table}/{l.target_id?.slice(0, 8) ?? "—"}
              </td>
              <td className="py-2">{l.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
