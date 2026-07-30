-- Season 3 week venues.
--
-- Venue lives on the week (`series.venue`), not the match — a week is always
-- played at a single ground. Weeks left NULL render as "Jai Club · TBC" on the
-- public schedule (see resolveVenue in lib/season-schedule.ts) and are meant to
-- be confirmed from Admin → Seasons → Week Venues as each booking is made.
--
-- Safe to re-run.

UPDATE public.series
SET venue = 'Heera Box Cricket'
WHERE week_no = 1
  AND season_id = (SELECT id FROM public.rivalry_seasons WHERE status = 'active');

UPDATE public.series
SET venue = 'Jai Club'
WHERE week_no = 2
  AND season_id = (SELECT id FROM public.rivalry_seasons WHERE status = 'active');

SELECT week_no, name, venue
FROM public.series
WHERE season_id = (SELECT id FROM public.rivalry_seasons WHERE status = 'active')
  AND week_no IS NOT NULL
ORDER BY week_no;
