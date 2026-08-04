-- ============================================================
-- Name the two archived seasons after their number, not their captains.
-- Run in the Supabase SQL editor.
--
-- "The Opal-Nitin Era" / "The Sagar-Anil-Rudraksh Era" read as folklore rather
-- than as a league: nothing in the title says which came first, and the names
-- stop meaning anything to anyone who joined after those captains left. The
-- season_label column already carried the ordering ("Legacy Season", "Season
-- 2"); the title now says it out loud, matching the seeded fallbacks in
-- lib/seasons.ts so the page reads the same with or without the DB.
--
-- Matched on the old title so a re-run is a no-op and nothing else is touched.
-- ============================================================

UPDATE public.rivalry_seasons
SET title = 'JCC Season 1', updated_at = NOW()
WHERE title = 'The Opal-Nitin Era';

UPDATE public.rivalry_seasons
SET title = 'JCC Season 2', updated_at = NOW()
WHERE title = 'The Sagar-Anil-Rudraksh Era';

SELECT id, title, season_label, status, started_at
FROM public.rivalry_seasons
ORDER BY started_at NULLS FIRST;
