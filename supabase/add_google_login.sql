-- Google sign-in for members (see lib/google-login.ts and /api/player/google).
--
-- A member logs in by entering their registered phone number and then
-- choosing a Google account. The first successful sign-in links that Google
-- account to the player; from then on only that account can log in with that
-- number, and that account can't be used for any other player. An admin can
-- clear a link from the Members panel so the member can link a new account.
--
-- Kept out of `players` on purpose: players is publicly readable, and the
-- Google email / account id must not be. RLS on with no policies, so only the
-- service role (the API routes) can read or write it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.player_google_links (
  player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL UNIQUE,
  google_email TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE public.player_google_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.player_google_links IS
  'The Google account each member signs in with (lib/google-login.ts). One account per player, one player per account.';
