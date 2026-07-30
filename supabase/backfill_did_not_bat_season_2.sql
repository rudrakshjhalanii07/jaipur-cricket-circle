-- ============================================================
-- Backfill missing did_not_bat rows in Season 2. Run in the Supabase SQL editor.
--
-- Per lib/match-template.ts, every squad member must appear in his team's
-- batting array, non-batters carrying dismissal_type 'did_not_bat'. That row is
-- the ONLY record that a player was present, so it is what the "M" (matches)
-- column on every leaderboard counts.
--
-- The convention was applied loosely in Season 2's first weeks: 14 Jun, 26 Jun
-- and one match on 12 Jul recorded only the players who actually batted. From
-- 19 Jun onward — and for all of Season 3 — the scorecards are complete, so
-- this is a one-off cleanup of three weeks, not a recurring fix.
--
-- 23 rows for 18 players, nobody missing more than 2 matches. Leaderboard
-- ORDER never changes: only the M column moves, by 1 or 2, for a third of the
-- Season 2 squad. Runs, wickets, averages and strike rates are untouched —
-- a did_not_bat row is excluded from every batting aggregate.
--
-- HOW THE NAMES WERE DERIVED — read before running:
--   This is INFERENCE, not record. A player is listed below when he turned out
--   for that same team on that same day in another match, but appears nowhere
--   in this match (neither batting nor bowling — bowling already credits an
--   appearance on its own). "He was there for the other two, so he was there
--   for this one" is usually right and occasionally wrong: someone may have
--   left early or sat a match out. Strike any line you know to be wrong before
--   running; a deleted line simply leaves that match as it is today.
--
-- Safe to re-run: the INSERT skips any (innings, player) pair already present.
-- ============================================================

INSERT INTO public.series_batting
  (innings_id, team_id, player_name, batting_order,
   runs, balls_faced, fours, sixes, dismissal_type, dismissed_by, caught_by)
-- innings_id is cast explicitly: a VALUES literal is text, and Postgres has no
-- assignment cast from text to uuid.
SELECT v.innings_id::UUID, v.team_id, v.player_name, v.batting_order,
       0, NULL, 0, 0, 'did_not_bat', NULL, NULL
