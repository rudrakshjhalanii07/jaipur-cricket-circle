-- Stats access window (see lib/stats-access.ts).
--
-- Members get 14 days of /stats and profile stats from their first login;
-- seven founding accounts keep it permanently (listed in code, by player id).
-- This column holds when each member's 14 days started. NULL = not started
-- yet; the app stamps it the first time the member logs in.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS stats_access_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.players.stats_access_started_at IS
  'When this member''s 14-day stats access began (first login). NULL until then.';
