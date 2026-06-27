-- ============================================================
-- Rivalry Season Auto-Sync
-- Run in Supabase SQL editor IN THREE SEPARATE PASTES:
--   Paste A: everything up to and including step 2
--   Paste B: step 3 + step 4 (the CREATE FUNCTION + CREATE TRIGGER block)
--   Paste C: step 5 (the backfill UPDATE)
-- ============================================================

-- 0. Link all existing series to the active rivalry season.
--    Must run before the backfill or existing series will be skipped.
UPDATE public.series
SET season_id = (
  SELECT id FROM public.rivalry_seasons WHERE status = 'active' LIMIT 1
)
WHERE season_id IS NULL;

-- 1. Add columns to store the frozen pre-import baseline.
--    For the current active season this is 5-3.
--    All future seasons default to 0 (no manual seed needed).
ALTER TABLE public.rivalry_seasons
  ADD COLUMN IF NOT EXISTS mavericks_initial_wins          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_initial_wins      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_initial_wins           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mavericks_initial_exh_wins     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_initial_exh_wins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_initial_exh_wins      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_initial_matches           INTEGER NOT NULL DEFAULT 0;

-- Also add tie columns if the previous migration wasn't run.
ALTER TABLE public.rivalry_seasons
  ADD COLUMN IF NOT EXISTS mavericks_main_ties           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_main_ties       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_main_ties            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mavericks_exhibition_ties     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_exhibition_ties INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_exhibition_ties      INTEGER DEFAULT 0;

-- 2. Stamp the current active season with the 5-3 pre-import baseline.
--    These columns are never touched by the trigger — they are the frozen seed.
UPDATE public.rivalry_seasons
SET
  mavericks_initial_wins     = 5,
  neurostrikers_initial_wins = 3,
  total_initial_matches      = 8
WHERE status = 'active';

-- 3. Trigger function — recomputes the entire season stats from scratch.
--    Fires on any INSERT / UPDATE / DELETE to series_matches.
CREATE OR REPLACE FUNCTION public.sync_rivalry_season_wins()
RETURNS TRIGGER AS $func$
DECLARE
  v_season_id UUID;
BEGIN
  -- Resolve which rivalry season this match belongs to.
  SELECT se.season_id INTO v_season_id
  FROM public.series se
  WHERE se.id = COALESCE(NEW.series_id, OLD.series_id);

  -- If the series isn't linked to a season yet, nothing to do.
  IF v_season_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Full recompute (idempotent — safe to run multiple times).
  UPDATE public.rivalry_seasons rs SET
    -- Main series (league stage) wins = frozen baseline + all recorded league wins
    mavericks_main_wins = rs.mavericks_initial_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'league' AND sm.winner_id = 'mavericks'
    ), 0),
    neurostrikers_main_wins = rs.neurostrikers_initial_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'league' AND sm.winner_id = 'neurostrikers'
    ), 0),
    outliers_main_wins = rs.outliers_initial_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'league' AND sm.winner_id = 'outliers'
    ), 0),

    -- Exhibition (final stage) wins = frozen baseline + recorded finals wins
    mavericks_exhibition_wins = rs.mavericks_initial_exh_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'final' AND sm.winner_id = 'mavericks'
    ), 0),
    neurostrikers_exhibition_wins = rs.neurostrikers_initial_exh_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'final' AND sm.winner_id = 'neurostrikers'
    ), 0),
    outliers_exhibition_wins = rs.outliers_initial_exh_wins + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id
        AND sm.stage = 'final' AND sm.winner_id = 'outliers'
    ), 0),

    -- Ties (no pre-import baseline — pre-import matches didn't track ties)
    mavericks_main_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'league'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'mavericks' OR sm.team2_id = 'mavericks')
    ), 0),
    neurostrikers_main_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'league'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'neurostrikers' OR sm.team2_id = 'neurostrikers')
    ), 0),
    outliers_main_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'league'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'outliers' OR sm.team2_id = 'outliers')
    ), 0),
    mavericks_exhibition_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'final'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'mavericks' OR sm.team2_id = 'mavericks')
    ), 0),
    neurostrikers_exhibition_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'final'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'neurostrikers' OR sm.team2_id = 'neurostrikers')
    ), 0),
    outliers_exhibition_ties = COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'final'
        AND sm.is_tie = true AND sm.winner_id IS NULL
        AND (sm.team1_id = 'outliers' OR sm.team2_id = 'outliers')
    ), 0),

    -- Total league matches with a result (initial baseline + recorded)
    total_matches_played = rs.total_initial_matches + COALESCE((
      SELECT COUNT(*) FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = v_season_id AND sm.stage = 'league'
        AND (sm.winner_id IS NOT NULL OR (sm.is_tie = true AND sm.winner_id IS NULL))
    ), 0),

    updated_at = NOW()
  WHERE rs.id = v_season_id;

  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger to series_matches.
DROP TRIGGER IF EXISTS trg_sync_rivalry_wins ON public.series_matches;
CREATE TRIGGER trg_sync_rivalry_wins
  AFTER INSERT OR UPDATE OR DELETE ON public.series_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rivalry_season_wins();

-- 5. Initial backfill — sync all existing match data right now.
UPDATE public.rivalry_seasons rs SET
  mavericks_main_wins = rs.mavericks_initial_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.winner_id = 'mavericks'), 0),
  neurostrikers_main_wins = rs.neurostrikers_initial_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.winner_id = 'neurostrikers'), 0),
  outliers_main_wins = rs.outliers_initial_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.winner_id = 'outliers'), 0),
  mavericks_exhibition_wins = rs.mavericks_initial_exh_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.winner_id = 'mavericks'), 0),
  neurostrikers_exhibition_wins = rs.neurostrikers_initial_exh_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.winner_id = 'neurostrikers'), 0),
  outliers_exhibition_wins = rs.outliers_initial_exh_wins + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.winner_id = 'outliers'), 0),
  mavericks_main_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'mavericks' OR sm.team2_id = 'mavericks')), 0),
  neurostrikers_main_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'neurostrikers' OR sm.team2_id = 'neurostrikers')), 0),
  outliers_main_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'outliers' OR sm.team2_id = 'outliers')), 0),
  mavericks_exhibition_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'mavericks' OR sm.team2_id = 'mavericks')), 0),
  neurostrikers_exhibition_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'neurostrikers' OR sm.team2_id = 'neurostrikers')), 0),
  outliers_exhibition_ties = COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'final' AND sm.is_tie = true AND sm.winner_id IS NULL
      AND (sm.team1_id = 'outliers' OR sm.team2_id = 'outliers')), 0),
  total_matches_played = rs.total_initial_matches + COALESCE((
    SELECT COUNT(*) FROM public.series_matches sm JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = rs.id AND sm.stage = 'league'
      AND (sm.winner_id IS NOT NULL OR (sm.is_tie = true AND sm.winner_id IS NULL))), 0),
  updated_at = NOW();
