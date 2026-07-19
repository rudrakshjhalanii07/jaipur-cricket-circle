-- AuctionOS delta: Guest-style squad rebalancing — cap how many times a
-- lot can be resold, then hand it to whichever team is falling behind.
--
-- Distinct from the category-quota mechanism (add_auctionos_quota.sql,
-- min_required > 0, MVP/Regular): quota guarantees a hard per-category
-- minimum and never lets a lot near open bidding once only the mandatory
-- team can use it. This mechanism has a softer goal — "keep every team's
-- overall squad about the same size" — and never touches bidding at all;
-- it only decides what happens after a specific player has genuinely
-- failed to sell more than once. Generic (driven by
-- auction_categories.max_resell_rounds, not a JCC-specific column check —
-- JCC just sets it to 2 for Guest, leaves it NULL for MVP/Regular).
--
-- auctionos_mark_unsold gains a third branch, evaluated only for a
-- category with min_required = 0 (quota takes precedence when both would
-- somehow apply) and max_resell_rounds NOT NULL:
--   - lot.metadata.resell_rounds (0 if unset) < max_resell_rounds → LOOP,
--     same requeue-to-end-of-category-block technique as the quota loop,
--     bumping resell_rounds by one in the lot's own metadata.
--   - otherwise (already resold max_resell_rounds times, still unsold) →
--     REBALANCE: find every wallet of this category's wallet_kind that can
--     afford category.base_price, order by that wallet's TEAM's total
--     acquired_count across every wallet they hold (i.e. overall squad
--     size, not just this category) ascending, random() as the tiebreak
--     within an equal squad size, and allot to whichever wallet sorts
--     first. If nobody can afford it, terminal 'unsold' — this is a
--     best-effort balance, not a guarantee like quota's is.
--
-- A category with neither min_required nor max_resell_rounds set behaves
-- exactly as before this pass (and before add_auctionos_quota.sql):
-- plain, immediate, terminal 'unsold'.
--
-- Rebalance allotments reuse _auctionos_finalize_purchase exactly like a
-- quota allotment does (same 'sold' status, same player_purchases.metadata
-- .allotted marker) — an additional 'lot_rebalanced' event (below) is what
-- actually distinguishes "resold out of players" from "resold out of
-- patience" in the audit trail, so _auctionos_finalize_purchase's own
-- signature doesn't need to change.

-- ============================================================
-- 1. The organizer-tunable resell cap. NULL = unlimited (today's
-- unconditional quota-loop / no-loop-at-all behavior, unaffected).
-- ============================================================
ALTER TABLE public.auction_categories ADD COLUMN IF NOT EXISTS max_resell_rounds INT;

-- ============================================================
-- 2. auctionos_mark_unsold — CREATE OR REPLACE, same signature. Quota
-- branch (min_required > 0) copied verbatim from add_auctionos_quota.sql;
-- the new resell-cap/rebalance branch only runs for a category quota
-- doesn't already own.
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
  v_metadata         JSONB;
  v_min_required     INT;
  v_wallet_kind      UUID;
  v_category_base    INT;
  v_max_resell       INT;
  v_remaining_in_cat INT;
  v_max_order        INT;
  v_short_count      INT;
  v_short_wallet     UUID;
  v_short_budget     INT;
  v_resell_rounds    INT;
  v_pick_wallet      UUID;
  v_pick_budget      INT;
  v_pick_squad       INT;
