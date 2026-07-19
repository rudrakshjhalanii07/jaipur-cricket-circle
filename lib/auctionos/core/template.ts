// The contract every auction format implements. The engine (API routes +
// Postgres RPCs) owns the actual state transitions and money movement so
// that's auditable in one place regardless of how many templates exist;
// a template only supplies the *rules* those transitions must respect, and
// the *visual experience* they're presented through.
//
// A template is assembled from independent modules (wallet formatting,
// auction order, bid increments, validation, floor price, captain
// valuation, allocation, permissions, visibility) plus an escape-hatch `modules` bag
// for anything format-specific the engine will never read. Nothing below
// is JCC-shaped — see the DEFAULT_* constants — a template overrides only
// what it needs via defineTemplate(), everything else falls back to a
// neutral default.
//
// Since the DB-backed catalog rewrite, categories and starting-budget
// numbers are no longer template code fields — they're organizer-configured
// data (`auction_categories`/`auction_wallets` rows, seeded from
// `template_categories` at auction-creation time). A template still owns
// the *algorithms* that interpret that data (how a lot's floor price is
// computed from a category, how currency is formatted) but not the data
// itself. See
// AUCTIONOS.md's "Template catalog" section for the full reasoning.
//
// UI is exposed as a single AuctionExperience component rather than a set
// of fine-grained slots (LotCard, ParticipantBadge, ...): this auction hall
// is a bespoke, immersive screen (hero → hammer sequence → captain desks),
// not a grid of interchangeable cards, and a slot-based shell would fight
// that. A second template can render something structurally unrelated as
// long as it fulfils this same prop contract.

import type { ComponentType } from "react";
import type { Auction, AuctionWallet, AuctionLot, AuctionCategory, AuctionTeam } from "./types";

export interface BidValidationContext {
  auction: Auction;
  lot: AuctionLot;
  wallet: AuctionWallet;
  proposedAmount: number;
}

export interface BidValidationResult {
  ok: boolean;
  reason?: string;
}

export interface AuctionExperienceProps {
  initialAuction: Auction | null;
  initialWallets: AuctionWallet[];
  initialLots: AuctionLot[];
  initialCategories: AuctionCategory[];
  // Wizard-created franchises (public.auction_teams) — a template resolves
  // wallet/captain team identity from these, not the legacy global `teams`
  // table (see AuctionWallet/AuctionCaptain's team_id/auction_team_id split).
  initialTeams: AuctionTeam[];
  // Whether the current viewer is the organizer (verified admin password)
  // rather than a plain join-code spectator — see HallAccessGate, which
  // computes this once from the same sessionStorage check that already
  // gates hall entry, and passes it down via cloneElement. Defaults to true
  // so every other caller (the /auctionos/dev mock harness, any future
  // template that doesn't wire this up) keeps full admin controls.
  isAdmin?: boolean;
}

// ── Wallets ────────────────────────────────────────────────────────────
// The starting budget number is now organizer-configured DB data
// (auction_wallets.budget_total, set at auction-creation time) — not a code
// constant. Currency *formatting* is still a template algorithm, so
// WalletConfig keeps only that.

export interface WalletConfig {
  formatAmount(amount: number): string;
}

// ── Auction order ──────────────────────────────────────────────────────

export interface AuctionOrderConfig {
  mode: "sequential" | "random" | "custom";
  resolve(lots: AuctionLot[], categories: AuctionCategory[]): AuctionLot[];
}

// ── Bid increments ─────────────────────────────────────────────────────

export interface BidIncrementTier {
  /** Exclusive upper bound this tier's amount applies below; null = open-ended. */
  upTo: number | null;
  amount: number;
}

