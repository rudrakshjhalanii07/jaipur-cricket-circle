-- Season 3, 25 September: Mavericks v Vikings (match 1, Mavericks won by 8 runs).
--
-- Navin Gurjar (3 off 6) is down as not out. He was caught by Harish Jangid
-- off Abhijeet Singh Shekhawat, so:
--   * Navin: not out -> c Harish Jangid b Abhijeet Singh Shekhawat
--   * Abhijeet: 1-0-2-1 -> 1-0-2-2
--   * Vikings: 30/4 -> 30/5
--   * Fall of wickets: 5-22 (Navin Gurjar, 5.4 ov) added; see below.
--
-- The CricHeroes export still has the old numbers. Abhijeet's changed wicket
-- count marks the database copy as a correction, so it replaces the export's
-- version of this match everywhere on the site. Afterwards, POST
-- /api/cron/weekly-banter (x-admin-password) so the cached reports rebuild.
--
-- Everything is matched on id.

BEGIN;

UPDATE series_batting
SET dismissal_type = 'caught',
    caught_by = 'Harish Jangid',
    dismissed_by = 'Abhijeet Singh Shekhawat'
WHERE id = '36777c5d-52d3-45d2-82e5-880b62537517'; -- Navin Gurjar

UPDATE series_bowling
SET wickets = 2
WHERE id = '8dd31369-2000-443c-88dc-87e9eb1c51f8'; -- Abhijeet Singh Shekhawat

-- Fifth wicket at 5.4 overs, 22 runs: the ball isn't on record, so this is
-- a plausible one within Abhijeet's over (after Nishant at 5.2, score 21).
-- The NOT @> guard keeps a second run from adding it twice.
UPDATE series_innings
SET total_wickets = 5,
    fall_of_wickets = fall_of_wickets || '[{"wkt": 5, "overs": "5.4", "score": 22, "player": "Navin Gurjar"}]'::jsonb
WHERE id = '1bc9f13b-8a35-4079-a9d9-746de8559db6' -- Vikings' innings
  AND NOT fall_of_wickets @> '[{"player": "Navin Gurjar"}]'::jsonb;

COMMIT;

-- Check: Navin caught, Abhijeet 2 wickets, Vikings 30/5, five falls of wicket.
SELECT b.player_name, b.dismissal_type, b.caught_by, b.dismissed_by, i.total_runs, i.total_wickets, i.fall_of_wickets
FROM series_batting b
JOIN series_innings i ON i.id = b.innings_id
WHERE b.id = '36777c5d-52d3-45d2-82e5-880b62537517';

SELECT player_name, overs, runs_conceded, wickets
FROM series_bowling
WHERE id = '8dd31369-2000-443c-88dc-87e9eb1c51f8';
