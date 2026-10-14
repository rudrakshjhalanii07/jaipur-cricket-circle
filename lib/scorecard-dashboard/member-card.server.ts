// Which scorecard identity is this member? Shared by the profile's My Stats
// (/api/player/me/stats) and /stats, which only lets a member open their own
// player cards.
//
// Scorecards spell names however the scorer typed them ("Sagar"), the club
// roster in full ("Sagar Sharma"), so the member is found through the roster
// matcher with the whole roster loaded: a bare first name two members share
// resolves to neither rather than to the wrong one. When several scorecard
// identities resolve to the member, the one with the most appearances is the
// one their card lives under.

import { fetchClubRoster } from "@/lib/club-roster.server";
import { createRosterMatcher } from "@/lib/club-roster";
import { playerProfile, type CardData } from "./profile";

export async function memberCardIndex(data: CardData, memberId: string): Promise<number | null> {
  const matcher = createRosterMatcher(await fetchClubRoster());
  const mine = data.players.map((name, i) => ({ name, i })).filter(({ name }) => matcher.find(name)?.id === memberId);
  if (!mine.length) return null;
  return mine
    .map((m) => ({ ...m, matches: playerProfile(data, [2, 3], m.i)?.matches ?? 0 }))
    .sort((a, b) => b.matches - a.matches)[0].i;
}
