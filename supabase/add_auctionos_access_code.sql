-- AUCTIONOS — SaaS access-code pivot (delta on top of add_auctionos.sql's
-- schema v3, already applied). This is the incremental patch, not another
-- full re-run of that ~1300-line file — see AUCTIONOS.md's "Landing
-- philosophy" section for why this exists: the auction code is now the
-- only front door, so `auctions` can no longer be publicly listed.

-- 1. The code itself.
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- 2. auctions is no longer publicly listable — every anon lookup must go
-- through /api/auctionos/resolve-code (by code) or /api/auctionos/current
-- (service role) instead.
DROP POLICY IF EXISTS "Allow public read auctions" ON public.auctions;

-- 3. auctionos_create_auction now generates + returns the access_code.
-- Full function body (unchanged elsewhere) — CREATE OR REPLACE, so this is
-- the only place that needs updating; every other RPC in add_auctionos.sql
-- is untouched by this pass.
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

REVOKE EXECUTE ON FUNCTION public.auctionos_create_auction(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auctionos_create_auction(JSONB) TO service_role;

-- 4. Backfill: the existing "Season II" auction predates access_code and
-- has NULL — give it one so the code-entry flow has something to test
-- against without needing to create a fresh auction.
DO $$
DECLARE
  v_code TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.auctions WHERE access_code IS NULL) THEN
    LOOP
      SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', ceil(random() * 33)::INT, 1), '')
      INTO v_code
      FROM generate_series(1, 6);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.auctions WHERE access_code = v_code);
    END LOOP;
    UPDATE public.auctions SET access_code = v_code WHERE access_code IS NULL;
    RAISE NOTICE 'Backfilled access_code: %', v_code;
  END IF;
END $$;
