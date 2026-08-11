-- ============================================================
-- Second round of player-name merges. Run in the Supabase SQL editor.
--
-- Same problem as supabase/merge_player_name_variants.sql: leaderboards, the
-- players pool and member profiles all key on the name string, so one person
-- spelled two ways splits into two players with half his stats each.
--
-- Confirmed with the club, 11 Aug 2026:
--
--   "Dr Gaurav" / "Dr. Gaurav"  (2 batting rows, 3 fielding credits and 1
--                 fall-of-wickets entry, NeuroStrikers) → Kunwar Gaurav
--
-- Week 3 also filed Madhav Sharma under a bare "Madhav" (2 batting + 2 bowling
-- rows + 1 fall-of-wickets entry, all tagged outliers). Those rows are renamed
-- by the one-off UPDATE at the bottom rather than through the function, because
-- two Madhavs were auctioned for Season 3 — Sharma (The Outliers) and a bare
-- "Madhav" (Mavericks). A standing 'madhav' → 'Madhav Sharma' rule would
-- collapse the two signings onto one key in createSigningMatcher and leave both
-- reading "yet to play". Bare "Madhav" on a future scorecard is resolved by
-- hand from the team on the row. See the note in lib/player-names.ts.
--
-- This extends public.jcc_canonical_name in place, so the earlier merges keep
-- working and this file stays safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.jcc_canonical_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN raw IS NULL THEN NULL ELSE (
    SELECT string_agg(
      CASE lower(base)
        WHEN 'siddarth rao'        THEN 'Siddharth Rao'
        WHEN 'saurabh cbi'         THEN 'Saurabh Charan'
        WHEN 'lakshay'             THEN 'Lakshya Sharma'
        WHEN 'krshna'              THEN 'Krishna Saxena'
        WHEN 'adhip choudhary'     THEN 'Adhip Chaudhary'
        WHEN 'bhairav deep touchy' THEN 'Bhairav Deep'
        WHEN 'bhairav neurostrikers' THEN 'Bhairav Deep'
        WHEN 'naman mavericks'     THEN 'Naman Saini'
        WHEN 'gourav boss'         THEN 'Kunwar Gaurav'
        WHEN 'dr gaurav'           THEN 'Kunwar Gaurav'
        WHEN 'dr. gaurav'          THEN 'Kunwar Gaurav'
        ELSE base
      END, ' / ' ORDER BY ord)
    FROM (
      -- A trailing "Jcc" is a WhatsApp display-name artefact, never part of
      -- anyone's name, so it is always dropped before the lookup.
      SELECT ord, regexp_replace(btrim(part), '\s+[Jj][Cc][Cc]$', '') AS base
      FROM unnest(string_to_array(raw, '/')) WITH ORDINALITY AS t(part, ord)
    ) parts
  ) END;
$$;

-- 1. Batting: the player, plus who dismissed/caught him.
UPDATE public.series_batting
SET player_name  = public.jcc_canonical_name(player_name),
    dismissed_by = public.jcc_canonical_name(dismissed_by),
    caught_by    = public.jcc_canonical_name(caught_by)
WHERE player_name  IS DISTINCT FROM public.jcc_canonical_name(player_name)
   OR dismissed_by IS DISTINCT FROM public.jcc_canonical_name(dismissed_by)
   OR caught_by    IS DISTINCT FROM public.jcc_canonical_name(caught_by);

-- 2. Bowling.
UPDATE public.series_bowling
SET player_name = public.jcc_canonical_name(player_name)
WHERE player_name IS DISTINCT FROM public.jcc_canonical_name(player_name);

-- 3. Match-level name fields.
UPDATE public.series_matches
SET player_of_match = public.jcc_canonical_name(player_of_match),
    team1_captain   = public.jcc_canonical_name(team1_captain),
    team2_captain   = public.jcc_canonical_name(team2_captain)
WHERE player_of_match IS DISTINCT FROM public.jcc_canonical_name(player_of_match)
   OR team1_captain   IS DISTINCT FROM public.jcc_canonical_name(team1_captain)
   OR team2_captain   IS DISTINCT FROM public.jcc_canonical_name(team2_captain);

-- 4. Fall of wickets — rebuilt element by element, order preserved.
UPDATE public.series_innings AS i
SET fall_of_wickets = sub.fow
FROM (
  SELECT i2.id,
         COALESCE(
           jsonb_agg(
             CASE WHEN e.val ? 'player'
               THEN jsonb_set(e.val, '{player}',
                              to_jsonb(public.jcc_canonical_name(e.val->>'player')))
               ELSE e.val
             END
             ORDER BY e.ord),
           '[]'::JSONB) AS fow
  FROM public.series_innings AS i2,
       jsonb_array_elements(i2.fall_of_wickets) WITH ORDINALITY AS e(val, ord)
  GROUP BY i2.id
) AS sub
WHERE i.id = sub.id
  AND i.fall_of_wickets IS DISTINCT FROM sub.fow;

-- 5. Week 3's bare "Madhav" — Outliers rows only, so Sharma. One-off by design
--    (see the header); the Mavericks Madhav must never be swept up by this.
UPDATE public.series_batting SET player_name = 'Madhav Sharma'
WHERE player_name = 'Madhav' AND team_id = 'outliers';

UPDATE public.series_bowling SET player_name = 'Madhav Sharma'
WHERE player_name = 'Madhav' AND team_id = 'outliers';

-- ── Verify: no variant should survive ───────────────────────────────────────
SELECT player_name, COUNT(*) AS rows
FROM (
  SELECT player_name FROM public.series_batting
  UNION ALL
  SELECT player_name FROM public.series_bowling
) AS everyone
WHERE player_name ILIKE '%gaurav%'
   OR player_name ILIKE '%madhav%'
GROUP BY player_name
ORDER BY player_name;
