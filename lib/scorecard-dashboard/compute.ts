// Stats for the /stats-preview dashboard, computed from the CricHeroes export
// (data.json, built by scripts/build-scorecard-dashboard.mjs).
//
// Import rules confirmed with the club, 7 Oct 2026:
// - Duplicate CricHeroes IDs for one person are merged (ID_MERGE below).
// - The two Ankits are different people: Jain (Neuro Strikers S2, Mavericks
//   S3) and Sharma, sometimes called Gupta (Outliers S2). They played on
//   opposite sides on 26 Jun.
// - "Retired hurt" is listed as RETIRED OUT and counts as a dismissal for the
//   batter. No bowler is credited and team wicket totals stay as scored.
// - The 26 Jun Season 2 matches were 10 overs a side and stay that way; any
//   record set in one is tagged instead of excluded.
// - "Box Cricket" / "Limited Overs" and "Resulted" / "resulted" are the same.
// - A guest's numbers count for the team he played for in that match.
//
// Rankings follow the IPL convention used sitewide (see lib/series.ts):
// batting runs → strike rate → average, bowling wickets → economy → runs.

import raw from "./data.json";
import { canonicalPlayerName } from "@/lib/player-names";
import { TEAMS } from "@/lib/teams";
import type { CardData, CardKind } from "./profile";

type RawMatch = {
  season: number;
  matchId: string;
  date: string;
  venue: string;
  overs: number;
  teamA: string;
  teamB: string;
  winner: string | null;
  result: string;
  winBy: string;
};
type RawInnings = {
  matchId: string;
  inning: number;
  team: string;
  runs: number;
  wickets: number;
  overs: string;
  extras: number;
};
type RawBatting = {
  matchId: string;
  inning: number;
  playerId: string;
  name: string;
  team: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  howOut: string;
};
type RawFallOfWicket = {
  matchId: string;
  inning: number;
  playerId: string;
  wicket: number;
  score: number;
  over: string;
};
type RawBowling = {
  matchId: string;
  inning: number;
  playerId: string;
  name: string;
  team: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  dots: number;
  wides: number;
  noBalls: number;
  fours: number;
  sixes: number;
};

const data = raw as {
  matches: RawMatch[];
  innings: RawInnings[];
  batting: RawBatting[];
  bowling: RawBowling[];
  fallOfWickets: RawFallOfWicket[];
};

// ─── Identity ────────────────────────────────────────────────────────────────

/** Duplicate CricHeroes IDs → the ID the player's records live under. */
const ID_MERGE: Record<string, string> = {
  "52957809": "38735959", // Siddharth Rao Jcc → Siddharth Rao
  "40500": "6259155", // Anagh Nandwana's second account
};

/** Names decided by ID, where the scorecard name alone is ambiguous. */
const ID_NAME: Record<string, string> = {
  "1218133": "Ankit Jain",
  "15649695": "Ankit Sharma", // also called Ankit Gupta — same person
  "52957941": "Madhav Sharma", // also scored as a bare "Madhav"
};

/** CricHeroes team name → the display name in lib/teams.ts (teamByName). */
const TEAM_NAME: Record<string, string> = {
  "Neuro strikers": TEAMS.neurostrikers.name,
  VIKINGS: TEAMS.vikings.name,
  Mavericks: TEAMS.mavericks.name,
  Outliers: TEAMS.outliers.name,
};
const teamName = (t: string) => TEAM_NAME[t] ?? t;

const mergedId = (id: string) => ID_MERGE[id] ?? id;

