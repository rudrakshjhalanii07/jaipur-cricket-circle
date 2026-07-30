-- ============================================================
-- Atomic season transition, variable team count.
-- Run in the Supabase SQL editor as a single paste, AFTER add_season_teams.sql.
--
-- Supersedes archive_and_create_season() in add_archive_and_create_season.sql,
-- whose signature took three fixed captain parameters and so could only ever
-- create a 2- or 3-team season. This version takes the teams as JSONB, so the
-- season declares whatever roster it has.
--
-- The original reason for doing this in plpgsql still holds: archiving the old
-- season and creating the new one are separate writes, and a failure partway
-- would leave the club with zero active seasons. Everything below — including
-- the season_teams inserts — runs in one transaction, so any exception rolls
-- the whole thing back.
-- ============================================================

-- Drop the old 3-captain signature so the two can't be confused at call time.
DROP FUNCTION IF EXISTS public.archive_and_create_season(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.archive_and_create_season(
  p_old_season_id   UUID,
  p_new_title       TEXT,
  p_new_season_label TEXT,
  p_new_started_at  DATE,
  -- [{"team_id": "mavericks", "captain": "...", "display_order": 0}, ...]
  p_teams           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_new_id UUID;
  v_count  INT;
BEGIN
  IF jsonb_typeof(p_teams) <> 'array' THEN
    RAISE EXCEPTION 'p_teams must be a JSON array';
  END IF;

  SELECT COUNT(*) INTO v_count FROM jsonb_array_elements(p_teams);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'A season needs at least 2 teams, got %', v_count;
  END IF;

  UPDATE public.rivalry_seasons
    SET status = 'archived', ended_at = CURRENT_DATE
    WHERE id = p_old_season_id AND status = 'active';

  -- mavericks_captain / neurostrikers_captain are still NOT NULL on the legacy
  -- schema. They are no longer read by the app, but must be satisfied until
  -- the column cleanup lands — fill them from the roster when those teams are
  -- present, otherwise from the first two teams so any roster can insert.
  INSERT INTO public.rivalry_seasons (
    title, season_label, status, started_at,
    mavericks_captain, neurostrikers_captain
  ) VALUES (
    p_new_title, p_new_season_label, 'active', p_new_started_at,
    COALESCE(
      (SELECT t->>'captain' FROM jsonb_array_elements(p_teams) t
        WHERE t->>'team_id' = 'mavericks'),
      (SELECT t->>'captain' FROM jsonb_array_elements(p_teams) WITH ORDINALITY AS a(t, n)
        ORDER BY n LIMIT 1)
    ),
    COALESCE(
      (SELECT t->>'captain' FROM jsonb_array_elements(p_teams) t
        WHERE t->>'team_id' = 'neurostrikers'),
      (SELECT t->>'captain' FROM jsonb_array_elements(p_teams) WITH ORDINALITY AS a(t, n)
        ORDER BY n OFFSET 1 LIMIT 1)
    )
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.season_teams (season_id, team_id, captain, display_order)
  SELECT
    v_new_id,
    t->>'team_id',
    NULLIF(t->>'captain', ''),
    COALESCE((t->>'display_order')::INT, (n - 1)::INT)
  FROM jsonb_array_elements(p_teams) WITH ORDINALITY AS a(t, n);

  RETURN v_new_id;
END;
$func$;
