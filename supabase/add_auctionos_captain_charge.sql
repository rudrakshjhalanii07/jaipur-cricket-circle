-- AuctionOS delta: captain valuation now carries a real wallet cost.
--
-- Previously (add_auctionos.sql + Phase 3's add_auctionos_wizard.sql),
-- `auctionos_assign_captain` only created an identity record — a captain
-- cost their team nothing, and `captain_valuations` (50% of the highest
-- unreversed purchase the team made in the captain's category) was
-- write-only: computed and logged on every sale/undo in that category, but
-- never charged to the wallet anywhere.
--
-- Per direction from the project owner: a captain's price is NOT a fixed
-- fee paid at assignment. It starts at NULL (no cost) and only begins
-- existing the moment the captain's own team completes its FIRST purchase
-- in the captain's category — at that point the newly-computed
-- captain_value is deducted from that team's relevant wallet (resolved via
-- the category's wallet_kind_id, same join the docs already describe for
-- "that captain's team's purchases in that category"). If a LATER purchase
-- in that same team+category raises the highest qualifying purchase (and
-- therefore captain_value), only the DELTA is charged — not the full new
-- value again. Undoing a sale that was the category's highest purchase
-- lowers captain_value back down, and this delta is negative, i.e. a
-- refund. This makes the charge symmetric with the existing undo model
-- rather than a one-way deduction.
--
-- Scope, per explicit confirmation: a captain's own price only ever
-- competes against HIS OWN team's other purchases in HIS OWN category —
-- unchanged from the existing query shape (aw.team_id = p_team_id AND
-- pp.category_id = p_category_id) — no other team's numbers are touched by
-- this change.
--
-- This only replaces _auctionos_recalc_captain_valuation's body (same
-- signature, so CREATE OR REPLACE keeps existing REVOKE/GRANT intact — the
-- DROP+re-GRANT here is defensive, matching the base file's own convention
-- rather than because the signature changed).

-- One new ledger type so this deduction is auditable in wallet_transactions
-- alongside every other kind of wallet movement, per the "engine owns money
-- movement, one place it's auditable" boundary AUCTIONOS.md documents.
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('purchase', 'purchase_undo', 'transfer_out', 'transfer_in', 'adjustment', 'captain_charge'));

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
  v_old_value  NUMERIC;
  v_highest    INT;
  v_new_value  NUMERIC;
  v_delta      INT;
  v_wallet_id  UUID;
BEGIN
  SELECT id INTO v_captain_id
  FROM public.auction_captains
  WHERE auction_id = p_auction_id AND team_id = p_team_id AND category_id = p_category_id;

  IF v_captain_id IS NULL THEN
    RETURN; -- this team has no captain in this category — nothing to recalculate
  END IF;

  -- Latest snapshot before this one, so we can charge/refund only the
  -- change — see header. NULL (no purchase yet) counts as 0 for the delta.
  SELECT captain_value INTO v_old_value
  FROM public.captain_valuations
  WHERE captain_id = v_captain_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  SELECT MAX(pp.price) INTO v_highest
  FROM public.player_purchases pp
  JOIN public.auction_wallets aw ON aw.id = pp.wallet_id
  WHERE pp.auction_id = p_auction_id
    AND aw.team_id = p_team_id
    AND pp.category_id = p_category_id
    AND pp.reversed_at IS NULL;

  v_new_value := CASE WHEN v_highest IS NULL THEN NULL ELSE v_highest * 0.5 END;

  INSERT INTO public.captain_valuations (auction_id, captain_id, triggering_purchase_id, captain_value, rationale)
  VALUES (
    p_auction_id,
    v_captain_id,
    p_triggering_purchase_id,
    v_new_value,
    jsonb_build_object('highest_qualifying_purchase', v_highest)
  );

  INSERT INTO public.auction_events (auction_id, type, payload, actor)
  VALUES (p_auction_id, 'captain_value_changed', jsonb_build_object('captain_id', v_captain_id, 'highest_qualifying_purchase', v_highest), 'system');

  -- Charge (or refund, if the delta is negative — an undo lowered the
  -- category's highest purchase) the captain's own team's wallet for the
  -- CHANGE in captain_value since the last snapshot. No budget-sufficiency
  -- check here, matching that this is a derived cost of money already
  -- spent, not a new bid being validated — it can legitimately push
  -- budget_remaining negative if the team's purse was nearly exhausted by
  -- the triggering purchase itself.
  v_delta := ROUND(COALESCE(v_new_value, 0) - COALESCE(v_old_value, 0));
  IF v_delta <> 0 THEN
    SELECT aw.id INTO v_wallet_id
    FROM public.auction_categories ac
    JOIN public.auction_wallets aw ON aw.wallet_kind_id = ac.wallet_kind_id AND aw.team_id = p_team_id
    WHERE ac.id = p_category_id AND ac.auction_id = p_auction_id;

    IF v_wallet_id IS NOT NULL THEN
      UPDATE public.auction_wallets
      SET budget_remaining = budget_remaining - v_delta, updated_at = NOW()
      WHERE id = v_wallet_id;

      INSERT INTO public.wallet_transactions (auction_id, wallet_id, type, amount, related_purchase_id, actor)
      VALUES (p_auction_id, v_wallet_id, 'captain_charge', -v_delta, p_triggering_purchase_id, 'system');
    END IF;
  END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._auctionos_recalc_captain_valuation(UUID, TEXT, UUID, UUID) TO service_role;
