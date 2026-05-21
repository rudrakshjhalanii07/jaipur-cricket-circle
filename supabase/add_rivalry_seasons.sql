-- JAIPUR CRICKET CIRCLE — RIVALRY SEASONS SCHEMA

-- 1. Create table public.rivalry_seasons
CREATE TABLE IF NOT EXISTS public.rivalry_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  season_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  mavericks_captain TEXT NOT NULL,
  neurostrikers_captain TEXT NOT NULL,
  mavericks_main_wins INTEGER DEFAULT 0,
  neurostrikers_main_wins INTEGER DEFAULT 0,
  mavericks_exhibition_wins INTEGER DEFAULT 0,
  neurostrikers_exhibition_wins INTEGER DEFAULT 0,
  total_matches_played INTEGER DEFAULT 0,
  started_at DATE,
  ended_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Set up RLS
ALTER TABLE public.rivalry_seasons ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Allow public read access to rivalry_seasons" ON public.rivalry_seasons;
CREATE POLICY "Allow public read access to rivalry_seasons" ON public.rivalry_seasons FOR SELECT TO public USING (true);

-- 4. Seed Data
-- Clear existing to prevent duplicate key errors if run multiple times
TRUNCATE TABLE public.rivalry_seasons CASCADE;

-- Archived first season
INSERT INTO public.rivalry_seasons (
  title,
  season_label,
  status,
  mavericks_captain,
  neurostrikers_captain,
  total_matches_played,
  mavericks_main_wins,
  neurostrikers_main_wins,
  mavericks_exhibition_wins,
  neurostrikers_exhibition_wins,
  notes
) VALUES (
  'The Setia-Chaudhary Era',
  'Legacy Season',
  'archived',
  'Mr. Nitin Setia',
  'Mr. Opal Chaudhary',
  24,
  10,
  10,
  3,
  1,
  'First recorded rivalry era. Match-by-match records were not maintained, so summary data is seeded manually.'
);

-- Active current season
INSERT INTO public.rivalry_seasons (
  title,
  season_label,
  status,
  mavericks_captain,
  neurostrikers_captain,
  total_matches_played,
  mavericks_main_wins,
  neurostrikers_main_wins,
  mavericks_exhibition_wins,
  neurostrikers_exhibition_wins,
  started_at,
  notes
) VALUES (
  'The Rawat-Sharma Era',
  'Current Season',
  'active',
  'Anil Rawat',
  'Sagar Sharma',
  2,
  1,
  1,
  0,
  0,
  '2026-05-17', -- Started Last Sunday relative to local time 2026-05-21
  'Current active captain rivalry season.'
);
