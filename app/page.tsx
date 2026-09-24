import Link from "next/link";
import { appConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { TiltCard } from "@/components/tilt-card";

interface LandingScore {
  lifetime_points: number | string | null;
  current_rank: number | null;
}

interface LandingReligion {
  name: string | null;
  slug: string | null;
  sacred_symbol: string | null;
  religion_scores: LandingScore[] | null;
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: topThree } = await supabase
    .from("religions")
    .select("name, slug, symbol_image_url, sacred_symbol, sacred_symbol_label, religion_scores ( lifetime_points, current_rank )")
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("current_rank", { foreignTable: "religion_scores", ascending: true, nullsFirst: false })
    .limit(3);

  const rows = (topThree as LandingReligion[] | null ?? []);

  return (
    <main>
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{appConfig.name}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{appConfig.tagline}</p>
        <p className="mt-2 text-sm text-muted-foreground">{appConfig.integrityPhrase}</p>

        <div className="mt-8 flex justify-center gap-3">
          <Link href="/leaderboard" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-white">
            View the leaderboard
          </Link>
          <Link href="/signup" className="rounded-md border px-6 py-3 text-sm font-medium">
            Create an account
          </Link>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-24">
          <h2 className="text-center text-lg font-semibold text-muted-foreground">Currently leading</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rows.map((r) => (
              <li key={r.slug ?? r.name ?? "unknown"}>
                <TiltCard className="cr-leader-card rounded-lg border">
                  <div className="p-4 text-center">
                    <div className="cr-mini-symbol mx-auto mb-2">{r.sacred_symbol ?? "✦"}</div>
                    <p className="text-2xl font-semibold">#{r.religion_scores?.[0]?.current_rank ?? "—"}</p>
                    <Link href={`/religions/${r.slug}`} className="mt-1 block font-medium hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {Number(r.religion_scores?.[0]?.lifetime_points ?? 0).toLocaleString()} pts
                    </p>
                  </div>
                </TiltCard>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t px-4 py-8 text-center text-xs text-muted-foreground">
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/charity">Charity &amp; Transparency</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/refunds">Refunds</Link>
          <Link href="/legal/acceptable-use">Acceptable Use</Link>
          <Link href="/legal/integrity">Leaderboard Integrity</Link>
        </nav>
      </footer>
    </main>
  );
}
