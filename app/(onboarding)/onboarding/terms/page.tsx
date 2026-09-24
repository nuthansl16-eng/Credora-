import { acceptTermsAndFinish } from "../../actions";
import Link from "next/link";

export default function OnboardingTermsPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 5 of 5</p>
      <h1 className="mt-1 text-2xl font-semibold">Last step</h1>

      <div className="mt-4 rounded-md border p-4 text-sm text-muted-foreground">
        <p>By continuing, you confirm you understand that:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Digital points have no cash value and cannot be withdrawn, transferred, or resold</li>
          <li>This is not gambling, an investment, or a donation-processing service</li>
          <li>
            You&apos;ve read our{" "}
            <Link href="/legal/terms" className="underline" target="_blank">Terms of Service</Link> and{" "}
            <Link href="/legal/privacy" className="underline" target="_blank">Privacy Policy</Link>
          </li>
        </ul>
      </div>

      <form action={acceptTermsAndFinish} className="mt-6">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-1 h-4 w-4" />
          I agree to the Terms of Service and Privacy Policy
        </label>
        <button type="submit" className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white">
          Finish and go to dashboard
        </button>
      </form>
    </main>
  );
}
