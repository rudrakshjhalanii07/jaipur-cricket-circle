-- Fix active rivalry season: add missing tie columns and set correct pre-import baseline.
-- Run in the Supabase SQL editor.

-- 1. Add tie-tracking columns (idempotent)
ALTER TABLE public.rivalry_seasons
  ADD COLUMN IF NOT EXISTS mavericks_main_ties         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_main_ties     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_main_ties          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mavericks_exhibition_ties   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neurostrikers_exhibition_ties INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_exhibition_ties    INTEGER DEFAULT 0;

-- 2. Correct the active season with the true pre-import baseline.
--    Main-series wins (5–3) reflect matches played before the tri-series
--    scorecard system was introduced. Exhibition wins are 0 here because they
--    are computed live from series_matches finals by applyLiveSeasonStats.
UPDATE public.rivalry_seasons
SET
  title                         = 'The Rawat-Sharma-Jhalani Era',
  mavericks_captain             = 'Anil Rawat',
  neurostrikers_captain         = 'Sagar Sharma',
  outliers_captain              = 'Rudraksh Jhalani',

  -- Pre-import main-series baseline (Mavericks 5 – NeuroStrikers 3, 8 matches)
  mavericks_main_wins           = 5,
  neurostrikers_main_wins       = 3,
  outliers_main_wins            = 0,

  -- Exhibition wins baseline: 0 (live finals data overlaid by code)
  mavericks_exhibition_wins     = 0,
  neurostrikers_exhibition_wins = 0,
  outliers_exhibition_wins      = 0,

  -- Tie baselines
  mavericks_main_ties           = 0,
  neurostrikers_main_ties       = 0,
  outliers_main_ties            = 0,
  mavericks_exhibition_ties     = 0,
  neurostrikers_exhibition_ties = 0,
  outliers_exhibition_ties      = 0,

  -- 8 pre-import league matches; code adds live tracked matches on top
  total_matches_played          = 8,

  started_at                    = '2026-05-17',
  notes                         = 'Pre-import baseline: Mavericks 5 – NeuroStrikers 3 in main series (8 matches before tri-series scorecard tracking began). Exhibition wins are overlaid live from series_matches finals.',
  updated_at                    = NOW()
WHERE status = 'active';
