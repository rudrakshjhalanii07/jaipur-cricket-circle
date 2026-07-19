// Generic Reserve Engine — see AUCTIONOS.md's "Floor Price vs. Reserve":
// Reserve is the live, wallet-level required holdback (remaining mandatory
// slots x current base price, summed across a wallet's categories), never
// stored anywhere. It's generic enough (reads only AuctionCategory's
// min_required/base_price and a wallet's own unreversed purchase counts)
// that it isn't part of the per-template contract — every template gets
// this check for free, on top of whatever its own validateBid() enforces.

import type { AuctionCategory, AuctionWallet, AuctionCaptain } from "./types";

// A captain occupies one mandatory slot of their own category — same
// team-identity xor auction_wallets/auction_captains both carry (team_id
// for a global-teams auction, auction_team_id for a wizard-created one; see
// AUCTIONOS.md's AuctionCaptain section). No purchase/wallet-transaction
// row backs this — it's purely a +1 folded into acquiredCountByCategory
// wherever quota/reserve is computed, mirrored in
// supabase/add_auctionos_quota.sql's SQL joins.
function walletMatchesCaptainTeam(wallet: Pick<AuctionWallet, "team_id" | "auction_team_id">, captain: Pick<AuctionCaptain, "team_id" | "auction_team_id">): boolean {
  if (wallet.team_id != null && captain.team_id != null) return wallet.team_id === captain.team_id;
  if (wallet.auction_team_id != null && captain.auction_team_id != null) return wallet.auction_team_id === captain.auction_team_id;
  return false;
}

// Adds 1 per category this wallet's team captains, on top of whatever
// `base` (purchase-derived acquired counts) already has — callers building
// acquiredCountByCategory for the Reserve Engine or quota checks should run
// their purchase counts through this rather than passing the raw map.
export function withCaptainBonus(
  base: Record<string, number>,
  wallet: Pick<AuctionWallet, "team_id" | "auction_team_id">,
  captains: Pick<AuctionCaptain, "team_id" | "auction_team_id" | "category_id">[]
): Record<string, number> {
  const result = { ...base };
  for (const captain of captains) {
    if (!walletMatchesCaptainTeam(wallet, captain)) continue;
    result[captain.category_id] = (result[captain.category_id] ?? 0) + 1;
  }
  return result;
}

export interface ReserveInput {
  wallet: AuctionWallet;
  /** Every category in the auction — filtered internally to this wallet's own kind. */
  categories: AuctionCategory[];
  /** This wallet's unreversed purchase count, keyed by category_id. */
  acquiredCountByCategory: Record<string, number>;
}

// Sum, across this wallet's own categories (wallet_kind_id match), of
// (remaining mandatory slots) x (category's current base_price). A
// category that's already met its min_required contributes 0.
export function computeReserve({ wallet, categories, acquiredCountByCategory }: ReserveInput): number {
  return categories
    .filter((category) => category.wallet_kind_id === wallet.wallet_kind_id)
    .reduce((sum, category) => {
      const acquired = acquiredCountByCategory[category.id] ?? 0;
      const remaining = Math.max(0, category.min_required - acquired);
      return sum + remaining * category.base_price;
    }, 0);
}

// The check a bid must pass: after winning this lot, the wallet must still
// be able to afford every OTHER mandatory slot it hasn't filled yet. The
// lot being bid on counts as filling one slot of its own category (if that
// category still has unmet demand), so acquiredCountByCategory is bumped
// for `lotCategoryId` before reserve is computed — a team is never blocked
// from bidding on a lot that itself satisfies a mandatory slot.
export function reserveAfterPurchase(input: ReserveInput, lotCategoryId: string | null): number {
  if (!lotCategoryId) return computeReserve(input);
  return computeReserve({
    ...input,
    acquiredCountByCategory: {
      ...input.acquiredCountByCategory,
      [lotCategoryId]: (input.acquiredCountByCategory[lotCategoryId] ?? 0) + 1,
    },
  });
}

// True if proposedAmount would leave the wallet unable to cover its
// reserve for the auction's other mandatory slots.
export function violatesReserve(input: ReserveInput, lotCategoryId: string | null, proposedAmount: number): boolean {
  const budgetAfter = input.wallet.budget_remaining - proposedAmount;
  return budgetAfter < reserveAfterPurchase(input, lotCategoryId);
}
