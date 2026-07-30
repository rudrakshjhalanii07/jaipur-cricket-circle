// The club's maintained roster — the client-safe half.
//
// Two different lists answer "who plays for JCC":
//
//   • the SEASON pool — derived from scorecards by computePlayersPool(), so it
//     only ever contains people who actually featured in that season, guests
//     included, spelled however the scorecard spelled them; and
//   • the CLUB ROSTER — the `players` table, maintained by admins through the
//     registration/approval flow and rendered on /members. It is the canonical
//     list: one row per person, one spelling, a photo, a team.
//
// The roster is deliberately NOT a new table. `players` is already the list the
// club maintains, and a second one would immediately drift out of sync with the
// faces on /members.

import { playerPhotoKeys, playerPhotoIndexKeys } from "@/lib/player-photos";
import { AUCTION_SIGNINGS, type Signing } from "@/lib/auction-squads";

export interface ClubRosterRow {
  id: string;
  name: string;
  image_url: string | null;
  team: string | null;
  role: string | null;
}

/** One row of the players pool, member or not. */
export interface PoolPlayer {
  /** Stable list key — the roster id for members, the scorecard name otherwise. */
  key: string;
  name: string;
  /** Members only. Non-members deliberately have no photo — there is no profile. */
  image: string | null;
  matches: number;
  /** Members only: the role shown on /members. */
  role: string | null;
  /** False for someone who has played but was never registered. */
  isMember: boolean;
}

/**
 * Resolves a loose scorecard name onto the roster row it belongs to.
 *
 * Roster names are indexed by their *index* keys and scorecard names looked up
 * by their *lookup* keys — the mirror of the photo lookup, which knows the tidy
 * name and searches for the loose one. Here the tidy names are the haystack: a
 * scorecard's bare "Sagar" has to find roster "Sagar Sharma".
 *
 * A bare first name that two roster members both answer to resolves to neither
 * — the same call the photo lookup makes, for the same reason: a wrong match is
 * worse than a missing one.
 */
export function createRosterMatcher(roster: ClubRosterRow[]) {
  // Every key a roster row answers to → the rows holding it. A key held by two
  // rows ("first:naman") identifies nobody.
  const claims = new Map<string, ClubRosterRow[]>();
  for (const r of roster) {
    for (const key of playerPhotoIndexKeys(r.name)) {
      claims.set(key, [...(claims.get(key) ?? []), r]);
    }
  }

  return {
    /** The roster row a scorecard name belongs to, or null if unregistered. */
    find(name: string): ClubRosterRow | null {
      // Most specific key first, and only the first hit counts — a scorecard
      // entry is one person, so it resolves to one row or to none.
      for (const key of playerPhotoKeys(name)) {
        const holders = claims.get(key);
        if (!holders) continue;
        return holders.length === 1 ? holders[0] : null;
      }
      return null;
    },
  };
}

/**
 * The full players pool: every registered member, everyone who has ever been
 * recorded in a scorecard without a `players` row behind him, and everyone
 * bought at the auction who is neither of those yet.
 *
 * The halves are deliberately not equivalent. A member is a profile — photo,
 * role, a page on /members. A non-member is only ever a name on a scorecard or
 * an auction sheet, so he carries no photo and is tagged as such; he appears
 * here and nowhere else in the site. Members with no appearances stay in the
 * list at 0 matches, and so does a signing who has yet to play.
 *
 * Sorted alphabetically, the kinds interleaved — this is one club list, not a
 * roster with an appendix.
 */
export function buildPlayersPool(
  roster: ClubRosterRow[],
  pool: { name: string; matches: number }[],
  signings: Signing[] = AUCTION_SIGNINGS,
): PoolPlayer[] {
  const matcher = createRosterMatcher(roster);
  const appearances = new Map<string, number>();
  const nonMembers: PoolPlayer[] = [];
  // Non-members are keyed by name, so this is what "already listed" means for
  // them — a member is deduped by landing on his roster row instead.
  const seen = new Set<string>();
  const key = (name: string) => name.trim().toLowerCase();

  for (const p of pool) {
    const row = matcher.find(p.name);
    if (row) {
      // Summed: two scorecard spellings of one member both land on his row.
      appearances.set(row.id, (appearances.get(row.id) ?? 0) + p.matches);
    } else {
      seen.add(key(p.name));
      nonMembers.push({
        key: p.name,
        name: p.name,
        image: null,
        matches: p.matches,
        role: null,
        isMember: false,
      });
    }
  }

  // Bought but never yet recorded anywhere. `member` is trusted over name
  // matching here — see lib/auction-squads.ts: some signings are first-name
  // twins of a member and must not be folded into him.
  for (const s of signings) {
    if (s.member || seen.has(key(s.name))) continue;
    seen.add(key(s.name));
    nonMembers.push({
      key: s.name,
      name: s.name,
      image: null,
      matches: 0,
      role: null,
      isMember: false,
    });
  }

  const members: PoolPlayer[] = roster.map((r) => ({
    key: r.id,
    name: r.name,
    image: r.image_url,
    matches: appearances.get(r.id) ?? 0,
    role: r.role,
    isMember: true,
  }));

  return [...members, ...nonMembers].sort((a, b) => a.name.localeCompare(b.name));
}
