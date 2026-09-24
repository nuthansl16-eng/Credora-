const FAQS = [
  {
    q: "Do I get any free points?",
    a: "Yes. Every account receives a one-time 50-point welcome bonus. If you choose a community during onboarding, the bonus is added there. If you skip that step, your first verified purchase claims the bonus for the community you support.",
  },
  {
    q: "Do digital points have any cash value?",
    a: "No. Points have no cash value and cannot be withdrawn, transferred, resold, or exchanged for goods, services, prizes, or money.",
  },
  {
    q: "Is this gambling or an investment?",
    a: "No. There is no chance-based outcome and no promise of financial return. Purchasing points simply adds a fixed, pre-disclosed number of points to your chosen community's leaderboard score.",
  },
  {
    q: "Can I get a refund?",
    a: "Purchases are generally final once points are credited, with narrow exceptions (duplicate charges, provider-reported chargebacks, confirmed fraud, or legal requirement). See our Refund Policy.",
  },
  {
    q: "Who can see that I support a community?",
    a: "Nobody, by default. Your religion/community affiliation is treated as sensitive personal information. You control exactly what's shown — including an anonymous-display option — in Settings → Privacy.",
  },
  {
    q: "How is the leaderboard ordered?",
    a: "By lifetime points, descending, including legitimate one-time welcome bonuses, with a deterministic tie-breaker. We never use random ordering or fabricated activity.",
  },
  {
    q: "What happens to my data if I delete my account?",
    a: "Your username, avatar, and country are anonymized immediately and you're removed from all public listings. Financial/point records are kept in anonymized form for accounting and fraud-prevention purposes, as required by law.",
  },
  {
    q: "Does every purchase go to charity?",
    a: "No — see our Charity & Transparency page. A disclosed percentage of eligible platform revenue, not each individual purchase, is allocated to charitable initiatives over each reporting period.",
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Frequently Asked Questions</h1>
      <div className="mt-6 space-y-6">
        {FAQS.map((f, i) => (
          <div key={i}>
            <h2 className="font-medium">{f.q}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
          </div>
        ))}
      </div>
    <section className="mt-8"><h2 className="text-lg font-semibold">Referral rewards</h2><p className="mt-2 text-sm text-muted-foreground">You can invite friends with your referral link. When a referred user verifies their email and completes community selection, you earn 30 promotional points. Each referred account can trigger only one signup reward. After that, you also earn 10% of the points on every successfully paid purchase made by that referred user. Referral purchase rewards are rounded down to whole points and are reversed if the underlying purchase is refunded or charged back.</p></section>
    </main>
  );
}
