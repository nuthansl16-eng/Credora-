"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; } }

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const params = useParams<{ purchaseId: string }>();
  const router = useRouter();
  const [state, setState] = useState<{ provider: string; amountMinorUnits: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/purchases/${params.purchaseId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (!res.ok) setError(data?.error ?? "Could not load checkout.");
        else setState({ provider: data.purchase.provider, amountMinorUnits: data.purchase.amountMinorUnits, currency: data.purchase.currency });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.purchaseId]);

  useEffect(() => {
    if (!state || state.provider !== "stripe") return;
    (async () => {
      const res = await fetch(`/api/purchases/${params.purchaseId}/checkout`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) window.location.assign(data.url);
      else setError(data?.error ?? "Could not open Stripe Checkout.");
    })();
  }, [state, params.purchaseId]);

  async function openRazorpay() {
    setError(null);
    const res = await fetch(`/api/purchases/${params.purchaseId}/checkout`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.checkoutPayload) { setError(data?.error ?? "Could not open payment checkout."); return; }
    const payload = data.checkoutPayload as { keyId: string; orderId: string; amountMinorUnits: number; currency: string };
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) { setError("Razorpay checkout could not be loaded."); return; }
    const checkout = new window.Razorpay({
      key: payload.keyId, amount: payload.amountMinorUnits, currency: payload.currency,
      order_id: payload.orderId, name: "Credora", description: "Credora points",
      handler: () => router.replace(`/payment/success?purchase=${encodeURIComponent(params.purchaseId)}`),
      modal: { ondismiss: () => setError("Payment window closed. Points are added only after provider confirmation.") },
    });
    checkout.open();
  }

  if (loading) return <main className="mx-auto max-w-md px-4 py-20 text-center"><p>Preparing secure checkout…</p></main>;
  if (error) return <main className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-sm text-red-600">{error}</p><button onClick={() => router.back()} className="mt-6 rounded-md border px-5 py-2.5 text-sm">Go back</button></main>;
  if (!state) return null;
  if (state.provider === "stripe") return <main className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-sm">Redirecting to secure Stripe Checkout…</p></main>;
  if (state.provider === "razorpay") return <main className="mx-auto max-w-md px-4 py-20 text-center"><div className="rounded-2xl border p-8 shadow-sm"><h1 className="text-xl font-semibold">Secure checkout</h1><p className="mt-2 text-sm text-muted-foreground">{(state.amountMinorUnits / 100).toFixed(2)} {state.currency}</p><button onClick={openRazorpay} className="mt-8 w-full rounded-md bg-primary py-3 text-sm font-medium text-white">Pay securely</button><p className="mt-4 text-xs text-muted-foreground">Points are credited only after server-side payment confirmation.</p></div></main>;
  return <main className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-sm text-red-600">Unknown payment provider.</p></main>;
}
