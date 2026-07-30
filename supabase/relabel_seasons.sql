-- ============================================================
-- Give the archived seasons proper numbered labels.
--
-- "Current Season" was accurate when that era was live, but it's archived now
-- and the label reads as a lie next to the active Season 3. Numbering them
-- also makes the ordering self-evident on /seasons.
--
-- Safe to re-run: matches on the old label, so a second run is a no-op.
-- ============================================================

UPDATE public.rivalry_seasons
   SET season_label = 'Season 2'
 WHERE season_label = 'Current Season'
   AND status = 'archived';

-- Optional — the legacy 2-captain era is chronologically Season 1.
-- Uncomment if you want it numbered rather than named.
-- UPDATE public.rivalry_seasons
--    SET season_label = 'Season 1'
--  WHERE season_label = 'Legacy Season'
--    AND status = 'archived';

-- Verify
-- SELECT season_label, status, started_at FROM public.rivalry_seasons
--  ORDER BY status, started_at DESC NULLS LAST;
