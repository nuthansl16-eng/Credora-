import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCharityAllocation, updateCharityStatus } from "./actions";

export default async function AdminCharityPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: allocations } = await admin
    .from("charity_allocations")
    .select("*")
    .order("reporting_period_start", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Charity Allocations</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Only entries with status &quot;allocated&quot; or &quot;paid&quot; appear on the public Charity & Transparency page.
        Never record a projected or estimated figure here — only actual eligible revenue and allocations.
      </p>

      <details className="mt-6 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">+ Record a new allocation</summary>
        <form action={createCharityAllocation} className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs">
            Period start
            <input type="date" name="reportingPeriodStart" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs">
            Period end
            <input type="date" name="reportingPeriodEnd" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <input name="eligibleRevenueMinorUnits" type="number" placeholder="Eligible revenue (minor units)" required className="rounded-md border px-3 py-2 text-sm" />
          <input name="currency" placeholder="Currency (e.g. USD)" required maxLength={3} className="rounded-md border px-3 py-2 text-sm" />
          <input name="allocationPercentage" type="number" step="0.01" placeholder="Allocation %" required className="rounded-md border px-3 py-2 text-sm" />
          <input name="recipientOrganization" placeholder="Recipient organization" required className="rounded-md border px-3 py-2 text-sm" />
          <textarea name="notes" placeholder="Notes" className="col-span-2 rounded-md border px-3 py-2 text-sm" rows={2} />
          <button type="submit" className="col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
            Record allocation (status: pending)
          </button>
        </form>
      </details>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Period</th>
            <th className="py-2">Recipient</th>
            <th className="py-2">Allocated</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(allocations ?? []).map((a) => (
            <tr key={a.id}>
              <td className="py-2">
                {a.reporting_period_start} → {a.reporting_period_end}
              </td>
              <td className="py-2">{a.recipient_organization}</td>
              <td className="py-2">
                {(a.allocated_amount_minor_units / 100).toFixed(2)} {a.currency}
              </td>
              <td className="py-2 capitalize">{a.status}</td>
              <td className="py-2">
                {a.status !== "paid" && a.status !== "cancelled" && (
                  <form
                    action={async () => {
                      "use server";
                      const next = a.status === "pending" ? "allocated" : "paid";
                      await updateCharityStatus(a.id, next);
                    }}
                  >
                    <button className="text-xs font-medium text-primary underline">
                      Mark {a.status === "pending" ? "allocated" : "paid"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
