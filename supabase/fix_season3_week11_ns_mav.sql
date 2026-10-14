-- Season 3, Week 11: NeuroStrikers v Mavericks (Week 11 match 2, Mavericks won)
-- was saved with the Week 11 slot's pre-filled date of 2 October. Week 10 was
-- played that day and the CricHeroes export has only its four matches, so this
-- one counted as a fifth Week 10 game and Week 11 showed three instead of four.
--
-- Week 11 was played on 9 October at Kodai 2.0, like the other three
-- (fix_season3_week11.sql). Afterwards, re-save any match in the admin
-- scorecard editor so the cached reports rebuild.

UPDATE series_matches
SET match_date = '2026-10-09',
    venue = 'Kodai 2.0'
WHERE id = 'c5cebd36-1790-4cf6-ae94-52dd99525d07';

-- Check: Week 11 should list four matches on 9 October.
SELECT match_no, match_date, venue, team1_id, team2_id, winner_id, is_tie
FROM series_matches
WHERE series_id = '2ef8d814-9ca4-4319-a19b-8e337e3dc95d'
ORDER BY match_no;
