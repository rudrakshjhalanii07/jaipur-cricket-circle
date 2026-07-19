-- AuctionOS delta: close the wallet-assignment hole in the wizard's
-- completeness gate. auctionos_begin_auction (add_auctionos_wizard.sql
-- §"Completeness gate") validated franchises/categories/lots before
-- flipping draft -> scheduled, but never checked auction_wallet_kinds or
-- auction_wallets at all — an organizer who finished every other step
-- while skipping the Wallets step got a "successfully created" auction
-- whose teams have no purse and literally cannot bid (confirmed live: an
-- auction went scheduled with zero wallet_kinds, its hall then showed
-- every team's Live Wallets card empty). CREATE OR REPLACE FUNCTION, same
-- name/signature — a plpgsql function body can't be patched in place, so
-- this re-declares the whole thing with two new checks inserted after the
-- existing lot check, everything else byte-for-byte unchanged.
--
-- Two checks, not one:
--   1. At least one wallet kind exists for the auction at all (the wizard-
--      level equivalent of "add at least one category" — catches the
--      exact bug reported: Wallets step skipped entirely).
--   2. Every (auction_teams row × auction_wallet_kinds row) combination
--      has a matching auction_wallets row. In the normal wizard flow this
--      is always already true — app/api/auctionos/[id]/wallet-kinds and
--      .../teams both backfill the missing side automatically the moment
--      either is created (see those routes) — but re-deriving it here
--      rather than trusting the backfill held is the same defense-in-depth
--      posture as every other completeness/quota check in this schema
--      (e.g. auctionos_advance_lot re-deriving short-team counts instead
--      of trusting a cached flag). Scoped to auction_teams (the wizard's
--      own franchise table) only — JCC's legacy team_id path predates this
--      migration and isn't wizard-driven, so it's out of scope here, same
--      as the existing franchise check's own team_id/auction_team_id split.
--
-- Also now calls _auctionos_charge_regular_captains (defined in
-- add_auctionos_captain_pricing.sql) right before the draft -> scheduled
-- flip — run that file too; plpgsql doesn't check a called function exists
-- until the CALL actually executes, so file order between the two doesn't
-- matter, but both must be applied before anyone begins an auction.
DROP FUNCTION IF EXISTS public.auctionos_begin_auction(UUID);
CREATE OR REPLACE FUNCTION public.auctionos_begin_auction(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_status              TEXT;
  v_has_franchise       BOOLEAN;
  v_has_category        BOOLEAN;
  v_has_lot             BOOLEAN;
  v_has_wallet_kind     BOOLEAN;
  v_missing_wallet_rows INT;
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

  SELECT EXISTS (SELECT 1 FROM public.auction_wallet_kinds WHERE auction_id = p_auction_id) INTO v_has_wallet_kind;
  IF NOT v_has_wallet_kind THEN
    RAISE EXCEPTION 'add at least one wallet before beginning the auction — every team needs a funded purse to bid with';
  END IF;

  SELECT COUNT(*) INTO v_missing_wallet_rows
  FROM public.auction_teams t
  CROSS JOIN public.auction_wallet_kinds wk
  WHERE t.auction_id = p_auction_id
    AND wk.auction_id = p_auction_id
    AND NOT EXISTS (
      SELECT 1 FROM public.auction_wallets w
      WHERE w.auction_team_id = t.id AND w.wallet_kind_id = wk.id
    );
  IF v_missing_wallet_rows > 0 THEN
    RAISE EXCEPTION 'every team needs a wallet for every wallet kind before beginning the auction (% missing)', v_missing_wallet_rows;
  END IF;

  -- Regular-category captains are a fixed ₹1 Cr, deducted here — before the
  -- hall opens — rather than off any purchase (see
  -- add_auctionos_captain_pricing.sql; MVP captains stay purchase-derived
  -- and are untouched by this call).
  PERFORM public._auctionos_charge_regular_captains(p_auction_id);

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

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'auction_prepared', jsonb_build_object('status', 'scheduled'), 'system');

  RETURN jsonb_build_object('auction_id', p_auction_id, 'status', 'scheduled');
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_begin_auction(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_begin_auction(UUID) TO service_role;
