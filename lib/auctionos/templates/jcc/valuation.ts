import type { ValuationContext, ValuationResult } from "@/lib/auctionos/core/template";

// Regular-category captains don't get a purchase-derived value at all —
// they're hard-coded at ₹1 Cr (100 lakhs), same units as everything else
// in this template (see rules.ts). Only MVP captains still use the 50%-of-
// highest-qualifying-purchase rule below.
const REGULAR_CAPTAIN_VALUE_LAKHS = 100;

// JCC's captain-valuation rule (AUCTIONOS.md's Captain Module) now branches
// by category: MVP captains' value IS 50% of the highest qualifying
// purchase made by the captain's own team inside the captain's own
// category — not an advisory suggestion, and not derived from player stats
// (strike rate/economy) the way an earlier draft of this file did. Regular
// captains bypass that formula entirely and get the flat
// REGULAR_CAPTAIN_VALUE_LAKHS above. `highestQualifyingPurchase` is
// computed by the engine (the SQL RPCs' `_auctionos_recalc_captain_
// valuation`, and read-side by whatever queries `player_purchases` for a
// wallet+category) — this function only applies the per-category rule to
// whatever number it's handed, so each formula lives in exactly one place.
export function computeJccCaptainValue({ category, highestQualifyingPurchase }: ValuationContext): ValuationResult {
  if (/regular/i.test(category.name)) {
    return {
      captainValue: REGULAR_CAPTAIN_VALUE_LAKHS,
      rationale: { rule: "regular-flat", value: REGULAR_CAPTAIN_VALUE_LAKHS },
    };
  }
  return {
    captainValue: highestQualifyingPurchase == null ? null : highestQualifyingPurchase * 0.5,
    rationale: { rule: "mvp-half-highest", highestQualifyingPurchase },
  };
}
