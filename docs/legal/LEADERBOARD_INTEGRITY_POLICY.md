# Leaderboard Integrity Policy (DRAFT TEMPLATE — REQUIRES LAWYER REVIEW)

We commit to the following rules for how the leaderboard is computed
and corrected:

1. **Points come only from verified sources.** A point is added to a
   community's score only after a real purchase is verified through
   our payment provider's webhook with a valid cryptographic signature.
2. **No artificial scores.** We never inject points to make a
   community look more or less popular than its real supporters have
   made it.
3. **Deterministic ranking.** Ties are always broken the same way
   (currently: religion ID as a stable sort key). We never use random
   ordering.
4. **Append-only history.** Every point change — including refunds and
   admin corrections — is recorded permanently in our internal ledger.
   Nothing is silently edited or deleted.
5. **Admin corrections are exceptional and audited.** Any manual
   correction requires a documented reason and is logged in our audit
   trail, viewable internally by our compliance team.
6. **Historical snapshots are real.** Historical rank/score charts are
   built only from actually recorded data, never backfilled or
   estimated.
