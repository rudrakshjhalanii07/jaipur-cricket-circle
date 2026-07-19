-- AuctionOS delta: category quota enforcement — unsold-loop + forced
-- allotment for the last player in a category.
--
-- Generic (not JCC-specific), driven entirely by data that already exists:
-- any auction_categories row with min_required > 0 is a "quota category".
-- JCC sets MVP's min_required = 2 and Regular's = 5 (a team's captain
-- counts as filling one of their own category's slots — see
-- withCaptainBonus in lib/auctionos/core/reserve.ts, mirrored in SQL by
-- _auctionos_acquired_count below); Guest stays at 0 (unaffected, keeps
-- today's plain-terminal-unsold behavior) per explicit direction.
--
-- Two cooperating mechanisms, not one:
--
--   1. auctionos_mark_unsold: whenever a quota category's lot goes unsold
--      AND other 'upcoming' lots remain in that category, it's requeued
--      (LOOPED) to the back of the category's own block rather than
--      resolved — the category cannot finish while any of its own lots
--      are unresolved.
--
--   2. auctionos_advance_lot: THE ACTUAL QUOTA GATE. Every time it's about
--      to open a lot from a quota category, it first checks whether that
--      lot is the category's LAST remaining 'upcoming' one. If so, before
--      ever putting it on_block:
--        - exactly one team still short of min_required, and they can
--          afford category.base_price → ALLOT: sold to them directly, no
--          bidding round at all;
--        - zero teams are short → ordinary bidding (nobody needs it,
--          nothing to force — may still end up unsold, and that's fine);
--        - 2+ teams are tied short (deliberately no automatic tie-break —
--          see AUCTION_RULES.md), or the one short team can't afford
--          base_price → BLOCKED: a new lot status; auctioneer cannot
--          advance until an organizer manually resolves it via
--          auctionos_resolve_blocked_lot (per explicit direction: "block
--          advancing until organizer intervenes", not a silent guess).
--      This can't live in mark_unsold alone — see that function's own
--      header comment below for why a purely-reactive-to-unsold design has
--      a real hole a richer team can walk straight through.
--
-- Reusing 'sold' as the lot status for a forced allotment (rather than a
-- new status) is deliberate: auctionos_undo_sale, TeamSheet, CompletedRecap
-- and every other "what's this team's roster" read already treat any sold
-- lot uniformly. player_purchases.metadata.allotted / the lot_sold event's
-- payload.allotted are the only markers distinguishing it from a bid-won
-- sale — audit-only, never read by any quota/reserve math.

-- ============================================================
-- 1. Widen the lot status vocabulary for the new 'blocked' state.
-- ============================================================
ALTER TABLE public.auction_lots DROP CONSTRAINT IF EXISTS auction_lots_status_check;
ALTER TABLE public.auction_lots
  ADD CONSTRAINT auction_lots_status_check
  CHECK (status IN ('upcoming', 'on_block', 'sold', 'unsold', 'blocked'));

-- ============================================================
-- 2. The unsold-loop reinserts a lot at the END of its own category's
-- lot_order block by shifting every later category's block up by one — a
-- single UPDATE that (for a moment, mid-statement) can produce the exact
-- same (auction_id, lot_order) pair on two rows unless the uniqueness
-- check is deferred to end-of-transaction. This is the standard fix for
-- "shift a range of unique sort keys" in Postgres; harmless for every
-- other existing caller (a normal single-row insert still ends its
-- transaction with a unique final state, checked at the same point it
-- always was).
-- ============================================================
ALTER TABLE public.auction_lots DROP CONSTRAINT IF EXISTS auction_lots_auction_id_lot_order_key;
ALTER TABLE public.auction_lots
  ADD CONSTRAINT auction_lots_auction_id_lot_order_key
  UNIQUE (auction_id, lot_order) DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- 3. Audit-only tag for how a purchase happened.
-- ============================================================
ALTER TABLE public.player_purchases ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- ============================================================
-- 4. Per-(wallet, category) acquired count, purchases + captain bonus.
-- STABLE (not VOLATILE) — reads only, safe to call repeatedly in a WHERE
-- clause. Mirrors lib/auctionos/core/reserve.ts's withCaptainBonus exactly:
-- a captain occupies one slot of their own category with no purchase row
-- behind it. Matches on whichever team-identity column this auction
-- actually uses (team_id for a global-teams auction, auction_team_id for a
-- wizard-created one — auction_wallets/auction_captains share the same xor
-- pair, see add_auctionos_wizard.sql).
-- ============================================================
CREATE OR REPLACE FUNCTION public._auctionos_acquired_count(p_wallet_id UUID, p_category_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $func$
  SELECT
    COALESCE((
      SELECT COUNT(*) FROM public.player_purchases pp
      WHERE pp.wallet_id = p_wallet_id AND pp.category_id = p_category_id AND pp.reversed_at IS NULL
    ), 0)
    + (
      SELECT COUNT(*) FROM public.auction_captains c
      JOIN public.auction_wallets w ON w.id = p_wallet_id
      WHERE c.category_id = p_category_id
        AND ((c.team_id IS NOT NULL AND c.team_id = w.team_id)
             OR (c.auction_team_id IS NOT NULL AND c.auction_team_id = w.auction_team_id))
    )::INT;
$func$;

REVOKE EXECUTE ON FUNCTION public._auctionos_acquired_count(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_acquired_count(UUID, UUID) TO service_role;

-- ============================================================
-- 5. Shared money-movement tail — "this wallet just acquired this lot for
-- this price" — factored out of auctionos_mark_sold so a forced allotment
-- (no prior bid) can reuse the exact same purchase/ledger/captain-recalc/
-- event logic rather than a second, drifting copy of it. Caller already
-- holds the lot's row lock (FOR UPDATE) and has validated status.
-- ============================================================
CREATE OR REPLACE FUNCTION public._auctionos_finalize_purchase(
  p_auction_id UUID,
  p_lot_id UUID,
  p_wallet_id UUID,
  p_category_id UUID,
  p_price INT,
  p_allotted BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_team_id         TEXT;
  v_remaining_after INT;
  v_purchase_id     UUID;
BEGIN
  UPDATE public.auction_lots
  SET status = 'sold', sold_price = p_price, sold_wallet_id = p_wallet_id, sold_at = NOW(), updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.player_purchases (auction_id, lot_id, wallet_id, category_id, price, metadata)
  VALUES (
    p_auction_id, p_lot_id, p_wallet_id, p_category_id, p_price,
    CASE WHEN p_allotted THEN jsonb_build_object('allotted', true) ELSE '{}'::JSONB END
  )
  RETURNING id INTO v_purchase_id;

  UPDATE public.auction_wallets
  SET budget_remaining = budget_remaining - p_price, acquired_count = acquired_count + 1, updated_at = NOW()
  WHERE id = p_wallet_id
  RETURNING budget_remaining, team_id INTO v_remaining_after, v_team_id;

  INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
  VALUES (p_auction_id, p_wallet_id, 'purchase', -p_price, v_purchase_id, 'system');

  IF p_category_id IS NOT NULL THEN
    PERFORM public._auctionos_recalc_captain_valuation(p_auction_id, v_team_id, p_category_id, v_purchase_id);
  END IF;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (
    p_auction_id, p_lot_id, 'lot_sold',
    jsonb_build_object('wallet_id', p_wallet_id, 'sold_price', p_price, 'budget_remaining_after', v_remaining_after, 'allotted', p_allotted),
    'system'
  );

  RETURN jsonb_build_object('lot_id', p_lot_id, 'sold_wallet_id', p_wallet_id, 'sold_price', p_price, 'allotted', p_allotted);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public._auctionos_finalize_purchase(UUID, UUID, UUID, UUID, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_finalize_purchase(UUID, UUID, UUID, UUID, INT, BOOLEAN) TO service_role;

-- ============================================================
-- 6. auctionos_mark_sold — same signature/behavior for a normal bid-won
-- sale, now a thin wrapper over the shared helper.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auctionos_mark_sold(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction  UUID;
  v_status   TEXT;
  v_bid      INT;
  v_wallet   UUID;
  v_category UUID;
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

  RETURN public._auctionos_finalize_purchase(v_auction, p_lot_id, v_wallet, v_category, v_bid, FALSE);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_mark_sold(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_mark_sold(UUID) TO service_role;

-- ============================================================
-- 7. auctionos_raise_bid — same signature; the Reserve Engine's acquired
-- count now goes through _auctionos_acquired_count so an in-progress
-- bidder isn't blocked by a reserve that overcounts a slot their own
-- captain already fills.
-- ============================================================
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
  v_status       TEXT;
  v_auction      UUID;
  v_version      INT;
  v_budget       INT;
  v_previous_bid INT;
  v_category     UUID;
  v_wallet_kind  UUID;
  v_reserve      INT;
BEGIN
  SELECT status, auction_id, version, current_bid, category_id
  INTO v_status, v_auction, v_version, v_previous_bid, v_category
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

  SELECT budget_remaining, wallet_kind_id INTO v_budget, v_wallet_kind
  FROM public.auction_wallets
  WHERE id = p_wallet_id AND auction_id = v_auction;

  IF v_budget IS NULL THEN
    RAISE EXCEPTION 'wallet not found in this auction';
  END IF;
  IF v_budget < p_new_bid THEN
    RAISE EXCEPTION 'wallet cannot afford this bid';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(
      ac.min_required - (public._auctionos_acquired_count(p_wallet_id, ac.id) + CASE WHEN ac.id = v_category THEN 1 ELSE 0 END),
      0
    ) * ac.base_price
  ), 0)
  INTO v_reserve
  FROM public.auction_categories ac
  WHERE ac.auction_id = v_auction AND ac.wallet_kind_id = v_wallet_kind;

  IF v_budget - p_new_bid < v_reserve THEN
    RAISE EXCEPTION 'bid would leave this team unable to afford its remaining mandatory slots';
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

REVOKE EXECUTE ON FUNCTION public.auctionos_raise_bid(UUID, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_raise_bid(UUID, UUID, INT, INT) TO service_role;

-- ============================================================
-- 8. auctionos_mark_unsold — rewritten per the header. Same signature.
-- The loop-requeue path (other upcoming lots remain in the category) is
-- the primary behavior this function now drives. Its own last-lot short-
-- team branch is kept as defense-in-depth (same posture as the budget/
-- reserve checks elsewhere in this schema) even though
-- auctionos_advance_lot's gate (item 10 below) means a lot only reaches
-- on_block already knowing 0 teams are short — this function doesn't
-- assume that invariant holds and re-derives it independently.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auctionos_mark_unsold(p_lot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction          UUID;
  v_status           TEXT;
  v_base_price       INT;
  v_category         UUID;
  v_min_required     INT;
  v_wallet_kind      UUID;
  v_category_base    INT;
  v_remaining_in_cat INT;
  v_max_order        INT;
  v_short_count      INT;
  v_short_wallet     UUID;
  v_short_budget     INT;
BEGIN
  SELECT auction_id, status, base_price, category_id
  INTO v_auction, v_status, v_base_price, v_category
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'lot is not currently on the block';
  END IF;

  IF v_category IS NOT NULL THEN
    SELECT min_required, wallet_kind_id, base_price
    INTO v_min_required, v_wallet_kind, v_category_base
    FROM public.auction_categories WHERE id = v_category;
  END IF;

  -- Non-quota lot (no category, or min_required = 0, e.g. Guest) — original
  -- behavior, unchanged: terminal, no loop, no allotment.
  IF v_category IS NULL OR v_min_required IS NULL OR v_min_required <= 0 THEN
    UPDATE public.auction_lots SET status = 'unsold', updated_at = NOW() WHERE id = p_lot_id;
    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price), 'system');
    RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', false);
  END IF;

  SELECT COUNT(*) INTO v_remaining_in_cat
  FROM public.auction_lots
  WHERE auction_id = v_auction AND category_id = v_category AND status = 'upcoming';

  IF v_remaining_in_cat > 0 THEN
    -- Loop: send this lot to the back of its own category's block, never
    -- past the next category's first lot — shift every later lot's
    -- lot_order up by one to make room (safe as a single statement, see
    -- item 2's DEFERRABLE note above).
    SELECT MAX(lot_order) INTO v_max_order
    FROM public.auction_lots WHERE auction_id = v_auction AND category_id = v_category;

    UPDATE public.auction_lots
    SET lot_order = lot_order + 1
    WHERE auction_id = v_auction AND lot_order > v_max_order;

    UPDATE public.auction_lots
    SET status = 'upcoming', current_bid = base_price, current_bid_wallet_id = NULL,
        lot_order = v_max_order + 1, updated_at = NOW()
    WHERE id = p_lot_id;

    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (v_auction, p_lot_id, 'lot_looped', jsonb_build_object('category_id', v_category), 'system');

    RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', true, 'allotted', false, 'blocked', false);
  END IF;

  -- Last lot in the category. How many wallets of this category's own
  -- wallet kind are still short of min_required?
  SELECT COUNT(*) INTO v_short_count
  FROM public.auction_wallets w
  WHERE w.auction_id = v_auction AND w.wallet_kind_id = v_wallet_kind
    AND public._auctionos_acquired_count(w.id, v_category) < v_min_required;

  IF v_short_count = 0 THEN
    UPDATE public.auction_lots SET status = 'unsold', updated_at = NOW() WHERE id = p_lot_id;
    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price), 'system');
    RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', false);
  END IF;

  IF v_short_count = 1 THEN
    SELECT w.id, w.budget_remaining INTO v_short_wallet, v_short_budget
    FROM public.auction_wallets w
    WHERE w.auction_id = v_auction AND w.wallet_kind_id = v_wallet_kind
      AND public._auctionos_acquired_count(w.id, v_category) < v_min_required
    LIMIT 1;

    IF v_short_budget >= v_category_base THEN
      RETURN public._auctionos_finalize_purchase(v_auction, p_lot_id, v_short_wallet, v_category, v_category_base, TRUE)
        || jsonb_build_object('looped', false, 'blocked', false);
    END IF;
  END IF;

  -- Either 2+ teams are tied for the one remaining slot (no automatic
  -- tie-break by design) or the sole short team can't afford base_price —
  -- neither is safe to auto-resolve. Park it for an organizer.
  UPDATE public.auction_lots SET status = 'blocked', updated_at = NOW() WHERE id = p_lot_id;

  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (
    v_auction, p_lot_id, 'lot_blocked',
    jsonb_build_object('category_id', v_category, 'short_wallet_count', v_short_count, 'base_price', v_category_base),
    'system'
  );

  RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', true);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) TO service_role;

-- ============================================================
-- 9. auctionos_resolve_blocked_lot — NEW. Organizer-only manual escape
-- hatch for a 'blocked' lot: p_wallet_id given → force-allot to that team
-- at category.base_price (still budget-checked — a blocked lot exists
-- precisely because the system wouldn't guess, not so an organizer can
-- push a wallet negative); p_wallet_id NULL → give up, terminal 'unsold'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.auctionos_resolve_blocked_lot(p_lot_id UUID, p_wallet_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_auction        UUID;
  v_status         TEXT;
  v_category       UUID;
  v_base_price     INT;
  v_category_base  INT;
  v_wallet_budget  INT;
BEGIN
  SELECT auction_id, status, category_id, base_price
  INTO v_auction, v_status, v_category, v_base_price
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'blocked' THEN
    RAISE EXCEPTION 'lot is not currently blocked';
  END IF;

  IF p_wallet_id IS NULL THEN
    UPDATE public.auction_lots SET status = 'unsold', updated_at = NOW() WHERE id = p_lot_id;
    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price, 'resolved_by', 'organizer'), 'system');
    RETURN jsonb_build_object('lot_id', p_lot_id, 'allotted', false);
  END IF;

  SELECT budget_remaining INTO v_wallet_budget
  FROM public.auction_wallets WHERE id = p_wallet_id AND auction_id = v_auction;

  IF v_wallet_budget IS NULL THEN
    RAISE EXCEPTION 'wallet not found in this auction';
  END IF;

  SELECT base_price INTO v_category_base FROM public.auction_categories WHERE id = v_category;
  v_category_base := COALESCE(v_category_base, v_base_price);

  IF v_wallet_budget < v_category_base THEN
    RAISE EXCEPTION 'selected team cannot afford this category''s base price';
  END IF;

  RETURN public._auctionos_finalize_purchase(v_auction, p_lot_id, p_wallet_id, v_category, v_category_base, TRUE);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_resolve_blocked_lot(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_resolve_blocked_lot(UUID, UUID) TO service_role;

-- ============================================================
-- 10. auctionos_advance_lot — same signature, two additions:
--
--   a. Refuses to call the next player while any lot is 'blocked'.
--
--   b. THE ACTUAL QUOTA GATE. Reactive-only enforcement (checking short
--      teams inside auctionos_mark_unsold, as an earlier version of this
--      migration did) has a real hole: if the money simply keeps landing
--      on 1-2 rich teams every round, a category's lots can sell out
--      completely via ordinary bid-won sales, never once going unsold —
--      the loop/allot logic never gets a turn to run, and a short team can
--      finish the category with zero players. Proven by a scripted
--      simulation against mockEngine before this fix: two teams ended a
--      quota category with 0-1 players despite the "protection" existing.
--
--      Fix: every time this function is about to open a lot from a quota
--      category, it first checks whether that lot is the LAST 'upcoming'
--      one left in its category. If so, the short-team decision (0/1/2+,
--      exactly mirroring auctionos_mark_unsold's own logic) runs BEFORE
--      the lot ever reaches on_block — a lot that would go to a specific
--      short team is never exposed to open bidding at all, where a richer
--      team could simply outbid the team it exists to protect. A 1-short
--      auto-allotment resolves with no bidding round and the function
--      loops to open the ACTUAL next lot in the same call, so "Call Next
--      Player" doesn't stall on an invisible auto-resolution.
--
--      auctionos_mark_unsold's own last-lot handling is kept as-is
--      (unreachable in the common case now that advance_lot intercepts
--      first, but cheap, correct, defense-in-depth against any lot that
--      reaches on_block outside the normal advance path, e.g. after an
--      undo-sale reopens it).
-- ============================================================
CREATE OR REPLACE FUNCTION public.auctionos_advance_lot(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_next_id          UUID;
  v_next_category    UUID;
  v_blocked_count    INT;
  v_min_required     INT;
  v_wallet_kind      UUID;
  v_category_base    INT;
  v_remaining_in_cat INT;
  v_short_count      INT;
  v_short_wallet     UUID;
  v_short_budget     INT;
BEGIN
  SELECT COUNT(*) INTO v_blocked_count
  FROM public.auction_lots WHERE auction_id = p_auction_id AND status = 'blocked';

  IF v_blocked_count > 0 THEN
    RAISE EXCEPTION 'a lot is blocked and needs organizer resolution before the auction can continue';
  END IF;

  LOOP
    SELECT id, category_id INTO v_next_id, v_next_category
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

    v_min_required := NULL;
    IF v_next_category IS NOT NULL THEN
      SELECT min_required, wallet_kind_id, base_price
      INTO v_min_required, v_wallet_kind, v_category_base
      FROM public.auction_categories WHERE id = v_next_category;
    END IF;

    -- Not a quota category (no category, or min_required = 0) — open normally.
    IF v_next_category IS NULL OR v_min_required IS NULL OR v_min_required <= 0 THEN
      EXIT;
    END IF;

    SELECT COUNT(*) INTO v_remaining_in_cat
    FROM public.auction_lots
    WHERE auction_id = p_auction_id AND category_id = v_next_category AND status = 'upcoming';

    -- Other lots remain after this one in the category — open normally
    -- (if this one goes unsold, mark_unsold's loop requeues it and the
    -- category will eventually narrow to a true last lot on some future
    -- advance() call).
    IF v_remaining_in_cat > 1 THEN
      EXIT;
    END IF;

    -- This IS the category's last upcoming lot. Who's still short?
    SELECT COUNT(*) INTO v_short_count
    FROM public.auction_wallets w
    WHERE w.auction_id = p_auction_id AND w.wallet_kind_id = v_wallet_kind
      AND public._auctionos_acquired_count(w.id, v_next_category) < v_min_required;

    IF v_short_count = 0 THEN
      EXIT; -- nobody needs it — ordinary bidding, ordinary possible-unsold
    END IF;

    IF v_short_count = 1 THEN
      SELECT w.id, w.budget_remaining INTO v_short_wallet, v_short_budget
      FROM public.auction_wallets w
      WHERE w.auction_id = p_auction_id AND w.wallet_kind_id = v_wallet_kind
        AND public._auctionos_acquired_count(w.id, v_next_category) < v_min_required
      LIMIT 1;

      IF v_short_budget >= v_category_base THEN
        PERFORM public._auctionos_finalize_purchase(p_auction_id, v_next_id, v_short_wallet, v_next_category, v_category_base, TRUE);
        CONTINUE; -- resolved without a bidding round — loop to the real next lot
      END IF;
    END IF;

    -- 2+ teams tied for the last slot (no automatic tie-break by design)
    -- or the one short team can't afford base_price — never expose this to
    -- open bidding. Park it for an organizer.
    UPDATE public.auction_lots SET status = 'blocked', updated_at = NOW() WHERE id = v_next_id;
    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (
      p_auction_id, v_next_id, 'lot_blocked',
      jsonb_build_object('category_id', v_next_category, 'short_wallet_count', v_short_count, 'base_price', v_category_base),
      'system'
    );
    RETURN jsonb_build_object('lot_id', v_next_id, 'blocked', true);
  END LOOP;

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

REVOKE EXECUTE ON FUNCTION public.auctionos_advance_lot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_advance_lot(UUID) TO service_role;

-- New event types this pass, added to the documented vocabulary in
-- add_auctionos.sql §14 (auction_events.type has no CHECK constraint, so no
-- migration needed to register them, only documentation):
--   lot_looped:  { category_id }                                  — unsold, requeued within its own category
--   lot_blocked: { category_id, short_wallet_count, base_price }  — unsold, needs organizer resolution
-- 'lot_sold' payload gains one new field, `allotted: boolean` — true when
-- the sale came from auctionos_mark_unsold's single-short-team path or
-- auctionos_resolve_blocked_lot, false for an ordinary bid-won sale.
