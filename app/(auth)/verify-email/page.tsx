"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) {
      const saved = window.localStorage.getItem("credora_verification_email");
      if (saved) setEmail(saved);
    }
  }, [email]);

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\s/g, "");
    if (!normalizedEmail || !/^\d{6}$/.test(normalizedCode)) {
      setError("Enter the email address and the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: "signup",
    });
    setLoading(false);

    if (verifyError) {
      setError("That code is invalid or expired. Request a new code and try again.");
      return;
    }

    window.localStorage.removeItem("credora_verification_email");
    router.replace("/onboarding/terms");
  }

  async function resendCode() {
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email address first.");
      return;
    }

    setResending(true);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
    });
    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }
    setMessage("A new verification code has been sent. Check your inbox and spam folder.");
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a 6-digit verification code to your email. Enter it below to activate your account.
      </p>

      <form onSubmit={verifyCode} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="code" className="text-sm font-medium">Verification code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-1 w-full rounded-md border px-3 py-3 text-center text-xl tracking-[0.35em]"
            placeholder="123456"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <button
        type="button"
        onClick={resendCode}
        disabled={resending}
        className="mt-4 w-full text-sm text-primary underline disabled:opacity-50"
      >
        {resending ? "Sending…" : "Didn't receive the code? Send again"}
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:underline">Back to login</Link>
      </p>
    </main>
  );
}
