-- JAIPUR CRICKET CIRCLE — TOURNAMENT JOIN CODE
-- Apply in Supabase SQL editor.
-- Adds a short shareable code to each tournament so other admins can join
-- and conduct tosses without needing the admin password.

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_code
  ON public.tournaments (code) WHERE code IS NOT NULL;
