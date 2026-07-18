// In-browser AuctionEngine for /auctionos/dev — no Supabase, no API routes,
// no network at all. Each method is a direct port of the matching Postgres
// function in supabase/add_auctionos.sql, minus the parts that don't apply
// without multi-client concurrency (no optimistic-lock version conflicts to
// defend against when there's only one browser tab driving the mock):
//   advance -> auctionos_advance_lot
//   bid     -> auctionos_raise_bid + template.validation.validateBid (budget check)
//   sold    -> auctionos_mark_sold + _auctionos_recalc_captain_valuation
//   unsold  -> auctionos_mark_unsold
// Keeping this a line-by-line mirror rather than "close enough" logic is
// the whole point: a bug the mock doesn't reproduce is a bug you won't
// catch testing here.
//
// player_purchases doesn't exist as a separate table here — with no undo
// wired into AuctionExperience yet, a sold AuctionLot row *is* the
// unreversed purchase record (sold_price/sold_wallet_id), so the captain
// recalc below scans store.lots instead of a parallel ledger. If undo ever
// gets added to this harness, that assumption needs revisiting — a
// reversed sale would need to stop counting toward MAX(price) without
// losing the lot's sold history.

import type {
  Auction,
  AuctionWallet,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  CaptainValuation,
} from "@/lib/auctionos/core/types";
import type { AuctionEngine, AuctionSnapshot } from "./engine";
import { getNextBidIncrement } from "./rules";
import { seedAuction, seedCategories, seedWallets, seedLots, seedCaptains } from "./mockSeed";

interface MockStore {
  auction: Auction;
  wallets: AuctionWallet[];
  lots: AuctionLot[];
  categories: AuctionCategory[];
  captains: AuctionCaptain[];
  captainValuations: CaptainValuation[];
}

function freshStore(): MockStore {
  return {
    auction: seedAuction(),
    wallets: seedWallets(),
    lots: seedLots(),
    categories: seedCategories(),
    captains: seedCaptains(),
    captainValuations: [],
  };
}

function snapshotOf(store: MockStore): AuctionSnapshot {
  return {
    auction: { ...store.auction },
    wallets: store.wallets.map((w) => ({ ...w })),
    lots: store.lots.map((l) => ({ ...l })),
    categories: store.categories.map((c) => ({ ...c })),
    captains: store.captains.map((c) => ({ ...c })),
    captainValuations: store.captainValuations.map((v) => ({ ...v })),
  };
}

// Returns both the mutable engine and a reset() escape hatch the dev page
// uses to restart the mock auction from lot 1 without a page reload.
export function createMockEngine(): { engine: AuctionEngine; reset: () => void } {
  let store = freshStore();
  let nextValuationId = 1;

  // Mirrors _auctionos_recalc_captain_valuation: no-op if this team has no
  // captain in this category; otherwise logs a new valuation row at half
  // the team's highest unreversed sold price in that category.
  function recalcCaptainValuation(teamId: string, categoryId: string, triggeringLotId: string) {
    const captain = store.captains.find((c) => c.team_id === teamId && c.category_id === categoryId);
    if (!captain) return;

    const highest = store.lots
      .filter((l) => l.status === "sold" && l.category_id === categoryId)
      .filter((l) => store.wallets.find((w) => w.id === l.sold_wallet_id)?.team_id === teamId)
      .reduce<number | null>((max, l) => Math.max(max ?? -Infinity, l.sold_price ?? 0), null);

    const valuation: CaptainValuation = {
      id: nextValuationId++,
      auction_id: store.auction.id,
      captain_id: captain.id,
      triggering_purchase_id: triggeringLotId,
      captain_value: highest == null ? null : highest * 0.5,
      rationale: { highest_qualifying_purchase: highest },
      created_at: new Date().toISOString(),
    };

    // Newest-first, matching fetchCaptainValuations()'s ordering — every
    // reader (latestValuationByCaptain in AuctionExperience) assumes the
    // first hit per captain_id is the current one.
    store = { ...store, captainValuations: [valuation, ...store.captainValuations] };
  }

  const engine: AuctionEngine = {
    requiresAdminAuth: false,

    async refresh() {
      return snapshotOf(store);
    },

    async advance() {
      const next = [...store.lots]
        .filter((l) => l.status === "upcoming")
        .sort((a, b) => a.lot_order - b.lot_order)[0];

      if (!next) {
        store = {
          ...store,
          auction: { ...store.auction, status: "completed", current_lot_id: null },
        };
        return;
      }

      store = {
        ...store,
        lots: store.lots.map((l) =>
          l.id === next.id
            ? { ...l, status: "on_block", current_bid: l.base_price, current_bid_wallet_id: null }
            : l
        ),
        auction: { ...store.auction, status: "live", current_lot_id: next.id },
      };
    },

    async bid(lotId, walletId) {
      const lot = store.lots.find((l) => l.id === lotId);
      const wallet = store.wallets.find((w) => w.id === walletId);
      if (!lot || lot.status !== "on_block" || !wallet) return;

      const category = lot.category_id
        ? store.categories.find((c) => c.id === lot.category_id) ?? null
        : null;
      const currentBid = lot.current_bid ?? lot.base_price;
      const increment = category?.bid_increment ?? getNextBidIncrement(currentBid);
      const newBid = currentBid + increment;

      if (wallet.budget_remaining < newBid) return; // mirrors validateJccBid

      store = {
        ...store,
        lots: store.lots.map((l) =>
          l.id === lotId
            ? { ...l, current_bid: newBid, current_bid_wallet_id: walletId, version: l.version + 1 }
            : l
        ),
      };
    },

    async sold(lotId) {
      const lot = store.lots.find((l) => l.id === lotId);
      if (!lot || lot.status !== "on_block" || !lot.current_bid_wallet_id) return;

      const price = lot.current_bid ?? lot.base_price;
      const buyerId = lot.current_bid_wallet_id;
      const buyer = store.wallets.find((w) => w.id === buyerId);

      store = {
        ...store,
        lots: store.lots.map((l) =>
          l.id === lotId
            ? { ...l, status: "sold", sold_price: price, sold_wallet_id: buyerId, sold_at: new Date().toISOString() }
            : l
        ),
        wallets: store.wallets.map((w) =>
          w.id === buyerId
            ? { ...w, budget_remaining: w.budget_remaining - price, acquired_count: w.acquired_count + 1 }
            : w
        ),
      };

      if (lot.category_id && buyer) {
        recalcCaptainValuation(buyer.team_id as string, lot.category_id, lotId);
      }
    },

    async unsold(lotId) {
      const lot = store.lots.find((l) => l.id === lotId);
      if (!lot || lot.status !== "on_block") return;
      store = {
        ...store,
        lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "unsold" } : l)),
      };
    },
  };

  return {
    engine,
    reset: () => {
      store = freshStore();
      nextValuationId = 1;
    },
  };
}
