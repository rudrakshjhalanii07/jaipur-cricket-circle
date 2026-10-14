-- Lock down member data that the browser could read or change.
--
-- The site's anon key ships in every page, so anything `anon` can read is
-- public. schema.sql opened players, registrations, matches and
-- match_player_roles wide: anyone could read every member's phone number,
-- insert themselves as an *approved* member, edit matches, and update or
-- delete registrations. This keeps what the public pages need and closes the
-- rest:
--
--   players             anon/authenticated read only the public profile
--                       columns below — no phone, no approval/audit fields.
--                       No writes: sign-ups go through /api/player/signup.
--   registrations       readable without the phone snapshot. Insert stays
--                       open (the /register page signs members up for a
--                       match); update and delete are admin-only (service role).
--   matches             read only. Admin edits use the service role.
--   match_player_roles  read only. Admin edits use the service role.
--
-- The service role (every API route, via lib/supabase-admin.ts) bypasses RLS
-- and keeps full access, so admin screens and server pages are unaffected.
--
-- If a column is added to players later and the public pages need it, grant
-- it here too: new columns are NOT readable by anon until granted.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ── players ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public insert to players" ON public.players;
REVOKE ALL ON public.players FROM anon, authenticated;
GRANT SELECT (
  id, name, cricket_role, batting_style, bowling_style, short_bio,
  image_url, image_focus, team, member_tag, group_role,
  governance_role, governance_order, is_core_committee, is_exec_committee,
  is_active, approval_status, created_at
) ON public.players TO anon, authenticated;

-- ── registrations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public update to registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public delete to registrations" ON public.registrations;
REVOKE ALL ON public.registrations FROM anon, authenticated;
GRANT SELECT (id, match_id, player_id, name, cricket_role, status, created_at)
  ON public.registrations TO anon, authenticated;
GRANT INSERT ON public.registrations TO anon, authenticated;

-- ── matches ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public update to matches" ON public.matches;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM anon, authenticated;

-- ── match_player_roles ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public all access to match_player_roles" ON public.match_player_roles;
REVOKE INSERT, UPDATE, DELETE ON public.match_player_roles FROM anon, authenticated;
-- The read policy from schema.sql stays; recreate it in case it was dropped.
DROP POLICY IF EXISTS "Allow public read access to match_player_roles" ON public.match_player_roles;
CREATE POLICY "Allow public read access to match_player_roles"
  ON public.match_player_roles FOR SELECT TO public USING (true);
