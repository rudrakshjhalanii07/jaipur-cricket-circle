-- ============================================================
-- Merge duplicate player-name spellings. Run in the Supabase SQL editor.
--
-- Every leaderboard, the players pool and the member profile pages key on the
-- player-name string, so one person spelled two ways shows up as two players
-- with half his stats each. Found in the data:
--
--   "Siddharth Rao Jcc"  (2 bat / 2 bowl, 24 Jul)  → Siddharth Rao
--   "Siddarth Rao"       (dismissal + POTM credits only, missing "h")
--                                                  → Siddharth Rao
--   "Saurabh CBI"        (28 rows)                 → Saurabh Charan
--   "Saurabh Cbi"        (1 row, 17 Jul)           → Saurabh Charan
--
-- Confirmed with the club on 30 Jul 2026, when scorecard names were matched
-- against profile photos and these spellings found no `players` row:
--
--   "Lakshay"              → Lakshya Sharma
--   "Krshna"               → Krishna Saxena   (missing "i")
--   "Adhip Choudhary"      → Adhip Chaudhary  (Chou/Chau)
--   "Bhairav Deep Touchy"  → Bhairav Deep
--   "Bhairav Neurostrikers"→ Bhairav Deep     (team name, not a surname)
--   "Naman Mavericks"      → Naman Saini      (the other Naman is Mittal)
--   "Gourav Boss"          → Kunwar Gaurav
--
-- The canonical names are the ones on their `players` rows, which is what the
-- members page matches stats against.
--
-- Names live in more than the two obvious columns — dismissal credits, captains,
-- player of the match and the fall-of-wickets JSON all store them as free text,
-- and some of those hold two names ("A / B"), so each side is mapped
-- separately. Mirrors canonicalPlayerName in lib/player-names.ts, which keeps
-- future imports clean.
--
-- Safe to re-run: every update is idempotent and skips rows already canonical.
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

-- ── Verify: no variant should survive ───────────────────────────────────────
SELECT player_name, COUNT(*) AS rows
FROM (
  SELECT player_name FROM public.series_batting
  UNION ALL
  SELECT player_name FROM public.series_bowling
) AS everyone
WHERE player_name ILIKE '%sid%'
   OR player_name ILIKE '%saurabh%'
   OR player_name ILIKE '%jcc%'
   OR player_name ILIKE '%laksh%'
   OR player_name ILIKE '%kr_shna%'
   OR player_name ILIKE '%adhip%'
   OR player_name ILIKE '%bhairav%'
   OR player_name ILIKE '%naman%'
   OR player_name ILIKE '%gaurav%'
   OR player_name ILIKE '%gourav%'
GROUP BY player_name
ORDER BY player_name;
