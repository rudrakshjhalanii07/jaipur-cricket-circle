-- Extend rivalry_seasons to support 3-captain eras
-- Run in Supabase SQL editor

ALTER TABLE public.rivalry_seasons
  ADD COLUMN IF NOT EXISTS outliers_captain TEXT,
  ADD COLUMN IF NOT EXISTS outliers_main_wins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outliers_exhibition_wins INT DEFAULT 0;

-- Update the active Rawat-Sharma era to include Jhalani
UPDATE public.rivalry_seasons
SET
  title = 'The Rawat-Sharma-Jhalani Era',
  outliers_captain = 'Rudraksh Jhalani',
  outliers_main_wins = 0,
  outliers_exhibition_wins = 0
WHERE status = 'active';
