// Canonical player names.
//
// Scorecards are typed by whoever ran the match, so the same person arrives
// spelled several ways — a missing letter, or a WhatsApp-style suffix picked up
// from the group ("Siddharth Rao Jcc"). Every leaderboard, the players pool and
// the member profile pages key on the name string, so a variant silently splits
// one player into two: half his runs under each spelling, and a profile page
// that shows only part of his season.
//
// The canonical form is the name on his `players` row, since that's what the
// members page matches stats against.

/** Variant (lowercased) → the name it should be stored and displayed as. */
export const PLAYER_NAME_ALIASES: Record<string, string> = {
  "siddharth rao jcc": "Siddharth Rao",
  "siddarth rao": "Siddharth Rao", // missing "h"
  "saurabh cbi": "Saurabh Charan",

  // Confirmed with the club, 30 Jul 2026 — each pair is one person.
  lakshay: "Lakshya Sharma",
  krshna: "Krishna Saxena", // missing "i"
  "adhip choudhary": "Adhip Chaudhary", // Chou/Chau
  "bhairav deep touchy": "Bhairav Deep",
  "bhairav neurostrikers": "Bhairav Deep", // team name, not a surname
  "naman mavericks": "Naman Saini", // the other Naman on the books is Mittal
  "gourav boss": "Kunwar Gaurav",

  // Confirmed with the club, 30 Jul 2026. Two Ankits play: Jain and Sharma —
  // they appear on opposite sides of the same innings (26 Jun match 2), so a
  // bare "Ankit" is genuinely ambiguous on its face. As a PLAYER it is Jain;
  // Sharma is always written out in full and is left alone by this map.
  //
  // Caveat, for whoever imports the next scorecard: this alias is applied to
  // dismissal credits too, where "b Ankit" means whichever Ankit was BOWLING —
  // not necessarily Jain. It was Sharma three times on 26 Jun (see
  // supabase/merge_ankit_to_ankit_jain.sql, which resolves those per innings).
  // If Sharma bowls again, write him out in full on the scorecard.
  ankit: "Ankit Jain",
};

/**
 * The one name a player's records should live under.
 *
 * Beyond the explicit alias list, a trailing "Jcc" is always dropped — it comes
 * from club WhatsApp display names rather than from anyone's actual name, so
 * new variants of it collapse without needing a new entry here.
 */
export function canonicalPlayerName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const withoutSuffix = trimmed.replace(/\s+jcc$/i, "");
  const key = withoutSuffix.toLowerCase();
  return PLAYER_NAME_ALIASES[key] ?? withoutSuffix;
}

/**
 * Same rules applied inside free text — dismissal credits, player-of-the-match
 * and captain fields, which sometimes hold two names ("A / B") rather than one.
 */
export function canonicalNamesInText(raw: string | null): string | null {
  if (!raw) return raw;
  return raw
    .split("/")
    .map((part) => {
      const trimmed = part.trim();
      return trimmed ? canonicalPlayerName(trimmed) : trimmed;
    })
    .join(" / ");
}
