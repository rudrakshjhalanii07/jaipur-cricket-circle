-- ============================================================
-- Atomic season transition. Run in Supabase SQL editor as a single paste.
--
-- Why: archiving the current season and creating the next one are two
-- writes to the same table. Done as separate calls from the API route,
-- a failure on the second write (the INSERT) would leave the club with
-- zero active seasons — the old one already archived, no new one to
-- replace it. Doing both in one plpgsql function means they run in one
-- transaction: any exception rolls back the archive too.
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_and_create_season(
  p_old_season_id UUID,
  p_new_title TEXT,
  p_new_season_label TEXT,
  p_new_mavericks_captain TEXT,
  p_new_neurostrikers_captain TEXT,
  p_new_outliers_captain TEXT,
  p_new_started_at DATE
)
RETURNS UUID
LANGUAGE plpgsql
AS $func$
DECLARE
  v_new_id UUID;
BEGIN
  UPDATE public.rivalry_seasons
    SET status = 'archived', ended_at = CURRENT_DATE
    WHERE id = p_old_season_id AND status = 'active';

  INSERT INTO public.rivalry_seasons (
    title, season_label, status,
    mavericks_captain, neurostrikers_captain, outliers_captain,
    started_at
  ) VALUES (
    p_new_title, p_new_season_label, 'active',
    p_new_mavericks_captain, p_new_neurostrikers_captain, p_new_outliers_captain,
    p_new_started_at
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;
