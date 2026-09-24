"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethodPicker } from "./payment-method-picker";
import type { PaymentMethodId } from "@/lib/payments/payment-methods";

interface Package {
  id: string;
  region_code: string;
  currency: string;
  amount_minor_units: number;
  points_granted: number;
  display_name: string;
}

export function PackagePicker({
  religionId,
  packagesByRegion,
  defaultRegion,
  isLoggedIn,
}: {
  religionId: string;
  packagesByRegion: Record<string, Package[]>;
  defaultRegion: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const regions = Object.keys(packagesByRegion);
  const [region, setRegion] = useState(regions.includes(defaultRegion) ? defaultRegion : regions[0] ?? "");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(region === "IN" ? "upi" : "card");

  async function purchase(pkg: Package) {
    if (!isLoggedIn) {
      router.push(`/login?next=/support`);
      return;
    }
    setError(null);
    setLoadingId(pkg.id);

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ religionId, pricingPackageId: pkg.id, paymentMethod }),
    });
    const data = await res.json();
    setLoadingId(null);

    if (!res.ok) {
      setError(data.error?.formErrors?.[0] ?? data.error ?? "Could not start checkout.");
      return;
    }

    const { purchaseId } = data;
    router.push(`/checkout/${purchaseId}`);
  }

  return (
    <div className="mt-6">
      {regions.length > 1 && (
        <div className="mb-4 flex gap-2">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                r === region ? "border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <PaymentMethodPicker region={region} value={paymentMethod} onChange={setPaymentMethod} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(packagesByRegion[region] ?? []).map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => purchase(pkg)}
            disabled={loadingId !== null}
            className="rounded-lg border p-4 text-left hover:border-primary disabled:opacity-50"
          >
            <p className="font-semibold">{pkg.display_name}</p>
            <p className="text-sm text-muted-foreground">{pkg.points_granted.toLocaleString()} points</p>
            {loadingId === pkg.id && <p className="mt-1 text-xs text-muted-foreground">Starting checkout…</p>}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
