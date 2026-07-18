-- AUCTIONOS — WIZARD PASS (schema v4 delta on top of add_auctionos.sql's
-- schema v3, already applied). Apply in the Supabase SQL editor via `psql`
-- (see AUCTIONOS.md's "Current status" note on why: plpgsql function
-- bodies with embedded semicolons can't go through `supabase db query -f`'s
-- single-prepared-statement path). Safely re-runnable end to end, same
-- convention as every other `add_*.sql` in this repo (`CREATE TABLE IF NOT
-- EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY/FUNCTION IF EXISTS`
-- before every `CREATE POLICY`/`CREATE OR REPLACE FUNCTION`, explicit
-- `DROP CONSTRAINT IF EXISTS` before every named constraint).
--
-- WHAT THIS DELTA IS FOR
-- -----------------------
-- Replaces AuctionOS's one bespoke, code-only creation path (JCC's
-- `PoolBuilderModal`, gated by a single site-wide `ADMIN_PASSWORD`) with a
-- real onboarding wizard: an auction now exists as a persisted `draft` row
-- the moment its Identity step is submitted, gets built up incrementally
-- through plain CRUD (teams, wallets, categories, lots, captains — added by
-- the next implementation pass, not this file), and is explicitly "begun"
-- (draft -> scheduled) only once it's complete. Every auction also gets its
-- own admin password and every captain its own access key, replacing the
-- single shared `ADMIN_PASSWORD` env var for AuctionOS's own routes (the
-- unrelated site-wide `/admin` CMS panel is untouched — different secret,
-- different surface). See the full plan/AUCTIONOS.md for the architecture
-- discussion; this file is the schema half of that plan, implemented.
--
-- pgcrypto is required for digest()/encode() (SHA-256 hashing of secrets)
-- below — declared explicitly rather than assumed, since add_auctionos.sql
-- never needed it (gen_random_uuid() is core in PG13+).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Auctions — new wizard-authored columns. `theme_key` defaults to
-- 'royal' (this site's current design language) so existing rows adopt a
-- sane default without needing a backfill. `admin_password_hash` is the
-- per-auction secret that "alone identifies and authenticates the
-- auction" (see AUCTIONOS.md's wizard-pass plan, §"Per-auction
-- credentials") — UNIQUE, SHA-256, plaintext never stored, returned once by
-- auctionos_create_auction_draft below. Legacy JCC auctions created before
-- this migration have admin_password_hash IS NULL and simply have no admin
-- access from here on — no env-var fallback, per the approved plan (this
-- hasn't been exercised against real production data yet).
-- ============================================================
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS theme_key TEXT NOT NULL DEFAULT 'royal';
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS admin_password_hash TEXT UNIQUE;

-- `status` CHECK gains 'draft' as the earliest state (before 'scheduled').
-- Postgres auto-names an unnamed CHECK() from CREATE TABLE as
-- <table>_<column>_check, but we discover it dynamically rather than assume
-- that name, same defensive pattern add_outliers_team.sql uses — a partial
-- v3 apply under a different history could have left it named differently.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.auctions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%scheduled%'
  LOOP
    EXECUTE 'ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS ' || quote_ident(con.conname);
  END LOOP;
END $$;

ALTER TABLE public.auctions
  ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('draft', 'scheduled', 'live', 'completed'));

-- ============================================================
-- 2. Auction teams — auction-SCOPED franchises created by the wizard.
-- Deliberately NOT the global public.teams table: that table is site-wide
-- and consumed by unrelated features (tournament, toss pages) via
-- lib/teams.ts — it's JCC's own hardcoded roster mirrored into rows.
-- Letting any organizer create arbitrary franchises through the wizard
-- would pollute that shared table. JCC's existing creation path is
-- untouched and keeps using the global teams table (team_id); the wizard
-- always uses auction_team_id below. See AUCTIONOS.md's wizard-pass plan,
-- "Architecture decisions §1" for the full reasoning.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auction_teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id       UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  short_name       TEXT,
  logo_url         TEXT,
  tagline          TEXT,
  primary_color    TEXT,
  secondary_color  TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_teams_auction ON public.auction_teams (auction_id);

ALTER TABLE public.auction_teams ENABLE ROW LEVEL SECURITY;
-- Same shape as auction_categories/auction_lots's existing read policies —
-- public SELECT, "scoped by auction_id" in the sense that every caller
-- already queries `.eq("auction_id", ...)`, same known RLS gap documented
-- in AUCTIONOS.md's "Landing philosophy" (knowing an auction's UUID is
-- still sufficient to read its rows directly via the anon client). Not
-- re-litigated here — this table just matches the existing convention.
DROP POLICY IF EXISTS "Allow public read auction_teams" ON public.auction_teams;
CREATE POLICY "Allow public read auction_teams" ON public.auction_teams FOR SELECT TO public USING (true);

