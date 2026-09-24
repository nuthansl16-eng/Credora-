"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema } from "@/lib/validation/schemas";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = (searchParams.get("ref") ?? "").trim().toLowerCase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: referralCode && /^[a-f0-9]{12}$/.test(referralCode) ? { referral_code: referralCode } : undefined,
      },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    window.localStorage.setItem("credora_verification_email", parsed.data.email);
    router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      {referralCode && /^[a-f0-9]{12}$/.test(referralCode) && (
        <p className="mt-2 rounded-md border p-3 text-sm">Referral link detected. Your friend will earn 30 points after you complete verification and choose a community.</p>
      )}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="hover:underline">Log in</Link>
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        By signing up you agree to our{" "}
        <Link href="/legal/terms" className="underline">Terms of Service</Link> and{" "}
        <Link href="/legal/privacy" className="underline">Privacy Policy</Link>. Digital points have no
        cash value and cannot be withdrawn, transferred, or resold.
      </p>
    </main>
  );
}
