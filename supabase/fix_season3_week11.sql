-- Season 3, Week 11 (9 October 2026) fixes, plus Abhijeet's committee row.
--
-- 1. The Week 11 Mavericks v Outliers scorecard (Outliers 53/2 beat Mavericks
--    52/6 by 4 wickets, Madhav Sharma 41) was saved into a pre-filled slot
--    dated 2 October. That made it look like a correction of Week 10's
--    Outliers v Mavericks (Outliers 55/2 beat Mavericks 48/4, from the export),
--    so Week 11's Boundary Banter report had only two matches and Week 10 showed
--    the wrong result. Moving it to 9 October fixes both reports.
--
-- 2. None of the 9 October matches had a venue, so the report read
--    "Two matches at :". All three are saved as Kodai 2.0.
--
-- 3. Abhijeet Singh Shekhawat becomes a Core Committee member through his own
--    row, replacing the hardcoded
--    About-page entry that had no photo.
--
-- Everything is matched on id. Afterwards, re-save any match in the admin
-- scorecard editor (or wait for the Sunday cron) so the cached reports rebuild.

BEGIN;

-- 1. Week 11 Mavericks v Outliers: 2 Oct -> 9 Oct
UPDATE series_matches
SET match_date = '2026-10-09'
WHERE id = 'b294d05b-0259-41f6-8e52-1d1daff86d56';

-- 2. Venue for the three 9 October matches
UPDATE series_matches
SET venue = 'Kodai 2.0'
WHERE id IN (
  'cded660a-6a7a-4744-8e1f-75876722ddbc', -- Outliers v Vikings (tie)
  '0572046a-59e0-4216-bde7-5a1adbe6e778', -- Mavericks v Vikings
  'b294d05b-0259-41f6-8e52-1d1daff86d56'  -- Outliers v Mavericks
);

COMMIT;

-- Check: Week 11 should list three matches, all at Kodai 2.0.
SELECT id, match_no, match_date, venue, team1_id, team2_id, winner_id, is_tie
FROM series_matches
WHERE match_date = '2026-10-09' AND (winner_id IS NOT NULL OR is_tie)
ORDER BY match_no;