export interface BidIncrementConfig {
  /** Declarative tier ladder, for anything that wants to display it (e.g. an admin builder). */
  tiers: BidIncrementTier[];
  /**
   * The actual next-increment computation — usually derived from `tiers`.
   * `category` is the lot's own AuctionCategory (null if the lot has none
   * assigned yet) — organizer-editable `auction_categories.bid_increment`
   * (schema v4) is a per-category override a template implementation
   * should prefer over its own tier ladder when set; the default engine
   * below ignores it since a template with no categories has nothing to
   * override.
   */
  nextIncrement(currentBid: number, lot: AuctionLot, auction: Auction, category: AuctionCategory | null): number;
}

// ── Validation rules ───────────────────────────────────────────────────

export interface ValidationConfig {
  validateBid(ctx: BidValidationContext): BidValidationResult;
}

// ── Floor price ────────────────────────────────────────────────────────
// The minimum opening bid for a lot. Deliberately NOT called "reserve" —
// see AUCTIONOS.md: "Floor Price" (this) and "Reserve" (the live,
// wallet-level required-holdback number the generic Reserve Engine derives
// from `category.min_required` × current base prices, never stored) are
// two different concepts that used to share a name and got confused
// because of it. The wallet-level Reserve Engine is generic enough it
// doesn't need a per-template override — it only reads AuctionCategory
// fields — so it isn't part of this contract at all.

export interface FloorPriceContext {
  lot: AuctionLot;
  auction: Auction;
  category: AuctionCategory | null;
}

export interface FloorPriceEngine {
  computeFloorPrice(ctx: FloorPriceContext): number;
}

// ── Captain valuation ──────────────────────────────────────────────────
// Deterministic, not advisory: captainValue IS the captain's price, per
// AUCTIONOS.md's captain module (50% of the highest qualifying purchase
// made by the captain's own team inside the captain's own category). The
// DB's captain_valuations table logs a snapshot of this computation every
// time a qualifying purchase or undo happens — this function is what
// computes the number that gets logged, and what a template's UI reads for
// the live value between recalculations.

export interface ValuationContext {
  category: AuctionCategory;
  auction: Auction;
  /** Highest qualifying purchase so far (null if none yet). */
  highestQualifyingPurchase: number | null;
}

export interface ValuationResult {
  captainValue: number | null;
  rationale: Record<string, unknown>;
}

export interface ValuationEngine {
  computeCaptainValue(ctx: ValuationContext): ValuationResult;
}

// ── Allocation ──────────────────────────────────────────────────────────
// Hook for a template-owned side effect after the engine settles a lot.
// The engine's own RPCs already move budget and bump acquired_count — this
// is only for something a specific template needs beyond that (e.g.
// writing into a template-owned roster table).

export interface AllocationContext {
  lot: AuctionLot;
  auction: Auction;
  wallet: AuctionWallet | null;
}

export interface AllocationModule {
  onLotSold(ctx: AllocationContext): void | Promise<void>;
  onLotUnsold(ctx: AllocationContext): void | Promise<void>;
}

// ── Permissions ────────────────────────────────────────────────────────

export interface PermissionsConfig {
  /** Operator roles this template recognizes. */
  roles: string[];
  /** Whether a non-auctioneer role may place a bid on a wallet's behalf. */
  canBidOnBehalf: boolean;
}

// ── Visibility defaults ───────────────────────────────────────────────
// These are now just the code-side fallback used when seeding
// auction_settings at creation time (see auctionos_create_auction) — the
// live, organizer-editable copy is the auction_settings row, read via
// fetchAuctionSettings().

export interface VisibilityDefaults {
  showFloorPriceToSpectators: boolean;
  showValuationToOperators: boolean;
  showWalletsToSpectators: boolean;
}

// ── The assembled template ────────────────────────────────────────────

export interface AuctionTemplate {
  id: string;
  displayName: string;

  wallet: WalletConfig;
  auctionOrder: AuctionOrderConfig;
  bidIncrements: BidIncrementConfig;
  validation: ValidationConfig;
  floorPrice: FloorPriceEngine;
  valuation: ValuationEngine;
  allocation: AllocationModule;
  permissions: PermissionsConfig;
  visibility: VisibilityDefaults;