-- ============================================================
-- 3. Auction wallets — team_id becomes optional, auction_team_id added as
-- its sibling. Exactly one of the two must be set (num_nonnulls CHECK).
-- JCC's existing rows (team_id set, auction_team_id NULL) are untouched and
-- keep working; the wizard always sets auction_team_id instead. The
-- original UNIQUE (auction_id, wallet_kind_id, team_id) constraint already
-- treats NULL team_id as distinct per row (standard SQL NULL semantics —
-- Postgres UNIQUE never conflicts on NULL), so wizard-created rows (NULL
-- team_id) never collide against it; a second, symmetric UNIQUE constraint
-- on (auction_id, wallet_kind_id, auction_team_id) gives auction_team_id
-- rows the same real uniqueness guarantee, while legacy team_id rows (NULL
-- auction_team_id) never collide against THAT one either. Two plain UNIQUE
-- constraints, not partial indexes — simpler and correct given NULL's
-- built-in "never equal" behavior in a UNIQUE constraint.
-- ============================================================
ALTER TABLE public.auction_wallets ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.auction_wallets ADD COLUMN IF NOT EXISTS auction_team_id UUID REFERENCES public.auction_teams(id) ON DELETE CASCADE;

ALTER TABLE public.auction_wallets DROP CONSTRAINT IF EXISTS chk_wallet_team_xor;
ALTER TABLE public.auction_wallets
  ADD CONSTRAINT chk_wallet_team_xor CHECK (num_nonnulls(team_id, auction_team_id) = 1);

ALTER TABLE public.auction_wallets DROP CONSTRAINT IF EXISTS auction_wallets_kind_auction_team_uniq;
ALTER TABLE public.auction_wallets
  ADD CONSTRAINT auction_wallets_kind_auction_team_uniq UNIQUE (auction_id, wallet_kind_id, auction_team_id);

CREATE INDEX IF NOT EXISTS idx_auction_wallets_auction_team ON public.auction_wallets (auction_team_id);

-- ============================================================
-- 4. Auction captains — per-captain access key. Each auction_captains row
-- gets its OWN key (not one shared secret) — mirrors how the admin
-- password uniquely identifies "this one thing" (AUCTIONOS.md's
-- wizard-pass plan, "Per-auction credentials"). Generated + hashed by
-- auctionos_assign_captain below; NULL for any captain assigned before
-- this migration (no access until reassigned/re-keyed — out of scope for
-- this pass, same "clean replace, no legacy fallback" stance as the admin
-- password above).
-- ============================================================
ALTER TABLE public.auction_captains ADD COLUMN IF NOT EXISTS access_key_hash TEXT;

ALTER TABLE public.auction_captains DROP CONSTRAINT IF EXISTS auction_captains_auction_access_key_uniq;
ALTER TABLE public.auction_captains
  ADD CONSTRAINT auction_captains_auction_access_key_uniq UNIQUE (auction_id, access_key_hash);

-- auction_team_id sibling, mirroring auction_wallets' team_id/
-- auction_team_id xor pattern (§3 above) exactly. Pass-1 shipped
-- auction_teams (wizard franchises) without ever giving auction_captains a
-- way to reference one — team_id still only pointed at the global
-- public.teams table, so a wizard-created auction (which never rows into
-- public.teams) could not have a captain assigned via
-- auctionos_assign_captain at all. Closed here: team_id becomes optional,
-- auction_team_id is its sibling FK into auction_teams, exactly one of the
-- two must be set, and auctionos_assign_captain below gains a matching
-- p_auction_team_id parameter.
ALTER TABLE public.auction_captains ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.auction_captains ADD COLUMN IF NOT EXISTS auction_team_id UUID REFERENCES public.auction_teams(id) ON DELETE CASCADE;

ALTER TABLE public.auction_captains DROP CONSTRAINT IF EXISTS chk_captain_team_xor;
ALTER TABLE public.auction_captains
  ADD CONSTRAINT chk_captain_team_xor CHECK (num_nonnulls(team_id, auction_team_id) = 1);

