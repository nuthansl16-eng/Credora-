import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

async function runReconciliation() {
  "use server";
  const { userId: adminId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("run_scheduled_maintenance");

  await admin.from("admin_actions").insert({
    admin_id: adminId,
    action_type: "MANUAL_RECONCILIATION",
    target_table: "religion_scores",
    reason: "Manual reconciliation triggered from admin dashboard",
    after_state: { ran_at: new Date().toISOString(), error: error?.message ?? null },
  });
}

export default async function AdminReconciliationPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: scores } = await admin
    .from("religion_scores")
    .select("religion_id, lifetime_points, verified_supporter_count, current_rank, last_updated_at, religions ( name )")
    .order("current_rank", { ascending: true, nullsFirst: false });

  const { data: latestSnapshot } = await admin
    .from("leaderboard_snapshots")
    .select("snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Leaderboard Reconciliation</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Recomputes ranks (points desc, id asc — deterministic, never random) and records a real
        snapshot of current standings. Safe to run any time; never fabricates data.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Last snapshot: {latestSnapshot ? new Date(latestSnapshot.snapshot_at).toLocaleString() : "never"}
      </p>

      <form action={runReconciliation} className="mt-4">
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
          Run reconciliation now
        </button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        To automate this, configure a daily scheduler (e.g. Vercel Cron) to POST to{" "}
        <code>/api/admin/reconcile</code> with header <code>x-cron-secret: &lt;CRON_SECRET&gt;</code>.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Rank</th>
            <th className="py-2">Community</th>
            <th className="py-2">Points</th>
            <th className="py-2">Supporters</th>
            <th className="py-2">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(scores ?? []).map((s) => (
            <tr key={s.religion_id}>
              <td className="py-2">{s.current_rank ?? "—"}</td>
              <td className="py-2">{s.religions?.[0]?.name}</td>
              <td className="py-2 tabular-nums">{Number(s.lifetime_points).toLocaleString()}</td>
              <td className="py-2">{s.verified_supporter_count}</td>
              <td className="py-2">{new Date(s.last_updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
