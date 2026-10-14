import { NextResponse } from "next/server";
import { getSignedInMember } from "@/lib/member-session";
import { getStatsAccess } from "@/lib/stats-access";
import { buildCardData } from "@/lib/scorecard-dashboard/compute";
import { fetchDbOnlyMatches } from "@/lib/scorecard-dashboard/db-matches.server";
import { keyBattles, leaderboardRows, leagueInsights, playerProfile, slug, type CardData, type Profile } from "@/lib/scorecard-dashboard/profile";
import { memberCardIndex } from "@/lib/scorecard-dashboard/member-card.server";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { fetchCaptaincy, type CaptaincyRow } from "@/lib/scorecard-dashboard/captaincy.server";
import { buildCaptains, captainAwards, played } from "@/app/stats/captains";
import { photoFor, type PlayerPhotoMap } from "@/lib/player-photos";

// The signed-in member's own numbers for the Profile tab: career and per-season
// batting, bowling and fielding, badges, player-of-the-match awards, best
// moments, head-to-heads, what they give their side, recent form and next
// steps — drawn from the same profile their card on /stats is built from.
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

/** Best moments, the head-to-heads, what they give the side, and recent form. */
/** Their record as captain in this scope: results and tosses, with the last ten matches. */
function captaincy(data: CardData, seasons: number[], p: number, rows: CaptaincyRow[]) {
  const all = buildCaptains(data, seasons, rows);
  const c = all.find((x) => x.p === p);
  if (!c) return null;
  // The club's captaincy and toss awards this member holds (good ones only).
  const awards = captainAwards(all)
    .filter((a) => a.p === p && a.tone !== "warn")
    .map(({ label, tone, value, unit, why }) => ({ label, tone, value, unit, why }));
  return {
    matches: played(c.all), w: c.all.w, l: c.all.l, t: c.all.t,
    first: c.first, chase: c.chase, toss: c.toss, streak: c.streak,
    teams: [...c.teams.keys()],
    recent: c.log.slice(-10),
    awards,
  };
}

/**
 * Everyone in this scope, compact, for "compare yourself with anyone": the
 * headline numbers, photo and team, and the member's head-to-head with each
 * (only dismissals are exact, so that's what it counts).
 */
function league(data: CardData, seasons: number[], pr: Profile, photos: PlayerPhotoMap) {
  const theyGotMe = new Map(pr.batting.matchups.map((m) => [m.p, m]));
  const iGotThem = new Map(pr.bowling.matchups.map((m) => [m.p, m]));
  return leaderboardRows(data, seasons).map((r) => {
    const a = theyGotMe.get(r.p), b = iGotThem.get(r.p);
    return {
      name: data.players[r.p], me: r.p === pr.p, photo: photoFor(photos, data.players[r.p]), team: r.team,
      matches: r.matches, runs: r.runs, balls: r.balls, sr: r1(r.sr), avg: r1(r.avg), s6: r.s6, bnd: r.bnd,
      wk: r.wk, bowlBalls: r.bowlBalls, econ: r1(r.econ), dotPct: r1(r.dotPct), death: r.death,
      fielding: r.fielding, mom: r.mom,
      // Only dismissals are exact head to head: the scorecards don't record
      // which bowler each run came off, so there are no runs-against figures.
      h2h: a || b ? { iDismissed: b?.wk ?? 0, theyDismissed: a?.wk ?? 0, meetings: Math.max(a?.inns ?? 0, b?.inns ?? 0) } : null,
    };
  });
}

