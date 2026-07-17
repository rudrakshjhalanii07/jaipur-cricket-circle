-- AUCTIONOS — GENERIC LIVE AUCTION ENGINE (schema v3: SaaS platform pass)
-- Apply in Supabase SQL editor. Supersedes schema v2 (confirmed never
-- applied to a live Supabase — AUCTIONOS.md's own roadmap still listed
-- "apply this file" as pending — so this is a clean-slate rewrite, not a
-- migration, same as v2 was over v1).
--
-- WHY THIS REWRITE EXISTS
-- -----------------------
-- v2 moved templates/categories/settings out of code into tables, but was
-- still built assuming one club running one format: captains lived on the
-- global `teams` table, a wallet was hardcoded 1:1 with a team, roles were
-- a 2-value CHECK enum, and there was no financial ledger — just a mutated
-- balance column. AuctionOS is now meant to be a reusable platform many
-- organizers configure, so every one of those had to become organizer-
-- editable data instead of a JCC-shaped assumption:
--   • Captains  -> auction-scoped (auction_captains), zero rows unless a
--     template's captain module is enabled. Never touches `teams`.
--   • Wallets   -> split into `auction_wallet_kinds` (the shared concept,
--     "Main Purse") and `auction_wallets` (one instance per team per kind).
--     A category points at a KIND, not a specific team's wallet row — that's
--     the only way "Category -> Wallet" means anything once >1 team exists.
--   • Roles     -> free text; `auction_permissions` grants fixed engine
--     CAPABILITIES to organizer-invented role names, not a hardcoded enum.
--   • Money     -> `wallet_transactions` is now the source-of-truth ledger;
--     `auction_wallets.budget_remaining` is a cached column kept in sync by
--     the same RPC that appends a ledger row, never the reverse.
--   • Purchases -> `player_purchases` is now the source-of-truth "who
--     bought what for how much"; `auction_lots.sold_*` are cached columns
--     over the latest unreversed purchase for that lot.
--   • Captain valuation -> `captain_valuations` is an append-only snapshot
--     log (one row per recalculation), not a mutable field. The formula is
--     deterministic (50% of the captain's team's highest purchase in the
--     captain's own category) — there is no "suggested"/advisory framing;
--     the column is literally called captain_value.
--
-- Nothing here knows about cricket, lakhs, or captains as a JCC-specific
-- idea — the generic engine only knows "a captain is a team+category
-- pairing with a computed value," same as it only knows "a lot is a thing
-- with a base price," never that the thing is a cricketer.
--
-- `external_ref` on auction_lots deliberately has NO foreign key to any
-- template's own table (e.g. JCC's `players`) — unchanged from v1/v2, and
-- confirmed correct in the design discussion for this rewrite: Auction Lots
-- stay the one generic auctionable entity; a future template auctioning
-- vehicles or artwork needs zero engine changes, just its own source table
-- wired the same denormalize-into-metadata way JCC's pool builder already
-- does.
--
-- Same atomic-RPC-per-multi-table-write convention as the rest of this repo
-- (see add_atomic_series_match_save.sql) — every write that touches more
-- than one table is a single plpgsql function, not an app-level multi-step
-- save with a compensating rollback.

-- ============================================================
-- 0. Teams — global, site-wide roster of bidding teams. NOT auction-scoped.
-- Mirrors lib/teams.ts's TeamConfig shape as DB rows so auction_wallets.
-- team_id can be a real FK. `captain_player_id` from v2 is REMOVED — a
-- captain is now an auction-scoped fact (auction_captains below), not a
-- property of the global team roster; a template with no captain module
-- must not carry a dead column for it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id                 TEXT PRIMARY KEY,             -- slug: 'mavericks' | 'neurostrikers' | 'outliers' | 'vikings'
  name               TEXT NOT NULL,
  short_name         TEXT NOT NULL,
  logo               TEXT NOT NULL,
  jersey_number      INT,
  primary_color      TEXT NOT NULL,
  secondary_color    TEXT NOT NULL,
  accent_color       TEXT NOT NULL,
  glow_color         TEXT NOT NULL,
  tagline            TEXT,
  pattern_type       TEXT NOT NULL CHECK (pattern_type IN ('tribal', 'lightning', 'scratch')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- If this file is being re-run after a v2 apply that already created
-- captain_player_id, drop it — a no-op on a fresh database.
ALTER TABLE public.teams DROP COLUMN IF EXISTS captain_player_id;

INSERT INTO public.teams (id, name, short_name, logo, jersey_number, primary_color, secondary_color, accent_color, glow_color, tagline, pattern_type)
VALUES
  ('mavericks', 'Mavericks', 'MAV', '/teams/mavericks-logo.webp', 4, '#E8A820', '#0D0D0D', '#F5C842', 'rgba(245, 200, 66, 0.55)', 'Born to Dominate', 'tribal'),
  ('neurostrikers', 'NeuroStrikers', 'NS', '/teams/neurostrikers-logo.webp', 1, '#3B6FC4', '#111827', '#D9172A', 'rgba(96, 179, 255, 0.55)', 'Beyond Fear', 'lightning'),
  ('outliers', 'The Outliers', 'OUT', '/teams/outliers-logo.webp', 7, '#1A7A5E', '#1A1A1A', '#22C97A', 'rgba(34, 201, 122, 0.55)', 'Against the Odds', 'scratch'),
  ('vikings', 'Vikings', 'VIK', '/teams/vikings-logo.png', 100, '#176178', '#0B1620', '#BB7E42', 'rgba(23, 97, 120, 0.55)', 'Born to Conquer', 'lightning')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read teams" ON public.teams;
CREATE POLICY "Allow public read teams" ON public.teams FOR SELECT TO public USING (true);

-- ============================================================
-- 1. Template catalog — auction_templates + template_categories +
-- template_wallets. `module_key` still resolves the *algorithms* via the
-- code registry (lib/auctionos/core/registry.ts); everything below is the
-- *data* a template ships as defaults, copied (never referenced) into an
-- auction's own tables at creation time.
--
-- `theme` is a JSONB bag of presentational tokens (colors, asset keys) — a
-- deliberate exception to "editable config becomes typed columns": a
-- theme's shape is inherently open-ended and read only by UI, never
-- branched on by engine or template code, so it doesn't risk becoming an
-- "unreadable DSL" the way a business rule in JSONB would.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  module_key   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  description  TEXT,
  theme        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (slug, version)
);

INSERT INTO public.auction_templates (slug, name, version, module_key, status, description)
VALUES
  ('jcc', 'JCC Auction', 1, 'jcc', 'published', 'Jaipur Cricket Circle''s player auction — lakhs currency, role categories, captain valuation.'),
  ('blank', 'Blank Auction', 1, 'blank', 'published', 'Every module left at the engine''s neutral default — the reference starting point for a new format.')
ON CONFLICT (slug, version) DO NOTHING;

