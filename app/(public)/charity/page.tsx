import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/config";
import { renderLegalDoc } from "@/lib/render-legal-doc";

export default async function CharityPage() {
  const supabase = createClient();
  const { data: allocations } = await supabase
    .from("charity_allocations")
    .select("reporting_period_start, reporting_period_end, allocated_amount_minor_units, currency, recipient_organization, allocation_date, status")
    .in("status", ["allocated", "paid"])
    .order("reporting_period_start", { ascending: false });

  const html = renderLegalDoc("CHARITY_TRANSPARENCY_POLICY.md");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div dangerouslySetInnerHTML={{ __html: html }} />

      <p className="mt-4 rounded-md border bg-muted p-3 text-sm">
        Current disclosed allocation: <strong>{appConfig.charityAllocationPercentage}%</strong> of
        eligible platform revenue.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Allocation records</h2>
      {(allocations ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No allocations have been finalized yet. This page will list only real, recorded allocations —
          never projected or estimated figures.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {allocations!.map((a, i) => (
            <li key={i} className="p-4 text-sm">
              <p className="font-medium">{a.recipient_organization}</p>
              <p className="text-xs text-muted-foreground">
                {a.reporting_period_start} → {a.reporting_period_end} ·{" "}
                {(a.allocated_amount_minor_units / 100).toFixed(2)} {a.currency} · {a.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
