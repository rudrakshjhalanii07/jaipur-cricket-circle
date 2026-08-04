import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MEMBER_STANDING_ORDER,
  type Member,
  type MemberStanding,
  type MemberTag,
} from "@/lib/types";
import { getDisplayRole, getGovernanceRoleLabel } from "@/lib/member-role";
import {
  fetchFullSeries,
  computePlayersPool,
  type FullSeries,
} from "@/lib/series";
import { TEAMS, type TeamId } from "@/lib/teams";
import { fetchSeasons, type Season } from "@/lib/seasons";
import { createRosterMatcher } from "@/lib/club-roster";
import { AUCTION_SIGNINGS, AUCTION_SEASON } from "@/lib/auction-squads";
import MembersClient from "./MembersClient";

export const metadata: Metadata = {
  title: "Members",
  description: "Meet the legends who define weekly cricket in Jaipur.",
};

/**
 * The standing a person holds independently of captaincy — founders outrank the
 * committee. Read off the same columns the rest of the site uses (see
 * lib/member-role.ts); nothing here is a new flag.
 *
 * Captaincy is deliberately NOT decided here. `players.group_role` is the admin
 * panel's own record and goes stale the moment a season hands the armband to
 * someone else, so who captains *now* is read from the active season's
 * `season_teams` rows — the same source /seasons renders. See captainIds().
 */
function standingOf(p: {
  member_tag?: string | null;
  group_role?: string | null;
  governance_role?: string | null;
  is_exec_committee?: boolean | null;
}): MemberStanding {
  if (p.member_tag === "founding-member" || p.group_role === "founding-member")
    return "founder";
  if (p.governance_role === "co-founder") return "founder";
  if (p.is_exec_committee || p.governance_role === "permanent-member")
    return "executive";
  return "member";
}

const getMembers = unstable_cache(
  async (): Promise<Member[]> => {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) return [];

    // Cap numbers, handed out in registration order — earliest sign-up is 001.
    // They are worked out over the whole approved roster here rather than from
    // a card's position on the page, so a member keeps his number whatever the
    // directory is sorted or filtered by. A row with no timestamp sorts last,
    // and the id breaks a tie so the run is stable between renders.
    const registeredAt = (p: { created_at?: string | null; approved_at?: string | null }) =>
      p.created_at || p.approved_at || null;
    const capNumbers = new Map<string, number>(
      [...data]
        .sort((a, b) => {
          const [x, y] = [registeredAt(a), registeredAt(b)];
          if (x && y && x !== y) return x < y ? -1 : 1;
          if (!x !== !y) return x ? -1 : 1;
          return String(a.id).localeCompare(String(b.id));
        })
        .map((p, i) => [p.id as string, i + 1]),
    );

    return data.map((p) => {
      // Captaincy is stripped out of the admin record here and re-applied from
      // the active season in MembersPage — `group_role` still names whoever led
      // a side in an earlier season, so trusting it shows retired captains as
      // current ones. Every other group_role ("admin", …) passes through.
      const groupRole =
        p.group_role === "captain" || p.group_role === "vice-captain"
          ? null
          : p.group_role;

      const tags: MemberTag[] = [];
      if (p.member_tag && p.member_tag !== "member") tags.push(p.member_tag as MemberTag);
      if (p.cricket_role) tags.push(p.cricket_role as MemberTag);

      // Committee standing outranks a cricket role on the badge — getDisplayRole
      // knows nothing about governance, so it would print "All-Rounder" for a
      // permanent member and lose the very thing that ranks him on this page.
      const standing = standingOf(p);
      return {
        id: p.id,
        name: p.name,
        initials: p.name
          ? p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
          : "🏏",
        team: p.team || "Unassigned",
        role:
          standing === "executive"
            ? getGovernanceRoleLabel(p)
            : getDisplayRole(p.member_tag, groupRole, p.cricket_role),
        tags,
        image: p.image_url || p.image,
        cricketRole: p.cricket_role as Member["cricketRole"],
        battingStyle: p.batting_style || "Right-hand bat",
        bowlingStyle: p.bowling_style || "N/A",
        shortBio: p.short_bio || p.bio || "A valued member of the circle.",
        joinedDate: p.approved_at || p.created_at || new Date().toISOString(),
        capNumber: capNumbers.get(p.id),
        standing,
      } as Member;
    });
  },
  ["members-page-players"],
  { revalidate: 300 }
);

/**
 * Career appearances per member, keyed by roster id.
 *
 * Scorecards spell a name however the scorer typed it, so the counts are folded
 * onto roster rows through the same matcher the players pool uses — two
 * spellings of one member sum into one total, and a name that resolves to
 * nobody (a guest) is simply not a member and drops out here.
 */
function appearancesByMember(
  matcher: ReturnType<typeof createRosterMatcher>,
  pool: { name: string; matches: number }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of pool) {
    const row = matcher.find(p.name);
    if (row) counts.set(row.id, (counts.get(row.id) ?? 0) + p.matches);
  }
  return counts;
}