function cleanName(rawName: string): string {
  const stripped = rawName
    .replace(/\((c|wk|c & wk)\)/gi, "")
    .replace(/†/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = canonicalPlayerName(stripped);
  // CricHeroes keeps whatever case the player typed ("pankaj tanwar",
  // "MITLESH CHOUDHARY"); title-case the ones that are all one case.
  if (name === name.toLowerCase() || name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return name;
}

// One display name per merged ID: an explicit override, else the most common
// cleaned spelling across every row that ID appears on.
const playerName = new Map<string, string>();
{
  const counts = new Map<string, Map<string, number>>();
  for (const r of [...data.batting, ...data.bowling]) {
    const id = mergedId(r.playerId);
    const n = cleanName(r.name);
    const m = counts.get(id) ?? new Map<string, number>();
    m.set(n, (m.get(n) ?? 0) + 1);
    counts.set(id, m);
  }
  for (const [id, m] of counts) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    playerName.set(id, ID_NAME[id] ?? best);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cricket overs notation: "5.4" is 5 overs and 4 balls, i.e. 34 balls. */
export function oversToBalls(overs: string | number): number {
  const [o, b = "0"] = String(overs).split(".");
  return Number(o) * 6 + Number(b);
}
export function ballsToOvers(balls: number): string {
  const b = balls % 6;
  return b ? `${Math.floor(balls / 6)}.${b}` : `${balls / 6}`;
}

const isNotOut = (howOut: string) => howOut.trim().toLowerCase() === "not out";
const isRetired = (howOut: string) => /^retired/i.test(howOut.trim());
export const displayHowOut = (howOut: string) =>
  isRetired(howOut) ? "retired out" : howOut;

// ─── Scopes ──────────────────────────────────────────────────────────────────

export type ScopeKey = "s2" | "s3" | "all";
export const SCOPES: { key: ScopeKey; label: string; seasons: number[] }[] = [
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
  { key: "all", label: "Seasons 2 + 3", seasons: [2, 3] },
];

const matchById = new Map(data.matches.map((m) => [m.matchId, m]));

// ─── Output shapes ───────────────────────────────────────────────────────────

export type StandingRow = {
  team: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  pct: number;
  nrr: number;
  /** Results in date order, oldest first. */
  form: ("W" | "L" | "T")[];
};
export type BattingRow = {
  id: string;
  name: string;
  teams: string[];
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highest: string;
  average: number | null;
  strikeRate: number;
  thirties: number;
  fifties: number;
  fours: number;
  sixes: number;
  ducks: number;
};
export type BowlingRow = {
  id: string;
  name: string;
  teams: string[];
  matches: number;
  overs: string;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  average: number | null;
  best: string;
  threeFors: number;
  dots: number;
  dotPct: number;
  wides: number;
  noBalls: number;
};
export type FieldingRow = {
  id: string;
  name: string;
  catches: number;
  stumpings: number;
  runOuts: number;
  total: number;
};
export type InningsRecord = {
  matchId: string;
  date: string;
  label: string;
  value: string;
  sub: string;
  tenOver: boolean;
};
export type MatchCard = {
  matchId: string;
  date: string;
  venue: string;
  overs: number;
  lines: { team: string; score: string; won: boolean }[];
  result: string;
};
export type ScopeStats = {
  key: ScopeKey;
  label: string;
  summary: {
    matches: number;
    matchdays: number;
    runs: number;
    wickets: number;
    fours: number;
    sixes: number;
    fifties: number;
    avgFirstInnings: number;
    chasesWon: number;
    defendsWon: number;
  };
  standings: StandingRow[];
  batting: BattingRow[];
  bowling: BowlingRow[];
  fielding: FieldingRow[];
  topScores: InningsRecord[];
  bestSpells: InningsRecord[];
  highestTotals: InningsRecord[];
  lowestTotals: InningsRecord[];
  biggestWins: InningsRecord[];
  matchdays: { date: string; label: string; matches: MatchCard[] }[];
};

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

// Dates are formatted here, by hand, rather than with toLocaleDateString in
// the client: Node's ICU and the browser's disagree on the punctuation, and
// that mismatch was a hydration error.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
};

// ─── Fielding credits, parsed from the dismissal text ────────────────────────

type Credit = { kind: "catch" | "stumping" | "runOut"; fielder: string };

function parseFielding(howOut: string): Credit[] {
  const t = howOut.replace(/†/g, "").replace(/\s+/g, " ").trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^c&b (.+)$/i))) return [{ kind: "catch", fielder: m[1] }];
  if ((m = t.match(/^c (.+?) b .+$/i))) return [{ kind: "catch", fielder: m[1] }];
  if ((m = t.match(/^st (.+?) b .+$/i))) return [{ kind: "stumping", fielder: m[1] }];
  if ((m = t.match(/^run out (.+)$/i)))
    return m[1]
      .split("/")
      .map((f) => f.trim())
      .filter(Boolean)
      .map((fielder) => ({ kind: "runOut" as const, fielder }));
  return [];
}

