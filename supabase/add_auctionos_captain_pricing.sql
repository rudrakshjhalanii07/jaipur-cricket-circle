-- AuctionOS delta: two changes to captain pricing, per direction from the
-- project owner, replacing add_auctionos_captain_charge.sql's model:
--
--   1. A Regular-category captain's price is a FIXED ₹1 Cr (100 lakhs) —
--      not derived from any purchase at all — and it's deducted from that
--      team's wallet up front, at auctionos_begin_auction (the draft ->
--      scheduled lock), before the hall ever opens. It no longer flows
--      through _auctionos_recalc_captain_valuation on every sale/undo in
--      that category the way it used to (that path always resolved back to
--      the same flat 100 anyway — this just makes the charge happen once,
--      early, instead of redundantly on every purchase).
--   2. An MVP-category captain's price is 50% of their team's FIRST
--      qualifying purchase in that category — not the HIGHEST, which is
--      what every earlier pass of this formula used. "By logic, only the
--      first MVP buy" — later purchases in the same category no longer
--      revalue the captain at all. Still deterministically re-derived
--      (earliest still-unreversed player_purchases row) rather than cached,
--      so undoing that first purchase correctly falls through to whichever
--      purchase is now earliest — or back to NULL if none remain — the same
--      "never trust a flag, re-derive it" posture as every other
--      completeness/quota check in this schema.
--
-- Fixes a latent gap while it's here: the old
-- _auctionos_recalc_captain_valuation only ever matched a captain/purchase
-- by `team_id` (TEXT, the legacy global-teams path) — for a wizard-created
-- auction, where both auction_captains and auction_wallets carry the
-- purchase's team on `auction_team_id` instead, `team_id` there is NULL and
-- the lookup silently matched nothing. Every resolution below now mirrors
-- _auctionos_acquired_count's own team_id/auction_team_id OR-match instead.
--
-- Three functions replaced (all CREATE OR REPLACE, full bodies — a plpgsql
-- body can't be patched in place):
--   _auctionos_recalc_captain_valuation  — new signature (p_wallet_id
--     replaces p_team_id, so the OR-match above has something to resolve
--     from), MVP-only, first-purchase instead of highest-purchase.
--   _auctionos_finalize_purchase (add_auctionos_quota.sql's version) — one
--     line: passes p_wallet_id straight through instead of a team_id it had
--     to fetch via RETURNING.
--   auctionos_undo_sale (add_auctionos.sql's version) — same one-line
--     change, using the wallet id it already had (v_sold_wallet).
-- Plus one new function, _auctionos_charge_regular_captains, called from
-- auctionos_begin_auction (see add_auctionos_wallet_gate.sql) to apply the
-- new up-front Regular-captain charge.

-- ============================================================
-- 1. _auctionos_recalc_captain_valuation — MVP-only now; Regular captains
-- never call this (see header). Old TEXT-param signature is dropped since
-- the new UUID-param one is a different overload, not a body-only edit.
-- ============================================================
DROP FUNCTION IF EXISTS public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public._auctionos_recalc_captain_valuation(UUID, UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION public._auctionos_recalc_captain_valuation(
  p_auction_id UUID,
  p_wallet_id UUID,
  p_category_id UUID,
  p_triggering_purchase_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_team_id         TEXT;
  v_auction_team_id UUID;
  v_category_name   TEXT;
  v_captain_id      UUID;
  v_old_value       NUMERIC;
  v_first_price     INT;
  v_new_value       NUMERIC;
  v_delta           INT;
  v_captain_wallet  UUID;
BEGIN
  SELECT team_id, auction_team_id INTO v_team_id, v_auction_team_id
  FROM public.auction_wallets WHERE id = p_wallet_id;

  SELECT name INTO v_category_name FROM public.auction_categories WHERE id = p_category_id;
  IF v_category_name ILIKE '%regular%' THEN
    RETURN; -- Regular captains are charged a flat fee once, up front, at
            -- auctionos_begin_auction — they never revalue off purchases.
  END IF;

  SELECT id INTO v_captain_id
  FROM public.auction_captains
  WHERE auction_id = p_auction_id AND category_id = p_category_id
    AND ((team_id IS NOT NULL AND team_id = v_team_id)
         OR (auction_team_id IS NOT NULL AND auction_team_id = v_auction_team_id));

  IF v_captain_id IS NULL THEN
    RETURN; -- this team has no captain in this category — nothing to recalculate
  END IF;

  SELECT captain_value INTO v_old_value
  FROM public.captain_valuations
  WHERE captain_id = v_captain_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- The team's earliest still-unreversed purchase in the captain's own
  -- category — "50% of his first MVP buy," not the highest.
  SELECT pp.price INTO v_first_price
  FROM public.player_purchases pp
  JOIN public.auction_wallets aw ON aw.id = pp.wallet_id
  WHERE pp.auction_id = p_auction_id
    AND pp.category_id = p_category_id
    AND pp.reversed_at IS NULL
    AND ((aw.team_id IS NOT NULL AND aw.team_id = v_team_id)
         OR (aw.auction_team_id IS NOT NULL AND aw.auction_team_id = v_auction_team_id))
  ORDER BY pp.purchased_at ASC, pp.id ASC
  LIMIT 1;

  v_new_value := CASE WHEN v_first_price IS NULL THEN NULL ELSE v_first_price * 0.5 END;

  -- Unchanged (e.g. a 2nd/3rd MVP purchase by the same team in this
  -- category, which by design no longer moves the captain's value) — skip,
  -- don't log a no-op snapshot or touch the wallet.
  IF v_new_value IS NOT DISTINCT FROM v_old_value THEN
    RETURN;
  END IF;

  INSERT INTO public.captain_valuations (auction_id, captain_id, triggering_purchase_id, captain_value, rationale)
  VALUES (
    p_auction_id,
    v_captain_id,
    p_triggering_purchase_id,
    v_new_value,
    jsonb_build_object('rule', 'mvp-half-first', 'first_qualifying_purchase', v_first_price)
  );

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'captain_value_changed', jsonb_build_object('captain_id', v_captain_id, 'first_qualifying_purchase', v_first_price), 'system');

  -- Charge (or refund, if undoing the first purchase dropped the value)
  -- only the CHANGE since the last snapshot — same symmetric-with-undo
  -- model as every other money movement in this schema.
  v_delta := ROUND(COALESCE(v_new_value, 0) - COALESCE(v_old_value, 0));
  IF v_delta <> 0 THEN
    SELECT aw.id INTO v_captain_wallet
    FROM public.auction_categories ac
    JOIN public.auction_wallets aw ON aw.wallet_kind_id = ac.wallet_kind_id
      AND ((aw.team_id IS NOT NULL AND aw.team_id = v_team_id)
           OR (aw.auction_team_id IS NOT NULL AND aw.auction_team_id = v_auction_team_id))
    WHERE ac.id = p_category_id AND ac.auction_id = p_auction_id;

    IF v_captain_wallet IS NOT NULL THEN
      UPDATE public.auction_wallets
      SET budget_remaining = budget_remaining - v_delta, updated_at = NOW()
      WHERE id = v_captain_wallet;

      INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
      VALUES (p_auction_id, v_captain_wallet, 'captain_charge', -v_delta, p_triggering_purchase_id, 'system');
    END IF;
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, UUID, UUID, UUID) TO service_role;

-- ============================================================
-- 2. _auctionos_finalize_purchase (add_auctionos_quota.sql's version,
-- reproduced in full) — one-line change: pass p_wallet_id straight through
-- to the recalc above instead of fetching a team_id first.
-- ============================================================
DROP FUNCTION IF EXISTS public._auctionos_finalize_purchase(UUID, UUID, UUID, UUID, INT, BOOLEAN);
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
  RETURNING budget_remaining INTO v_remaining_after;

  INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
  VALUES (p_auction_id, p_wallet_id, 'purchase', -p_price, v_purchase_id, 'system');

  IF p_category_id IS NOT NULL THEN
    PERFORM public._auctionos_recalc_captain_valuation(p_auction_id, p_wallet_id, p_category_id, v_purchase_id);
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
-- 3. auctionos_undo_sale (add_auctionos.sql's version, reproduced in full)
-- — same one-line change, using the wallet id (v_sold_wallet) it already
-- had in scope instead of fetching a team_id via RETURNING.
-- ============================================================
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
    WHERE id = v_sold_wallet;

    INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
    VALUES (v_auction, v_sold_wallet, 'purchase_undo', v_sold_price, v_purchase_id, 'system');

    IF v_category IS NOT NULL THEN
      PERFORM public._auctionos_recalc_captain_valuation(v_auction, v_sold_wallet, v_category, NULL);
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

REVOKE EXECUTE ON FUNCTION public.auctionos_undo_sale(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_undo_sale(UUID) TO service_role;

-- ============================================================
-- 4. _auctionos_charge_regular_captains — NEW. Called once from
-- auctionos_begin_auction (add_auctionos_wallet_gate.sql) right before the
-- draft -> scheduled flip. Flat ₹1 Cr per Regular-category captain,
-- deducted from the team's wallet for that category's wallet kind. Guarded
-- by "already has a valuation snapshot" so it's a no-op if anything ever
-- calls it twice — begin_auction's own one-way status lock already makes
-- that unreachable in practice, but re-deriving instead of trusting that
-- holds is the same posture as every other check in this schema.
-- ============================================================
DROP FUNCTION IF EXISTS public._auctionos_charge_regular_captains(UUID);
CREATE OR REPLACE FUNCTION public._auctionos_charge_regular_captains(p_auction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_captain   RECORD;
  v_wallet_id UUID;
BEGIN
  FOR v_captain IN
    SELECT c.id AS captain_id, c.team_id, c.auction_team_id, ac.wallet_kind_id
    FROM public.auction_captains c
    JOIN public.auction_categories ac ON ac.id = c.category_id
    WHERE c.auction_id = p_auction_id AND ac.name ILIKE '%regular%'
  LOOP
    -- NOT "any row exists" — auctionos_assign_captain (add_auctionos_wizard.sql)
    -- inserts a captain_value=NULL placeholder row for every captain at
    -- assignment time, before begin_auction ever runs; an EXISTS-only guard
    -- treats that placeholder as "already charged" and skips every Regular
    -- captain unconditionally. Only a real (non-NULL) valuation counts.
    IF EXISTS (
      SELECT 1 FROM public.captain_valuations
      WHERE captain_id = v_captain.captain_id AND captain_value IS NOT NULL
    ) THEN
      CONTINUE;
    END IF;

    SELECT aw.id INTO v_wallet_id
    FROM public.auction_wallets aw
    WHERE aw.auction_id = p_auction_id
      AND aw.wallet_kind_id = v_captain.wallet_kind_id
      AND ((aw.team_id IS NOT NULL AND aw.team_id = v_captain.team_id)
           OR (aw.auction_team_id IS NOT NULL AND aw.auction_team_id = v_captain.auction_team_id));

    IF v_wallet_id IS NULL THEN
      CONTINUE; -- no wallet resolvable for this captain's category — nothing to charge
    END IF;

    UPDATE public.auction_wallets
    SET budget_remaining = budget_remaining - 100, updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, actor)
    VALUES (p_auction_id, v_wallet_id, 'captain_charge', -100, 'system');

    INSERT INTO public.captain_valuations (auction_id, captain_id, captain_value, rationale)
    VALUES (p_auction_id, v_captain.captain_id, 100, jsonb_build_object('rule', 'regular-flat-preauction', 'value', 100));

    INSERT INTO public.auction_events (auction_id, type, payload, actor)
    VALUES (p_auction_id, 'captain_charged', jsonb_build_object('captain_id', v_captain.captain_id, 'amount', 100), 'system');
  END LOOP;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public._auctionos_charge_regular_captains(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_charge_regular_captains(UUID) TO service_role;
