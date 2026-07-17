import type { ValuationContext, ValuationResult } from "@/lib/auctionos/core/template";

// JCC's one deterministic captain-valuation rule (AUCTIONOS.md's Captain
// Module): a captain's value IS 50% of the highest qualifying purchase
// made by the captain's own team inside the captain's own category — not
// an advisory suggestion, and not derived from player stats (strike rate/
// economy) the way an earlier draft of this file did. `highestQualifying
// Purchase` is computed by the engine (the SQL RPCs' `_auctionos_recalc_
// captain_valuation`, and read-side by whatever queries `player_purchases`
// for a wallet+category) — this function only applies the 50% rule to
// whatever number it's handed, so the formula lives in exactly one place.
export function computeJccCaptainValue({ highestQualifyingPurchase }: ValuationContext): ValuationResult {
  return {
    captainValue: highestQualifyingPurchase == null ? null : highestQualifyingPurchase * 0.5,
    rationale: { highestQualifyingPurchase },
  };
}
