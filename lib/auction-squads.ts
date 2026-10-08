// Season 3 auction squads — every player bought at the auction, flattened out
// of the results transcript in scripts/season-3-auction.json.
//
// This is NOT a second roster. The `players` table stays the club's canonical
// list; this is the record of one event, and it exists here for a single
// reason: someone can be bought and not yet appear anywhere else on the site.
// A member has a `players` row, a scorecard name has appearances — a signing
// who has neither would otherwise be invisible until his first match.
//
// `member` is the flag settled name-by-name when the transcript was made, and
// it is trusted over any name matching. Several signings are first-name-only
// people who are genuinely NOT the similarly named member ("Madhav" the
// non-member vs "Madhav Sharma" the member), so resolving them by name would
// silently merge two different people.

import auction from "@/scripts/season-3-auction.json";
import type { TeamId } from "@/lib/teams";
import { playerPhotoIndexKeys, playerPhotoKeys } from "@/lib/player-photos";

export interface Signing {
  /** Canonical name, as agreed when the results graphic was transcribed. */
  name: string;
  teamId: TeamId;
  /** True when an approved `players` row exists for this person. */
  member: boolean;
  /** Base price in lakhs — 100, 50 or 25. See GUEST_BASE. */
  base: number;
  /** Bought for, in lakhs. */
  sold: number;
  /** Bought into the 25L guest tier rather than the main squad. */
  guest: boolean;
  /** Leads this team — flagged on the results graphic, one per side. */
  captain: boolean;
}

/**
 * The base price that marks a guest.
 *
 * The auction ran three tiers — 1Cr (8 players), 50L (20) and 25L (29). The
 * bottom tier is the guest pool: a squad player is one of the first two. This
 * is a property of the sheet, not of who has turned out since, so it does not
 * move when a match is played.
 */
export const GUEST_BASE = 25;

/** The season these squads were drafted for — see `season` in the JSON. */
export const AUCTION_SEASON: string = auction.season;

export const AUCTION_SIGNINGS: Signing[] = auction.teams.flatMap((t) =>
  t.players.map((p) => ({
    name: (p.resolved ?? p.name).trim(),
    teamId: t.team_id as TeamId,
    member: p.member === true,
    base: p.base,
    sold: p.sold,
    guest: p.base === GUEST_BASE,
    captain: p.captain === true,
  })),
);

/**
 * Resolves a scorecard name onto the signing it belongs to.
 *
 * The two lists spell the same person differently: the sheet was transcribed in
 * full ("Sagar Sharma", "Rudraksh Jhalani") while a scorecard says whatever the
 * scorer typed ("Sagar", "Rudraksh"). Compared as strings they never meet, and
 * Season 3's regulars end up filed as newcomers while their signings sit on 0
 * matches — so the sheet is indexed and looked up exactly the way the roster is
 * in createRosterMatcher, most specific key first.
 *
 * A name two signings both answer to resolves to neither, and a scorecard name
 * carrying a surname the sheet doesn't have is a different person: "Raghav
 * Chaturvedi" is not the Vikings' "Raghav" unless someone says so in the JSON.
 */
export function createSigningMatcher() {
  const claims = new Map<string, Signing[]>();
  for (const s of AUCTION_SIGNINGS) {
    for (const k of playerPhotoIndexKeys(s.name)) {
      claims.set(k, [...(claims.get(k) ?? []), s]);
    }
  }
  return (name: string): Signing | null => {
    for (const k of playerPhotoKeys(name)) {
      const holders = claims.get(k);
      if (!holders) continue;
      return holders.length === 1 ? holders[0] : null;
    }
    return null;
  };
}
