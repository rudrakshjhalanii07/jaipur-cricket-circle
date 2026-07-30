-- ============================================================
-- Resolve the bare "Ankit" spelling. Run in the Supabase SQL editor.
--
-- Two Ankits play for the club and they are NOT the same person — on 26 Jun
-- match 2 they are on opposite sides of the same innings, Ankit Jain batting
-- for NeuroStrikers while Ankit Sharma bowls for Outliers.
--
-- Confirmed with the club on 30 Jul 2026: a bare "Ankit" as a PLAYER is
-- **Ankit Jain**. Sharma's own batting and bowling rows are always written out
-- in full, so nothing there is ambiguous:
--
--   "Ankit"        (4 matches: 12 Jul m1/m2, 24 Jul m3/m4)  → Ankit Jain
--   "Ankit Jain"   (2 matches: 26 Jun m2/m3)                → unchanged
--   "Ankit Sharma" (3 matches: 26 Jun m1/m2/m4)             → unchanged
--
-- ⚠ A DISMISSAL CREDIT IS A DIFFERENT PROBLEM FROM A PLAYER NAME.
--   "b Ankit" names whichever Ankit was BOWLING in that innings, and on 26 Jun
--   that is Sharma. Blanket-mapping every bare "Ankit" to Jain would hand
--   Sharma's wickets to Jain and leave each batsman's scorecard reading
--   "b Ankit Jain" while the bowling table beside it still credited Sharma.
--
--   The five bare credits split 3 / 2:
--     26 Jun m1  → Ankit Sharma  (Prashant Ramchandani, Navin Gurjar)
--     26 Jun m2  → Ankit Sharma  (Rahul Rathore)
--     12 Jul m1  → Ankit Jain    (Rahul Kasliwal)
--     24 Jul m3  → Ankit Jain    (Mahesh Kumar)
--
--   So step 3 below resolves each credit from the bowling card of its own
--   innings rather than from a name map. That is why the statements are
--   ORDERED: bowling names are canonicalised first (step 2), and step 3 then
--   reads the corrected card. Do not reorder them.
--
-- Why any of this matters: every leaderboard keys on the name string, so today
-- Jain's six appearances are split across two entries with his stats divided
-- between them. The roster lookup meanwhile already folds bare "Ankit" onto
-- Jain's `players` row (he is the only Ankit registered), so the profile page
-- and the leaderboards currently disagree. This makes the stored data match.
--
-- Mirrors PLAYER_NAME_ALIASES in lib/player-names.ts, which keeps future
-- imports clean.
--
-- Verified against production before writing:
--   · no innings contains both "Ankit" and "Ankit Jain", so no row can collide
--   · both bare-"Ankit" fall-of-wickets entries are Jain's own dismissals
--   · no match-level field (captains, player of the match) holds a bare
--     "Ankit" — only "Ankit Sharma" — so there is nothing to rewrite there.
--     A bare "Ankit" in those fields could NOT be resolved automatically, as
--     they carry no innings to read a bowling card from.
--
-- Safe to re-run: every statement skips rows that are already canonical.
-- ============================================================

-- ── 1. Player names: batting ────────────────────────────────────────────────
-- Exact match only — "Ankit Sharma" must never be touched by this.
UPDATE public.series_batting
SET player_name = 'Ankit Jain'
WHERE btrim(player_name) ILIKE 'ankit'
  AND btrim(player_name) <> 'Ankit Jain';

-- ── 2. Player names: bowling ────────────────────────────────────────────────
-- MUST run before step 3, which reads these rows to resolve credits.
UPDATE public.series_bowling
SET player_name = 'Ankit Jain'
WHERE btrim(player_name) ILIKE 'ankit'
  AND btrim(player_name) <> 'Ankit Jain';

