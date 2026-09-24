import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPricingPackage, togglePricingPackage } from "./actions";

export default async function AdminPricingPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: packages } = await admin
    .from("pricing_packages")
    .select("*")
    .order("region_code")
    .order("amount_minor_units");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Pricing Packages</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        The frontend never decides points-per-currency — every purchase looks up the package server-side
        from this table at the moment of purchase, and snapshots it onto the purchase record.
      </p>

      <details className="mt-6 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">+ Add a new package</summary>
        <form action={createPricingPackage} className="mt-4 grid grid-cols-2 gap-3">
          <input name="regionCode" placeholder="Region code (e.g. US)" required maxLength={2} className="rounded-md border px-3 py-2 text-sm" />
          <input name="currency" placeholder="Currency (e.g. USD)" required maxLength={3} className="rounded-md border px-3 py-2 text-sm" />
          <input name="amountMinorUnits" type="number" placeholder="Amount in minor units (e.g. 999 = $9.99)" required className="rounded-md border px-3 py-2 text-sm" />
          <input name="pointsGranted" type="number" placeholder="Points granted" required className="rounded-md border px-3 py-2 text-sm" />
          <input name="displayName" placeholder="Display name" required className="col-span-2 rounded-md border px-3 py-2 text-sm" />
          <button type="submit" className="col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
            Create package
          </button>
        </form>
      </details>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Region</th>
            <th className="py-2">Display name</th>
            <th className="py-2">Points</th>
            <th className="py-2">Active</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(packages ?? []).map((p) => (
            <tr key={p.id}>
              <td className="py-2">{p.region_code}</td>
              <td className="py-2">{p.display_name}</td>
              <td className="py-2 tabular-nums">{Number(p.points_granted).toLocaleString()}</td>
              <td className="py-2">{p.is_active ? "Yes" : "No"}</td>
              <td className="py-2">
                <form
                  action={async () => {
                    "use server";
                    await togglePricingPackage(p.id, !p.is_active);
                  }}
                >
                  <button className="text-xs font-medium text-primary underline">
                    {p.is_active ? "Deactivate" : "Activate"}
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