BEGIN
  SELECT auction_id, status, base_price, category_id, metadata
  INTO v_auction, v_status, v_base_price, v_category, v_metadata
  FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'lot not found';
  END IF;
  IF v_status <> 'on_block' THEN
    RAISE EXCEPTION 'lot is not currently on the block';
  END IF;

  IF v_category IS NOT NULL THEN
    SELECT min_required, wallet_kind_id, base_price, max_resell_rounds
    INTO v_min_required, v_wallet_kind, v_category_base, v_max_resell
    FROM public.auction_categories WHERE id = v_category;
  END IF;

  -- ── Branch A: quota category (min_required > 0) — unchanged from
  -- add_auctionos_quota.sql. Takes precedence over max_resell_rounds if a
  -- category somehow has both set.
  IF v_category IS NOT NULL AND v_min_required IS NOT NULL AND v_min_required > 0 THEN
    SELECT COUNT(*) INTO v_remaining_in_cat
    FROM public.auction_lots
    WHERE auction_id = v_auction AND category_id = v_category AND status = 'upcoming';

    IF v_remaining_in_cat > 0 THEN
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

    UPDATE public.auction_lots SET status = 'blocked', updated_at = NOW() WHERE id = p_lot_id;
    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (
      v_auction, p_lot_id, 'lot_blocked',
      jsonb_build_object('category_id', v_category, 'short_wallet_count', v_short_count, 'base_price', v_category_base),
      'system'
    );
    RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', true);
  END IF;

  -- ── Branch B: resell-capped category (max_resell_rounds set, quota
  -- doesn't apply) — NEW this pass.
  IF v_category IS NOT NULL AND v_max_resell IS NOT NULL THEN
    v_resell_rounds := COALESCE((v_metadata->>'resell_rounds')::INT, 0);

    IF v_resell_rounds < v_max_resell THEN
      SELECT MAX(lot_order) INTO v_max_order
      FROM public.auction_lots WHERE auction_id = v_auction AND category_id = v_category;

      UPDATE public.auction_lots
      SET lot_order = lot_order + 1
      WHERE auction_id = v_auction AND lot_order > v_max_order;

      UPDATE public.auction_lots
      SET status = 'upcoming', current_bid = base_price, current_bid_wallet_id = NULL,
          lot_order = v_max_order + 1, updated_at = NOW(),
          metadata = jsonb_set(COALESCE(metadata, '{}'::JSONB), '{resell_rounds}', to_jsonb(v_resell_rounds + 1))
      WHERE id = p_lot_id;

      INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
      VALUES (
        v_auction, p_lot_id, 'lot_looped',
        jsonb_build_object('category_id', v_category, 'resell_round', v_resell_rounds + 1, 'max_resell_rounds', v_max_resell),
        'system'
      );

      RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', true, 'allotted', false, 'blocked', false);
    END IF;

    -- Resold the max number of times and still unsold — rebalance: the
    -- eligible wallet (this category's wallet_kind) whose TEAM currently
    -- has the smallest total squad (summed across every wallet that team
    -- holds, not just this category) and can afford base_price. ORDER BY
    -- squad size ASC, random() as the tiebreak, naturally falls through to
    -- the next-smallest-squad team if the very smallest can't afford it —
    -- no separate tier-by-tier loop needed.
    SELECT w.id, w.budget_remaining, team_totals.total_squad
    INTO v_pick_wallet, v_pick_budget, v_pick_squad
    FROM public.auction_wallets w
    JOIN (
      SELECT team_id, SUM(acquired_count) AS total_squad
      FROM public.auction_wallets
      WHERE auction_id = v_auction
      GROUP BY team_id
    ) team_totals ON team_totals.team_id = w.team_id
    WHERE w.auction_id = v_auction AND w.wallet_kind_id = v_wallet_kind
      AND w.budget_remaining >= v_category_base
    ORDER BY team_totals.total_squad ASC, random()
    LIMIT 1;

    IF v_pick_wallet IS NULL THEN
      UPDATE public.auction_lots SET status = 'unsold', updated_at = NOW() WHERE id = p_lot_id;
      INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
      VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price, 'rebalance_attempted', true), 'system');
      RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', false);
    END IF;

    INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
    VALUES (
      v_auction, p_lot_id, 'lot_rebalanced',
      jsonb_build_object('category_id', v_category, 'wallet_id', v_pick_wallet, 'squad_size_before', v_pick_squad),
      'system'
    );

    RETURN public._auctionos_finalize_purchase(v_auction, p_lot_id, v_pick_wallet, v_category, v_category_base, TRUE)
      || jsonb_build_object('looped', false, 'blocked', false, 'rebalanced', true);
  END IF;

  -- ── Branch C: plain category (neither quota nor resell cap) —
  -- unchanged, original behavior.
  UPDATE public.auction_lots SET status = 'unsold', updated_at = NOW() WHERE id = p_lot_id;
  INSERT INTO public.auction_events (auction_id, lot_id, type, payload, actor)
  VALUES (v_auction, p_lot_id, 'lot_unsold', jsonb_build_object('base_price', v_base_price), 'system');
  RETURN jsonb_build_object('lot_id', p_lot_id, 'looped', false, 'allotted', false, 'blocked', false);
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_mark_unsold(UUID) TO service_role;

-- New event type this pass, added to the documented vocabulary (see
-- add_auctionos.sql §14 / add_auctionos_quota.sql's own trailer):
--   lot_rebalanced: { category_id, wallet_id, squad_size_before } — a
--   resell-capped lot's max_resell_rounds was exhausted and it was handed
--   to the eligible team with the smallest overall squad, not a specific
--   short team (that's lot_sold's payload.allotted=true path from quota).
