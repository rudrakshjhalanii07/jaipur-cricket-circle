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

export interface Signing {
  /** Canonical name, as agreed when the results graphic was transcribed. */
  name: string;
  teamId: TeamId;
  /** True when an approved `players` row exists for this person. */
  member: boolean;
}

/** The season these squads were drafted for — see `season` in the JSON. */
export const AUCTION_SEASON: string = auction.season;

export const AUCTION_SIGNINGS: Signing[] = auction.teams.flatMap((t) =>
  t.players.map((p) => ({
    name: (p.resolved ?? p.name).trim(),
    teamId: t.team_id as TeamId,
    member: p.member === true,
  })),
);
