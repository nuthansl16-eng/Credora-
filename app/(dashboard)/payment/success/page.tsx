"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");
  const [status, setStatus] = useState<"loading" | "succeeded" | "pending" | "failed">("loading");

  useEffect(() => {
    if (!purchaseId) { setStatus("failed"); return; }
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      const res = await fetch(`/api/purchases/${purchaseId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const next = data?.purchase?.status;
      if (cancelled) return;
      if (next === "succeeded") setStatus("succeeded");
      else if (["failed", "cancelled", "expired", "refunded"].includes(next)) setStatus("failed");
      else if (attempts++ < 10) { setStatus("pending"); window.setTimeout(check, 1500); }
      else setStatus("pending");
    };
    check();
    return () => { cancelled = true; };
  }, [purchaseId]);

  if (status === "loading" || status === "pending") return <main className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold">Payment received</h1><p className="mt-2 text-sm text-muted-foreground">We are waiting for secure server-side confirmation from the payment provider. Your points are added only after that confirmation.</p><Link href="/dashboard" className="mt-6 inline-block rounded-md border px-5 py-2.5 text-sm">Go to dashboard</Link></main>;
  if (status === "failed") return <main className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold text-red-700">Payment not completed</h1><p className="mt-2 text-sm text-muted-foreground">No points were added for an unconfirmed transaction.</p><Link href="/dashboard" className="mt-6 inline-block rounded-md border px-5 py-2.5 text-sm">Back to dashboard</Link></main>;
  return <main className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-2xl font-semibold text-green-700">Payment confirmed</h1><p className="mt-2 text-sm text-muted-foreground">Your points have been added to the leaderboard.</p><Link href="/dashboard" className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white">Go to dashboard</Link></main>;
}
