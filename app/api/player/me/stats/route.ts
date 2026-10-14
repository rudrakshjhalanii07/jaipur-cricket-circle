import { NextResponse } from "next/server";
import { getSignedInMember } from "@/lib/member-session";
import { getStatsAccess } from "@/lib/stats-access";
import { buildCardData } from "@/lib/scorecard-dashboard/compute";
import { fetchDbOnlyMatches } from "@/lib/scorecard-dashboard/db-matches.server";
import { playerProfile, slug } from "@/lib/scorecard-dashboard/profile";
import { memberCardIndex } from "@/lib/scorecard-dashboard/member-card.server";

// The signed-in member's own numbers for the Profile tab: career and per-season
// batting, bowling and fielding, the badges he holds, and his player-of-the-
// match awards — the same figures his card on /stats shows.
//
// Scorecards spell names however the scorer typed them ("Sagar"), the club
// roster in full ("Sagar Sharma"), so the member is found through the roster
// matcher with the whole roster loaded: a bare first name two members share
// resolves to neither rather than to the wrong one.

const SCOPES = [
  { key: "career", label: "Career", seasons: [2, 3] },
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
];

const r1 = (n: number | null) => (n == null || !isFinite(n) ? null : Math.round(n * 10) / 10);

export async function GET() {
  const member = await getSignedInMember();
  if (!member) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const access = await getStatsAccess(member.id);
  if (access.kind === "expired") {
    return NextResponse.json({ error: "Stats access ended", expired: true, endsAt: access.endsAt }, { status: 403 });
  }

  try {
    const data = buildCardData(await fetchDbOnlyMatches());
    const mainIndex = await memberCardIndex(data, member.id);
    if (mainIndex == null) {
      return NextResponse.json({ ok: true, found: false, name: member.name, access });
    }
    const main = { i: mainIndex, name: data.players[mainIndex] };

    const scopes = SCOPES.map((sc) => {
      const pr = playerProfile(data, sc.seasons, main.i);
      if (!pr) return { key: sc.key, label: sc.label, played: false };
      return {
        key: sc.key,
        label: sc.label,
        played: true,
        matches: pr.matches,
        team: pr.team,
        role: pr.role,
        winPct: r1(pr.winPct),
        batting: {
          inns: pr.B.inns, runs: pr.B.runs, balls: pr.B.balls, hs: pr.B.hs, notOuts: pr.B.no,
          avg: r1(pr.B.avg), sr: r1(pr.B.sr), fours: pr.B.f4, sixes: pr.B.s6, ducks: pr.B.ducks,
        },
        bowling: {
          spells: pr.W.spells, balls: pr.W.balls, wickets: pr.W.wk, runs: pr.W.runs, best: pr.W.best,
          econ: r1(pr.W.econ), avg: r1(pr.W.avg), maidens: pr.W.mdn,
        },
        fielding: pr.F,
        ranks: pr.ranks,
        // Percentile against qualified players in the same scope (0–100), and
        // the player-type tags they add up to.
        dna: pr.dna,
        phase: pr.phase,
        teamShare: r1(pr.batting.teamShare),
        badges: pr.badges,
        mom: pr.mom.map((m) => ({ date: m.date, season: m.season, line: m.line, opp: m.opp })),
      };
    });

    return NextResponse.json({
      ok: true,
      found: true,
      name: member.name,
      access,
      scorecardName: main.name,
      cardHash: `player-${slug(main.name)}`,
      scopes,
    });
  } catch (err) {
    console.error("player/me/stats error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