function story(pr: Profile, battles: ReturnType<typeof keyBattles>, photos: PlayerPhotoMap) {
  const nm = pr.nameOf;
  const pic = (q: number) => photoFor(photos, nm(q));
  const log = pr.batting.log, spells = pr.bowling.spells;
  const bestInnings = [...log].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0] ?? null;
  const bestSpell = [...spells].filter((s) => s.wk > 0).sort((a, b) => b.wk - a.wk || a.runs - b.runs)[0] ?? null;
  const bigHit = [...log].sort((a, b) => b.s6 - a.s6 || b.runs - a.runs)[0] ?? null;
  const won = log.filter((r) => r.won);
  const wonSpells = spells.filter((s) => s.won);

  return {
    highlights: {
      bestInnings: bestInnings && { runs: bestInnings.runs, balls: bestInnings.balls, notOut: !bestInnings.out, opp: bestInnings.opp, date: bestInnings.date, won: bestInnings.won, tied: bestInnings.tied },
      bestSpell: bestSpell && { wk: bestSpell.wk, runs: bestSpell.runs, balls: bestSpell.balls, opp: bestSpell.opp, date: bestSpell.date, won: bestSpell.won, tied: bestSpell.tied },
      mostSixes: bigHit && bigHit.s6 > 0 ? { s6: bigHit.s6, runs: bigHit.runs, opp: bigHit.opp, date: bigHit.date } : null,
      boundaries: pr.B.f4 + pr.B.s6,
      scores20: log.filter((r) => r.runs >= 20).length,
    },
    contribution: {
      attendance: pr.attendance,
      winsPlayed: Math.round(((pr.winPct ?? 0) * pr.matches) / 100),
      runsInWins: won.reduce((s, r) => s + r.runs, 0),
      wicketsInWins: wonSpells.reduce((s, r) => s + r.wk, 0),
      battedIn: pr.chances.battedIn,
      bowledIn: pr.chances.bowledIn,
      ballsPerMatch: r1(pr.chances.ballsPerMatch),
      oversPerMatch: r1(pr.chances.oversPerMatch),
    },
    // Head-to-heads. The export has no ball-by-ball data, so a meeting is an
    // innings where both were on the field; only the dismissal is exact.
    battles: {
      bunnies: pr.bowling.matchups
        .filter((m) => m.wk > 0)
        .sort((a, b) => b.wk - a.wk || a.inns - b.inns)
        .slice(0, 4)
        .map((m) => ({ name: nm(m.p), photo: pic(m.p), wk: m.wk, meetings: m.inns, ducks: m.ducks })),
      // Bowlers who've bowled in their innings again and again and never got them out.
      dominated: pr.batting.matchups
        .filter((m) => m.wk === 0 && m.inns >= 2)
        .sort((a, b) => b.inns - a.inns)
        .slice(0, 4)
        .map((m) => ({ name: nm(m.p), photo: pic(m.p), meetings: m.inns })),
      nemesis: pr.batting.matchups
        .filter((m) => m.wk >= 2)
        .sort((a, b) => b.wk - a.wk || a.inns - b.inns)
        .slice(0, 3)
        .map((m) => ({ name: nm(m.p), photo: pic(m.p), wk: m.wk, meetings: m.inns })),
      rivalries: battles
        .filter((b) => b.batter === pr.p || b.bowler === pr.p)
        .slice(0, 3)
        .map((b) => {
          const batting = b.batter === pr.p;
          return {
            opponent: nm(batting ? b.bowler : b.batter),
            photo: pic(batting ? b.bowler : b.batter),
            batting,
            meetings: b.meetings.length,
            mine: batting ? b.batterWins : b.bowlerWins,
            theirs: batting ? b.bowlerWins : b.batterWins,
            runs: b.runs,
            balls: b.balls,
          };
        }),
    },
    form: {
      // Bat and ball in the same match, side by side.
      allround: (() => {
        const seen = new Map<string, number>();
        const key = (date: string, opp: string) => {
          const base = `${date}|${opp}`;
          const n = (seen.get(base) ?? 0) + 1;
          seen.set(base, n);
          return `${base}|${n}`;
        };
        type Row = { date: string; opp: string; won: boolean; tied: boolean; bat: { runs: number; balls: number; out: boolean } | null; bowl: { wk: number; runs: number; balls: number } | null };
        const rows = new Map<string, Row>();
        for (const r of log) rows.set(key(r.date, r.opp), { date: r.date, opp: r.opp, won: r.won, tied: r.tied, bat: { runs: r.runs, balls: r.balls, out: r.out }, bowl: null });
        seen.clear();
        for (const w of spells) {
          const k = key(w.date, w.opp);
          const row = rows.get(k) ?? { date: w.date, opp: w.opp, won: w.won, tied: w.tied, bat: null, bowl: null };
          row.bowl = { wk: w.wk, runs: w.runs, balls: w.balls };
          rows.set(k, row);
        }
        return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
      })(),
      innings: log.slice(-8).map((r) => ({ runs: r.runs, balls: r.balls, out: r.out, opp: r.opp, date: r.date, won: r.won, tied: r.tied })),
      spells: spells.slice(-8).map((s) => ({ wk: s.wk, runs: s.runs, balls: s.balls, opp: s.opp, date: s.date })),
    },
    strengths: [...pr.insights.good, ...pr.insights.info].slice(0, 5),
    tips: [...pr.tips.batting.slice(0, 2), ...pr.tips.bowling.slice(0, 2)],
  };
}

export async function GET() {
  const member = await getSignedInMember();
  if (!member) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const access = await getStatsAccess(member.id);
  if (access.kind === "expired") {
    return NextResponse.json({ error: "Stats access ended", expired: true, endsAt: access.endsAt }, { status: 403 });
  }

  try {
    const [extra, photos, capRows] = await Promise.all([
      fetchDbOnlyMatches(),
      fetchPlayerPhotos().catch(() => ({}) as PlayerPhotoMap),
      fetchCaptaincy().catch(() => [] as CaptaincyRow[]),
    ]);
    const data = buildCardData(extra);
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
        // How many players hold each badge in this scope, for its rarity.
        badges: (() => {
          const holders = new Map<string, number>();
          for (const r of leagueInsights(data, sc.seasons).badges) for (const b of r.badges) holders.set(b.label, (holders.get(b.label) ?? 0) + 1);
          return pr.badges.map((b) => ({ ...b, holders: holders.get(b.label) ?? 1 }));
        })(),
        mom: pr.mom.map((m) => ({ date: m.date, season: m.season, line: m.line, opp: m.opp })),
        ...story(pr, keyBattles(data, sc.seasons), photos),
        captaincy: captaincy(data, sc.seasons, main.i, capRows),
        league: league(data, sc.seasons, pr, photos),
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
