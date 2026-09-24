import { appConfig } from "@/lib/config";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm">
      <h1 className="text-2xl font-semibold">About {appConfig.name}</h1>
      <p className="mt-4">
        {appConfig.name} is a permanent, global leaderboard for religions and communities. Registered
        users may select a community and purchase non-transferable digital points; once a payment is
        verified, those points are permanently added to that community&apos;s lifetime score.
      </p>
      <p className="mt-4">{appConfig.integrityPhrase}</p>

      <h2 className="mt-8 text-lg font-semibold">What this is not</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
        <li>Not gambling, betting, or a lottery</li>
        <li>Not an investment product or financial service</li>
        <li>Not a money-transfer service</li>
        <li>Not a religious donation processor</li>
        <li>Does not promise any financial return</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">What digital points are</h2>
      <p className="mt-2 text-muted-foreground">
        Points have no cash value, cannot be withdrawn, transferred, or resold, and never expire. They
        exist solely to affect a community&apos;s position on our internal, permanent leaderboard.
      </p>

      <p className="mt-8 text-xs text-muted-foreground">
        For legal specifics, see our{" "}
        <a href="/legal/terms" className="underline">Terms of Service</a> and{" "}
        <a href="/legal/integrity" className="underline">Leaderboard Integrity Policy</a>.
      </p>
    </main>
  );
}
