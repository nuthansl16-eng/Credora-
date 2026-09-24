"use client";

import { useState } from "react";

export default function ReportPage() {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "other", reason }) });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { setError(data?.error ?? "Could not submit report."); return; }
    setSent(true);
  }

  return <main className="mx-auto max-w-lg px-4 py-12">
    <h1 className="text-2xl font-semibold">Report a problem</h1>
    <p className="mt-2 text-sm text-muted-foreground">Use this form for abusive, deceptive, or clearly inappropriate content. Reports are reviewed by authorized administrators.</p>
    {sent ? <p className="mt-6 rounded-lg border p-4 text-sm">Report submitted. Thank you for helping keep the platform usable.</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      <textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={2000} required className="min-h-40 w-full rounded-md border p-3 text-sm" placeholder="Describe the issue…" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={loading} className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{loading ? "Submitting…" : "Submit report"}</button>
    </form>}
  </main>;
}
