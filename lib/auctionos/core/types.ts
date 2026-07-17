// Generic AuctionOS domain types. No format-specific fields here — anything
// a template needs beyond this shape belongs in `metadata` (or an
// `auction_categories`/`auction_settings` row rather than a JSONB guess).
// Mirrors supabase/add_auctionos.sql (schema v3) 1:1.

export type AuctionStatus = "scheduled" | "live" | "completed";
export type LotStatus = "upcoming" | "on_block" | "sold" | "unsold";
export type TemplateStatus = "draft" | "published" | "archived";

// ── Teams ──────────────────────────────────────────────────────────────
// Global, site-wide bidding-team roster (public.teams) — not auction-scoped.
// Mirrors lib/teams.ts's TeamConfig shape but is a DB row read at request
// time, not a code constant; only AuctionOS's wallet table is wired to it.
// `captain_player_id` from schema v2 is GONE — a captain is now an
// auction-scoped fact (AuctionCaptain below), never a property of the
// global team roster.

export type PatternType = "tribal" | "lightning" | "scratch";

export interface Team {
  id: string;
  name: string;
  short_name: string;
  logo: string;
  jersey_number: number | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  glow_color: string;
  tagline: string | null;
  pattern_type: PatternType;
  created_at: string;
  updated_at: string;
}

// ── Template catalog ───────────────────────────────────────────────────
// The DB-facing half of a template — organizer-visible metadata plus a
// `module_key` pointer into the code registry (lib/auctionos/core/registry.ts)
// that still owns the algorithmic modules (bid increments, reserve,
// valuation, validation, ...). `theme` is a presentational-only JSONB bag —
// never branched on by engine or template code.

