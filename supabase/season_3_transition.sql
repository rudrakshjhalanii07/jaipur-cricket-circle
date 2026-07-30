-- ============================================================
-- Season 2 -> Season 3 transition. Run in the Supabase SQL editor.
--
-- Prerequisites, in this order:
--   1. add_season_teams.sql            (season_teams table + new trigger)
--   2. add_vikings_team.sql            (players.team CHECK allows Vikings)
--   3. add_archive_and_create_season_v2.sql  (not needed by this file, but
--      required before the admin Seasons page can create the season after this)
--
-- What this does, in ONE transaction:
--   - archives the currently active season (Season 2)
--   - creates Season 3 as the new active season
--   - gives Season 3 its four teams, Vikings included
--
-- Seasons 1 and 2 are NOT touched beyond the status flip. They keep their own
-- 2- and 3-team rosters, which is the whole point of the season_teams model.
--
-- Ready to run as-is.
-- ============================================================

BEGIN;

WITH cfg AS (
  SELECT
    'JCC Season 3'::TEXT AS new_title,
    'Season 3'::TEXT     AS new_season_label,  -- badge shown on /seasons
    DATE '2026-07-24'    AS new_started_at     -- Friday; JCC plays Fridays
),
-- Archive whatever is active right now. Captured as a CTE so the whole
-- transition is a single statement — no window where zero seasons are active.
archived AS (
  UPDATE public.rivalry_seasons
     SET status = 'archived',
         ended_at = CURRENT_DATE
   WHERE status = 'active'
  RETURNING id, title
),
created AS (
  INSERT INTO public.rivalry_seasons (
    title, season_label, status, started_at,
    -- These two legacy columns are still NOT NULL on the old schema and are no
    -- longer read by the app; they're satisfied here and become dead weight
    -- once the column cleanup lands.
    mavericks_captain, neurostrikers_captain
  )
  SELECT
    cfg.new_title, cfg.new_season_label, 'active', cfg.new_started_at,
    'Nitesh Jhurani', 'Saurabh Charan'
  FROM cfg
  RETURNING id
)
INSERT INTO public.season_teams (season_id, team_id, captain, display_order)
SELECT created.id, t.team_id, t.captain, t.display_order
FROM created
CROSS JOIN (VALUES
  ('neurostrikers', 'Saurabh Charan',        0),
  ('mavericks',     'Nitesh Jhurani', 1),
  ('outliers',      'Naman Saini',    2),
  ('vikings',       'Bhairav Deep',   3)
) AS t(team_id, captain, display_order);

COMMIT;


-- ── Verify before you move on ───────────────────────────────────────────────
-- Expect: exactly one active season (Season 3) with 4 team rows, Season 2
-- archived with 3, and the legacy season archived with 2.
--
--   SELECT rs.season_label, rs.status, COUNT(st.team_id) AS teams
--   FROM public.rivalry_seasons rs
--   LEFT JOIN public.season_teams st ON st.season_id = rs.id
--   GROUP BY rs.id, rs.season_label, rs.status
--   ORDER BY rs.status, rs.started_at DESC NULLS LAST;
--
-- Then grab the new season's id for the fixture seed script:
--
--   SELECT id FROM public.rivalry_seasons WHERE status = 'active';
--
-- and run:
--
--   SEASON_ID=<that-uuid> node scripts/seed-season-3.mjs --dry-run
--   SEASON_ID=<that-uuid> node scripts/seed-season-3.mjs