FROM (VALUES
  -- 2026-06-14 · match 1 · mavericks
  ('2170398a-426c-4521-b7fd-88ada002c3a5', 'mavericks', 'Nitin Setia', 4),
  ('2170398a-426c-4521-b7fd-88ada002c3a5', 'mavericks', 'Raghav Patodia', 5),

  -- 2026-06-14 · match 1 · neurostrikers
  ('6e4b390a-a775-46f1-904b-ede9634ec293', 'neurostrikers', 'Prashant Ramchandani', 6),

  -- 2026-06-14 · match 4 (final) · mavericks
  ('7abbb767-9939-4694-9498-84c853b1eb23', 'mavericks', 'Raghav Patodia', 7),

  -- 2026-06-14 · match 4 (final) · neurostrikers
  ('c80c9ebe-d207-4dd0-bc3f-fb138c54cdb1', 'neurostrikers', 'Sonu', 7),

  -- 2026-06-26 · match 1 · mavericks
  ('4e3a7368-6953-4e82-9089-547aae37e3ce', 'mavericks', 'Kunwar Gaurav', 7),
  ('4e3a7368-6953-4e82-9089-547aae37e3ce', 'mavericks', 'Mahesh Kumar', 8),
  ('4e3a7368-6953-4e82-9089-547aae37e3ce', 'mavericks', 'Rahul Rathore', 9),

  -- 2026-06-26 · match 1 · outliers
  ('ddd98be0-1b4e-49d6-a5e5-75ffa3362a22', 'outliers', 'Saurabh Charan', 11),

  -- 2026-06-26 · match 2 · neurostrikers
  ('82307e04-eaa2-4b28-b57a-c2617c15ccd2', 'neurostrikers', 'Abhijeet Singh Shekhawat', 6),
  ('82307e04-eaa2-4b28-b57a-c2617c15ccd2', 'neurostrikers', 'Sarthak Rathore', 7),

  -- 2026-06-26 · match 2 · outliers
  ('944c9dc6-abf9-44ad-b511-ef0c512662ad', 'outliers', 'Akshat Pandey', 5),
  ('944c9dc6-abf9-44ad-b511-ef0c512662ad', 'outliers', 'Rudraksh', 6),

  -- 2026-06-26 · match 3 · mavericks
  ('b64bd386-3547-415b-a9e8-5c9167df5cae', 'mavericks', 'Nitin Setia', 4),

  -- 2026-06-26 · match 3 · neurostrikers
  ('6ec8bd6c-bdfa-4add-b242-0d23eb029d24', 'neurostrikers', 'Vaibhav Asudani', 8),

  -- 2026-06-26 · match 4 (final) · mavericks
  ('e2616465-2709-4d90-b6e9-546d9a568bd0', 'mavericks', 'Nitesh', 6),
  ('e2616465-2709-4d90-b6e9-546d9a568bd0', 'mavericks', 'Prashant Ramchandani', 7),
  ('e2616465-2709-4d90-b6e9-546d9a568bd0', 'mavericks', 'Yash Pareek', 8),

  -- 2026-06-26 · match 4 (final) · outliers
  ('79da6167-5002-48e1-ad1d-90c5311c3921', 'outliers', 'Akshat Pandey', 4),
  ('79da6167-5002-48e1-ad1d-90c5311c3921', 'outliers', 'Dhruv Paliwal', 5),
  ('79da6167-5002-48e1-ad1d-90c5311c3921', 'outliers', 'Rudhra Agrawal', 6),
  ('79da6167-5002-48e1-ad1d-90c5311c3921', 'outliers', 'Rudraksh', 7),

  -- 2026-07-12 · match 2 · outliers
  ('8a4152ce-eee8-4fcf-aebd-57001a7cdacd', 'outliers', 'Nishant Gupta', 9)
) AS v(innings_id, team_id, player_name, batting_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.series_batting b
  WHERE b.innings_id = v.innings_id::UUID
    AND b.player_name = v.player_name
);

-- ── Verify ──────────────────────────────────────────────────────────────────
-- 1. Every affected innings should now list its whole squad, and no batting
--    aggregate should have moved (did_not_bat rows carry 0 runs / 0 balls).
SELECT m.match_date,
       m.match_no,
       i.batting_team_id,
       COUNT(*)                                                   AS squad_listed,
       COUNT(*) FILTER (WHERE b.dismissal_type = 'did_not_bat')    AS did_not_bat,
       SUM(b.runs)                                                AS innings_runs
FROM public.series_batting  AS b
JOIN public.series_innings  AS i ON i.id = b.innings_id
JOIN public.series_matches  AS m ON m.id = i.match_id
WHERE m.match_date IN (DATE '2026-06-14', DATE '2026-06-26', DATE '2026-07-12')
GROUP BY m.match_date, m.match_no, i.batting_team_id
ORDER BY m.match_date, m.match_no, i.batting_team_id;

-- 2. The 18 players who gain an appearance, with their new Season 2 match count.
SELECT b.player_name, COUNT(DISTINCT i.match_id) AS matches
FROM public.series_batting  AS b
JOIN public.series_innings  AS i ON i.id = b.innings_id
WHERE b.player_name IN (
  'Abhijeet Singh Shekhawat', 'Akshat Pandey', 'Dhruv Paliwal', 'Kunwar Gaurav',
  'Mahesh Kumar', 'Nishant Gupta', 'Nitesh', 'Nitin Setia',
  'Prashant Ramchandani', 'Raghav Patodia', 'Rahul Rathore', 'Rudhra Agrawal',
  'Rudraksh', 'Sarthak Rathore', 'Saurabh Charan', 'Sonu',
  'Vaibhav Asudani', 'Yash Pareek'
)
GROUP BY b.player_name
ORDER BY b.player_name;
