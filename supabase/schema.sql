-- JAIPUR CRICKET CIRCLE — LONG-TERM PLAYER ARCHITECTURE

-- 1. Create Players Table (Permanent Profiles)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  cricket_role TEXT NOT NULL DEFAULT 'all-rounder',
  batting_style TEXT,
  bowling_style TEXT,
  bio TEXT,
  image TEXT,
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date DATE NOT NULL,
  match_time TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_map_url TEXT,
  player_limit INT NOT NULL DEFAULT 18,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Registrations Table (Links Players to Matches)
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Snapshot name at time of registration
  phone TEXT NOT NULL, -- Snapshot phone
  cricket_role TEXT NOT NULL, -- Snapshot role
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id) -- Prevent duplicate registration for same match
);

-- 4. Create Match Player Roles Table (Specific Roles per Match)
CREATE TABLE IF NOT EXISTS match_player_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('captain', 'vice-captain', 'player')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id) -- One role per player per match
);

-- 5. Set up RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_roles ENABLE ROW LEVEL SECURITY;

-- 6. Policies
-- Public Read Access
CREATE POLICY "Allow public read access to players" ON players FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to matches" ON matches FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to registrations" ON registrations FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to match_player_roles" ON match_player_roles FOR SELECT TO public USING (true);

-- Public Insert Access (for registration flow)
CREATE POLICY "Allow public insert to players" ON players FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert to registrations" ON registrations FOR INSERT TO public WITH CHECK (true);

-- Admin Access (Simplified: Allowing all for now to public to match previous requirement)
CREATE POLICY "Allow public all access to match_player_roles" ON match_player_roles FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public update to matches" ON matches FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public update to registrations" ON registrations FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete to registrations" ON registrations FOR DELETE TO public USING (true);