/** Players who appeared for each side of each match, by cleaned name. */
const matchSides = new Map<string, Map<string, Map<string, string>>>();
for (const r of [...data.batting, ...data.bowling]) {
  const sides = matchSides.get(r.matchId) ?? new Map();
  const side = sides.get(r.team) ?? new Map<string, string>();
  const id = mergedId(r.playerId);
  side.set(cleanName(r.name).toLowerCase(), id);
  side.set(r.name.replace(/\((c|wk|c & wk)\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase(), id);
  sides.set(r.team, side);
  matchSides.set(r.matchId, sides);
}
const globalByName = new Map<string, string>();
for (const [id, n] of playerName) globalByName.set(n.toLowerCase(), id);

function resolveFielder(matchId: string, fieldingTeam: string, raw: string): string {
  const side = matchSides.get(matchId)?.get(fieldingTeam);
  const keys = [raw.replace(/\s+/g, " ").trim().toLowerCase(), cleanName(raw).toLowerCase()];
  for (const k of keys) {
    const id = side?.get(k) ?? globalByName.get(k);
    if (id) return id;
  }
  return `name:${cleanName(raw)}`;
}

// ─── Compute one scope ───────────────────────────────────────────────────────

function computeScope(key: ScopeKey, label: string, seasons: number[]): ScopeStats {
  const matches = data.matches
    .filter((m) => seasons.includes(m.season))
    .sort((a, b) => a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId));
  const ids = new Set(matches.map((m) => m.matchId));
  const innings = data.innings.filter((i) => ids.has(i.matchId));
  const batting = data.batting.filter((b) => ids.has(b.matchId));
  const bowling = data.bowling.filter((b) => ids.has(b.matchId));
  const inningsOf = (matchId: string, n: number) =>
    innings.find((i) => i.matchId === matchId && i.inning === n);
  const tenOver = (matchId: string) => (matchById.get(matchId)?.overs ?? 7) !== 7;

  // Standings — W = 2, T = 1, ordered by points % then NRR (the site's
  // points-table rule; teams don't always play the same number of games).
  const table = new Map<string, StandingRow & { rf: number; bf: number; ra: number; ba: number }>();
  const row = (team: string) => {
    const name = teamName(team);
    if (!table.has(name))
      table.set(name, { team: name, played: 0, won: 0, lost: 0, tied: 0, points: 0, pct: 0, nrr: 0, form: [], rf: 0, bf: 0, ra: 0, ba: 0 });
    return table.get(name)!;
  };
  for (const m of matches) {
    const a = row(m.teamA);
    const b = row(m.teamB);
    a.played++;
    b.played++;
    if (!m.winner) {
      a.tied++;
      b.tied++;
      a.points++;
      b.points++;
      a.form.push("T");
      b.form.push("T");
    } else {
      const w = teamName(m.winner) === a.team ? a : b;
      const l = w === a ? b : a;
      w.won++;
      w.points += 2;
      l.lost++;
      w.form.push("W");
      l.form.push("L");
    }
    for (const inn of innings.filter((i) => i.matchId === m.matchId)) {
      const bat = row(inn.team);
      const bowl = bat === a ? b : a;
      const balls = oversToBalls(inn.overs);
      bat.rf += inn.runs;
      bat.bf += balls;
      bowl.ra += inn.runs;
      bowl.ba += balls;
    }
  }
  const standings = [...table.values()]
    .map(({ rf, bf, ra, ba, ...r }) => ({
      ...r,
      pct: round((r.points / (r.played * 2)) * 100, 1),
      nrr: round(rf / (bf / 6) - ra / (ba / 6), 3),
    }))
    .sort((x, y) => y.pct - x.pct || y.nrr - x.nrr);

  // Appearances (batting or bowling row) per player, for the M column.
  const appearances = new Map<string, Set<string>>();
  const playerTeams = new Map<string, Set<string>>();
  for (const r of [...batting, ...bowling]) {
    const id = mergedId(r.playerId);
    (appearances.get(id) ?? appearances.set(id, new Set()).get(id)!).add(r.matchId);
    (playerTeams.get(id) ?? playerTeams.set(id, new Set()).get(id)!).add(teamName(r.team));
  }

  // Batting
  const bat = new Map<string, BattingRow & { hsRuns: number; hsNotOut: boolean; outs: number }>();
  for (const r of batting) {
    const id = mergedId(r.playerId);
    const p =
      bat.get(id) ??
      bat
        .set(id, {
          id,
          name: playerName.get(id)!,
          teams: [...(playerTeams.get(id) ?? [])],
          matches: appearances.get(id)?.size ?? 0,
          innings: 0,
          notOuts: 0,
          runs: 0,
          balls: 0,
          highest: "",
          average: null,
          strikeRate: 0,
          thirties: 0,
          fifties: 0,
          fours: 0,
          sixes: 0,
          ducks: 0,
          hsRuns: -1,
          hsNotOut: false,
          outs: 0,
        })
        .get(id)!;
    const notOut = isNotOut(r.howOut);
    p.innings++;
    p.runs += r.runs;
    p.balls += r.balls;
    p.fours += r.fours;
    p.sixes += r.sixes;
    if (notOut) p.notOuts++;
    else p.outs++;
    if (r.runs >= 50) p.fifties++;
    else if (r.runs >= 30) p.thirties++;
    if (r.runs === 0 && !notOut) p.ducks++;
    if (r.runs > p.hsRuns || (r.runs === p.hsRuns && notOut && !p.hsNotOut)) {
      p.hsRuns = r.runs;
      p.hsNotOut = notOut;
    }
  }
  const battingRows: BattingRow[] = [...bat.values()]
    .map(({ hsRuns, hsNotOut, outs, ...p }) => ({
      ...p,
      highest: `${hsRuns}${hsNotOut ? "*" : ""}`,
      average: outs ? round(p.runs / outs) : null,
      strikeRate: p.balls ? round((p.runs / p.balls) * 100) : 0,
    }))
    .sort(
      (a, b) =>
        b.runs - a.runs ||
        b.strikeRate - a.strikeRate ||
        (b.average ?? Infinity) - (a.average ?? Infinity),
    );

  // Bowling
  const bowl = new Map<string, BowlingRow & { bestW: number; bestR: number }>();
  for (const r of bowling) {
    const balls = oversToBalls(r.overs);
    if (!balls && !r.runs) continue; // listed but never bowled
    const id = mergedId(r.playerId);
    const p =
      bowl.get(id) ??
      bowl
        .set(id, {
          id,
          name: playerName.get(id)!,
          teams: [...(playerTeams.get(id) ?? [])],
          matches: appearances.get(id)?.size ?? 0,
          overs: "",
          balls: 0,
          maidens: 0,
          runs: 0,
          wickets: 0,
          economy: 0,
          average: null,
          best: "",
          threeFors: 0,
          dots: 0,
          dotPct: 0,
          wides: 0,
          noBalls: 0,
          bestW: -1,
          bestR: Infinity,
        })
        .get(id)!;
    p.balls += balls;
    p.maidens += r.maidens;
    p.runs += r.runs;
    p.wickets += r.wickets;
    p.dots += r.dots;
    p.wides += r.wides;
    p.noBalls += r.noBalls;
    if (r.wickets >= 3) p.threeFors++;
    if (r.wickets > p.bestW || (r.wickets === p.bestW && r.runs < p.bestR)) {
      p.bestW = r.wickets;
      p.bestR = r.runs;
    }
  }
  const bowlingRows: BowlingRow[] = [...bowl.values()]
    .map(({ bestW, bestR, ...p }) => ({
      ...p,
      overs: ballsToOvers(p.balls),
      economy: p.balls ? round(p.runs / (p.balls / 6)) : 0,
      average: p.wickets ? round(p.runs / p.wickets) : null,
      best: `${bestW}/${bestR}`,
      dotPct: p.balls ? round((p.dots / p.balls) * 100, 1) : 0,
    }))
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy || a.runs - b.runs);

  // Fielding — credited to the side bowling in that innings.
  const field = new Map<string, FieldingRow>();
  for (const r of batting) {
    const m = matchById.get(r.matchId)!;
    const fieldingTeam = r.team === m.teamA ? m.teamB : m.teamA;
    for (const c of parseFielding(r.howOut)) {
      const id = resolveFielder(r.matchId, fieldingTeam, c.fielder);
      const name = id.startsWith("name:") ? id.slice(5) : playerName.get(id)!;
      const f = field.get(id) ?? field.set(id, { id, name, catches: 0, stumpings: 0, runOuts: 0, total: 0 }).get(id)!;
      if (c.kind === "catch") f.catches++;
      else if (c.kind === "stumping") f.stumpings++;
      else f.runOuts++;
      f.total++;
    }
  }
  const fieldingRows = [...field.values()].sort(
    (a, b) => b.total - a.total || b.catches - a.catches || a.name.localeCompare(b.name),
  );

  // Records
  const vs = (matchId: string, team: string) => {
    const m = matchById.get(matchId)!;
    return teamName(team === m.teamA ? m.teamB : m.teamA);
  };
  const topScores: InningsRecord[] = [...batting]
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, 10)
    .map((r) => ({
      matchId: r.matchId,
      date: fmtDate(matchById.get(r.matchId)!.date),
      label: playerName.get(mergedId(r.playerId))!,
      value: `${r.runs}${isNotOut(r.howOut) ? "*" : ""} (${r.balls})`,
      sub: `${teamName(r.team)} v ${vs(r.matchId, r.team)} · ${r.fours}×4, ${r.sixes}×6`,
      tenOver: tenOver(r.matchId),
    }));
  const bestSpells: InningsRecord[] = [...bowling]
    .filter((r) => oversToBalls(r.overs) > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs || oversToBalls(a.overs) - oversToBalls(b.overs))
    .slice(0, 10)
    .map((r) => ({
      matchId: r.matchId,
      date: fmtDate(matchById.get(r.matchId)!.date),
      label: playerName.get(mergedId(r.playerId))!,
      value: `${r.wickets}/${r.runs}`,
      sub: `${r.overs} ov · ${teamName(r.team)} v ${vs(r.matchId, r.team)}`,
      tenOver: tenOver(r.matchId),
    }));
  const inningsRecord = (i: RawInnings): InningsRecord => ({
    matchId: i.matchId,
    date: fmtDate(matchById.get(i.matchId)!.date),
    label: teamName(i.team),
    value: `${i.runs}/${i.wickets}`,
    sub: `${i.overs} ov v ${vs(i.matchId, i.team)}${i.inning === 2 ? " (chasing)" : ""}`,
    tenOver: tenOver(i.matchId),
  });
  const highestTotals = [...innings].sort((a, b) => b.runs - a.runs).slice(0, 5).map(inningsRecord);
  // Lowest: first innings only — a chase that finished early isn't a low score.
  const lowestTotals = innings
    .filter((i) => i.inning === 1)
    .sort((a, b) => a.runs - b.runs)
    .slice(0, 5)
    .map(inningsRecord);
  const biggestWins: InningsRecord[] = matches
    .filter((m) => m.winner)
    .map((m) => {
      const [n, unit] = m.winBy.split(" ");
      // Runs margins and wicket margins don't compare; rank runs first, then
      // wickets by balls to spare.
      const first = inningsOf(m.matchId, 1)!;
      const second = inningsOf(m.matchId, 2)!;
      const spare = m.overs * 6 - oversToBalls(second.overs);
      return { m, runs: unit.startsWith("run") ? Number(n) : 0, wkts: unit.startsWith("wicket") ? Number(n) : 0, spare, first, second };
    })
    .sort((a, b) => b.runs - a.runs || b.wkts - a.wkts || b.spare - a.spare)
    .slice(0, 5)
    .map(({ m, spare, wkts }) => ({
      matchId: m.matchId,
      date: fmtDate(m.date),
      label: teamName(m.winner!),
      value: m.winBy,
      sub: `v ${teamName(m.winner === m.teamA ? m.teamB : m.teamA)}${wkts ? ` · ${spare} balls to spare` : ""}`,
      tenOver: tenOver(m.matchId),
    }));

  // Match cards, grouped by matchday
  const days = new Map<string, MatchCard[]>();
  for (const m of matches) {
    const lines = [1, 2]
      .map((n) => inningsOf(m.matchId, n))
      .filter((i): i is RawInnings => !!i)
      .map((i) => ({
        team: teamName(i.team),
        score: `${i.runs}/${i.wickets} (${i.overs})`,
        won: !!m.winner && i.team === m.winner,
      }));
    const card: MatchCard = {
      matchId: m.matchId,
      date: m.date,
      venue: m.venue,
      overs: m.overs,
      lines,
      result: m.winner ? `${teamName(m.winner)} won by ${m.winBy}` : "Match tied",
    };
    (days.get(m.date) ?? days.set(m.date, []).get(m.date)!).push(card);
  }
  const matchdays = [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, ms]) => ({ date, label: fmtDay(date), matches: ms }));

  const firstInnings = innings.filter((i) => i.inning === 1);
  let chasesWon = 0;
  let defendsWon = 0;
  for (const m of matches) {
    if (!m.winner) continue;
    if (inningsOf(m.matchId, 2)?.team === m.winner) chasesWon++;
    else defendsWon++;
  }

  return {
    key,
    label,
    summary: {
      matches: matches.length,
      matchdays: days.size,
      runs: innings.reduce((s, i) => s + i.runs, 0),
      wickets: innings.reduce((s, i) => s + i.wickets, 0),
      fours: batting.reduce((s, b) => s + b.fours, 0),
      sixes: batting.reduce((s, b) => s + b.sixes, 0),
      fifties: batting.filter((b) => b.runs >= 50).length,
      avgFirstInnings: round(firstInnings.reduce((s, i) => s + i.runs, 0) / (firstInnings.length || 1), 1),
      chasesWon,
      defendsWon,
    },
    standings,
    batting: battingRows,
    bowling: bowlingRows,
    fielding: fieldingRows,
    topScores,
    bestSpells,
    highestTotals,
    lowestTotals,
    biggestWins,
    matchdays,
  };
}

