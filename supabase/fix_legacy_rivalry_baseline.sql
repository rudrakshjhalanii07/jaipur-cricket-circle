-- Fix the archived "Opal-Nitin" (Setia-Chaudhary) legacy era, which got its
-- manually-seeded totals wiped to 0 by the rivalry_season_trigger.sql backfill.
--
-- Root cause: that migration froze a per-season baseline (mavericks_initial_wins,
-- total_initial_matches, etc.) but only stamped it for the ACTIVE season. The
-- archived legacy row's baseline was left at the column default of 0, so the
-- unconditional backfill recomputed its totals as 0 (baseline) + 0 (no linked
-- series_matches, since this era predates that system) = 0 across the board.
--
-- This UPDATE is scoped by title to this one archived row only. It does not
-- touch the active season, the trigger function, or table schema, so it has
-- no effect on the current Sagar-Anil-Rudraksh era or on any future seasons.

UPDATE public.rivalry_seasons
SET
  mavericks_initial_wins         = 10,
  neurostrikers_initial_wins     = 10,
  mavericks_initial_exh_wins     = 3,
  neurostrikers_initial_exh_wins = 1,
  total_initial_matches          = 24,

  -- Restate the live totals to match (baseline + 0 linked matches, since this
  -- era has no series_matches rows and never will).
  mavericks_main_wins            = 10,
  neurostrikers_main_wins        = 10,
  mavericks_exhibition_wins      = 3,
  neurostrikers_exhibition_wins  = 1,
  total_matches_played           = 24,

  updated_at = NOW()
WHERE title = 'The Setia-Chaudhary Era'
  AND status = 'archived';
