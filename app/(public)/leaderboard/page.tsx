import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/config";
import Link from "next/link";
import { TiltCard } from "@/components/tilt-card";

export const revalidate = 30; // seconds — leaderboard is near-real-time, not client-writable

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const pageSize = appConfig.pagination.leaderboardPageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Query the score table as the ranked source, then join the approved
  // community. This ensures database pagination happens after ordering by
  // score, rather than sorting only the current page in application memory.
  let query = supabase
    .from("religion_scores")
    .select(
      `religion_id, lifetime_points, verified_supporter_count, current_rank, last_updated_at,
       religions!inner ( id, slug, name, symbol_image_url, sacred_symbol, sacred_symbol_label )`,
      { count: "exact" }
    )
    .eq("religions.is_active", true)
    .eq("religions.is_approved", true)
    .order("lifetime_points", { ascending: false })
    .order("religion_id", { ascending: true });

  if (searchParams.q) {
    query = query.ilike("religions.name", `%${searchParams.q}%`);
  }

  const { data: scores, count, error } = await query.range(from, to);

  const rows = (scores ?? []).map((r: any) => {
    const religion = Array.isArray(r.religions) ? r.religions[0] : r.religions;
    return {
      id: r.religion_id,
      slug: religion?.slug,
      name: religion?.name,
      symbolUrl: religion?.symbol_image_url,
      sacredSymbol: religion?.sacred_symbol,
      sacredSymbolLabel: religion?.sacred_symbol_label,
      points: Number(r.lifetime_points ?? 0),
      supporters: r.verified_supporter_count ?? 0,
      rank: r.current_rank ?? null,
      lastUpdated: r.last_updated_at ?? null,
    };
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Global Leaderboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">{appConfig.integrityPhrase}</p>

      <form className="mt-6 flex gap-2" action="/leaderboard">
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search communities…"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button className="rounded-md border px-4 py-2 text-sm font-medium">Search</button>
      </form>

      {error && (
        <p className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Could not load the leaderboard right now. Please try again shortly.
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No communities match your search yet.
        </p>
      )}

      {!error && rows.length > 0 && (
        <ol className="mt-6 divide-y rounded-lg border">
          {rows.map((r, i) => (
            <li key={r.id}>
              <TiltCard className="cr-leader-card">
                <div className="flex items-center gap-4 p-4">
                  <span className="w-8 text-right text-sm text-muted-foreground">{r.rank ?? from + i + 1}</span>
                  <div className="cr-mini-symbol" title={r.sacredSymbolLabel ?? undefined}>
                    {r.sacredSymbol ? r.sacredSymbol : r.symbolUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.symbolUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : "✦"}
                  </div>
                  <div className="flex-1">
                    <Link href={`/religions/${r.slug}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.supporters.toLocaleString()} verified supporters
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{r.points.toLocaleString()} pts</p>
                    {r.lastUpdated && (
                      <p className="text-xs text-muted-foreground">
                        updated {new Date(r.lastUpdated).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link href={`/religions/${r.slug}`} className="text-sm font-medium text-primary hover:underline">
                    View
                  </Link>
                </div>
              </TiltCard>
            </li>
          ))}
        </ol>
      )}

      <nav className="mt-6 flex justify-between text-sm">
        <a
          href={`/leaderboard?page=${Math.max(1, page - 1)}${searchParams.q ? `&q=${searchParams.q}` : ""}`}
          className={page <= 1 ? "pointer-events-none opacity-40" : "hover:underline"}
        >
          Previous
        </a>
        <span className="text-muted-foreground">Page {page}</span>
        <a
          href={`/leaderboard?page=${page + 1}${searchParams.q ? `&q=${searchParams.q}` : ""}`}
          className={(count ?? 0) <= to + 1 ? "pointer-events-none opacity-40" : "hover:underline"}
        >
          Next
        </a>
      </nav>
    </main>
  );
}
