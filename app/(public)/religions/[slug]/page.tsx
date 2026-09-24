import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TiltCard } from "@/components/tilt-card";

export const revalidate = 30;

async function getTop100(religionId: string) {
  // This is a public page, but the query deliberately runs server-side with
  // the service role so we can inspect privacy flags without exposing the
  // privacy table to anonymous clients. Only the final, opted-in fields are
  // rendered. The ranking itself is based on the actual top 100 verified
  // supporters, not merely the first 100 people who opted in.
  const admin = createAdminClient();
  const { data: contributions, error } = await admin
    .from("supporter_contributions")
    .select("user_id, lifetime_points, first_contribution_at")
    .eq("religion_id", religionId)
    .eq("is_verified", true)
    .order("lifetime_points", { ascending: false })
    .order("first_contribution_at", { ascending: true })
    .order("user_id", { ascending: true })
    .limit(100);

  if (error || !contributions?.length) return { rows: [], error };

  const userIds = contributions.map((row) => row.user_id);
  const [{ data: profiles }, { data: privacy }] = await Promise.all([
    admin.from("profiles").select("id, username, avatar_url, country_code").in("id", userIds),
    admin
      .from("user_privacy_settings")
      .select("user_id, public_username, public_avatar, show_points_publicly, show_country_publicly, appear_in_top_100, anonymous_display, public_profile")
      .in("user_id", userIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const privacyById = new Map((privacy ?? []).map((p) => [p.user_id, p]));

  const rows = contributions.flatMap((row) => {
    const ps = privacyById.get(row.user_id);
    if (!ps?.public_profile || !ps.appear_in_top_100 || !ps.show_points_publicly) return [];

    const profile = profileById.get(row.user_id);
    const displayName = ps.anonymous_display || !ps.public_username
      ? "Anonymous Supporter"
      : profile?.username ?? "Anonymous Supporter";

    return [{
      user_id: row.user_id,
      lifetime_points: row.lifetime_points,
      display_name: displayName,
      avatar_url: ps.public_avatar ? profile?.avatar_url ?? null : null,
      country_code: ps.show_country_publicly ? profile?.country_code ?? null : null,
    }];
  });

  return { rows, error: null };
}

export default async function ReligionProfilePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: religion } = await supabase
    .from("religions")
    .select(
      `id, slug, name, description, short_description, symbol_image_url, sacred_symbol, sacred_symbol_label,
       religion_scores ( lifetime_points, verified_supporter_count, current_rank, last_updated_at )`
    )
    .eq("slug", params.slug)
    .eq("is_active", true)
    .eq("is_approved", true)
    .single();

  if (!religion) notFound();

  const score = religion.religion_scores?.[0];
  const { rows: supporters } = await getTop100(religion.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <TiltCard className="cr-hero-card rounded-3xl border p-6">
        <div className="flex items-center gap-4">
          <div className="cr-symbol-orb" aria-label={religion.sacred_symbol_label ?? `${religion.name} traditional symbol`}>
            {religion.sacred_symbol ? <span>{religion.sacred_symbol}</span> : religion.symbol_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={religion.symbol_image_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : <span aria-hidden="true">✦</span>}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{religion.name}</h1>
          <p className="text-sm text-muted-foreground">
            Global rank #{score?.current_rank ?? "—"} · {(score?.lifetime_points ?? 0).toLocaleString()} pts ·{" "}
            {(score?.verified_supporter_count ?? 0).toLocaleString()} verified supporters
          </p>
          {religion.sacred_symbol_label && <p className="mt-1 text-xs text-muted-foreground">{religion.sacred_symbol_label}</p>}
          </div>
        </div>
      </TiltCard>

      {religion.short_description && <p className="mt-6 text-muted-foreground">{religion.short_description}</p>}
      {religion.description && <p className="mt-4 whitespace-pre-line text-sm">{religion.description}</p>}

      <Link
        href={`/support/${religion.slug}`}
        className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white"
      >
        Support this community
      </Link>

      <section className="mt-10 cr-depth-section">
        <h2 className="text-lg font-semibold">Top 100 Supporters</h2>
        <p className="text-xs text-muted-foreground">
          Ranked by verified lifetime points. Supporters who opted out of public display are not shown.
        </p>

        {supporters.length === 0 ? (
          <p className="mt-6 rounded-md border p-6 text-center text-sm text-muted-foreground">
            No public supporters yet. Be the first to appear here.
          </p>
        ) : (
          <ol className="mt-4 divide-y rounded-lg border">
            {supporters.map((s, i) => (
              <li key={s.user_id} className="cr-row flex items-center gap-4 p-3 text-sm">
                <span className="w-8 text-right text-muted-foreground">{i + 1}</span>
                <span className="flex-1 font-medium">
                  {s.display_name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Number(s.lifetime_points).toLocaleString()} pts
                </span>
              </li>
            ))}
          </ol>
        )}

        {supporters.length === 100 && (
          <p className="mt-2 text-xs text-muted-foreground">Showing the top 100. Rankings beyond this are not displayed.</p>
        )}
      </section>
    </main>
  );
}
