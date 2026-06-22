-- Add per-match captain names to series_matches.
-- Used to render a "(C)" tag next to the captain in each match scorecard.
-- Run this in the Supabase SQL editor.

ALTER TABLE public.series_matches
  ADD COLUMN IF NOT EXISTS team1_captain TEXT,
  ADD COLUMN IF NOT EXISTS team2_captain TEXT;
