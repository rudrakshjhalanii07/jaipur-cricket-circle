-- ============================================================
-- Variable-team seasons.
--
-- Why: rivalry_seasons stores one column per team per stat
-- (mavericks_main_wins, neurostrikers_main_wins, ...). That welds the
-- team count into the schema — Season 3 adding Vikings would mean six new
-- columns plus another ~40 lines of copy-paste in the sync trigger, and a
-- Season 5 with six teams would mean doing it all again.
--
-- season_teams replaces that with one row per (season, team). A season
-- declares whatever teams it has; Seasons 1 and 2 keep their 2- and
-- 3-team shape untouched, and adding a team is an INSERT, not a migration.
--
-- The old rivalry_seasons per-team columns are LEFT IN PLACE but no longer
-- read by the app. Dropping them is a separate cleanup once this path is
-- confirmed in production — keeping them makes this migration reversible.
--
-- Run in the Supabase SQL editor IN FOUR SEPARATE PASTES:
--   Paste A: steps 1-3   (table, RLS, backfill)
--   Paste B: step 4      (stage + team-id constraint changes)
--   Paste C: step 5      (trigger function + trigger)
--   Paste D: step 6      (backfill recompute)
-- ============================================================


-- ── 1. The table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.season_teams (
  season_id        UUID NOT NULL REFERENCES public.rivalry_seasons(id) ON DELETE CASCADE,
  team_id          TEXT NOT NULL,           -- matches TeamId in lib/teams.ts
  captain          TEXT,
  display_order    INT  NOT NULL DEFAULT 0,

  -- Running totals, kept live by the trigger in step 5.
  main_wins        INT  NOT NULL DEFAULT 0,
  playoff_wins     INT  NOT NULL DEFAULT 0,
  main_ties        INT  NOT NULL DEFAULT 0,
  playoff_ties     INT  NOT NULL DEFAULT 0,

  -- Frozen pre-import baseline. Never touched by the trigger — it is added
  -- to the recorded counts, exactly as the old *_initial_wins columns were.
  initial_wins     INT  NOT NULL DEFAULT 0,
  initial_exh_wins INT  NOT NULL DEFAULT 0,

  PRIMARY KEY (season_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_season_teams_season ON public.season_teams(season_id);


-- ── 2. RLS — public read, matching rivalry_seasons ──────────────────────────
ALTER TABLE public.season_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to season_teams" ON public.season_teams;
CREATE POLICY "Allow public read access to season_teams"
  ON public.season_teams FOR SELECT TO public USING (true);


-- ── 3. Backfill existing seasons from the per-team columns ──────────────────
-- Unpivots the three hardcoded team column groups into rows. A team is only
-- materialised when that season actually had a captain for it, so the
-- 2-captain legacy season produces 2 rows and the 3-captain season produces 3.
-- Idempotent: ON CONFLICT DO NOTHING means re-running never clobbers live data.
INSERT INTO public.season_teams (
  season_id, team_id, captain, display_order,
  main_wins, playoff_wins, main_ties, playoff_ties,
  initial_wins, initial_exh_wins
)
SELECT * FROM (
  SELECT
    rs.id, 'neurostrikers', rs.neurostrikers_captain, 0,
    COALESCE(rs.neurostrikers_main_wins, 0),
    COALESCE(rs.neurostrikers_exhibition_wins, 0),
    COALESCE(rs.neurostrikers_main_ties, 0),
    COALESCE(rs.neurostrikers_exhibition_ties, 0),
    COALESCE(rs.neurostrikers_initial_wins, 0),
    COALESCE(rs.neurostrikers_initial_exh_wins, 0)
  FROM public.rivalry_seasons rs
  WHERE rs.neurostrikers_captain IS NOT NULL

  UNION ALL

  SELECT
    rs.id, 'mavericks', rs.mavericks_captain, 1,
    COALESCE(rs.mavericks_main_wins, 0),
    COALESCE(rs.mavericks_exhibition_wins, 0),
    COALESCE(rs.mavericks_main_ties, 0),
    COALESCE(rs.mavericks_exhibition_ties, 0),
    COALESCE(rs.mavericks_initial_wins, 0),
    COALESCE(rs.mavericks_initial_exh_wins, 0)
  FROM public.rivalry_seasons rs
  WHERE rs.mavericks_captain IS NOT NULL

  UNION ALL

  SELECT
    rs.id, 'outliers', rs.outliers_captain, 2,
    COALESCE(rs.outliers_main_wins, 0),
    COALESCE(rs.outliers_exhibition_wins, 0),
    COALESCE(rs.outliers_main_ties, 0),
    COALESCE(rs.outliers_exhibition_ties, 0),
    COALESCE(rs.outliers_initial_wins, 0),
    COALESCE(rs.outliers_initial_exh_wins, 0)
  FROM public.rivalry_seasons rs
  WHERE rs.outliers_captain IS NOT NULL
) AS backfill
ON CONFLICT (season_id, team_id) DO NOTHING;


-- ── 4. Fixture-shape changes on series_matches ──────────────────────────────

-- 4a. Playoff stages. The Season 3 final week is a three-round bracket:
--     eliminator (3rd v 4th) -> qualifier (2nd v eliminator winner)
--     -> final (1st v qualifier winner).
--     'league' and 'final' keep their meaning, so existing rows are valid.
ALTER TABLE public.series_matches DROP CONSTRAINT IF EXISTS series_matches_stage_check;
ALTER TABLE public.series_matches
  ADD CONSTRAINT series_matches_stage_check
  CHECK (stage IN ('league', 'eliminator', 'qualifier', 'final'));

-- 4b. Fixtures are now seeded before they are played, and a bracket fixture's
--     participants aren't known until the league table settles. Allow the team
--     columns to be NULL and record the seed position instead; a resolver
--     fills in the real team once standings are final.
ALTER TABLE public.series_matches ALTER COLUMN team1_id DROP NOT NULL;
ALTER TABLE public.series_matches ALTER COLUMN team2_id DROP NOT NULL;

ALTER TABLE public.series_matches
  ADD COLUMN IF NOT EXISTS team1_seed INT,   -- 1-indexed league position, bracket only
  ADD COLUMN IF NOT EXISTS team2_seed INT,
  -- When set, this side is "winner of match N in the same series" rather than
  -- a league seed — that's how qualifier and final chain off the eliminator.
  ADD COLUMN IF NOT EXISTS team1_from_match_no INT,
  ADD COLUMN IF NOT EXISTS team2_from_match_no INT;

-- 4c. Weeks. Each week of the published schedule is one `series` row.
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS week_no INT;


-- ── 5. Season stats sync trigger (set-based, team-count agnostic) ───────────
-- Replaces sync_rivalry_season_wins from rivalry_season_trigger.sql, which
-- repeated the same subquery once per team per stat. This version aggregates
-- every recorded match for the season in one pass and joins the result onto
-- whatever teams that season declares — 2, 3, 4 or more, no edits needed.
CREATE OR REPLACE FUNCTION public.sync_season_team_stats()
RETURNS TRIGGER AS $func$
DECLARE
  v_season_id UUID;
BEGIN
  SELECT se.season_id INTO v_season_id
  FROM public.series se
  WHERE se.id = COALESCE(NEW.series_id, OLD.series_id);

  IF v_season_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.recompute_season_stats(v_season_id);
  RETURN NULL;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;


-- Full recompute for one season. Idempotent — safe to run any number of times.
-- Split out from the trigger so the backfill in step 6 and any future repair
-- job can call the exact same logic instead of duplicating it.
CREATE OR REPLACE FUNCTION public.recompute_season_stats(p_season_id UUID)
RETURNS VOID AS $func$
BEGIN
  -- Reset to the frozen baseline first, then add the recorded counts back on
  -- top. Doing it in that order means a team whose last match was deleted —
  -- or which has played nothing yet — lands on its baseline rather than
  -- keeping stale totals, without needing a separate "teams with no matches"
  -- case to go stale-hunting for.
  UPDATE public.season_teams st SET
    main_wins    = st.initial_wins,
    playoff_wins = st.initial_exh_wins,
    main_ties    = 0,
    playoff_ties = 0
  WHERE st.season_id = p_season_id;

  -- One row per team that appears on either side of a decided match in this
  -- season, carrying its wins and ties split by league vs playoff stage.
  WITH decided AS (
    SELECT sm.stage, sm.team1_id, sm.team2_id, sm.winner_id, sm.is_tie
    FROM public.series_matches sm
    JOIN public.series se ON se.id = sm.series_id
    WHERE se.season_id = p_season_id
      AND (sm.winner_id IS NOT NULL OR (sm.is_tie = TRUE AND sm.winner_id IS NULL))
  ),
  -- Unpivot each match into its two participants so wins and ties can be
  -- counted per team without naming a single team id.
  sides AS (
    SELECT stage, team1_id AS team_id, winner_id, is_tie FROM decided WHERE team1_id IS NOT NULL
    UNION ALL
    SELECT stage, team2_id AS team_id, winner_id, is_tie FROM decided WHERE team2_id IS NOT NULL
  ),
  tallied AS (
    SELECT
      team_id,
      COUNT(*) FILTER (
        WHERE stage = 'league' AND winner_id = team_id
      ) AS main_wins,
      COUNT(*) FILTER (
        WHERE stage <> 'league' AND winner_id = team_id
      ) AS playoff_wins,
      COUNT(*) FILTER (
        WHERE stage = 'league' AND is_tie = TRUE AND winner_id IS NULL
      ) AS main_ties,
      COUNT(*) FILTER (
        WHERE stage <> 'league' AND is_tie = TRUE AND winner_id IS NULL
      ) AS playoff_ties
    FROM sides
    GROUP BY team_id
  )
  UPDATE public.season_teams st SET
    -- Frozen baseline + recorded, matching the old trigger's semantics.
    main_wins    = st.initial_wins     + t.main_wins,
    playoff_wins = st.initial_exh_wins + t.playoff_wins,
    main_ties    = t.main_ties,
    playoff_ties = t.playoff_ties
  FROM tallied t
  WHERE st.season_id = p_season_id
    AND st.team_id = t.team_id;

  -- Season-level total stays on rivalry_seasons, unchanged in meaning:
  -- league matches with a result, plus the frozen pre-import count.
  UPDATE public.rivalry_seasons rs SET
    total_matches_played = rs.total_initial_matches + COALESCE((
      SELECT COUNT(*)
      FROM public.series_matches sm
      JOIN public.series se ON se.id = sm.series_id
      WHERE se.season_id = p_season_id
        AND sm.stage = 'league'
        AND (sm.winner_id IS NOT NULL OR (sm.is_tie = TRUE AND sm.winner_id IS NULL))
    ), 0),
    updated_at = NOW()
  WHERE rs.id = p_season_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;


-- Swap the trigger over. The old one wrote to the rivalry_seasons per-team
-- columns, which are no longer read — drop it so the two don't both fire.
DROP TRIGGER IF EXISTS trg_sync_rivalry_wins ON public.series_matches;
DROP TRIGGER IF EXISTS trg_sync_season_team_stats ON public.series_matches;
CREATE TRIGGER trg_sync_season_team_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.series_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_season_team_stats();


-- ── 6. Recompute every season now ───────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.rivalry_seasons LOOP
    PERFORM public.recompute_season_stats(r.id);
  END LOOP;
END;
$$;
