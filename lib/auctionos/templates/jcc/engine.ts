// The transport seam AuctionExperience talks through instead of calling
// fetch()/data.ts directly. createLiveEngine() below is a 1:1 extraction of
// what AuctionExperience used to do inline (Supabase reads via data.ts,
// mutations via /api/auctionos/* + the admin-password header) — the real
// hall page's behavior is unchanged. The dev-mode mock auction
// (mockEngine.ts) implements the same interface entirely in-browser, with
// no network/DB involved, so the exact production UI can be driven by
// hardcoded data. AuctionExperience itself never knows which one it holds.

import type {
  Auction,
  AuctionWallet,
  AuctionWalletKind,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  AuctionTeam,
  CaptainValuation,
} from "@/lib/auctionos/core/types";
import {
  fetchActiveAuction,
  fetchWallets,
  fetchWalletKinds,
  fetchLots,
  fetchAuctionCategories,
  fetchAuctionCaptains,
  fetchCaptainValuations,
  fetchAuctionTeams,
} from "@/lib/auctionos/core/data";

export interface AuctionSnapshot {
  auction: Auction | null;
  wallets: AuctionWallet[];
  walletKinds: AuctionWalletKind[];
  lots: AuctionLot[];
  categories: AuctionCategory[];
  captains: AuctionCaptain[];
  captainValuations: CaptainValuation[];
  teams: AuctionTeam[];
}

export const EMPTY_SNAPSHOT: AuctionSnapshot = {
  auction: null,
  wallets: [],
  walletKinds: [],
  lots: [],
  categories: [],
  captains: [],
  captainValuations: [],
  teams: [],
};

export interface AuctionEngine {
  // The mock engine needs no admin password (nothing it does leaves the
  // browser) — AuctionExperience skips the password modal entirely when
  // this is false rather than prompting for a password to type into a
  // fetch call the engine won't make.
  requiresAdminAuth: boolean;
  refresh(): Promise<AuctionSnapshot>;
  advance(auctionId: string, password: string | null): Promise<void>;
  bid(lotId: string, walletId: string, password: string | null): Promise<void>;
  sold(lotId: string, password: string | null): Promise<void>;
  unsold(lotId: string, password: string | null): Promise<void>;
  // Undo is real-auction-only (AUCTIONOS.md §11's auctionos_undo_bid/
  // auctionos_undo_sale) — optional so mockEngine can omit it entirely
  // rather than fake a no-op; AuctionExperience feature-detects these to
  // decide whether to render the undo controls at all.
  undoBid?(lotId: string, password: string | null): Promise<void>;
  undoSale?(lotId: string, password: string | null): Promise<void>;
  // Organizer-only manual resolution for a 'blocked' lot (see
  // auctionos_resolve_blocked_lot / AUCTION_RULES.md's category-quota
  // section) — walletId given force-allots to that team, null/omitted
  // gives up and finalizes it as unsold. Optional so a template/engine that
  // never produces a 'blocked' lot (no quota categories) can omit it
  // entirely, same pattern as undoBid/undoSale.
  resolveBlockedLot?(lotId: string, walletId: string | null, password: string | null): Promise<void>;
}

async function postAdmin(path: string, password: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/auctionos/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error ?? `Request to ${path} failed (${res.status})`);
  }
}

// Module-level singleton — holds no per-call state (password is passed in
// per method, resolved by the component's own admin-password modal), so
// there's nothing to gain from constructing a fresh one per render.
export const liveEngine: AuctionEngine = {
  requiresAdminAuth: true,
  async refresh() {
    const auction = await fetchActiveAuction();
    if (!auction) return EMPTY_SNAPSHOT;
    const [wallets, walletKinds, lots, categories, captains, captainValuations, teams] = await Promise.all([
      fetchWallets(auction.id),
      fetchWalletKinds(auction.id),
      fetchLots(auction.id),
      fetchAuctionCategories(auction.id),
      fetchAuctionCaptains(auction.id),
      fetchCaptainValuations(auction.id),
      fetchAuctionTeams(auction.id),
    ]);
    return { auction, wallets, walletKinds, lots, categories, captains, captainValuations, teams };
  },
  async advance(auctionId, password) {
    if (!password) return;
    await postAdmin("advance", password, { auction_id: auctionId });
  },
  async bid(lotId, walletId, password) {
    if (!password) return;
    await postAdmin("bid", password, { lot_id: lotId, wallet_id: walletId });
  },
  async sold(lotId, password) {
    if (!password) return;
    await postAdmin("sold", password, { lot_id: lotId });
  },
  async unsold(lotId, password) {
    if (!password) return;
    await postAdmin("unsold", password, { lot_id: lotId });
  },
  async undoBid(lotId, password) {
    if (!password) return;
    await postAdmin("undo-bid", password, { lot_id: lotId });
  },
  async undoSale(lotId, password) {
    if (!password) return;
    await postAdmin("undo-sale", password, { lot_id: lotId });
  },
  async resolveBlockedLot(lotId, walletId, password) {
    if (!password) return;
    await postAdmin("resolve-lot", password, { lot_id: lotId, wallet_id: walletId });
  },
};
