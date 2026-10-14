-- Photo framing (see lib/photo-focus.ts).
--
-- Where the face sits in each member's photo, so avatars, the player hero and
-- story cards frame the face instead of guessing. Set by face detection at
-- upload, by the admin "Photo framing" panel, or by hand:
--   { "x": 0.52, "y": 0.31, "s": 0.18, "a": 0.75, "w": 1080, "by": "auto" }
--   x, y = face centre (fractions of width/height), s = face height / image
--   height, a = image width / height, w = image width in px.
-- NULL = not framed yet (surfaces fall back to a top-centred crop).
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS image_focus JSONB;

COMMENT ON COLUMN public.players.image_focus IS
  'Face position in image_url (lib/photo-focus.ts). NULL until framed.';
