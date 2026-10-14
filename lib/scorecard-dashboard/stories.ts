// Stat stories: the handful of numbers worth telling someone about, written
// up as one-line headlines. Shared by the home page (computed on the server,
// only the finished stories are sent down) and /stats (computed in the
// browser from the same CardData).
//
// Every story is read straight off the scope index in profile.ts — nothing is
// estimated. Wicket phases come from the fall-of-wicket over, which is the
// closest thing to ball-by-ball the CricHeroes export carries. Rate stories
// need a qualifying floor (MIN_BALLS) so a two-ball cameo can't lead.

import { MIN_BALLS, getScope, momCounts, leagueInsights, type CardData, type PlayerAgg } from "./profile";

export type StoryTone = "gold" | "orange" | "purple" | "blue";

/** Gradient fill for each tone's headline number. */
export const TONE: Record<StoryTone, string> = {
  gold: "linear-gradient(135deg, #F3C96A 0%, #D4AF37 45%, #A97824 100%)",
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
  blue: "linear-gradient(135deg, #6E9BE6 0%, #3B6FC4 100%)",
};

export type Story = {
  /** Stable slug: the share link is /stats#story-<id>. */
  id: string;
  kicker: string;
  /** The headline number, already formatted. */
  value: string;
  unit: string;
  headline: string;
  body: string;
  /** Player name, when the story is about one player. */
  player: string | null;
  /** Player index into CardData.players, for opening their cards. */
  p: number | null;
  team: string | null;
  tone: StoryTone;
};

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const r0 = (n: number) => String(Math.round(n));
const first = (name: string) => name.split(/\s+/)[0];

