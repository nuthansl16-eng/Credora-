import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already guards this route

  const { data: contributions } = await supabase
    .from("supporter_contributions")
    .select("religion_id, lifetime_points, contribution_count, religions ( name, slug )")
    .eq("user_id", user.id)
    .order("lifetime_points", { ascending: false });

  const { data: achievements } = await supabase
    .from("user_achievements")
    .select("earned_at, achievements ( name, description )")
    .eq("user_id", user.id)
    .order("earned_at", { ascending: false });

  const totalPoints = (contributions ?? []).reduce((sum, c) => sum + Number(c.lifetime_points), 0);

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  const { data: referrals } = await supabase
    .from("referrals")
    .select("status")
    .eq("referrer_user_id", user.id);

  const rewardedReferrals = (referrals ?? []).filter((r) => r.status === "rewarded").length;
  const { data: purchaseReferralRewards } = await supabase
    .from("referral_purchase_rewards")
    .select("reward_points, status")
    .eq("referrer_user_id", user.id);
  const purchaseReferralPoints = (purchaseReferralRewards ?? [])
    .filter((r: any) => r.status === "rewarded")
    .reduce((sum, r) => sum + Number(r.reward_points), 0);
  const referralCode = profile?.referral_code ?? "";
  const referralLink = referralCode ? `/signup?ref=${encodeURIComponent(referralCode)}` : "/signup";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Your dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total lifetime points</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Communities supported</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{(contributions ?? []).length}</p>
        </div>
      </div>

      <section className="mt-8 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Refer & earn</h2>
        <p className="mt-2 text-sm text-muted-foreground">Invite a friend. When they verify their email and choose a community, you earn 30 points.</p>
        <div className="mt-4 rounded-md bg-muted p-3 font-mono text-xs break-all">{typeof window === "undefined" ? referralLink : referralLink}</div>
        <p className="mt-2 text-xs text-muted-foreground">Successful referrals: {rewardedReferrals} · Signup rewards: {(rewardedReferrals * 30).toLocaleString()} pts</p>
        <p className="mt-1 text-xs text-muted-foreground">Purchase rewards: {purchaseReferralPoints.toLocaleString()} pts · You earn 10% of points purchased by your referred users.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your contributions</h2>
        {(contributions ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You haven't supported a community yet. <Link href="/leaderboard" className="underline">Browse the leaderboard</Link>.
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border">
            {contributions!.map((c) => (
              <li key={c.religion_id} className="flex items-center justify-between p-4 text-sm">
                <Link href={`/religions/${c.religions.slug}`} className="font-medium hover:underline">
                  {c.religions.name}
                </Link>
                <span className="tabular-nums">{Number(c.lifetime_points).toLocaleString()} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Achievements</h2>
        {(achievements ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No achievements earned yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {achievements!.map((a, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{a.achievements.name}</p>
                <p className="text-xs text-muted-foreground">{a.achievements.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
