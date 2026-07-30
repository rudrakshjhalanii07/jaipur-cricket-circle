// Profile photos for scorecards — the client-safe half.
//
// Scorecards store only a player's name, while the photo lives on his `players`
// row — the same row the members page renders. This maps one to the other so a
// scorecard shows the face people know from /members.
//
// The two sources spell names loosely: a scorecard says "Sagar", "Mahesh kumar"
// or "Naman Mavericks" where the players table says "Sagar Sharma", "Mahesh
// kumar" and "Naman Mittal". So the server indexes each player under several
// keys and a lookup tries them from most to least specific. Anything that stays
// ambiguous (two Namans, one first name) is deliberately left unmatched — a
// generated avatar is better than another member's face.
//
// The Supabase read lives in player-photos.server.ts: importing it from here
// would drag the service-role client into the browser bundle of every client
// component that only needs the lookup below.

import { canonicalPlayerName } from "@/lib/player-names";

/** Lookup key → photo URL. Keys are built by playerPhotoKeys(). */
export type PlayerPhotoMap = Record<string, string>;

/** Club/team words that ride along on WhatsApp-style scorecard names. */
const NAME_NOISE =
  /\b(jcc|neurostrikers|neuro|strikers|mavericks|outliers|vikings|brewvana|owner|cbi)\b/g;

/** "Bhairav Deep Touchy JCC" → ["bhairav", "deep", "touchy"] */
function nameTokens(raw: string): string[] {
  return canonicalPlayerName(raw)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(NAME_NOISE, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * The keys a name can be looked up by, most specific first:
 *  • the whole name       — "mahesh kumar"
 *  • first + last         — "mahesh|kumar", ignoring middles ("Sarthak S Rathore")
 *  • the first name alone — "sagar", indexed only when it is unambiguous
 *
 * A surname that is present and different is a different person, so the
 * first-name key is only *searched* for a scorecard name that is a lone first
 * name. Without that, "Ankit Sharma" would wear Ankit Jain's face.
 */
export function playerPhotoKeys(raw: string): string[] {
  const t = nameTokens(raw);
  if (t.length === 0) return [];
  if (t.length === 1) return [`full:${t[0]}`, `first:${t[0]}`];
  return [`full:${t.join(" ")}`, `fl:${t[0]}|${t[t.length - 1]}`];
}

/** Every key a player's photo should be stored under. */
export function playerPhotoIndexKeys(raw: string): string[] {
  const t = nameTokens(raw);
  if (t.length === 0) return [];
  const keys = [`full:${t.join(" ")}`, `first:${t[0]}`];
  if (t.length > 1) keys.push(`fl:${t[0]}|${t[t.length - 1]}`);
  return keys;
}

/** The first name a photo would be indexed under, or null. */
export function playerFirstName(raw: string): string | null {
  return nameTokens(raw)[0] ?? null;
}

/** Photo for a name as it appears on a scorecard, or null to fall back. */
export function photoFor(
  photos: PlayerPhotoMap,
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  for (const key of playerPhotoKeys(name)) {
    const url = photos[key];
    if (url) return url;
  }
  return null;
}