/**
 * The members captaining a side in the season currently being played.
 *
 * `season_teams.captain` holds a name, not a player id, so it resolves onto the
 * roster through the same matcher the appearance counts use.
 */
function captainIds(
  matcher: ReturnType<typeof createRosterMatcher>,
  season: Season | null,
): Set<string> {
  const ids = new Set<string>();
  for (const t of season?.teams ?? []) {
    if (!t.captain?.trim()) continue;
    const row = matcher.find(t.captain);
    if (row) ids.add(row.id);
  }
  return ids;
}

/**
 * The side each member is on *this season*, keyed by roster id.
 *
 * `players.team` is the admin panel's record and carries last season's squad
 * until someone edits it by hand, so the current side is read from the season
 * itself, in three passes of rising authority:
 *
 *   1. scorecards — who he has actually turned out for;
 *   2. the auction — the squad he was bought into, which is the real answer for
 *      anyone who has not played a match yet (Harnoor, say) and also corrects
 *      anyone who guested for another side in a fixture; and
 *   3. captaincy — a captain leads the team `season_teams` gives him.
 *
 * A member in none of the three keeps whatever the roster says.
 */
function teamsByMember(
  matcher: ReturnType<typeof createRosterMatcher>,
  seasonSeries: FullSeries[],
  season: Season | null,
): Map<string, TeamId> {
  const teams = new Map<string, TeamId>();

  for (const p of computePlayersPool(seasonSeries)) {
    const row = matcher.find(p.name);
    // teams[0] only matters for a guest who filled in for a second side; the
    // first is the one he actually belongs to.
    if (row && p.teams[0]) teams.set(row.id, p.teams[0] as TeamId);
  }

  // The auction squads are Season 3's, so they only speak for the season they
  // drafted — the guard keeps them from mislabelling a later season's roster.
  if (season?.season_label === AUCTION_SEASON) {
    for (const s of AUCTION_SIGNINGS) {
      if (!s.member) continue;
      const row = matcher.find(s.name);
      if (row) teams.set(row.id, s.teamId);
    }
  }

  // Captaincy wins: a captain is on his team from the day the season is drawn,
  // whether or not a scorecard has recorded him yet.
  for (const t of season?.teams ?? []) {
    if (!t.captain?.trim()) continue;
    const row = matcher.find(t.captain);
    if (row) teams.set(row.id, t.team_id);
  }

  return teams;
}

export default async function MembersPage() {
  const [members, fullSeries, seasons] = await Promise.all([
    getMembers(),
    fetchFullSeries(),
    fetchSeasons(),
  ]);

  const matcher = createRosterMatcher(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      image_url: null,
      team: null,
      role: null,
    })),
  );

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const activeSeries = activeSeason
    ? fullSeries.filter((s) => s.season_id === activeSeason.id)
    : [];

  const counts = appearancesByMember(matcher, computePlayersPool(fullSeries));
  const captains = captainIds(matcher, activeSeason);
  const teams = teamsByMember(matcher, activeSeries, activeSeason);

  const withStanding = members.map((m) => {
    const isCaptain = captains.has(m.id);
    const teamId = teams.get(m.id);
    return {
      ...m,
      matchesPlayed: counts.get(m.id) ?? 0,
      team: (teamId ? TEAMS[teamId].name : m.team) as Member["team"],
      // Captaincy never displaces a higher standing, it only lifts a plain
      // member — a founder who also captains stays in the founders' block.
      standing:
        isCaptain && (m.standing ?? "member") === "member"
          ? ("captain" as MemberStanding)
          : (m.standing ?? "member"),
      role: isCaptain ? captainRole(m.standing ?? "member", m.role) : m.role,
      tags: isCaptain && !m.tags.includes("captain")
        ? ([...m.tags, "captain"] as MemberTag[])
        : m.tags,
    };
  });

  // Standing leads — founders, then the committee, then captains, then everyone
  // else — and caps order people *within* a tier. Members who have yet to play
  // fall to the bottom of their own tier at 0, alphabetical within a tie.
  const rankOf = (m: Member) =>
    MEMBER_STANDING_ORDER.indexOf(m.standing ?? "member");

  const ranked = withStanding.sort(
    (a, b) =>
      rankOf(a) - rankOf(b) ||
      b.matchesPlayed - a.matchesPlayed ||
      a.name.localeCompare(b.name),
  );

  return <MembersClient members={ranked} />;
}

/** Badge text for an active-season captain, keeping any higher standing. */
function captainRole(standing: MemberStanding, baseRole: string): string {
  if (standing === "founder") return "Founder & Captain";
  // "Permanent Member" / "Committee Member" — whichever governance label the
  // member already carries, rather than a second hardcoded copy of it.
  if (standing === "executive") return `${baseRole} & Captain`;
  return "Captain";
}