-- The original UNIQUE(auction_id, team_id) (unnamed at CREATE TABLE time,
-- auto-named by Postgres) already treats NULL as distinct per row — never
-- conflicts — so wizard rows (NULL team_id) never collide against it. Add
-- the symmetric constraint on auction_team_id so wizard rows get the same
-- one-captain-per-team guarantee; same two-plain-UNIQUE approach as
-- auction_wallets above (not partial indexes), for the same reason.
ALTER TABLE public.auction_captains DROP CONSTRAINT IF EXISTS auction_captains_auction_auction_team_uniq;
ALTER TABLE public.auction_captains
  ADD CONSTRAINT auction_captains_auction_auction_team_uniq UNIQUE (auction_id, auction_team_id);

-- ============================================================
-- 5. Storage — public bucket for organizer-uploaded logos (auction + team).
-- No public INSERT/UPDATE/DELETE policy: uploads only ever happen through
-- a Next.js route holding the service-role key (POST /api/auctionos/
-- upload-logo, built in the next pass), and service_role always bypasses
-- RLS entirely — there is nothing to grant it explicitly. Only a public
-- SELECT policy is needed so an uploaded logo's public URL actually
-- resolves for anyone (spectators, captains) viewing the auction.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('auctionos-logos', 'auctionos-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read auctionos-logos" ON storage.objects;
CREATE POLICY "Allow public read auctionos-logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'auctionos-logos');

-- ============================================================
-- RPCs — same CQRS/REVOKE-GRANT convention as add_auctionos.sql: every
-- command below is immediately followed by
--   REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;
--   GRANT EXECUTE ... TO service_role;
-- so only a Next.js route holding the service-role client can invoke it.
-- ============================================================

-- Identity-step creation: makes a persisted, resumable `draft` auction the
-- moment Identity is submitted — before any franchise/wallet/category/lot
-- exists. Steps 2-6 of the wizard (Franchises, Wallets, Talent Pool,
-- Categories, Captains) are plain CRUD against this draft row via new
-- service-role API routes (next implementation pass), not further RPCs —
-- see AUCTIONOS.md's wizard-pass plan, "Architecture decisions §2".
--
-- payload shape:
-- {
--   "template_id": "uuid",           -- required, FK into auction_templates
--   "name": "JCC Season III",         -- required
--   "logo_url": "https://..." | null,
--   "venue": "..." | null,
--   "starts_at": "2026-08-01T18:00:00Z" | null,
--   "theme_key": "royal" | null       -- defaults to 'royal' if omitted
-- }
--
-- Returns {"auction_id": "uuid", "access_code": "ABC123", "admin_password": "..."}
-- — both the join code and the admin password are ONE-TIME-REVEAL: only
-- their hashes/existence are ever stored (access_code plaintext IS stored,
-- unchanged from v3 — see add_auctionos.sql; admin_password is hashed,
-- never stored in plaintext, and this is the only call that ever returns
-- it). The organizer must copy the password out of this response now.
DROP FUNCTION IF EXISTS public.auctionos_create_auction_draft(JSONB);
CREATE OR REPLACE FUNCTION public.auctionos_create_auction_draft(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction_id      UUID;
  v_template_id     UUID := (payload->>'template_id')::UUID;
  v_access_code     TEXT;
  v_admin_password  TEXT;
  v_admin_hash      TEXT;
BEGIN
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'template_id is required';
  END IF;
  IF COALESCE(payload->>'name', '') = '' THEN
    RAISE EXCEPTION 'name is required';
  END IF;

  -- 6-char uppercase join code — identical generation loop to
  -- auctionos_create_auction (add_auctionos.sql): no confusable 0/O/1/I,
  -- regenerated on the rare UNIQUE collision.
  LOOP
    SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 33)::INT, 1), '')
    INTO v_access_code
    FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.auctions WHERE access_code = v_access_code);
  END LOOP;

  -- 12-char admin password — same no-confusables alphabet as the join code
  -- (still human-typeable if an organizer has to relay it verbally/by
  -- hand), just longer: 12 chars over a 33-char alphabet is ~62 bits of
  -- entropy (log2(33^12)), appropriate for a server-generated secret that
  -- alone authenticates an entire auction (direct SHA-256 equality is fine
  -- here — this is not a user-chosen password that needs bcrypt-style
  -- slow hashing against guessing, per AUCTIONOS.md's wizard-pass plan).
  -- Only the hash is ever persisted (auctions.admin_password_hash); the
  -- plaintext exists only in this function's return value.
  LOOP
    SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 33)::INT, 1), '')
    INTO v_admin_password
    FROM generate_series(1, 12);
    v_admin_hash := encode(digest(v_admin_password, 'sha256'), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.auctions WHERE admin_password_hash = v_admin_hash);
  END LOOP;

  INSERT INTO public.auctions (
    template_id, name, status, starts_at, access_code,
    logo_url, venue, theme_key, admin_password_hash
  ) VALUES (
    v_template_id,
    payload->>'name',
    'draft',
    NULLIF(payload->>'starts_at', '')::TIMESTAMPTZ,
    v_access_code,
    NULLIF(payload->>'logo_url', ''),
    NULLIF(payload->>'venue', ''),
    COALESCE(NULLIF(payload->>'theme_key', ''), 'royal'),
    v_admin_hash
  )
  RETURNING id INTO v_auction_id;

  -- auction_settings' own column DEFAULTs already match every COALESCE
  -- fallback auctionos_create_auction uses explicitly (add_auctionos.sql
  -- §3/§"Creates the auction..."), so a bare insert is sufficient here —
  -- no need to restate every default inline a second time.
  INSERT INTO public.auction_settings (auction_id) VALUES (v_auction_id);

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (v_auction_id, 'auction_created', jsonb_build_object('name', payload->>'name', 'stage', 'draft'), 'system');

  RETURN jsonb_build_object(
    'auction_id', v_auction_id,
    'access_code', v_access_code,
    'admin_password', v_admin_password
  );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_create_auction_draft(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_create_auction_draft(JSONB) TO service_role;

-- Completeness gate + draft -> scheduled transition. Validates: at least
-- one franchise (an auction_teams row, OR at least one team_id-based
-- wallet already exists for JCC-style legacy-path auctions that skip the
-- wizard's Franchises step), at least one category, at least one lot.
-- Raises a descriptive exception on the first failing check — the calling
-- API route (next pass) catches and surfaces RAISE EXCEPTION's message
-- directly. Once flipped to 'scheduled', the dashboard CRUD routes (next
-- pass) refuse further edits by checking status = 'draft' themselves; this
-- function only owns the transition itself, not enforcing the lock on
-- other routes.
DROP FUNCTION IF EXISTS public.auctionos_begin_auction(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_begin_auction(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_status         TEXT;
  v_has_franchise  BOOLEAN;
  v_has_category   BOOLEAN;
  v_has_lot        BOOLEAN;
BEGIN
  SELECT status INTO v_status FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'auction not found';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'auction is not in draft status (current status: %)', v_status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.auction_teams WHERE auction_id = p_auction_id
    UNION ALL
    SELECT 1 FROM public.auction_wallets WHERE auction_id = p_auction_id AND team_id IS NOT NULL
  ) INTO v_has_franchise;
  IF NOT v_has_franchise THEN
    RAISE EXCEPTION 'add at least one franchise (or a funded wallet) before beginning the auction';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.auction_categories WHERE auction_id = p_auction_id) INTO v_has_category;
  IF NOT v_has_category THEN
    RAISE EXCEPTION 'add at least one category before beginning the auction';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.auction_lots WHERE auction_id = p_auction_id) INTO v_has_lot;
  IF NOT v_has_lot THEN
    RAISE EXCEPTION 'add at least one lot before beginning the auction';
  END IF;

  -- Shuffle the draw order once, here, at lock time — never derivable from
  -- CSV/manual-add insertion order, and never surfaced to spectators (no
  -- "Upcoming Lots" list exists in the UI). Categories still run in their
  -- authored sort_order (Marquee/MVP first, then the rest), but which
  -- specific lot comes up next within a category is random every time the
  -- auction is begun.
  WITH ranked AS (
    SELECT al.id,
           ROW_NUMBER() OVER (
             ORDER BY COALESCE(ac.sort_order, 999999), random()
           ) AS new_order
    FROM public.auction_lots al
    LEFT JOIN public.auction_categories ac ON ac.id = al.category_id
    WHERE al.auction_id = p_auction_id
  )
  UPDATE public.auction_lots al
  SET lot_order = ranked.new_order - 1
  FROM ranked
  WHERE al.id = ranked.id;

  UPDATE public.auctions SET status = 'scheduled', updated_at = NOW() WHERE id = p_auction_id;

  -- 'auction_prepared' is a NEW event type this pass — the wizard's
  -- draft -> scheduled transition. Distinct from 'auction_created' (already
  -- fired by auctionos_create_auction_draft at Identity-step time) and the
  -- unrelated 'auction_started' (still fired elsewhere when the hall
  -- itself opens/lots start moving). Add 'auction_prepared' to the
  -- documented vocabulary list in add_auctionos.sql §14 alongside the rest.
  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'auction_prepared', jsonb_build_object('status', 'scheduled'), 'system');

  RETURN jsonb_build_object('auction_id', p_auction_id, 'status', 'scheduled');
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_begin_auction(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_begin_auction(UUID) TO service_role;

-- Re-declared here (full body, CREATE OR REPLACE) to add per-captain
-- access-key generation AND (this pass) an auction_team_id parameter — see
-- §4 above for why: a wizard-created auction's franchises live in
-- auction_teams, not the global teams table, so the original 6-param
-- signature (p_team_id only) could never assign a captain to one. The old
-- 6-arg signature is dropped explicitly since adding a parameter is a new
-- overload, not something CREATE OR REPLACE can widen in place. Exactly one
-- of p_team_id / p_auction_team_id must be provided, mirroring
-- chk_captain_team_xor at the table level. Everything else (captain-module-
-- enabled check, event, initial valuation snapshot) is preserved unchanged.
DROP FUNCTION IF EXISTS public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.auctionos_assign_captain(
  p_auction_id UUID,
  p_team_id TEXT,
  p_category_id UUID,
  p_external_ref UUID,
  p_display_name TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_auction_team_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_enabled       BOOLEAN;
  v_captain_id    UUID;
  v_access_key    TEXT;
  v_access_hash   TEXT;
BEGIN
  IF num_nonnulls(p_team_id, p_auction_team_id) <> 1 THEN
    RAISE EXCEPTION 'exactly one of p_team_id or p_auction_team_id must be provided';
  END IF;

  SELECT captain_module_enabled INTO v_enabled FROM public.auction_settings WHERE auction_id = p_auction_id;
  IF v_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'captain module is not enabled for this auction';
  END IF;

  -- 8-char access key, same no-confusables alphabet/collision-retry loop as
  -- the join code and admin password above — one per captain (not one
  -- shared secret), mirroring how the admin password uniquely identifies
  -- "this one thing" (AUCTIONOS.md wizard-pass plan, "Per-auction
  -- credentials"). Combined with the auction's own join code at login time
  -- (POST /api/auctionos/resolve-captain, next pass), so 8 chars here is
  -- appropriate — shorter than the admin password since it's never the
  -- sole credential.
  LOOP
    SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 33)::INT, 1), '')
    INTO v_access_key
    FROM generate_series(1, 8);
    v_access_hash := encode(digest(v_access_key, 'sha256'), 'hex');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.auction_captains WHERE auction_id = p_auction_id AND access_key_hash = v_access_hash
    );
  END LOOP;

  INSERT INTO public.auction_captains (auction_id, team_id, auction_team_id, category_id, external_ref, display_name, metadata, access_key_hash)
  VALUES (p_auction_id, p_team_id, p_auction_team_id, p_category_id, p_external_ref, p_display_name, p_metadata, v_access_hash)
  RETURNING id INTO v_captain_id;

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'captain_assigned', jsonb_build_object('captain_id', v_captain_id, 'team_id', p_team_id, 'auction_team_id', p_auction_team_id, 'category_id', p_category_id), 'system');

  -- Seed an initial valuation snapshot (captain_value NULL — no purchases yet).
  INSERT INTO public.captain_valuations (auction_id, captain_id, captain_value, rationale)
  VALUES (p_auction_id, v_captain_id, NULL, '{}'::JSONB);

  RETURN jsonb_build_object('captain_id', v_captain_id, 'access_key', v_access_key);
END;
$func$;

-- COMMAND — server-only (captain assignment).
REVOKE EXECUTE ON FUNCTION public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_assign_captain(UUID, TEXT, UUID, UUID, TEXT, JSONB, UUID) TO service_role;

-- ============================================================
-- 6. Per-category bid increment — organizer-editable data, NOT a template
-- algorithm ladder. Categories previously had no way to set this (the
-- Categories wizard step showed a "bid increments are template-defined for
-- now" notice because there was no column to write to); the organizer
-- explicitly wants this configurable per category rather than fixed by the
-- template. NULL means "no override — fall back to the template's own
-- tier ladder" (see lib/auctionos/core/template.ts's BidIncrementConfig and
-- lib/auctionos/templates/jcc/rules.ts's BID_INCREMENT_TIERS), so existing
-- categories/templates keep working unchanged until an organizer sets one.
-- ============================================================
ALTER TABLE public.auction_categories ADD COLUMN IF NOT EXISTS bid_increment INT;
