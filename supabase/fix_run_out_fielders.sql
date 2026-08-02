-- ============================================================
-- Move run-out fielders out of the bowler column. Run in the Supabase SQL editor.
--
-- A run out has no bowler, so `dismissed_by` should be null on these rows and
-- the fielders should sit in `caught_by`. 25 of the 34 run outs on record have
-- it the other way round — not a scorer error, but the import form's fault: it
-- disabled the fielder input for every dismissal except a catch, so the only
-- field available to type a name into was the bowler one.
--
--   caught_by    →  9 rows   (5 direct hits, 4 combined)
--   dismissed_by → 25 rows  (21 direct hits, 4 combined)
--
-- app/admin/series-import/page.tsx now opens the fielder column for run outs
-- and stumpings and disables the bowler column on a run out, so nothing new
-- lands in the wrong place. This backfills what is already stored.
--
-- lib/mvp.ts reads BOTH columns (see runOutFielders) and keeps doing so after
-- this runs — the fallback costs nothing and covers any scorecard imported
-- from an older backup. So this migration changes no leaderboard number; it
-- only makes the stored rows say what they mean.
--
-- Safe to run more than once: the WHERE clause skips anything already moved.
-- ============================================================

BEGIN;

-- What is about to change — read this before committing.
SELECT
  player_name        AS batter_out,
  dismissed_by       AS fielders_being_moved,
  array_length(string_to_array(dismissed_by, '/'), 1) AS fielder_count
FROM public.series_batting
WHERE dismissal_type = 'run_out'
  AND caught_by IS NULL
  AND dismissed_by IS NOT NULL
ORDER BY dismissed_by;

UPDATE public.series_batting
SET caught_by    = dismissed_by,
    dismissed_by = NULL
WHERE dismissal_type = 'run_out'
  AND caught_by IS NULL
  AND dismissed_by IS NOT NULL;

-- Every run out should now name its fielders in caught_by and no one in
-- dismissed_by. Expect: stranded = 0, and still_has_bowler = 0.
SELECT
  count(*) FILTER (WHERE caught_by IS NULL)      AS stranded,
  count(*) FILTER (WHERE dismissed_by IS NOT NULL) AS still_has_bowler,
  count(*)                                        AS total_run_outs
FROM public.series_batting
WHERE dismissal_type = 'run_out';

COMMIT;
