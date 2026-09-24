import { saveRegion } from "../../actions";
import { appConfig } from "@/lib/config";

const REGIONS = appConfig.supportedRegions;
const REGION_LABELS: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AE: "United Arab Emirates",
};

export default function OnboardingRegionPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1 of 5</p>
      <h1 className="mt-1 text-2xl font-semibold">Where are you joining from?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This sets your currency for support packages. You can support any community regardless of region.
      </p>

      <form action={saveRegion} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Country / region</label>
          <select
            name="regionCode"
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
