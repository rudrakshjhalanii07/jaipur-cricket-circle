-- ============================================================
-- Give a scheduled week its own start time. Run in the Supabase SQL editor.
--
-- The public schedule used to print a hardcoded "07:30 PM" against every
-- fixture, which was a guess dressed up as a fact: grounds are booked a few
-- days out and the slot moves with them. A week now carries the time its FIRST
-- match starts, and the rest of that week's matches follow it a fixed interval
-- apart (see MATCH_SLOT_MINUTES in lib/season-schedule.ts).
--
-- Stored as text in 24-hour "HH:MM" — the same shape an <input type="time">
-- reads and writes, so the admin field needs no conversion in either direction.
-- NULL means the week has no slot yet and the schedule shows TBC, which is the
-- same thing a NULL `venue` now means: unknown, and said so rather than
-- defaulted to the club's usual ground.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS start_time text;

COMMENT ON COLUMN public.series.start_time IS
  'First match''s start time for this week, 24h "HH:MM". NULL = TBC.';

-- Every week starts out unscheduled; the admin panel fills these in.
SELECT week_no, name, venue, start_time
FROM public.series
WHERE week_no IS NOT NULL
ORDER BY week_no;
