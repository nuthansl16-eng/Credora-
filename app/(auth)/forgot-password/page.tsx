"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Please enter a valid email.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Always show the same message, whether or not the email exists,
    // to avoid leaking which emails are registered.
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <p className="mt-6 text-sm text-muted-foreground">
          If an account exists for that email, a password reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
            Send reset link
          </button>
        </form>
      )}
    </main>
  );
}
