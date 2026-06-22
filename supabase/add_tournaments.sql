-- JAIPUR CRICKET CIRCLE — WEEKLY TOURNAMENT SYSTEM
-- Apply in Supabase SQL editor.
-- Tables are permanent (one row per week tournament); lifecycle via status column.

-- 1. Tournaments table (one per week)
CREATE TABLE IF NOT EXISTS public.tournaments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label      TEXT NOT NULL,                 -- e.g. "2026-06-21"
  overs_per_innings INT NOT NULL DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'in_progress', 'final_pending', 'completed')),
  champion_team_id TEXT,                         -- team id string, set after final
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tournament matches table (4 rows per tournament: 3 league + 1 final)
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_no        INT NOT NULL,                  -- 1, 2, 3 (league), 4 (final)
  stage           TEXT NOT NULL CHECK (stage IN ('league', 'final')),

  -- Teams (nullable — final starts as TBD)
  team1_id        TEXT,
  team2_id        TEXT,

  -- Toss
  toss_winner_id  TEXT,
  toss_decision   TEXT CHECK (toss_decision IN ('bat', 'bowl')),

  -- Team 1 innings
  team1_runs      INT,
  team1_wickets   INT,
  team1_overs     NUMERIC(5,1),                  -- e.g. 9.4 stored as 9.4 (display); logic uses sixths
  team1_all_out   BOOLEAN DEFAULT FALSE,

  -- Team 2 innings
  team2_runs      INT,
  team2_wickets   INT,
  team2_overs     NUMERIC(5,1),
  team2_all_out   BOOLEAN DEFAULT FALSE,

  -- Result
  winner_id       TEXT,                          -- null = tie (before super over resolves)
  margin_type     TEXT CHECK (margin_type IN ('runs', 'wickets')),
  margin_value    INT,
  is_tie          BOOLEAN DEFAULT FALSE,

  -- Super over (nullable jsonb; only populated if played)
  -- Shape: { played: true, team1_runs: N, team2_runs: N, winner_id: "..." }
  super_over      JSONB,

  -- Denormalised points for this match (0/1/2 each)
  points_team1    INT DEFAULT 0,
  points_team2    INT DEFAULT 0,

  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'toss_done', 'completed')),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tournament_id, match_no)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id
  ON public.tournament_matches (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_status
  ON public.tournaments (status);

-- 4. RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Public read (anon client)
CREATE POLICY "Allow public read tournaments"
  ON public.tournaments FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read tournament_matches"
  ON public.tournament_matches FOR SELECT TO public USING (true);

-- Writes handled by service-role client via API routes (bypasses RLS)