export function computeScorecardDashboard(): ScopeStats[] {
  return SCOPES.map((s) => computeScope(s.key, s.label, s.seasons));
}


// ─── Player cards ────────────────────────────────────────────────────────────
// Row-level data for the player flash cards. Identity is resolved here, with
// the same rules as the tables above, so a row click opens the same person.
// The cards compute their own stats from this in the browser (profile.ts).

const KIND_OF: [RegExp, CardKind][] = [
  [/^c&b /i, "cb"],
  [/^c .+? b /i, "c"],
  [/^st .+? b /i, "st"],
  [/^lbw /i, "lbw"],
  [/^b /i, "b"],
  [/^run out/i, "ro"],
  [/^hit wicket/i, "hw"],
  [/^retired/i, "rt"],
];

export function buildCardData(): CardData {
  const ids = [...playerName.keys()].sort((a, b) => playerName.get(a)!.localeCompare(playerName.get(b)!));
  const index = new Map(ids.map((id, i) => [id, i]));
  const names = ids.map((id) => playerName.get(id)!);
  const indexOf = (id: string) => {
    if (!index.has(id)) {
      index.set(id, ids.length);
      ids.push(id);
      names.push(id.startsWith("name:") ? id.slice(5) : id);
    }
    return index.get(id)!;
  };

  const matches = [...data.matches].sort((a, b) => a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId));
  const mIndex = new Map(matches.map((m, i) => [m.matchId, i]));

  // A dismissal names the bowler as typed ("b Ankit"), so look the name up
  // among the bowlers of that innings first. That is how the two Ankits stay
  // apart: only one of them bowled in any given innings.
  const bowlersIn = new Map<string, Map<string, string>>();
  for (const r of data.bowling) {
    const k = `${r.matchId}:${r.inning}`;
    const m = bowlersIn.get(k) ?? bowlersIn.set(k, new Map()).get(k)!;
    const id = mergedId(r.playerId);
    m.set(r.name.replace(/\((c|wk|c & wk)\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase(), id);
    m.set(cleanName(r.name).toLowerCase(), id);
  }
  const resolveBowler = (matchId: string, inning: number, fieldingTeam: string, raw: string) => {
    const m = bowlersIn.get(`${matchId}:${inning}`);
    const keys = [raw.replace(/\s+/g, " ").trim().toLowerCase(), cleanName(raw).toLowerCase()];
    for (const k of keys) if (m?.has(k)) return m.get(k)!;
    return resolveFielder(matchId, fieldingTeam, raw);
  };

  const fow = new Map(data.fallOfWickets.map((f) => [`${f.matchId}:${f.inning}:${mergedId(f.playerId)}`, f]));
  const order = new Map<string, string[]>();
  for (const r of data.batting) {
    const k = `${r.matchId}:${r.inning}`;
    (order.get(k) ?? order.set(k, []).get(k)!).push(mergedId(r.playerId));
  }

  const bat: CardData["bat"] = data.batting.map((r) => {
    const m = matchById.get(r.matchId)!;
    const fieldingTeam = r.team === m.teamA ? m.teamB : m.teamA;
    const how = r.howOut.replace(/\s+/g, " ").trim();
    const plain = how.replace(/†/g, "");
    const kind: CardKind = isNotOut(how) ? "no" : (KIND_OF.find(([re]) => re.test(plain))?.[1] ?? "ot");
    let bowler = -1;
    const bm = plain.match(/(?:^c&b |\bb )(.+)$/i);
    if (bm && kind !== "ro") bowler = indexOf(resolveBowler(r.matchId, r.inning, fieldingTeam, bm[1]));
    const fielders = parseFielding(how).map((c) => indexOf(resolveFielder(r.matchId, fieldingTeam, c.fielder)));
    const keeper = (kind === "c" || kind === "st") && /^(c|st) †/.test(how) ? 1 : 0;
    const id = mergedId(r.playerId);
    const f = fow.get(`${r.matchId}:${r.inning}:${id}`);
    return [
      mIndex.get(r.matchId)!, r.inning, indexOf(id), teamName(r.team), teamName(fieldingTeam),
      r.runs, r.balls, r.fours, r.sixes, kind, bowler, fielders, keeper,
      order.get(`${r.matchId}:${r.inning}`)!.indexOf(id) + 1,
      f ? [f.wicket, f.score, f.over] : null,
      displayHowOut(how),
    ];
  });

  const bowl: CardData["bowl"] = data.bowling
    .filter((r) => oversToBalls(r.overs) > 0 || r.runs > 0)
    .map((r) => {
      const m = matchById.get(r.matchId)!;
      return [
        mIndex.get(r.matchId)!, r.inning, indexOf(mergedId(r.playerId)), teamName(r.team),
        teamName(r.team === m.teamA ? m.teamB : m.teamA),
        oversToBalls(r.overs), r.maidens, r.runs, r.wickets, r.dots, r.wides, r.noBalls,
      ];
    });

  // Attendance: every name on a scorecard marks that player present for his
  // side, whether he batted, bowled (even a row with 0 balls), or was named
  // in a dismissal as bowler or fielder.
  const seen = new Set<string>();
  const present: CardData["present"] = [];
  const mark = (m: number, p: number, team: string) => {
    const k = `${m}:${p}`;
    if (p < 0 || seen.has(k)) return;
    seen.add(k);
    present.push([m, p, team]);
  };
  for (const r of bat) {
    mark(r[0], r[2], r[3]);
    mark(r[0], r[10], r[4]);
    for (const f of r[11]) mark(r[0], f, r[4]);
  }
  for (const r of data.bowling) mark(mIndex.get(r.matchId)!, indexOf(mergedId(r.playerId)), teamName(r.team));

  return {
    players: names,
    playerIds: ids,
    matches: matches.map((m) => ({
      id: m.matchId,
      season: m.season,
      date: m.date,
      venue: m.venue,
      overs: m.overs,
      teamA: teamName(m.teamA),
      teamB: teamName(m.teamB),
      winner: m.winner ? teamName(m.winner) : null,
      winBy: m.winBy,
    })),
    innings: data.innings.map((i) => [mIndex.get(i.matchId)!, i.inning, teamName(i.team), i.runs, i.wickets, oversToBalls(i.overs), i.extras]),
    bat,
    bowl,
    present,
  };
}