export function statStories(d: CardData, seasons: number[]): Story[] {
  const S = getScope(d, seasons);
  const name = (p: number) => d.players[p];
  const ps = [...S.players.values()].filter((x) => x.matches > 0);
  const out: Story[] = [];
  const add = (s: Story | null | undefined) => {
    if (s) out.push(s);
  };
  const best = <T,>(xs: T[], score: (x: T) => number) => xs.reduce<T | null>((b, x) => (b == null || score(x) > score(b) ? x : b), null);
  const of = (x: PlayerAgg) => ({ player: name(x.p), p: x.p, team: x.team ?? null });

  // Six machine — fewest balls per six.
  const sixer = best(
    ps.filter((x) => x.B.balls >= MIN_BALLS && x.B.s6 >= 3),
    (x) => -(x.B.balls / x.B.s6),
  );
  if (sixer) {
    const bps = sixer.B.balls / sixer.B.s6;
    const league = S.LB.s6 ? S.LB.balls / S.LB.s6 : null;
    add({
      id: "six-machine",
      kicker: "Six machine",
      value: r1(bps),
      unit: "balls per six",
      headline: `${name(sixer.p)} clears the rope every ${r1(bps)} balls.`,
      body: league
        ? `The league needs ${r1(league)} balls per six — ${first(name(sixer.p))} is ${r1(league / bps)}× quicker, with ${sixer.B.s6} sixes in ${sixer.B.balls} balls.`
        : `${sixer.B.s6} sixes in ${sixer.B.balls} balls faced.`,
      ...of(sixer),
      tone: "orange",
    });
  }

  // Strike force — strike rate against the league's.
  const striker = best(
    ps.filter((x) => x.B.balls >= MIN_BALLS && x.B.sr != null),
    (x) => x.B.sr!,
  );
  if (striker && S.LB.sr) {
    const lift = (100 * (striker.B.sr! - S.LB.sr)) / S.LB.sr;
    add({
      id: "strike-force",
      kicker: "Fastest bat",
      value: r0(striker.B.sr!),
      unit: "strike rate",
      headline: `${name(striker.p)} scores ${r0(lift)}% faster than the league.`,
      body: `${striker.B.runs} runs off ${striker.B.balls} balls. The league strike rate is ${r0(S.LB.sr)}. Minimum ${MIN_BALLS} balls faced.`,
      ...of(striker),
      tone: "gold",
    });
  }

  // Death specialist — wickets in the last two overs.
  const closer = best(
    ps.filter((x) => x.phase.death >= 2),
    (x) => x.phase.death * 100 - (x.W.econ ?? 99),
  );
  if (closer) {
    const share = closer.W.wk ? (100 * closer.phase.death) / closer.W.wk : 0;
    add({
      id: "death-overs",
      kicker: "Death-over specialist",
      value: String(closer.phase.death),
      unit: "death-over wickets",
      headline: `Give ${first(name(closer.p))} the last two overs.`,
      body: `${closer.phase.death} of ${name(closer.p)}'s ${closer.W.wk} wickets (${r0(share)}%) fell in the final two overs — read from the over each wicket fell in.`,
      ...of(closer),
      tone: "purple",
    });
  }

  // New-ball threat — wickets in the first two overs.
  const opener = best(
    ps.filter((x) => x.phase.powerplay >= 2 && x.p !== closer?.p),
    (x) => x.phase.powerplay * 100 - (x.W.econ ?? 99),
  );
  if (opener) {
    add({
      id: "powerplay",
      kicker: "Powerplay strike",
      value: String(opener.phase.powerplay),
      unit: "wickets in overs 1–2",
      headline: `${name(opener.p)} hits early.`,
      body: `${opener.phase.powerplay} of ${name(opener.p)}'s ${opener.W.wk} wickets came inside the first two overs, before the batters are set.`,
      ...of(opener),
      tone: "purple",
    });
  }

  // Dot-ball squeeze.
  const squeeze = best(
    ps.filter((x) => x.W.balls >= MIN_BALLS && x.W.dotPct != null),
    (x) => x.W.dotPct!,
  );
  if (squeeze && S.LW.dotPct != null) {
    add({
      id: "dot-squeeze",
      kicker: "Dot-ball squeeze",
      value: `${r0(squeeze.W.dotPct!)}%`,
      unit: "of balls are dots",
      headline: `${name(squeeze.p)} bowls a dot more often than not.`,
      body: `${squeeze.W.dots} dots in ${squeeze.W.balls} balls. League average: ${r0(S.LW.dotPct)}%. Economy ${squeeze.W.econ?.toFixed(2)}.`,
      ...of(squeeze),
      tone: "blue",
    });
  }

  // Lucky charm — side's win rate with them in it.
  const charm = best(
    ps.filter((x) => x.matches >= 6),
    (x) => x.winPct * 100 + x.matches,
  );
  if (charm && charm.winPct >= 55) {
    add({
      id: "lucky-charm",
      kicker: "Lucky charm",
      value: `${r0(charm.winPct)}%`,
      unit: "win rate when playing",
      headline: `When ${first(name(charm.p))} plays, ${charm.team} wins.`,
      body: `${name(charm.p)}'s side has won ${r0(charm.winPct)}% of the ${charm.matches} matches they played in. Minimum six appearances.`,
      ...of(charm),
      tone: "gold",
    });
  }

  // Player of the Match haul.
  const moms = [...momCounts(d, seasons).entries()].sort((a, b) => b[1].length - a[1].length);
  if (moms[0] && moms[0][1].length >= 2) {
    const [p, ms] = moms[0];
    const x = S.players.get(p);
    add({
      id: "match-winner",
      kicker: "Match-winner",
      value: String(ms.length),
      unit: "Player of the Match awards",
      headline: `${first(name(p))} turns up when it matters.`,
      body: `${name(p)} has the most Player of the Match awards in the league: ${ms.length}${moms[1] ? `, against ${moms[1][1].length} for the next best` : ""}.`,
      player: name(p),
      p,
      team: x?.team ?? null,
      tone: "gold",
    });
  }

  // Hidden gem — the strongest "deserves more chances" case.
  const gem = leagueInsights(d, seasons)
    .chances.filter((c) => c.underusedBat && c.sr != null)
    .sort((a, b) => (b.sr ?? 0) - (a.sr ?? 0))[0];
  if (gem && S.LB.sr) {
    add({
      id: "hidden-gem",
      kicker: "Hidden gem",
      value: r0(gem.sr!),
      unit: "strike rate, barely used",
      headline: `${name(gem.p)} deserves more balls.`,
      body: `Strikes at ${r0(gem.sr!)} (league ${r0(S.LB.sr)}) but faces ${r1(gem.ballsPerMatch)} balls a match, against a team average of ${r1(gem.teamBallsPerMatch)}.`,
      player: name(gem.p),
      p: gem.p,
      team: gem.team,
      tone: "orange",
    });
  }

  // League-wide: boundary dependence.
  if (S.LB.bndPct != null && S.LB.runs) {
    add({
      id: "boundary-league",
      kicker: "League pulse",
      value: `${r0(S.LB.bndPct)}%`,
      unit: "of runs come in boundaries",
      headline: `JCC cricket is played over the rope.`,
      body: `${S.LB.f4} fours and ${S.LB.s6} sixes account for ${r0(S.LB.bndPct)}% of the ${S.LB.runs} runs off the bat. A boundary every ${S.LB.bpb ? r1(S.LB.bpb) : "–"} balls.`,
      player: null,
      p: null,
      team: null,
      tone: "blue",
    });
  }

  // League-wide: chase or defend.
  let chaseW = 0;
  let defendW = 0;
  for (const m of S.matchIds) {
    const w = d.matches[m].winner;
    if (!w) continue;
    const firstInn = S.innings.find((i) => i[0] === m && i[1] === 1);
    if (!firstInn) continue;
    if (firstInn[2] === w) defendW++;
    else chaseW++;
  }
  if (chaseW + defendW >= 6) {
    const chasePct = (100 * chaseW) / (chaseW + defendW);
    const chase = chasePct >= 50;
    add({
      id: "toss-call",
      kicker: "Win the toss?",
      value: `${r0(chase ? chasePct : 100 - chasePct)}%`,
      unit: chase ? "of matches won chasing" : "of matches won batting first",
      headline: chase ? "Win the toss, bowl first." : "Win the toss, bat first.",
      body: `${chaseW} matches won chasing, ${defendW} won defending a total, from ${chaseW + defendW} with a result.`,
      player: null,
      p: null,
      team: null,
      tone: "blue",
    });
  }

  return out;
}

