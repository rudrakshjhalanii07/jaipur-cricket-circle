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

export const DEFAULT_PURSE_LAKHS = 1400; // ₹14 Cr per team — Wallet A (MVP + Regular)
export const DEFAULT_GUEST_PURSE_LAKHS = 500; // ₹5 Cr per team — Wallet B (Guest Players)

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

// Inverse of formatLakhs(), for every organizer-facing money input (wallet
// balances, base prices, bid increments, CSV import) so nobody has to type
// or read a raw lakh integer. "20cr"/"20 Cr"/"20crore" -> 2000 (lakhs);
// "50l"/"50L"/"50lakh(s)" -> 50; a bare number ("2000") is already lakhs,
// matching this module's existing storage convention. Strips commas/₹/$ so
// pasted spreadsheet values ("₹1,20,000") and CSV cells work the same way.
// Returns null for anything unparseable — callers treat that as a
// validation error rather than silently coercing to 0/NaN.
const CRORE_SUFFIX = /^(cr|crore|crores)$/i;
const LAKH_SUFFIX = /^(l|lakh|lakhs|lac|lacs)$/i;

export function parseMoneyLakhs(input: string): number | null {
  const cleaned = input.trim().replace(/[,₹$]/g, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([a-zA-Z]*)$/);
  if (!match) return null;
  const [, numberPart, suffix] = match;
  const value = Number(numberPart);
  if (!Number.isFinite(value)) return null;
  if (!suffix || LAKH_SUFFIX.test(suffix)) return Math.round(value);
  if (CRORE_SUFFIX.test(suffix)) return Math.round(value * 100);
  return null;
}

export function validateJccBid(ctx: BidValidationContext): BidValidationResult {
  if (ctx.wallet.budget_remaining < ctx.proposedAmount) {
    return { ok: false, reason: "Team cannot afford this bid" };
  }
  return { ok: true };
}
