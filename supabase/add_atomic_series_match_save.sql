-- ============================================================
-- Atomic series-match save. Run in Supabase SQL editor as a single paste.
--
-- Why: the save route used to do separate INSERTs (match, then innings,
-- then batting/bowling per innings) with an app-level compensating delete
-- on failure — not a guarantee, just a best-effort follow-up call. That's
-- how match M3 ended up with a fully-populated series_matches row but zero
-- series_innings rows: an insert later in the chain failed and nothing
-- rolled back what came before it.
--
-- Fix: do the whole save in one plpgsql function. Postgres runs a function
-- body as part of the caller's transaction, so any exception discards
-- every INSERT it made — no partial rows possible.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_series_match(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
  v_series_id  UUID;
  v_match_id   UUID;
  v_innings_id UUID;
  v_new_series JSONB := payload->'new_series';
  v_inn        JSONB;
BEGIN
  IF NULLIF(payload->>'series_id', '') IS NOT NULL THEN
    v_series_id := (payload->>'series_id')::UUID;
  ELSIF v_new_series IS NOT NULL THEN
    INSERT INTO public.series (
      name, series_no, season_id, overs_per_innings, venue,
      started_at, ended_at, notes, articles, updated_at
    ) VALUES (
      v_new_series->>'name',
      (v_new_series->>'series_no')::INT,
      NULLIF(v_new_series->>'season_id', '')::UUID,
      (v_new_series->>'overs_per_innings')::INT,
      v_new_series->>'venue',
      NULLIF(v_new_series->>'started_at', '')::DATE,
      NULLIF(v_new_series->>'ended_at', '')::DATE,
      v_new_series->>'notes',
      COALESCE(v_new_series->'articles', '[]'::JSONB),
      NOW()
    )
    RETURNING id INTO v_series_id;
  ELSE
    RAISE EXCEPTION 'series_id or new_series required';
  END IF;

  INSERT INTO public.series_matches (
    series_id, match_no, stage, match_date, venue, team1_id, team2_id,
    toss_winner_id, toss_decision, team1_captain, team2_captain,
    winner_id, margin_type, margin_value, is_tie, super_over,
    player_of_match, match_notes, updated_at
  ) VALUES (
    v_series_id,
    (payload->>'match_no')::INT,
    payload->>'stage',
    NULLIF(payload->>'match_date', '')::DATE,
    payload->>'venue',
    payload->>'team1_id',
    payload->>'team2_id',
    NULLIF(payload->>'toss_winner_id', ''),
    NULLIF(payload->>'toss_decision', ''),
    payload->>'team1_captain',
    payload->>'team2_captain',
    NULLIF(payload->>'winner_id', ''),
    NULLIF(payload->>'margin_type', ''),
    NULLIF(payload->>'margin_value', '')::INT,
    COALESCE((payload->>'is_tie')::BOOLEAN, FALSE),
    payload->'super_over',
    payload->>'player_of_match',
    payload->>'match_notes',
    NOW()
  )
  RETURNING id INTO v_match_id;

  -- One iteration per innings (always 1-2); batting/bowling rows within
  -- each innings are inserted set-at-a-time instead of row-by-row.
  FOR v_inn IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'innings', '[]'::JSONB))
  LOOP
    INSERT INTO public.series_innings (
      match_id, innings_no, batting_team_id, bowling_team_id,
      total_runs, total_wickets, total_overs, all_out,
      extras_wides, extras_no_balls, extras_byes, extras_leg_byes,
      fall_of_wickets
    ) VALUES (
      v_match_id,
      (v_inn->>'innings_no')::INT,
      v_inn->>'batting_team_id',
      v_inn->>'bowling_team_id',
      COALESCE((v_inn->>'total_runs')::INT, 0),
      COALESCE((v_inn->>'total_wickets')::INT, 0),
      COALESCE((v_inn->>'total_overs')::NUMERIC, 0),
      COALESCE((v_inn->>'all_out')::BOOLEAN, FALSE),
      COALESCE((v_inn->>'extras_wides')::INT, 0),
      COALESCE((v_inn->>'extras_no_balls')::INT, 0),
      COALESCE((v_inn->>'extras_byes')::INT, 0),
      COALESCE((v_inn->>'extras_leg_byes')::INT, 0),
      COALESCE(v_inn->'fall_of_wickets', '[]'::JSONB)
    )
    RETURNING id INTO v_innings_id;

    INSERT INTO public.series_batting (
      innings_id, team_id, player_name, batting_order, runs, balls_faced,
      fours, sixes, dismissal_type, dismissed_by, caught_by
    )
    SELECT
      v_innings_id, v_inn->>'batting_team_id', b.player_name,
      COALESCE(b.batting_order, b.ord::INT), COALESCE(b.runs, 0), b.balls_faced,
      COALESCE(b.fours, 0), COALESCE(b.sixes, 0),
      NULLIF(b.dismissal_type, ''), NULLIF(b.dismissed_by, ''), NULLIF(b.caught_by, '')
    FROM jsonb_to_recordset(COALESCE(v_inn->'batting', '[]'::JSONB)) WITH ORDINALITY
      AS b(player_name TEXT, batting_order INT, runs INT, balls_faced INT,
           fours INT, sixes INT, dismissal_type TEXT, dismissed_by TEXT,
           caught_by TEXT, ord INT);

    INSERT INTO public.series_bowling (
      innings_id, team_id, player_name, bowling_order, overs, maidens,
      runs_conceded, wickets, wides, no_balls
    )
    SELECT
      v_innings_id, v_inn->>'bowling_team_id', w.player_name,
      COALESCE(w.bowling_order, w.ord::INT), COALESCE(w.overs, 0), COALESCE(w.maidens, 0),
      COALESCE(w.runs_conceded, 0), COALESCE(w.wickets, 0), COALESCE(w.wides, 0), COALESCE(w.no_balls, 0)
    FROM jsonb_to_recordset(COALESCE(v_inn->'bowling', '[]'::JSONB)) WITH ORDINALITY
      AS w(player_name TEXT, bowling_order INT, overs NUMERIC, maidens INT,
           runs_conceded INT, wickets INT, wides INT, no_balls INT, ord INT);
  END LOOP;

  RETURN jsonb_build_object('match_id', v_match_id, 'series_id', v_series_id);
END;
$func$;