export interface AuctionTemplateRow {
  id: string;
  slug: string;
  name: string;
  version: number;
  module_key: string;
  status: TemplateStatus;
  description: string | null;
  theme: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateCategory {
  id: string;
  template_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  default_base_price: number;
  default_floor_price: number | null;
  min_required: number;
  max_allowed: number | null;
  wallet_kind_name: string | null;
}

// The wallet KINDS a template ships with (e.g. "Main Purse") — copied into
// AuctionWalletKind per auction at creation time.
export interface TemplateWallet {
  id: string;
  template_id: string;
  name: string;
  initial_balance: number;
  transfer_enabled: boolean;
  sort_order: number;
}

export interface Auction {
  id: string;
  template_id: string;
  name: string;
  status: AuctionStatus;
  starts_at: string | null;
  current_lot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionSettings {
  id: string;
  auction_id: string;
  max_teams: number | null;
  allow_operator_bids: boolean;
  undo_enabled: boolean;
  captain_module_enabled: boolean;
  unsold_round_enabled: boolean;
  allocation_enabled: boolean;
  auction_order_mode: string;
  show_floor_price_to_spectators: boolean;
  show_wallets_to_spectators: boolean;
  show_valuation_to_operators: boolean;
  spectator_visibility: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// The shared, auction-scoped wallet concept a category points at ("Main
// Purse", "Overseas Purse"). Every registered team gets one AuctionWallet
// instance per kind — see auctionos_create_auction.
export interface AuctionWalletKind {
  id: string;
  auction_id: string;
  name: string;
  initial_balance: number;
  transfer_enabled: boolean;
  sort_order: number;
  created_at: string;
}

// Live, organizer-editable per-auction categories — copied from
// template_categories at creation time, never referenced back to it.
// `floor_price` (renamed from schema v2's `reserve_price`) is the minimum
// opening bid for a lot in this category. This is NOT the same concept as
// "reserve" — the live, wallet-level required-holdback number computed by
// the Reserve Engine is never stored anywhere in this schema.
export interface AuctionCategory {
  id: string;
  auction_id: string;
  wallet_kind_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  base_price: number;
  floor_price: number | null;
  min_required: number;
  max_allowed: number | null;
  created_at: string;
  updated_at: string;
}

// One row per (team, wallet kind) per auction — the actual money container
// the engine debits/credits. budget_remaining/acquired_count are CACHED
// values, kept in sync with WalletTransaction by the same RPC that appends
// a ledger row; the ledger is the source of truth, never this column.
export interface AuctionWallet {
  id: string;
  auction_id: string;
  wallet_kind_id: string;
  team_id: string;
  display_name: string | null;
  budget_total: number;
  budget_remaining: number;
  acquired_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Optional, organizer-set per-category spend/lot caps, on top of whatever a
// wallet's kind already funds. Empty by default; not enforced by any RPC
// yet — see supabase/add_auctionos.sql §7.
export interface AuctionWalletCategoryCap {
  id: string;
  wallet_id: string;
  category_id: string;
  max_spend: number | null;
  max_lots: number | null;
}

// Auction-scoped; a template/auction with the captain module disabled has
// zero rows here. Tied to team_id (not a specific wallet row) — the
// captain's own wallet instance is resolved via team_id + the category's
// wallet_kind_id at valuation time.
export interface AuctionCaptain {
  id: string;
  auction_id: string;
  team_id: string;
  category_id: string;
  external_ref: string | null;
  display_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuctionLot {
  id: string;
  auction_id: string;
  category_id: string | null;
  external_ref: string | null;
  display_name: string;
  lot_order: number;
  base_price: number;
  status: LotStatus;
  current_bid: number | null;
  current_bid_wallet_id: string | null;
  sold_price: number | null;
  sold_wallet_id: string | null;
  sold_at: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuctionBid {
  id: string;
  lot_id: string;
  wallet_id: string;
  amount: number;
  created_at: string;
}

// SOURCE OF TRUTH for "who bought what, for how much" — AuctionLot's
// sold_price/sold_wallet_id/sold_at are a cache over the latest row here
// with reversed_at === null. Undo never deletes a row, it stamps
// reversed_at, so reversed purchases stay in history.
export interface PlayerPurchase {
  id: string;
  auction_id: string;
  lot_id: string;
  wallet_id: string;
  category_id: string | null;
  price: number;
  purchased_at: string;
  reversed_at: string | null;
}

export type WalletTransactionType =
  | "purchase"
  | "purchase_undo"
  | "transfer_out"
  | "transfer_in"
  | "adjustment";

// SOURCE OF TRUTH financial ledger. AuctionWallet.budget_remaining/
// acquired_count are cached values kept in sync in the same transaction
// that appends a row here. amount is signed: debits negative, credits
// positive. transfer_group_id links the paired transfer_out/transfer_in
// rows a wallet-to-wallet transfer produces.
export interface WalletTransaction {
  id: string;
  auction_id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: number;
  related_purchase_id: string | null;
  transfer_group_id: string | null;
  actor: string | null;
  created_at: string;
}

// Append-only snapshot log — there is no mutable "current value" field
// anywhere. The current captain_value is the latest row for a captain_id.
// captain_value is null when there's no qualifying purchase yet (not zero).
export interface CaptainValuation {
  id: number;
  auction_id: string;
  captain_id: string;
  triggering_purchase_id: string | null;
  captain_value: number | null;
  rationale: Record<string, unknown>;
  created_at: string;
}

// Complete chronological system history — deliberately separate from
// PlayerPurchase/WalletTransaction (those are financial/business ledgers;
// this is a timeline for replay, debugging, and a future activity feed).
// No fixed union of `type` — the vocabulary is expected to keep growing as
// templates add their own lifecycle moments, and a closed enum here would
// mean a migration every time. Documented, engine-emitted values as of
// schema v3: auction_created, auction_started, auction_paused,
// auction_resumed, auction_completed, team_joined, captain_assigned,
// captain_value_changed, lot_opened, bid_placed, bid_undone, lot_sold,
// lot_unsold, sale_reversed, wallet_updated, wallet_transferred.
export interface AuctionEvent {
  id: number;
  auction_id: string;
  lot_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  actor: string | null;
  created_at: string;
}

// Fixed, engine-defined capability set — what the Permission Engine code
// actually branches on. `role` (on both AuctionPermission and
// AuctionOperator below) is free text; an organizer invents role names and
// grants them capabilities from this fixed list.
export type PermissionCapability =
  | "place_bid"
  | "undo"
  | "advance_lot"
  | "manage_wallets"
  | "edit_categories"
  | "view_wallets"
  | "view_reserve"
  | "assign_captain"
  | "manage_settings"
  | "transfer_funds";

export interface AuctionPermission {
  id: string;
  auction_id: string;
  role: string;
  capability: PermissionCapability;
  allowed: boolean;
}

export interface AuctionOperator {
  id: string;
  auction_id: string;
  role: string;
  label: string;
}
