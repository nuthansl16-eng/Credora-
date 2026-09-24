import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminHomePage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ count: userCount }, { count: religionCount }, { count: pendingPurchases }, { count: succeededPurchases }] =
    await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("religions").select("*", { count: "exact", head: true }).eq("is_approved", true),
      admin.from("purchases").select("*", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("purchases").select("*", { count: "exact", head: true }).eq("status", "succeeded"),
    ]);

  const links = [
    { href: "/admin/religions", label: "Religions / Communities" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/purchases", label: "Purchases" },
    { href: "/admin/ledger", label: "Point Ledger" },
    { href: "/admin/refunds", label: "Refunds / Reversals" },
    { href: "/admin/pricing", label: "Pricing Packages" },
    { href: "/admin/reconciliation", label: "Leaderboard Reconciliation" },
    { href: "/admin/charity", label: "Charity Allocations" },
    { href: "/admin/audit-logs", label: "Audit Logs" },
    { href: "/admin/settings", label: "Platform Settings" },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Users" value={userCount ?? 0} />
        <Stat label="Approved communities" value={religionCount ?? 0} />
        <Stat label="Pending purchases" value={pendingPurchases ?? 0} />
        <Stat label="Succeeded purchases" value={succeededPurchases ?? 0} />
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block rounded-lg border p-4 text-sm font-medium hover:border-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
