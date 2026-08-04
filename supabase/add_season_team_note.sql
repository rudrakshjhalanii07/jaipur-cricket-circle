-- ============================================================
-- Let a team's win count carry a caveat. Run in the Supabase SQL editor.
--
-- The archived-season card shows each side's wins as a bare number, which
-- quietly invites a comparison the data can't support: the Outliers entered
-- Season 2 partway through and played roughly half the fixtures the other two
-- did, so their smaller total says nothing about how they played. There is no
-- per-team matches-played column to normalise against, so the card says it in
-- words instead — one short line under the captain, only where it's needed.
--
-- NULL (the default, and every other row) means no caveat and nothing renders.
-- Kept in step with the seeded fallback in lib/seasons.ts.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.season_teams
  ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN public.season_teams.note IS
  'Short caveat shown under this team''s win count on the archive card. NULL = none.';

UPDATE public.season_teams st
SET note = 'Entered mid-season — about half the fixtures of the other two.'
FROM public.rivalry_seasons rs
WHERE st.season_id = rs.id
  AND rs.title = 'JCC Season 2'
  AND st.team_id = 'outliers';

SELECT rs.title, st.team_id, st.main_wins, st.playoff_wins, st.note
FROM public.season_teams st
JOIN public.rivalry_seasons rs ON rs.id = st.season_id
ORDER BY rs.started_at NULLS FIRST, st.display_order;
