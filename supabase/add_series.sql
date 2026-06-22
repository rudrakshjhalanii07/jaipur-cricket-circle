-- JCC Historical Tri-Series System
-- Run this in the Supabase SQL editor

-- 1. Series (each tri-series event)
CREATE TABLE IF NOT EXISTS public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  series_no INT NOT NULL,
  season_id UUID REFERENCES public.rivalry_seasons(id) ON DELETE SET NULL,
  overs_per_innings INT NOT NULL DEFAULT 10,
  venue TEXT,
  started_at DATE,
  ended_at DATE,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  notes TEXT,
  articles JSONB DEFAULT '[]'::JSONB,  -- [{"title": "...", "url": "..."}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Series matches
CREATE TABLE IF NOT EXISTS public.series_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  match_no INT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('league', 'final')),
  match_date DATE,
  venue TEXT,
  team1_id TEXT NOT NULL,
  team2_id TEXT NOT NULL,
  toss_winner_id TEXT,
  toss_decision TEXT CHECK (toss_decision IN ('bat', 'bowl')),
  team1_captain TEXT,
  team2_captain TEXT,
  winner_id TEXT,
  margin_type TEXT CHECK (margin_type IN ('runs', 'wickets')),
  margin_value INT,
  is_tie BOOLEAN DEFAULT FALSE,
  super_over JSONB,
  player_of_match TEXT,
  match_notes TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (series_id, match_no)
);

-- 3. Innings (2 per match)
-- fall_of_wickets stored as JSONB — never aggregated across matches
CREATE TABLE IF NOT EXISTS public.series_innings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.series_matches(id) ON DELETE CASCADE,
  innings_no INT NOT NULL CHECK (innings_no IN (1, 2)),
  batting_team_id TEXT NOT NULL,
  bowling_team_id TEXT NOT NULL,
  total_runs INT NOT NULL DEFAULT 0,
  total_wickets INT NOT NULL DEFAULT 0,
  total_overs NUMERIC(5,1) NOT NULL DEFAULT 0,
  all_out BOOLEAN DEFAULT FALSE,
  extras_wides INT DEFAULT 0,
  extras_no_balls INT DEFAULT 0,
  extras_byes INT DEFAULT 0,
  extras_leg_byes INT DEFAULT 0,
  fall_of_wickets JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, innings_no)
);

-- 4. Batting performances
CREATE TABLE IF NOT EXISTS public.series_batting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID NOT NULL REFERENCES public.series_innings(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  batting_order INT,
  runs INT NOT NULL DEFAULT 0,
  balls_faced INT,
  fours INT DEFAULT 0,
  sixes INT DEFAULT 0,
  dismissal_type TEXT CHECK (dismissal_type IN (
    'bowled','caught','lbw','run_out','stumped',
    'hit_wicket','retired_hurt','not_out','did_not_bat'
  )),
  dismissed_by TEXT,
  caught_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bowling performances
CREATE TABLE IF NOT EXISTS public.series_bowling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  innings_id UUID NOT NULL REFERENCES public.series_innings(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  bowling_order INT,
  overs NUMERIC(4,1) NOT NULL DEFAULT 0,
  maidens INT DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  wides INT DEFAULT 0,
  no_balls INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_batting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_bowling ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read series"         ON public.series         FOR SELECT TO public USING (true);
CREATE POLICY "Public read series_matches" ON public.series_matches FOR SELECT TO public USING (true);
CREATE POLICY "Public read series_innings" ON public.series_innings FOR SELECT TO public USING (true);
CREATE POLICY "Public read series_batting" ON public.series_batting FOR SELECT TO public USING (true);
CREATE POLICY "Public read series_bowling" ON public.series_bowling FOR SELECT TO public USING (true);
