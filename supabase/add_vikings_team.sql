-- ============================================================
-- Vikings join from Season 3.
--
-- series_matches.team1_id / team2_id / winner_id are plain TEXT with no
-- check constraint, so match data needs nothing here. The only place a
-- team name is constrained is players.team, set by add_outliers_team.sql.
-- ============================================================

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_team_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_team_check
  CHECK (team IN ('Mavericks', 'NeuroStrikers', 'The Outliers', 'Vikings', 'Unassigned'));