  /** Escape hatch for a template's own future modules — the engine never reads this. */
  modules: Record<string, unknown>;

  /** The entire auction hall screen for this format. */
  AuctionExperience: ComponentType<AuctionExperienceProps>;
}

// ── Generic, format-agnostic defaults ─────────────────────────────────
// Every value here is the most neutral behavior possible — no currency, no
// roles, no rule that assumes anything about a specific format. This is
// what "Blank Auction" is built from unmodified; JCC overrides the modules
// it actually needs and leaves the rest.

const DEFAULT_WALLET: WalletConfig = {
  formatAmount: (amount) => String(amount),
};

const DEFAULT_AUCTION_ORDER: AuctionOrderConfig = {
  mode: "sequential",
  resolve: (lots) => [...lots].sort((a, b) => a.lot_order - b.lot_order),
};

const DEFAULT_BID_INCREMENTS: BidIncrementConfig = {
  tiers: [{ upTo: null, amount: 1 }],
  nextIncrement: (_currentBid, _lot, _auction, category) => category?.bid_increment ?? 1,
};

const DEFAULT_VALIDATION: ValidationConfig = {
  // The one invariant that holds for any format built on this engine: a
  // wallet can't bid past the budget the engine is already tracking for it.
  // Format-specific rules (eligibility, category caps) are added by the
  // template, not a replacement for this.
  validateBid: ({ wallet, proposedAmount }) =>
    wallet.budget_remaining >= proposedAmount
      ? { ok: true }
      : { ok: false, reason: "Insufficient budget" },
};

const DEFAULT_FLOOR_PRICE: FloorPriceEngine = {
  // No format-specific floor logic — the lot's own base_price, set at
  // pool-build time, is already the floor.
  computeFloorPrice: ({ lot }) => lot.base_price,
};

const DEFAULT_VALUATION: ValuationEngine = {
  // No captain module by default — a template opts in via defineTemplate()
  // with its own formula (e.g. JCC's 50%-of-highest-purchase rule).
  computeCaptainValue: () => ({ captainValue: null, rationale: {} }),
};

const DEFAULT_ALLOCATION: AllocationModule = {
  onLotSold: () => {},
  onLotUnsold: () => {},
};

const DEFAULT_PERMISSIONS: PermissionsConfig = {
  roles: ["auctioneer"],
  canBidOnBehalf: false,
};

const DEFAULT_VISIBILITY: VisibilityDefaults = {
  showFloorPriceToSpectators: true,
  showValuationToOperators: false,
  showWalletsToSpectators: true,
};

export type TemplateDefinition = Pick<AuctionTemplate, "id" | "displayName" | "AuctionExperience"> &
  Partial<Omit<AuctionTemplate, "id" | "displayName" | "AuctionExperience">>;

/**
 * Assembles a full AuctionTemplate from only the modules a format actually
 * needs to override. Anything omitted falls back to the neutral default
 * above — a template with no format-specific rules at all (see
 * templates/blank) is just an id, a displayName, and a UI.
 *
 * An override replaces a whole module (e.g. `wallet: {...}`), not
 * individual fields inside one — a module is a cohesive unit, not a bag of
 * independent settings, so partial-merging within one would hide which
 * values actually came from the template vs. the default.
 */
export function defineTemplate(definition: TemplateDefinition): AuctionTemplate {
  return {
    wallet: DEFAULT_WALLET,
    auctionOrder: DEFAULT_AUCTION_ORDER,
    bidIncrements: DEFAULT_BID_INCREMENTS,
    validation: DEFAULT_VALIDATION,
    floorPrice: DEFAULT_FLOOR_PRICE,
    valuation: DEFAULT_VALUATION,
    allocation: DEFAULT_ALLOCATION,
    permissions: DEFAULT_PERMISSIONS,
    visibility: DEFAULT_VISIBILITY,
    modules: {},
    ...definition,
  };
}
