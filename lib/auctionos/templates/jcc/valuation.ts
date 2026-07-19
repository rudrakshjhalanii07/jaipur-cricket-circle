import type { ValuationContext, ValuationResult } from "@/lib/auctionos/core/template";

// Regular-category captains don't get a purchase-derived value at all —
// they're hard-coded at ₹1 Cr (100 lakhs), same units as everything else
// in this template (see rules.ts), and it's charged up front at
// auctionos_begin_auction rather than through this function at all (see
// _auctionos_charge_regular_captains in
// supabase/add_auctionos_captain_pricing.sql). The branch below is kept for
// template-contract completeness, not because anything currently calls it
// for a Regular category. Only MVP captains still use the 50%-of-
// first-qualifying-purchase rule below.
const REGULAR_CAPTAIN_VALUE_LAKHS = 100;

// JCC's captain-valuation rule (AUCTIONOS.md's Captain Module) now branches
// by category: MVP captains' value IS 50% of their team's FIRST qualifying
// purchase inside the captain's own category — not the highest, and not
// derived from player stats (strike rate/economy) the way an earlier draft
// of this file did. Later purchases in that same category no longer
// revalue the captain at all. Regular captains bypass this formula
// entirely (see above). `highestQualifyingPurchase` (the field name is a
// holdover — it now holds whichever qualifying purchase the caller
// resolved, i.e. the first one) is computed by the engine (the SQL RPCs'
// `_auctionos_recalc_captain_valuation`) — this function only applies the
// per-category rule to whatever number it's handed, so each formula lives
// in exactly one place.
export function computeJccCaptainValue({ category, highestQualifyingPurchase }: ValuationContext): ValuationResult {
  if (/regular/i.test(category.name)) {
    return {
      captainValue: REGULAR_CAPTAIN_VALUE_LAKHS,
      rationale: { rule: "regular-flat", value: REGULAR_CAPTAIN_VALUE_LAKHS },
    };
  }
  return {
    captainValue: highestQualifyingPurchase == null ? null : highestQualifyingPurchase * 0.5,
    rationale: { rule: "mvp-half-first", firstQualifyingPurchase: highestQualifyingPurchase },
  };
}
