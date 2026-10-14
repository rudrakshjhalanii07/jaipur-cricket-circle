-- Ball-by-ball logs (see lib/ball-by-ball.ts and /admin/series-import).
--
-- The admin scorer records every delivery: striker, non-striker, bowler, runs
-- off the bat, extras and wickets. The scorecard tables are replayed from that
-- log; this keeps the log itself, so true head-to-head figures (runs a batter
-- scored off a particular bowler) can be worked out. Starts with Season 4:
-- older matches have scorecards only.
--
--   innings  = [[...events of the 1st innings], [...events of the 2nd]]
--   scorecard_edited_at = set when the scorecard was corrected afterwards in
--                         the admin editor, so the log may no longer agree
--                         with it ball for ball.
--
-- Written only by /api/series/save with the service role; no public access.
-- Run once in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.series_ball_logs (
  match_id UUID PRIMARY KEY REFERENCES public.series_matches(id) ON DELETE CASCADE,
  innings JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scorecard_edited_at TIMESTAMPTZ
);

ALTER TABLE public.series_ball_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.series_ball_logs IS
  'Every delivery of a match scored ball by ball in the admin (lib/ball-by-ball.ts). From Season 4.';
