// In-browser AuctionEngine for /auctionos/dev — no Supabase, no API routes,
// no network at all. Each method is a direct port of the matching Postgres
// function in supabase/add_auctionos.sql, minus the parts that don't apply
// without multi-client concurrency (no optimistic-lock version conflicts to
// defend against when there's only one browser tab driving the mock):
//   advance          -> auctionos_advance_lot (incl. the blocked-lot guard)
//   bid              -> auctionos_raise_bid + template.validation.validateBid (budget check)
//   sold             -> auctionos_mark_sold + _auctionos_recalc_captain_valuation
//   unsold           -> auctionos_mark_unsold (loop/allot/blocked — see AUCTION_RULES.md)
//   resolveBlockedLot -> auctionos_resolve_blocked_lot
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
  AuctionWalletKind,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  CaptainValuation,
} from "@/lib/auctionos/core/types";
import type { AuctionEngine, AuctionSnapshot } from "./engine";
import { violatesReserve, withCaptainBonus } from "@/lib/auctionos/core/reserve";
import { getNextBidIncrement } from "./rules";
import {
  seedAuction,
  seedCategories,
  seedWallets,
  seedWalletKinds,
  seedLots,
  seedCaptains,
} from "./mockSeed";

interface MockStore {
  auction: Auction;
  wallets: AuctionWallet[];
  walletKinds: AuctionWalletKind[];
  lots: AuctionLot[];
  categories: AuctionCategory[];
  captains: AuctionCaptain[];
  captainValuations: CaptainValuation[];
}