-- ── 3. Dismissal credits, resolved per innings ──────────────────────────────
-- Each bare "Ankit" becomes the full name of the Ankit who bowled in THAT
-- innings. The subquery returns exactly one name per innings (verified: no
-- innings has two Ankits bowling), and NULL — leaving the row alone — for any
-- innings where no Ankit bowled at all.
UPDATE public.series_batting AS b
SET dismissed_by = ankit_bowler.name
FROM (
  SELECT w.innings_id, MIN(btrim(w.player_name)) AS name
  FROM public.series_bowling AS w
  WHERE btrim(w.player_name) ILIKE 'ankit%'
  GROUP BY w.innings_id
  HAVING COUNT(DISTINCT btrim(w.player_name)) = 1
) AS ankit_bowler
WHERE b.innings_id = ankit_bowler.innings_id
  AND btrim(b.dismissed_by) ILIKE 'ankit'
  AND btrim(b.dismissed_by) <> ankit_bowler.name;

-- The same rule for catches. (None exist today — no caught_by holds an Ankit —
-- but the statement keeps this script correct if one is imported later.)
UPDATE public.series_batting AS b
SET caught_by = ankit_fielder.name
FROM (
  SELECT w.innings_id, MIN(btrim(w.player_name)) AS name
  FROM public.series_bowling AS w
  WHERE btrim(w.player_name) ILIKE 'ankit%'
  GROUP BY w.innings_id
  HAVING COUNT(DISTINCT btrim(w.player_name)) = 1
) AS ankit_fielder
WHERE b.innings_id = ankit_fielder.innings_id
  AND btrim(b.caught_by) ILIKE 'ankit'
  AND btrim(b.caught_by) <> ankit_fielder.name;

-- ── 4. Fall of wickets ──────────────────────────────────────────────────────
-- "player" here is the batsman who fell, not the bowler, so the player-name
-- rule applies: both bare entries are Jain's own dismissals (12 Jul m2,
-- 24 Jul m3). Rebuilt element by element, order preserved.
UPDATE public.series_innings AS i
SET fall_of_wickets = sub.fow
FROM (
  SELECT i2.id,
         COALESCE(
           jsonb_agg(
             CASE WHEN btrim(e.val->>'player') ILIKE 'ankit'
               THEN jsonb_set(e.val, '{player}', to_jsonb('Ankit Jain'::TEXT))
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

-- ── Verify ──────────────────────────────────────────────────────────────────
-- 1. Names. Expect exactly "Ankit Jain" and "Ankit Sharma"; a surviving bare
--    "Ankit" means a statement above was skipped.
SELECT 'batting' AS source, btrim(player_name) AS name, COUNT(*) AS rows
FROM public.series_batting WHERE player_name ILIKE 'ankit%' GROUP BY 2
UNION ALL
SELECT 'bowling', btrim(player_name), COUNT(*)
FROM public.series_bowling WHERE player_name ILIKE 'ankit%' GROUP BY 2
UNION ALL
SELECT 'dismissed_by', btrim(dismissed_by), COUNT(*)
FROM public.series_batting WHERE dismissed_by ILIKE 'ankit%' GROUP BY 2
ORDER BY 1, 2;

-- 2. Wickets credited to each Ankit must equal the wickets on his bowling card.
--    Expect Ankit Jain 2 / 2 and Ankit Sharma 4 / 4. Any mismatch means a
--    credit was attached to the wrong man.
SELECT bowler.name,
       bowler.card_wickets,
       COALESCE(credited.n, 0) AS credited_wickets
FROM (
  SELECT btrim(player_name) AS name, SUM(wickets) AS card_wickets
  FROM public.series_bowling
  WHERE player_name ILIKE 'ankit%'
  GROUP BY 1
) AS bowler
LEFT JOIN (
  SELECT btrim(dismissed_by) AS name, COUNT(*) AS n
  FROM public.series_batting
  WHERE dismissed_by ILIKE 'ankit%'
    AND dismissal_type IN ('bowled', 'caught', 'lbw', 'stumped', 'hit_wicket')
  GROUP BY 1
) AS credited ON credited.name = bowler.name
ORDER BY 1;


