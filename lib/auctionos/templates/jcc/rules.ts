// Pure domain logic for the JCC player auction template. No I/O.
// Money throughout is stored/passed as an integer number of lakhs (IPL-style),
// e.g. 2000 = ₹20 Cr, 50 = ₹50 L. formatLakhs() renders it for display.
//
// This is the one place JCC's currency/increment/eligibility rules live —
// the generic engine (lib/auctionos/core, supabase/add_auctionos.sql) never
// sees a lakh or a purse.

import type {
  BidValidationContext,
  BidValidationResult,
  BidIncrementTier,
} from "@/lib/auctionos/core/template";

export const DEFAULT_PURSE_LAKHS = 2000; // ₹20 Cr per team

export const BASE_PRICE_TIERS_LAKHS = [20, 30, 50, 75, 100] as const;

// Real-auction-style step-up: small increments early, larger ones as the
// price climbs, so bidding doesn't crawl once a lot gets expensive. This is
// the single declarative source of truth — getNextBidIncrement derives from
// it rather than duplicating the thresholds in an if/else chain, so the
// tier ladder shown in any future admin UI can never drift from what
// actually gets applied.
export const BID_INCREMENT_TIERS: BidIncrementTier[] = [
  { upTo: 100, amount: 5 },
  { upTo: 200, amount: 10 },
  { upTo: null, amount: 20 },
];

export function getNextBidIncrement(currentBid: number): number {
  const tier = BID_INCREMENT_TIERS.find((t) => t.upTo === null || currentBid < t.upTo);
  return (tier ?? BID_INCREMENT_TIERS[BID_INCREMENT_TIERS.length - 1]).amount;
}

export function getNextBid(currentBid: number): number {
  return currentBid + getNextBidIncrement(currentBid);
}

// ₹20 Cr in lakhs is 2000; render as "₹20.00 Cr" above 100L, "₹85 L" below.
export function formatLakhs(lakhs: number): string {
  if (lakhs >= 100) {
    const crores = lakhs / 100;
    const isWhole = Number.isInteger(crores);
    return `₹${isWhole ? crores : crores.toFixed(2)} Cr`;
  }
  return `₹${lakhs} L`;
}

export function validateJccBid(ctx: BidValidationContext): BidValidationResult {
  if (ctx.wallet.budget_remaining < ctx.proposedAmount) {
    return { ok: false, reason: "Team cannot afford this bid" };
  }
  return { ok: true };
}
