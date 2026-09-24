import { requireAdmin } from "@/lib/auth/require-admin";
import { appConfig } from "@/lib/config";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Platform Settings</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Most platform settings are edited in code (`lib/config.ts`) or via environment variables, kept
        out of the database so they can&apos;t be changed by a database-level compromise alone. This page is
        a read-only summary.
      </p>

      <dl className="mt-6 space-y-3 text-sm">
        <Row label="App name" value={appConfig.name} />
        <Row label="Tagline" value={appConfig.tagline} />
        <Row label="Charity allocation %" value={`${appConfig.charityAllocationPercentage}%`} />
        <Row label="Active payment provider" value={process.env.PAYMENT_PROVIDER ?? "mock"} />
        <Row label="Supported regions" value={appConfig.supportedRegions.join(", ")} />
      </dl>

      <p className="mt-8 text-xs text-muted-foreground">
        To change the payment provider, app name, theme, or charity percentage, edit{" "}
        <code>lib/config.ts</code> and/or your deployment&apos;s environment variables, then redeploy. See{" "}
        <code>docs/PAYMENT_SETUP.md</code> for switching payment providers safely.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