-- Categories a template ships with. `default_floor_price` (renamed from v2's
-- default_reserve_price) is the minimum opening bid a lot in this category
-- can carry — an entirely different concept from "reserve" as this rewrite
-- now defines it (see auction_captains / the reserve-calculation note on
-- auction_categories below). `wallet_kind_name` is resolved by NAME against
-- template_wallets at auction-creation time (both are template-scoped, so
-- name matching within one template_id is unambiguous) — there's no FK
-- since a template's categories and wallets are inserted independently and
-- name is the only shared vocabulary between them at seed time.
CREATE TABLE IF NOT EXISTS public.template_categories (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          UUID NOT NULL REFERENCES public.auction_templates(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  color                TEXT,
  icon                 TEXT,
  sort_order           INT NOT NULL DEFAULT 0,
  default_base_price   INT NOT NULL DEFAULT 0,
  default_floor_price  INT,
  min_required         INT NOT NULL DEFAULT 0,   -- mandatory squad slots a team must fill in this category
  max_allowed          INT,                       -- nullable = unbounded
  wallet_kind_name      TEXT                       -- resolved against template_wallets.name at seed time
);

-- Wallet KINDS a template ships with — e.g. JCC ships one kind, "Main
-- Purse". A second template could ship two ("Domestic Purse", "Overseas
-- Purse") without any engine change. `initial_balance` here is the default
-- an organizer can override per auction at creation time.
CREATE TABLE IF NOT EXISTS public.template_wallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES public.auction_templates(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  initial_balance   INT NOT NULL,
  transfer_enabled  BOOLEAN NOT NULL DEFAULT false,
  sort_order        INT NOT NULL DEFAULT 0
);

INSERT INTO public.template_wallets (template_id, name, initial_balance, transfer_enabled, sort_order)
SELECT t.id, 'Main Purse', 2000, false, 0
FROM public.auction_templates t
WHERE t.slug IN ('jcc', 'blank') AND t.version = 1
ON CONFLICT DO NOTHING;

-- Mirrors lib/auctionos/templates/jcc/categories.ts + the reserve tiers in
-- lib/auctionos/templates/jcc/reserve.ts, both in lakhs. Every JCC category
-- draws from the single "Main Purse" kind.
INSERT INTO public.template_categories (template_id, name, color, sort_order, default_base_price, default_floor_price, wallet_kind_name)
SELECT t.id, c.name, NULL, c.sort_order, 20, c.floor, 'Main Purse'
FROM public.auction_templates t
CROSS JOIN (VALUES
  ('Marquee', 0, 100),
  ('All-Rounders', 1, 75),
  ('Batters', 2, 50),
  ('Bowlers', 3, 30),
  ('Wicketkeepers', 4, 20)
) AS c(name, sort_order, floor)
WHERE t.slug = 'jcc' AND t.version = 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Auctions — one row per running auction. No `config` JSONB catch-all;
-- every organizer-editable toggle is a typed column on auction_settings.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auctions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES public.auction_templates(id),
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled', 'live', 'completed')),
  starts_at        TIMESTAMPTZ,
  current_lot_id   UUID,
  access_code      TEXT UNIQUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- If this file is being re-run after a pre-SaaS-pivot apply, add the
-- column — a no-op on a fresh database.
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- SaaS pivot: the auction code is the ONLY front door — see AUCTIONOS.md's
-- "Landing philosophy" section. auctions is no longer publicly listable
-- (a caller must already hold a valid access_code, resolved server-side by
-- /api/auctionos/resolve-code with the service-role client, to learn an
-- auction's id at all). This intentionally breaks anonymous enumeration of
-- auction rows; it does NOT yet lock down auction_wallets/auction_lots/
-- auction_categories reads once an id is known (still public SELECT,
-- scoped by an unguessable UUID) — see "Known risk" for why that's
-- deliberately deferred rather than silently assumed solved here. The
-- table's own public-read policy is dropped (not recreated) in §18 below.

-- ============================================================
-- 3. Auction settings — the single configuration source for an auction.
-- Every organizer-facing toggle belongs here unless there's a strong
-- relational reason it can't be (e.g. captain module ON/OFF is a setting;
-- the captains themselves are their own table because they have identity
-- and relationships, not because they're "config").
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_settings (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id                    UUID NOT NULL UNIQUE REFERENCES public.auctions(id) ON DELETE CASCADE,
  max_teams                     INT,
  allow_operator_bids           BOOLEAN NOT NULL DEFAULT false,
  undo_enabled                  BOOLEAN NOT NULL DEFAULT true,
  captain_module_enabled        BOOLEAN NOT NULL DEFAULT false,
  unsold_round_enabled          BOOLEAN NOT NULL DEFAULT true,
  allocation_enabled            BOOLEAN NOT NULL DEFAULT true,
  auction_order_mode            TEXT NOT NULL DEFAULT 'sequential',
  show_floor_price_to_spectators    BOOLEAN NOT NULL DEFAULT true,
  show_wallets_to_spectators    BOOLEAN NOT NULL DEFAULT true,
  show_valuation_to_operators   BOOLEAN NOT NULL DEFAULT false,
  spectator_visibility          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Auction wallet KINDS — the shared, auction-scoped concept a category
-- points at ("Main Purse", "Overseas Purse"). Copied from template_wallets
-- at creation time (same copy-not-reference semantics as categories); an
-- organizer renaming/rebalancing one auction's kind never touches the
-- template or any other auction. Every registered team gets exactly one
-- auction_wallets row per kind — see auctionos_create_auction.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_wallet_kinds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id        UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  initial_balance   INT NOT NULL,
  transfer_enabled  BOOLEAN NOT NULL DEFAULT false,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (auction_id, name)
);

-- ============================================================
-- 5. Auction categories — live, organizer-editable per auction. Seeded
-- once from template_categories (or the creation payload), then fully
-- independent. `floor_price` (renamed from v2's reserve_price) is the
-- minimum opening bid for a lot in this category — the ONLY thing called
-- "reserve" from here on is the wallet-level number computed live by the
-- Reserve Engine (remaining mandatory slots × current base prices); that
-- number is never stored anywhere in this schema.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id        UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  wallet_kind_id    UUID REFERENCES public.auction_wallet_kinds(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  color             TEXT,
  icon              TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  base_price        INT NOT NULL DEFAULT 0,
  floor_price       INT,
  min_required      INT NOT NULL DEFAULT 0,
  max_allowed       INT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. Auction wallets — one row per (team, wallet kind) per auction. This is
-- the actual money container the engine debits/credits; `auction_wallet_
-- kinds` above is just the shared label/config a category and every team's
-- instance of it share. budget_total/budget_remaining are integer minor
-- units, CACHED from wallet_transactions (see §11) — never hand-edited.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_wallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id        UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  wallet_kind_id    UUID NOT NULL REFERENCES public.auction_wallet_kinds(id) ON DELETE CASCADE,
  team_id           TEXT NOT NULL REFERENCES public.teams(id),
  display_name      TEXT,                       -- optional UI-only override; team.name + wallet_kind.name already identify it
  budget_total      INT NOT NULL,
  budget_remaining  INT NOT NULL,
  acquired_count    INT NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (auction_id, wallet_kind_id, team_id)
);

-- ============================================================
-- 7. Wallet category caps — OPTIONAL, organizer-set per-category spend/lot
-- caps on top of whatever a wallet's kind already funds (e.g. "Vikings may
-- spend at most 400L of their Main Purse on Bowlers specifically"). Empty
-- by default, not read by any RPC yet — a future validateBid hook is the
-- natural place to enforce these.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_wallet_category_caps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     UUID NOT NULL REFERENCES public.auction_wallets(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES public.auction_categories(id) ON DELETE CASCADE,
  max_spend     INT,
  max_lots      INT,
  UNIQUE (wallet_id, category_id)
);

-- ============================================================
-- 8. Auction captains — auction-scoped; ZERO rows for any auction whose
-- template/settings doesn't enable the captain module. Tied to team_id
-- (global identity), not a specific wallet row, because "that captain's
-- team's purchases in that category" is resolved through auction_wallets
-- (team_id + the category's wallet_kind_id) at valuation time — storing a
-- wallet_id here would hardcode which kind the captain's purchases are
-- read from, when that's actually the category's decision.
-- UNIQUE(auction_id, team_id): a team has exactly one captain, and that
-- captain occupies exactly one category slot (category_id).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_captains (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id     UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  team_id        TEXT NOT NULL REFERENCES public.teams(id),
  category_id    UUID NOT NULL REFERENCES public.auction_categories(id),
  external_ref   UUID,                          -- optional pointer into a template's own player data, no FK
  display_name   TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (auction_id, team_id)
);

-- ============================================================
-- 9. Auction lots — the item list for an auction. `sold_price`/
-- `sold_wallet_id`/`sold_at` are CACHED from the latest unreversed
-- player_purchases row for this lot (see §10) — kept here because the lot
-- card is the single hottest read in the whole app (polled every 4s per
-- AUCTIONOS.md §16) and a join for every poll isn't worth it. `version` is
-- the optimistic-lock counter. `external_ref` stays FK-less — see this
-- file's header.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_lots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id                  UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  category_id                 UUID REFERENCES public.auction_categories(id) ON DELETE SET NULL,
  external_ref                UUID,
  display_name                TEXT NOT NULL,
  lot_order                   INT NOT NULL,
  base_price                  INT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'upcoming'
                              CHECK (status IN ('upcoming', 'on_block', 'sold', 'unsold')),

  current_bid                 INT,
  current_bid_wallet_id       UUID REFERENCES public.auction_wallets(id) ON DELETE SET NULL,

  sold_price                  INT,
  sold_wallet_id              UUID REFERENCES public.auction_wallets(id) ON DELETE SET NULL,
  sold_at                     TIMESTAMPTZ,

  version                     INT NOT NULL DEFAULT 0,
  metadata                    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (auction_id, lot_order)
);

ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_current_lot_fk;
ALTER TABLE public.auctions
  ADD CONSTRAINT auctions_current_lot_fk
  FOREIGN KEY (current_lot_id) REFERENCES public.auction_lots(id) ON DELETE SET NULL;

-- ============================================================
-- 10. Bid history — append-only audit trail of every raise on a lot.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id           UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  wallet_id        UUID NOT NULL REFERENCES public.auction_wallets(id) ON DELETE CASCADE,
  amount           INT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. Player purchases — SOURCE OF TRUTH for "who bought what, for how
-- much." auction_lots.sold_* (§9) is a cache over the latest row here with
-- reversed_at IS NULL. Undo doesn't delete a purchase — it stamps
-- reversed_at, so the full history (including reversed purchases) survives
-- for audit, and the Captain Valuation Engine's "highest qualifying
-- purchase" query only has to add `WHERE reversed_at IS NULL`.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id     UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  lot_id         UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  wallet_id      UUID NOT NULL REFERENCES public.auction_wallets(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES public.auction_categories(id) ON DELETE SET NULL,
  price          INT NOT NULL,
  purchased_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at    TIMESTAMPTZ
);

-- ============================================================
-- 12. Wallet transactions — SOURCE OF TRUTH financial ledger.
-- auction_wallets.budget_remaining/acquired_count (§6) are cached values
-- kept in sync in the same transaction that appends a ledger row here —
-- they are never the authority, this table is. `transfer_group_id` links
-- the paired transfer_out/transfer_in rows a wallet-to-wallet transfer
-- produces (double-entry, so every transfer is auditable from either
-- wallet's side). amount is signed: debits negative, credits positive.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id            UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  wallet_id             UUID NOT NULL REFERENCES public.auction_wallets(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('purchase', 'purchase_undo', 'transfer_out', 'transfer_in', 'adjustment')),
  amount                INT NOT NULL,
  related_purchase_id   UUID REFERENCES public.player_purchases(id),
  transfer_group_id     UUID,
  actor                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. Captain valuations — append-only snapshot log. There is no mutable
-- "current value" field anywhere: the current captain_value is just the
-- latest row for a captain_id, same pattern as reading the latest
-- unreversed player_purchases row for a lot. captain_value is nullable —
-- NULL means "no qualifying purchase yet," not zero.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.captain_valuations (
  id                       BIGSERIAL PRIMARY KEY,
  auction_id               UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  captain_id               UUID NOT NULL REFERENCES public.auction_captains(id) ON DELETE CASCADE,
  triggering_purchase_id   UUID REFERENCES public.player_purchases(id),
  captain_value            NUMERIC,
  rationale                JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. Auction events — complete chronological system history, DELIBERATELY
-- separate from wallet_transactions/player_purchases: those two are
-- financial/business ledgers built for reconciliation queries (sum of a
-- wallet, latest purchase for a lot); this is a timeline built for replay,
-- debugging, and a future admin/spectator activity feed. A single sale
-- produces one player_purchases row, one wallet_transactions row, AND one
-- 'lot_sold' event — three different consumers, three different shapes.
--
-- `type` has NO CHECK constraint (unlike v2) — deliberately, per "choose
-- the abstraction that's easier to extend": the event vocabulary is
-- expected to keep growing as templates add their own lifecycle moments
-- (Team Joined, Captain Assigned, Player Registered, Auction Paused, ...),
-- and a fixed enum would mean a migration every time. The documented,
-- engine-emitted vocabulary as of this schema:
--   auction_created, auction_started, auction_paused, auction_resumed,
--   auction_completed, team_joined, captain_assigned, captain_value_changed,
--   lot_opened, bid_placed, bid_undone, lot_sold, lot_unsold, sale_reversed,
--   wallet_updated, wallet_transferred
-- A template module is free to insert its own additional type strings.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_events (
  id            BIGSERIAL PRIMARY KEY,
  auction_id    UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  lot_id        UUID REFERENCES public.auction_lots(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. Auction permissions — organizer-editable capability grants. `role` is
-- free text (an organizer invents role names); `capability` is a FIXED,
-- engine-defined CHECK list — capabilities are what the Permission Engine
-- code actually branches on, so unlike roles, these must not be free text.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id    UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  capability    TEXT NOT NULL CHECK (capability IN (
                  'place_bid', 'undo', 'advance_lot', 'manage_wallets',
                  'edit_categories', 'view_wallets', 'view_reserve',
                  'assign_captain', 'manage_settings', 'transfer_funds'
                )),
  allowed       BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (auction_id, role, capability)
);

-- ============================================================
-- 16. Auction operators — scoped auctioneer credentials, one row per
-- person per auction. `role` is free text now (was a 2-value CHECK enum in
-- v2) — validity is an application-layer concern (does auction_permissions
-- have a grant for this role?), not a schema-level enum. No public read
-- policy (service-role client only).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_operators (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id     UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,
  role           TEXT NOT NULL,
  label          TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_auction_wallet_kinds_auction ON public.auction_wallet_kinds (auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_wallets_auction ON public.auction_wallets (auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_wallets_kind ON public.auction_wallets (wallet_kind_id);
CREATE INDEX IF NOT EXISTS idx_auction_categories_auction ON public.auction_categories (auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_categories_wallet_kind ON public.auction_categories (wallet_kind_id);
CREATE INDEX IF NOT EXISTS idx_auction_captains_auction ON public.auction_captains (auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_auction ON public.auction_lots (auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_status ON public.auction_lots (auction_id, status);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions (status);
CREATE INDEX IF NOT EXISTS idx_auction_bids_lot ON public.auction_bids (lot_id);
CREATE INDEX IF NOT EXISTS idx_player_purchases_wallet_category ON public.player_purchases (wallet_id, category_id) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_player_purchases_lot ON public.player_purchases (lot_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON public.wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_captain_valuations_captain ON public.captain_valuations (captain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_events_auction ON public.auction_events (auction_id, id);
CREATE INDEX IF NOT EXISTS idx_auction_permissions_auction_role ON public.auction_permissions (auction_id, role);

-- ============================================================
-- 18. RLS — public read on everything except auction_operators.
-- ============================================================
ALTER TABLE public.auction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_wallet_kinds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_wallet_category_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captain_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_operators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read auction_templates" ON public.auction_templates;
CREATE POLICY "Allow public read auction_templates" ON public.auction_templates FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read template_categories" ON public.template_categories;
CREATE POLICY "Allow public read template_categories" ON public.template_categories FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read template_wallets" ON public.template_wallets;
CREATE POLICY "Allow public read template_wallets" ON public.template_wallets FOR SELECT TO public USING (true);
-- No public read policy for auctions — deliberate, see §2's comment above.
-- RLS stays enabled with zero SELECT policies, so only the service-role
-- client (which bypasses RLS) can read this table; every anon lookup must
-- go through /api/auctionos/resolve-code instead.
DROP POLICY IF EXISTS "Allow public read auctions" ON public.auctions;
DROP POLICY IF EXISTS "Allow public read auction_settings" ON public.auction_settings;
CREATE POLICY "Allow public read auction_settings" ON public.auction_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_wallet_kinds" ON public.auction_wallet_kinds;
CREATE POLICY "Allow public read auction_wallet_kinds" ON public.auction_wallet_kinds FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_categories" ON public.auction_categories;
CREATE POLICY "Allow public read auction_categories" ON public.auction_categories FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_wallets" ON public.auction_wallets;
CREATE POLICY "Allow public read auction_wallets" ON public.auction_wallets FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_wallet_category_caps" ON public.auction_wallet_category_caps;
CREATE POLICY "Allow public read auction_wallet_category_caps" ON public.auction_wallet_category_caps FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_captains" ON public.auction_captains;
CREATE POLICY "Allow public read auction_captains" ON public.auction_captains FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_lots" ON public.auction_lots;
CREATE POLICY "Allow public read auction_lots" ON public.auction_lots FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_bids" ON public.auction_bids;
CREATE POLICY "Allow public read auction_bids" ON public.auction_bids FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read player_purchases" ON public.player_purchases;
CREATE POLICY "Allow public read player_purchases" ON public.player_purchases FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Allow public read wallet_transactions" ON public.wallet_transactions FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read captain_valuations" ON public.captain_valuations;
CREATE POLICY "Allow public read captain_valuations" ON public.captain_valuations FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_events" ON public.auction_events;
CREATE POLICY "Allow public read auction_events" ON public.auction_events FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow public read auction_permissions" ON public.auction_permissions;
CREATE POLICY "Allow public read auction_permissions" ON public.auction_permissions FOR SELECT TO public USING (true);
-- No policy for auction_operators — deliberate, see §16.

-- ============================================================
-- RPCs — one per multi-table write. Bid-increment tiering, reserve, and
-- valuation math are still computed by the resolved template in the API
-- route layer (TypeScript) and passed in as plain numbers/derived
-- read-side; these functions only validate + apply state changes
-- atomically, plus append the corresponding ledger/event rows in the same
-- transaction. No business logic lives in SQL — see AUCTIONOS.md.
--
-- CQRS split, enforced at the database, not just in application code:
-- every function below is a COMMAND (a mutation) — there are no read-only
-- "query" RPCs in this file, because reads already go straight from the
-- browser to Supabase tables via RLS (lib/auctionos/core/data.ts,
-- lib/auctionos/templates/*/data.ts), which is exactly where they should
-- stay: fast, cacheable, no server round-trip.
--
-- Every command function below is immediately followed by:
--   REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;
--   GRANT EXECUTE ... TO service_role;
-- This is the actual authorization boundary — only Next.js API routes
-- using the service-role client (supabaseAdmin) can invoke these, never
-- a browser holding just the anon key. RLS on the underlying tables having
-- no write policies for anon is a coincidental second layer, not the
-- mechanism this depends on; do not remove the REVOKE/GRANT pair on the
-- assumption "RLS already blocks it" — a future RLS policy change must not
-- be able to silently reopen a command to public callers. Any new command
-- function added later must ship with its own REVOKE/GRANT pair in the
-- same commit that creates it.
-- ============================================================

-- Internal helper: recalculates and logs a captain's valuation after a
-- purchase or purchase-undo affecting their team+category. No-op if the
-- team has no captain assigned to that category (most teams, most
-- categories, and every auction with the captain module off).
-- DROP FUNCTION matches by argument TYPES, not parameter names — needed
-- because an earlier partial apply (pre "season" -> "auction" rename) may
-- have left functions with the same name/types but differently-named
-- parameters (e.g. p_season_id), and CREATE OR REPLACE refuses to rename a
-- parameter in place (Postgres error 42P13).
DROP FUNCTION IF EXISTS public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID);
CREATE OR REPLACE FUNCTION public._auctionos_recalc_captain_valuation(
  p_auction_id UUID,
  p_team_id TEXT,
  p_category_id UUID,
  p_triggering_purchase_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_captain_id UUID;
  v_highest    INT;
BEGIN
  SELECT id INTO v_captain_id
  FROM public.auction_captains
  WHERE auction_id = p_auction_id AND team_id = p_team_id AND category_id = p_category_id;

  IF v_captain_id IS NULL THEN
    RETURN; -- this team has no captain in this category — nothing to recalculate
  END IF;

  SELECT MAX(pp.price) INTO v_highest
  FROM public.player_purchases pp
  JOIN public.auction_wallets aw ON aw.id = pp.wallet_id
  WHERE pp.auction_id = p_auction_id
    AND aw.team_id = p_team_id
    AND pp.category_id = p_category_id
    AND pp.reversed_at IS NULL;

  INSERT INTO public.captain_valuations (auction_id, captain_id, triggering_purchase_id, captain_value, rationale)
  VALUES (
    p_auction_id,
    v_captain_id,
    p_triggering_purchase_id,
    CASE WHEN v_highest IS NULL THEN NULL ELSE v_highest * 0.5 END,
    jsonb_build_object('highest_qualifying_purchase', v_highest)
  );

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'captain_value_changed', jsonb_build_object('captain_id', v_captain_id, 'highest_qualifying_purchase', v_highest), 'system');
END;
$func$;

-- Internal helper, never called directly over HTTP — locked down anyway
-- since PostgREST exposes every public-schema function by default.
REVOKE EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID) TO service_role;

-- Creates the auction + settings + wallet kinds (+ one auction_wallets row
-- per team per kind) + categories + lots, all in one transaction, and
-- appends 'auction_created' + 'auction_started' events. payload shape:
-- {
--   "template_id": "uuid",
--   "name": "Season II",
--   "starts_at": "2026-07-20T18:00:00Z" | null,
--   "settings": { "max_teams": 4, "captain_module_enabled": true, ... } | null,
--   "team_ids": ["mavericks","neurostrikers","outliers","vikings"],
--   "wallet_kinds": [{"name":"Main Purse","initial_balance":2000,"transfer_enabled":false,"sort_order":0}] | null,
--                    -- if null/omitted, copied from template_wallets for template_id
--   "categories": [{"name":"Marquee","color":null,"icon":null,"sort_order":0,"base_price":100,"floor_price":100,"min_required":0,"max_allowed":null,"wallet_kind_name":"Main Purse"}, ...] | null,
--                  -- if null/omitted, copied from template_categories for template_id
--   "lots": [{"external_ref":"uuid"|null,"display_name":"...","base_price":50,"lot_order":1,"category_id":"uuid"|null,"metadata":{"role":"batter","image":null}}, ...]
-- }
-- Returns {"auction_id": "uuid", "access_code": "ABC123"} — the code is the
-- ONLY way a spectator/participant ever learns this auction's id (see §2's
-- comment on why `auctions` has no public read policy); the organizer must
-- copy it out of this response and share it themselves, since there is no
-- other retrieval path once this call returns.
DROP FUNCTION IF EXISTS public.auctionos_create_auction(JSONB);
CREATE OR REPLACE FUNCTION public.auctionos_create_auction(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction_id   UUID;
  v_template_id  UUID := (payload->>'template_id')::UUID;
  v_settings     JSONB := payload->'settings';
  v_kind         JSONB;
  v_category     JSONB;
  v_lot          JSONB;
  v_team_id      TEXT;
  v_kind_row     RECORD;
  v_access_code  TEXT;
BEGIN
  -- 6-char uppercase alphanumeric code, regenerated on the rare UNIQUE
  -- collision. No confusable 0/O/1/I — organizers read these out loud.
  LOOP
    SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 33)::INT, 1), '')
    INTO v_access_code
    FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.auctions WHERE access_code = v_access_code);
  END LOOP;

  INSERT INTO public.auctions (template_id, name, status, starts_at, access_code)
  VALUES (v_template_id, payload->>'name', 'scheduled', NULLIF(payload->>'starts_at', '')::TIMESTAMPTZ, v_access_code)
  RETURNING id INTO v_auction_id;

  INSERT INTO public.auction_settings (
    auction_id, max_teams, allow_operator_bids, undo_enabled,
    captain_module_enabled, unsold_round_enabled, allocation_enabled, auction_order_mode,
    show_floor_price_to_spectators, show_wallets_to_spectators, show_valuation_to_operators,
    spectator_visibility
  ) VALUES (
    v_auction_id,
    NULLIF(v_settings->>'max_teams', '')::INT,
    COALESCE((v_settings->>'allow_operator_bids')::BOOLEAN, false),
    COALESCE((v_settings->>'undo_enabled')::BOOLEAN, true),
    COALESCE((v_settings->>'captain_module_enabled')::BOOLEAN, false),
    COALESCE((v_settings->>'unsold_round_enabled')::BOOLEAN, true),
    COALESCE((v_settings->>'allocation_enabled')::BOOLEAN, true),
    COALESCE(v_settings->>'auction_order_mode', 'sequential'),
    COALESCE((v_settings->>'show_floor_price_to_spectators')::BOOLEAN, true),
    COALESCE((v_settings->>'show_wallets_to_spectators')::BOOLEAN, true),
    COALESCE((v_settings->>'show_valuation_to_operators')::BOOLEAN, false),
    COALESCE(v_settings->'spectator_visibility', '{}'::JSONB)
  );

  -- Wallet kinds: from payload, or copied from template_wallets.
  IF jsonb_typeof(payload->'wallet_kinds') = 'array' AND jsonb_array_length(payload->'wallet_kinds') > 0 THEN
    FOR v_kind IN SELECT * FROM jsonb_array_elements(payload->'wallet_kinds')
    LOOP
      INSERT INTO public.auction_wallet_kinds (auction_id, name, initial_balance, transfer_enabled, sort_order)
      VALUES (
        v_auction_id, v_kind->>'name', (v_kind->>'initial_balance')::INT,
        COALESCE((v_kind->>'transfer_enabled')::BOOLEAN, false),
        COALESCE((v_kind->>'sort_order')::INT, 0)
      );
    END LOOP;
  ELSE
    INSERT INTO public.auction_wallet_kinds (auction_id, name, initial_balance, transfer_enabled, sort_order)
    SELECT v_auction_id, tw.name, tw.initial_balance, tw.transfer_enabled, tw.sort_order
    FROM public.template_wallets tw
    WHERE tw.template_id = v_template_id;
  END IF;

  -- One auction_wallets row per team per kind.
  FOR v_team_id IN SELECT * FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(payload->'team_ids') = 'array' THEN payload->'team_ids' ELSE '[]'::JSONB END
  )
  LOOP
    FOR v_kind_row IN SELECT id, initial_balance FROM public.auction_wallet_kinds WHERE auction_id = v_auction_id
    LOOP
      INSERT INTO public.auction_wallets (auction_id, wallet_kind_id, team_id, budget_total, budget_remaining)
      VALUES (v_auction_id, v_kind_row.id, v_team_id, v_kind_row.initial_balance, v_kind_row.initial_balance);
    END LOOP;
    INSERT INTO public.auction_events (auction_id, type, payload, actor)
    VALUES (v_auction_id, 'team_joined', jsonb_build_object('team_id', v_team_id), 'system');
  END LOOP;

  -- Categories: from payload, or copied from template_categories (wallet
  -- resolved by name against the kinds just created/copied above).
  IF jsonb_typeof(payload->'categories') = 'array' AND jsonb_array_length(payload->'categories') > 0 THEN
    FOR v_category IN SELECT * FROM jsonb_array_elements(payload->'categories')
    LOOP
      INSERT INTO public.auction_categories (auction_id, wallet_kind_id, name, color, icon, sort_order, base_price, floor_price, min_required, max_allowed)
      VALUES (
        v_auction_id,
        (SELECT id FROM public.auction_wallet_kinds WHERE auction_id = v_auction_id AND name = v_category->>'wallet_kind_name'),
        v_category->>'name',
        v_category->>'color',
        v_category->>'icon',
        COALESCE((v_category->>'sort_order')::INT, 0),
        COALESCE((v_category->>'base_price')::INT, 0),
        NULLIF(v_category->>'floor_price', '')::INT,
        COALESCE((v_category->>'min_required')::INT, 0),
        NULLIF(v_category->>'max_allowed', '')::INT
      );
    END LOOP;
  ELSE
    INSERT INTO public.auction_categories (auction_id, wallet_kind_id, name, color, icon, sort_order, base_price, floor_price, min_required, max_allowed)
    SELECT
      v_auction_id,
      (SELECT awk.id FROM public.auction_wallet_kinds awk WHERE awk.auction_id = v_auction_id AND awk.name = tc.wallet_kind_name),
      tc.name, tc.color, tc.icon, tc.sort_order, tc.default_base_price, tc.default_floor_price, tc.min_required, tc.max_allowed
    FROM public.template_categories tc
    WHERE tc.template_id = v_template_id;
  END IF;

  FOR v_lot IN SELECT * FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(payload->'lots') = 'array' THEN payload->'lots' ELSE '[]'::JSONB END
  )
  LOOP
    INSERT INTO public.auction_lots (
      auction_id, category_id, external_ref, display_name, base_price, lot_order, status, metadata
    ) VALUES (
      v_auction_id,
      NULLIF(v_lot->>'category_id', '')::UUID,
      NULLIF(v_lot->>'external_ref', '')::UUID,
      v_lot->>'display_name',
      (v_lot->>'base_price')::INT,
      (v_lot->>'lot_order')::INT,
      'upcoming',
      COALESCE(v_lot->'metadata', '{}'::JSONB)
    );
  END LOOP;

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (v_auction_id, 'auction_created', jsonb_build_object('name', payload->>'name'), 'system');

  RETURN jsonb_build_object('auction_id', v_auction_id, 'access_code', v_access_code);
END;
$func$;

-- COMMAND — server-only (auction creation).
REVOKE EXECUTE ON FUNCTION public.auctionos_create_auction(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_create_auction(JSONB) TO service_role;

-- Assigns a captain: one call, one team, one category. Fails loudly if the
-- auction's captain module isn't enabled, or the team already has one.
DROP FUNCTION IF EXISTS public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.auctionos_assign_captain(
  p_auction_id UUID,
  p_team_id TEXT,
  p_category_id UUID,
  p_external_ref UUID,
  p_display_name TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_enabled    BOOLEAN;
  v_captain_id UUID;
BEGIN
  SELECT captain_module_enabled INTO v_enabled FROM public.auction_settings WHERE auction_id = p_auction_id;
  IF v_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'captain module is not enabled for this auction';
  END IF;

  INSERT INTO public.auction_captains (auction_id, team_id, category_id, external_ref, display_name, metadata)
  VALUES (p_auction_id, p_team_id, p_category_id, p_external_ref, p_display_name, p_metadata)
  RETURNING id INTO v_captain_id;

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'captain_assigned', jsonb_build_object('captain_id', v_captain_id, 'team_id', p_team_id, 'category_id', p_category_id), 'system');

  -- Seed an initial valuation snapshot (captain_value NULL — no purchases yet).
  INSERT INTO public.captain_valuations (auction_id, captain_id, captain_value, rationale)
  VALUES (p_auction_id, v_captain_id, NULL, '{}'::JSONB);

  RETURN jsonb_build_object('captain_id', v_captain_id);
END;
$func$;

-- COMMAND — server-only (captain assignment).
REVOKE EXECUTE ON FUNCTION public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB) TO service_role;

-- Wallet-to-wallet transfer — legal only if BOTH wallets' kind has
-- transfer_enabled = true. Double-entry: one negative + one positive
-- wallet_transactions row, sharing transfer_group_id.
DROP FUNCTION IF EXISTS public.auctionos_transfer_funds(UUID, UUID, INT, TEXT);
CREATE OR REPLACE FUNCTION public.auctionos_transfer_funds(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_amount INT,
  p_actor TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction        UUID;
  v_from_enabled   BOOLEAN;
  v_to_enabled     BOOLEAN;
  v_from_auction   UUID;
  v_to_auction     UUID;
  v_group          UUID := gen_random_uuid();
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'transfer amount must be positive';
  END IF;

  SELECT aw.auction_id, awk.transfer_enabled INTO v_from_auction, v_from_enabled
  FROM public.auction_wallets aw JOIN public.auction_wallet_kinds awk ON awk.id = aw.wallet_kind_id
  WHERE aw.id = p_from_wallet_id FOR UPDATE OF aw;

  SELECT aw.auction_id, awk.transfer_enabled INTO v_to_auction, v_to_enabled
  FROM public.auction_wallets aw JOIN public.auction_wallet_kinds awk ON awk.id = aw.wallet_kind_id
  WHERE aw.id = p_to_wallet_id FOR UPDATE OF aw;

  IF v_from_auction IS NULL OR v_to_auction IS NULL OR v_from_auction <> v_to_auction THEN
    RAISE EXCEPTION 'both wallets must belong to the same auction';
  END IF;
  IF NOT v_from_enabled OR NOT v_to_enabled THEN
    RAISE EXCEPTION 'transfers are not enabled for one of these wallet kinds';
  END IF;
  v_auction := v_from_auction;

  UPDATE public.auction_wallets SET budget_remaining = budget_remaining - p_amount, updated_at = NOW()
  WHERE id = p_from_wallet_id AND budget_remaining >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'source wallet cannot afford this transfer';
  END IF;

  UPDATE public.auction_wallets SET budget_remaining = budget_remaining + p_amount, updated_at = NOW()
  WHERE id = p_to_wallet_id;

  INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, transfer_group_id, actor)
  VALUES (v_auction, p_from_wallet_id, 'transfer_out', -p_amount, v_group, p_actor);
  INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, transfer_group_id, actor)
  VALUES (v_auction, p_to_wallet_id, 'transfer_in', p_amount, v_group, p_actor);

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (v_auction, 'wallet_transferred', jsonb_build_object('from_wallet_id', p_from_wallet_id, 'to_wallet_id', p_to_wallet_id, 'amount', p_amount), p_actor);

  RETURN jsonb_build_object('transfer_group_id', v_group);
END;
$func$;

-- COMMAND — server-only (moves money between wallets).
REVOKE EXECUTE ON FUNCTION public.auctionos_transfer_funds(UUID, UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_transfer_funds(UUID, UUID, INT, TEXT) TO service_role;

-- Puts the next 'upcoming' lot on the block; flips the auction to 'live' on
-- first call. Unchanged from v2 besides the doc header above.
DROP FUNCTION IF EXISTS public.auctionos_advance_lot(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_advance_lot(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_next_id UUID;
BEGIN
  SELECT id INTO v_next_id
  FROM public.auction_lots
  WHERE auction_id = p_auction_id AND status = 'upcoming'
  ORDER BY lot_order ASC
  LIMIT 1;

  IF v_next_id IS NULL THEN
    UPDATE public.auctions
    SET status = 'completed', current_lot_id = NULL, updated_at = NOW()
    WHERE id = p_auction_id AND status <> 'completed';
    INSERT INTO public.auction_events (auction_id, type, payload, actor)
    VALUES (p_auction_id, 'auction_completed', '{}'::JSONB, 'system');
    RETURN jsonb_build_object('lot_id', NULL);
  END IF;

  UPDATE public.auction_lots
  SET status = 'on_block', current_bid = base_price, current_bid_wallet_id = NULL, updated_at = NOW()
  WHERE id = v_next_id;

  UPDATE public.auctions
  SET status = 'live', current_lot_id = v_next_id, updated_at = NOW()
  WHERE id = p_auction_id;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (p_auction_id, v_next_id, 'lot_opened', '{}'::JSONB, 'system');

  RETURN jsonb_build_object('lot_id', v_next_id);
END;
$func$;

-- COMMAND — server-only (advances the auction's frontier).
REVOKE EXECUTE ON FUNCTION public.auctionos_advance_lot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_advance_lot(UUID) TO service_role;

-- Raises the bid for a wallet. Unchanged from v2 — bids don't touch
-- purchases/ledger, only the append-only bid history, until the lot is
-- actually marked sold.
DROP FUNCTION IF EXISTS public.auctionos_raise_bid(UUID, UUID, INT, INT);
DROP FUNCTION IF EXISTS public.auctionos_raise_bid(UUID, UUID, INT); -- pre-optimistic-lock signature, if it ever landed
CREATE OR REPLACE FUNCTION public.auctionos_raise_bid(
  p_lot_id UUID,
  p_wallet_id UUID,
  p_new_bid INT,
  p_expected_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_status   TEXT;
  v_auction  UUID;
  v_version  INT;
  v_budget   INT;
  v_previous_bid INT;
BEGIN
  SELECT status, auction_id, version, current_bid INTO v_status, v_auction, v_version, v_previous_bid
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'lot is not currently on the block';
  END IF;
  IF v_version <> p_expected_version THEN
    RAISE EXCEPTION 'someone else bid first — refresh and try again (expected version %, saw %)', p_expected_version, v_version;
  END IF;

  SELECT budget_remaining INTO v_budget
  FROM public.auction_wallets
  WHERE id = p_wallet_id AND auction_id = v_auction;

  IF v_budget IS NULL THEN
    RAISE EXCEPTION 'wallet not found in this auction';
  END IF;
  IF v_budget < p_new_bid THEN
    RAISE EXCEPTION 'wallet cannot afford this bid';
  END IF;

  UPDATE public.auction_lots
  SET current_bid = p_new_bid, current_bid_wallet_id = p_wallet_id, version = version + 1, updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.auction_bids (lot_id, wallet_id, amount)
  VALUES (p_lot_id, p_wallet_id, p_new_bid);

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'bid_placed', jsonb_build_object('wallet_id', p_wallet_id, 'amount', p_new_bid, 'previous_bid', v_previous_bid), 'system');

  RETURN jsonb_build_object('lot_id', p_lot_id, 'current_bid', p_new_bid, 'current_bid_wallet_id', p_wallet_id, 'version', v_version + 1);
END;
$func$;

-- COMMAND — server-only. This is the one most tempting to call straight
-- from the browser for latency reasons — don't; validateBid() and
-- increment computation happen in the API route first, and that check is
-- meaningless if a client can call this RPC directly and skip it.
REVOKE EXECUTE ON FUNCTION public.auctionos_raise_bid(UUID, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_raise_bid(UUID, UUID, INT, INT) TO service_role;

-- Finalizes a sale: updates the lot cache, inserts the source-of-truth
-- player_purchases row, debits the wallet via wallet_transactions (with
-- budget_remaining/acquired_count kept in sync as a cache), recalculates
-- the buyer's captain valuation if applicable, and appends a 'lot_sold'
-- event. All in one transaction.
DROP FUNCTION IF EXISTS public.auctionos_mark_sold(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_mark_sold(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction      UUID;
  v_status       TEXT;
  v_bid          INT;
  v_wallet       UUID;
  v_category     UUID;
  v_team_id      TEXT;
  v_purchase_id  UUID;
  v_remaining_after INT;
BEGIN
  SELECT auction_id, status, current_bid, current_bid_wallet_id, category_id
  INTO v_auction, v_status, v_bid, v_wallet, v_category
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'lot is not currently on the block';
  END IF;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'no bid has been placed on this lot';
  END IF;

  UPDATE public.auction_lots
  SET status = 'sold', sold_price = v_bid, sold_wallet_id = v_wallet, sold_at = NOW(), updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.player_purchases (auction_id, lot_id, wallet_id, category_id, price)
  VALUES (v_auction, p_lot_id, v_wallet, v_category, v_bid)
  RETURNING id INTO v_purchase_id;

  UPDATE public.auction_wallets
  SET budget_remaining = budget_remaining - v_bid, acquired_count = acquired_count + 1, updated_at = NOW()
  WHERE id = v_wallet
  RETURNING budget_remaining, team_id INTO v_remaining_after, v_team_id;

  INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
  VALUES (v_auction, v_wallet, 'purchase', -v_bid, v_purchase_id, 'system');

  IF v_category IS NOT NULL THEN
    PERFORM public._auctionos_recalc_captain_valuation(v_auction, v_team_id, v_category, v_purchase_id);
  END IF;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'lot_sold', jsonb_build_object('wallet_id', v_wallet, 'sold_price', v_bid, 'budget_remaining_after', v_remaining_after), 'system');

  RETURN jsonb_build_object('lot_id', p_lot_id, 'sold_wallet_id', v_wallet, 'sold_price', v_bid);
END;
$func$;

-- COMMAND — server-only (moves money, writes the ledger).
REVOKE EXECUTE ON FUNCTION public.auctionos_mark_sold(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_mark_sold(UUID) TO service_role;

-- No buyer — marks the lot unsold, appends a 'lot_unsold' event. No
-- purchase/ledger rows involved.
DROP FUNCTION IF EXISTS public.auctionos_mark_unsold(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_mark_unsold(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction UUID;
  v_status  TEXT;
  v_base_price INT;
BEGIN
  SELECT auction_id, status, base_price INTO v_auction, v_status, v_base_price
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'lot is not currently on the block';
  END IF;

  UPDATE public.auction_lots
  SET status = 'unsold', updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price), 'system');

  RETURN jsonb_build_object('lot_id', p_lot_id);
END;
$func$;

-- COMMAND — server-only (resolves a lot with no buyer).
REVOKE EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) TO service_role;

-- Undo the most recent bid on a lot. Unchanged from v2 — no purchase
-- exists yet at this point, so no ledger/valuation work needed.
DROP FUNCTION IF EXISTS public.auctionos_undo_bid(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_undo_bid(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction        UUID;
  v_status         TEXT;
  v_latest_bid_id  UUID;
  v_latest_amount  INT;
  v_latest_wallet  UUID;
  v_previous_bid_id UUID;
  v_previous_amount INT;
  v_previous_wallet UUID;
BEGIN
  SELECT auction_id, status INTO v_auction, v_status
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'undo_bid is only legal while the lot is on the block';
  END IF;

  SELECT id, amount, wallet_id INTO v_latest_bid_id, v_latest_amount, v_latest_wallet
  FROM public.auction_bids WHERE lot_id = p_lot_id ORDER BY created_at DESC, id DESC LIMIT 1;

  IF v_latest_bid_id IS NULL THEN
    RAISE EXCEPTION 'no bid to undo on this lot';
  END IF;

  DELETE FROM public.auction_bids WHERE id = v_latest_bid_id;

  SELECT id, amount, wallet_id INTO v_previous_bid_id, v_previous_amount, v_previous_wallet
  FROM public.auction_bids WHERE lot_id = p_lot_id ORDER BY created_at DESC, id DESC LIMIT 1;

  UPDATE public.auction_lots
  SET current_bid = v_previous_amount, current_bid_wallet_id = v_previous_wallet, version = version + 1, updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'bid_undone', jsonb_build_object(
    'undone_wallet_id', v_latest_wallet,
    'undone_amount', v_latest_amount,
    'restored_bid', v_previous_amount
  ), 'system');

  RETURN jsonb_build_object('lot_id', p_lot_id, 'current_bid', v_previous_amount, 'current_bid_wallet_id', v_previous_wallet);
END;
$func$;

-- COMMAND — server-only (rewrites bid history).
REVOKE EXECUTE ON FUNCTION public.auctionos_undo_bid(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_undo_bid(UUID) TO service_role;

-- Undo a sold/unsold resolution. Only legal if the auction's frontier
-- hasn't moved past this lot. For a sale: marks the player_purchases row
-- reversed (never deleted), credits the wallet via wallet_transactions,
-- recalculates the affected captain valuation, and resets the lot to
-- on_block with its last bid state.
DROP FUNCTION IF EXISTS public.auctionos_undo_sale(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_undo_sale(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction       UUID;
  v_status        TEXT;
  v_lot_order     INT;
  v_category      UUID;
  v_sold_price    INT;
  v_sold_wallet   UUID;
  v_team_id       TEXT;
  v_purchase_id   UUID;
  v_later_exists  BOOLEAN;
  v_last_bid_amount INT;
  v_last_bid_wallet UUID;
BEGIN
  SELECT auction_id, status, lot_order, sold_price, sold_wallet_id, category_id
  INTO v_auction, v_status, v_lot_order, v_sold_price, v_sold_wallet, v_category
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status NOT IN ('sold', 'unsold') THEN
    RAISE EXCEPTION 'lot has no resolution to undo';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.auction_lots
    WHERE auction_id = v_auction AND lot_order > v_lot_order AND status <> 'upcoming'
  ) INTO v_later_exists;

  IF v_later_exists THEN
    RAISE EXCEPTION 'cannot undo — the auction has already moved past this lot';
  END IF;

  IF v_status = 'sold' THEN
    SELECT id INTO v_purchase_id
    FROM public.player_purchases
    WHERE lot_id = p_lot_id AND reversed_at IS NULL
    ORDER BY purchased_at DESC LIMIT 1;

    UPDATE public.player_purchases SET reversed_at = NOW() WHERE id = v_purchase_id;

    UPDATE public.auction_wallets
    SET budget_remaining = budget_remaining + v_sold_price, acquired_count = acquired_count - 1, updated_at = NOW()
    WHERE id = v_sold_wallet
    RETURNING team_id INTO v_team_id;

    INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
    VALUES (v_auction, v_sold_wallet, 'purchase_undo', v_sold_price, v_purchase_id, 'system');

    IF v_category IS NOT NULL THEN
      PERFORM public._auctionos_recalc_captain_valuation(v_auction, v_team_id, v_category, NULL);
    END IF;
  END IF;

  SELECT amount, wallet_id INTO v_last_bid_amount, v_last_bid_wallet
  FROM public.auction_bids WHERE lot_id = p_lot_id ORDER BY created_at DESC, id DESC LIMIT 1;

  UPDATE public.auction_lots
  SET status = 'on_block',
      sold_price = NULL,
      sold_wallet_id = NULL,
      sold_at = NULL,
      current_bid = COALESCE(v_last_bid_amount, base_price),
      current_bid_wallet_id = v_last_bid_wallet,
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_lot_id;

  UPDATE public.auctions SET current_lot_id = p_lot_id, status = 'live', updated_at = NOW() WHERE id = v_auction;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'sale_reversed', jsonb_build_object(
    'previous_status', v_status,
    'restored_wallet_id', v_sold_wallet,
    'restored_amount', v_sold_price
  ), 'system');

  RETURN jsonb_build_object('lot_id', p_lot_id, 'status', 'on_block');
END;
$func$;

-- COMMAND — server-only (reverses a sale, moves money back).
REVOKE EXECUTE ON FUNCTION public.auctionos_undo_sale(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_undo_sale(UUID) TO service_role;