export type TrendPoint = {
  date: string;
  /** "14 Jun" — formatted here so server and browser agree. */
  label: string;
  matches: number;
  /** Average first-innings total that matchday. */
  avgFirst: number;
  /** Sixes per match that matchday. */
  sixes: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Scoring across the season, one point per matchday. */
export function scoringTrend(d: CardData, seasons: number[]): TrendPoint[] {
  const S = getScope(d, seasons);
  const byDate = new Map<string, number[]>();
  for (const m of S.matchIds) {
    const date = d.matches[m].date;
    (byDate.get(date) ?? byDate.set(date, []).get(date)!).push(m);
  }
  const sixesIn = new Map<number, number>();
  for (const r of S.bat) sixesIn.set(r.m, (sixesIn.get(r.m) ?? 0) + r.s6);
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ms]) => {
      const firsts = S.innings.filter((i) => i[1] === 1 && ms.includes(i[0]));
      const [, mo, dd] = date.split("-").map(Number);
      return {
        date,
        label: `${dd} ${MONTHS[mo - 1]}`,
        matches: ms.length,
        avgFirst: firsts.length ? firsts.reduce((s, i) => s + i[3], 0) / firsts.length : 0,
        sixes: ms.reduce((s, m) => s + (sixesIn.get(m) ?? 0), 0) / ms.length,
      };
    })
    .filter((t) => t.avgFirst > 0);
}
