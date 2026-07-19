-- AuctionOS delta: enforce auction_categories.max_allowed as a hard bid
-- ceiling, in the SQL layer — closing the gap that let The Outliers buy a
-- 3rd MVP player (captain + 2 purchases) against JCC's intended 2-MVP /
-- 5-Regular exact squad.
--
-- max_allowed has existed on auction_categories since add_auctionos.sql
-- (nullable = unbounded) and is already wired through the categories POST/
-- PATCH routes, but nothing ever READ it — the only per-category ceiling
-- enforced anywhere was min_required, which is a FLOOR (quota's allot/loop/
-- block machinery in add_auctionos_quota.sql exists to make sure a team
-- gets to at least min_required, never to stop them going over it). JCC's
-- wizard preset (components/auctionos/wizard/presets.ts) never set
-- max_allowed on MVP/Regular either, so even a fresh wizard-created auction
-- had no ceiling — that's fixed there in the same pass as this file, setting
-- max_allowed = min_required for MVP (2) and Regular (5), matching JCC's
-- exact-squad rule (Guest stays max_allowed = NULL, uncapped by quota,
-- governed by max_resell_rounds instead, per add_auctionos_guest_rebalance.sql).
--
-- app/api/auctionos/bid/route.ts gets the identical TS-side check (same
-- acquiredCountByCategory it already builds via withCaptainBonus) in the
-- same pass — belt-and-suspenders, the same posture as the reserve check
-- that's independently enforced in both the route and this function.
--
-- Only auctionos_raise_bid changes (CREATE OR REPLACE, full body — a
-- plpgsql body can't be patched in place). The allotment paths in
-- auctionos_mark_unsold / auctionos_advance_lot / auctionos_resolve_blocked_lot
-- only ever fire for a wallet still SHORT of min_required, and max_allowed is
-- never meant to be set below min_required, so they can't hand a lot to a
-- team that's already at its ceiling — no change needed there.
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
  v_max_allowed  INT;
  v_acquired     INT;
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

  -- Quota ceiling — a category with max_allowed set is a hard cap, distinct
  -- from min_required's floor. Checked before the reserve math below since
  -- it's an outright block, not a budget question.
  IF v_category IS NOT NULL THEN
    SELECT max_allowed INTO v_max_allowed FROM public.auction_categories WHERE id = v_category;
    IF v_max_allowed IS NOT NULL THEN
      v_acquired := public._auctionos_acquired_count(p_wallet_id, v_category);
      IF v_acquired >= v_max_allowed THEN
        RAISE EXCEPTION 'this team has already filled its quota for this category';
      END IF;
    END IF;
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