function freshStore(): MockStore {
  return {
    auction: seedAuction(),
    wallets: seedWallets(),
    walletKinds: seedWalletKinds(),
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
    walletKinds: store.walletKinds.map((k) => ({ ...k })),
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
  // captain in this category; otherwise logs a new valuation row. Regular-
  // category captains get a flat 100 (₹1 Cr); MVP (and any other) captains
  // get half the team's highest unreversed sold price in that category.
  function recalcCaptainValuation(teamId: string, categoryId: string, triggeringLotId: string) {
    const captain = store.captains.find((c) => c.team_id === teamId && c.category_id === categoryId);
    if (!captain) return;

    const category = store.categories.find((c) => c.id === categoryId);
    const isRegular = /regular/i.test(category?.name ?? "");

    const highest = store.lots
      .filter((l) => l.status === "sold" && l.category_id === categoryId)
      .filter((l) => store.wallets.find((w) => w.id === l.sold_wallet_id)?.team_id === teamId)
      .reduce<number | null>((max, l) => Math.max(max ?? -Infinity, l.sold_price ?? 0), null);

    const valuation: CaptainValuation = {
      id: nextValuationId++,
      auction_id: store.auction.id,
      captain_id: captain.id,
      triggering_purchase_id: triggeringLotId,
      captain_value: isRegular ? 100 : highest == null ? null : highest * 0.5,
      rationale: isRegular
        ? { rule: "regular-flat", value: 100 }
        : { rule: "mvp-half-highest", highest_qualifying_purchase: highest },
      created_at: new Date().toISOString(),
    };

    // Newest-first, matching fetchCaptainValuations()'s ordering — every
    // reader (latestValuationByCaptain in AuctionExperience) assumes the
    // first hit per captain_id is the current one.
    store = { ...store, captainValuations: [valuation, ...store.captainValuations] };
  }

  // Mirrors _auctionos_acquired_count: sold-lot count in this category for
  // this wallet (this harness's stand-in for player_purchases — see the
  // file header) plus 1 if this wallet's team captains this category (see
  // reserve.ts's withCaptainBonus).
  function acquiredCount(walletId: string, categoryId: string): number {
    const wallet = store.wallets.find((w) => w.id === walletId);
    if (!wallet) return 0;
    const purchased = store.lots.filter(
      (l) => l.status === "sold" && l.sold_wallet_id === walletId && l.category_id === categoryId
    ).length;
    return withCaptainBonus({ [categoryId]: purchased }, wallet, store.captains)[categoryId] ?? purchased;
  }

  // Mirrors _auctionos_finalize_purchase: the shared "this wallet just
  // acquired this lot for this price" tail, used identically by a bid-won
  // sale and a system/organizer allotment.
  function finalizePurchase(lotId: string, walletId: string, price: number) {
    const lot = store.lots.find((l) => l.id === lotId);
    const buyer = store.wallets.find((w) => w.id === walletId);

    store = {
      ...store,
      lots: store.lots.map((l) =>
        l.id === lotId
          ? { ...l, status: "sold", sold_price: price, sold_wallet_id: walletId, sold_at: new Date().toISOString() }
          : l
      ),
      wallets: store.wallets.map((w) =>
        w.id === walletId
          ? { ...w, budget_remaining: w.budget_remaining - price, acquired_count: w.acquired_count + 1 }
          : w
      ),
    };

    if (lot?.category_id && buyer) {
      recalcCaptainValuation(buyer.team_id as string, lot.category_id, lotId);
    }
  }

  const engine: AuctionEngine = {
    requiresAdminAuth: false,

    async refresh() {
      return snapshotOf(store);
    },

    // Mirrors auctionos_advance_lot, including THE ACTUAL QUOTA GATE (see
    // that function's header comment in add_auctionos_quota.sql for why
    // this can't live in unsold() alone — a purely-reactive-to-unsold
    // design lets a category sell out entirely via ordinary bid-won sales,
    // never once going unsold, leaving a short team with nothing; caught
    // by a scripted simulation against this exact file before the fix).
    // Every lot pulled from a quota category is checked for "is this the
    // category's last one" BEFORE it ever reaches on_block, so a lot that
    // belongs to a specific short team is never exposed to open bidding
    // where a richer team could simply outbid them.
    async advance() {
      if (store.lots.some((l) => l.status === "blocked")) return;

      while (true) {
        const next = [...store.lots]
          .filter((l) => l.status === "upcoming")
          .sort((a, b) => a.lot_order - b.lot_order)[0];

        if (!next) {
          store = { ...store, auction: { ...store.auction, status: "completed", current_lot_id: null } };
          return;
        }

        const category = next.category_id ? store.categories.find((c) => c.id === next.category_id) ?? null : null;
        const remainingInCategory = category
          ? store.lots.filter((l) => l.category_id === category.id && l.status === "upcoming").length
          : 0;

        // Not a quota category, or other lots remain after this one —
        // nothing special, open it normally.
        if (!category || category.min_required <= 0 || remainingInCategory > 1) {
          store = {
            ...store,
            lots: store.lots.map((l) =>
              l.id === next.id
                ? { ...l, status: "on_block", current_bid: l.base_price, current_bid_wallet_id: null }
                : l
            ),
            auction: { ...store.auction, status: "live", current_lot_id: next.id },
          };
          return;
        }

        // This IS the category's last upcoming lot.
        const shortWallets = store.wallets.filter(
          (w) => w.wallet_kind_id === category.wallet_kind_id && acquiredCount(w.id, category.id) < category.min_required
        );

        if (shortWallets.length === 0) {
          store = {
            ...store,
            lots: store.lots.map((l) =>
              l.id === next.id
                ? { ...l, status: "on_block", current_bid: l.base_price, current_bid_wallet_id: null }
                : l
            ),
            auction: { ...store.auction, status: "live", current_lot_id: next.id },
          };
          return;
        }

        if (shortWallets.length === 1 && shortWallets[0].budget_remaining >= category.base_price) {
          finalizePurchase(next.id, shortWallets[0].id, category.base_price);
          continue; // resolved without a bidding round — loop to the real next lot
        }

        // 2+ tied short, or the one short team can't afford base_price —
        // never expose this to open bidding. Park it for an organizer.
        store = { ...store, lots: store.lots.map((l) => (l.id === next.id ? { ...l, status: "blocked" } : l)) };
        return;
      }
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

      // Mirrors the reserve check bolted onto auctionos_raise_bid, captain
      // bonus included (acquiredCount already folds it in).
      const acquiredCountByCategory: Record<string, number> = {};
      for (const category of store.categories) {
        if (category.wallet_kind_id !== wallet.wallet_kind_id) continue;
        acquiredCountByCategory[category.id] = acquiredCount(walletId, category.id);
      }
      if (
        violatesReserve(
          { wallet, categories: store.categories, acquiredCountByCategory },
          lot.category_id,
          newBid
        )
      ) {
        return; // would leave this team unable to afford its remaining mandatory slots
      }

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
      finalizePurchase(lotId, lot.current_bid_wallet_id, lot.current_bid ?? lot.base_price);
    },

    // Mirrors auctionos_mark_unsold's rewritten body — see
    // AUCTION_RULES.md's "Category quota" section for the full rule.
    async unsold(lotId) {
      const lot = store.lots.find((l) => l.id === lotId);
      if (!lot || lot.status !== "on_block") return;

      const category = lot.category_id ? store.categories.find((c) => c.id === lot.category_id) ?? null : null;

      // Neither a quota category nor a resell-capped one — original,
      // terminal, immediate behavior.
      if (!category || (category.min_required <= 0 && category.max_resell_rounds == null)) {
        store = { ...store, lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "unsold" } : l)) };
        return;
      }

      // Resell-capped, non-quota category (e.g. Guest) — mirrors
      // add_auctionos_guest_rebalance.sql's Branch B. Quota (checked
      // below) takes precedence if a category somehow has both set.
      if (category.min_required <= 0 && category.max_resell_rounds != null) {
        const resellRounds = (lot.metadata?.resell_rounds as number | undefined) ?? 0;

        if (resellRounds < category.max_resell_rounds) {
          const maxOrderInCategory = Math.max(
            ...store.lots.filter((l) => l.category_id === category.id).map((l) => l.lot_order)
          );
          store = {
            ...store,
            lots: store.lots.map((l) =>
              l.id === lotId
                ? {
                    ...l,
                    status: "upcoming",
                    current_bid: l.base_price,
                    current_bid_wallet_id: null,
                    lot_order: maxOrderInCategory + 1,
                    metadata: { ...l.metadata, resell_rounds: resellRounds + 1 },
                  }
                : l
            ),
          };
          return;
        }

        // Exhausted its resells and still unsold — rebalance: among
        // wallets of this category's kind that can afford base_price, pick
        // whichever team currently has the smallest OVERALL squad (summed
        // across every wallet that team holds, not just this category),
        // random tiebreak among teams equally behind. Best-effort, not a
        // guarantee like quota's allotment is — if nobody can afford it,
        // it goes plain unsold.
        const eligible = store.wallets
          .filter((w) => w.wallet_kind_id === category.wallet_kind_id && w.budget_remaining >= category.base_price)
          .map((w) => ({
            wallet: w,
            totalSquad: store.wallets
              .filter((x) => x.team_id === w.team_id)
              .reduce((sum, x) => sum + x.acquired_count, 0),
          }));
        const minSquad = eligible.length ? Math.min(...eligible.map((e) => e.totalSquad)) : null;
        const tied = minSquad != null ? eligible.filter((e) => e.totalSquad === minSquad) : [];
        const pick = tied.length ? tied[Math.floor(Math.random() * tied.length)] : null;

        if (!pick) {
          store = { ...store, lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "unsold" } : l)) };
          return;
        }

        finalizePurchase(lotId, pick.wallet.id, category.base_price);
        return;
      }

      const remainingInCategory = store.lots.filter(
        (l) => l.category_id === category.id && l.status === "upcoming"
      ).length;

      if (remainingInCategory > 0) {
        // Loop: send this lot to the back of its own category's block —
        // give it a lot_order past every other lot currently in this
        // category (still ahead of the next category's first lot, since
        // nothing outside this category has a lower lot_order than "the
        // rest of this category" at this point in a sequential auction).
        const maxOrderInCategory = Math.max(
          ...store.lots.filter((l) => l.category_id === category.id).map((l) => l.lot_order)
        );
        store = {
          ...store,
          lots: store.lots.map((l) =>
            l.id === lotId
              ? {
                  ...l,
                  status: "upcoming",
                  current_bid: l.base_price,
                  current_bid_wallet_id: null,
                  lot_order: maxOrderInCategory + 1,
                }
              : l
          ),
        };
        return;
      }

      // Last lot in the category — which of this category's wallet-kind
      // wallets are still short of min_required?
      const shortWallets = store.wallets.filter(
        (w) => w.wallet_kind_id === category.wallet_kind_id && acquiredCount(w.id, category.id) < category.min_required
      );

      if (shortWallets.length === 0) {
        store = { ...store, lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "unsold" } : l)) };
        return;
      }

      if (shortWallets.length === 1 && shortWallets[0].budget_remaining >= category.base_price) {
        finalizePurchase(lotId, shortWallets[0].id, category.base_price);
        return;
      }

      // 2+ teams tied for the last slot (no automatic tie-break) or the
      // one short team can't afford base_price — park it for an organizer.
      store = { ...store, lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "blocked" } : l)) };
    },

    async resolveBlockedLot(lotId, walletId) {
      const lot = store.lots.find((l) => l.id === lotId);
      if (!lot || lot.status !== "blocked") return;

      if (!walletId) {
        store = { ...store, lots: store.lots.map((l) => (l.id === lotId ? { ...l, status: "unsold" } : l)) };
        return;
      }

      const wallet = store.wallets.find((w) => w.id === walletId);
      const category = lot.category_id ? store.categories.find((c) => c.id === lot.category_id) ?? null : null;
      const price = category?.base_price ?? lot.base_price;
      if (!wallet || wallet.budget_remaining < price) return; // mirrors the RPC's affordability guard

      finalizePurchase(lotId, walletId, price);
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
