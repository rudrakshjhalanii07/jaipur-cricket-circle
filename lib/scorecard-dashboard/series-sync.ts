// Converts the CricHeroes matches behind /stats-preview into scorecards for the
// series tables, so /seasons (which reads the database) can catch up with them.
//
// Pure — no I/O. app/api/series/sync-dashboard decides which seeded fixture
// each match fills and does the writing; this only builds the payload the
// save_series_match RPC takes (the same shape /api/series/save accepts).
//
// What the export does not carry, and so stays empty: toss, player of the
// match, and the byes/leg-byes split. Extras beyond the bowlers' wides and
// no-balls are filed as byes.

import { canonicalNamesInText } from "@/lib/player-names";
import type { TeamId } from "@/lib/teams";
import type { DismissalType } from "@/lib/series";
import {
  dashboardData as data,
  dashboardNameInText,
  dashboardPlayerName,
  type RawBatting,
  type RawMatch,
} from "./compute";

/** CricHeroes team name → TeamId. */
const TEAM_ID: Record<string, TeamId> = {
  "Neuro strikers": "neurostrikers",
  VIKINGS: "vikings",
  Mavericks: "mavericks",
  Outliers: "outliers",
};

export interface SyncInnings {
  innings_no: 1 | 2;
  batting_team_id: TeamId;
  bowling_team_id: TeamId;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  all_out: boolean;
  extras_wides: number;
  extras_no_balls: number;
  extras_byes: number;
  extras_leg_byes: number;
  fall_of_wickets: Array<{ wkt: number; score: number; overs: string; player: string }>;
  batting: Array<{
    batting_order: number;
    player_name: string;
    runs: number;
    balls_faced: number | null;
    fours: number;
    sixes: number;
    dismissal_type: DismissalType;
    dismissed_by: string | null;
    caught_by: string | null;
  }>;
  bowling: Array<{
    bowling_order: number;
    player_name: string;
    overs: number;
    maidens: number;
    runs_conceded: number;
    wickets: number;
    wides: number;
    no_balls: number;
  }>;
}

export interface DashboardMatch {
  /** CricHeroes match ID. */
  source_id: string;
  season: number;
  date: string;
  /** Batting first / batting second, as played. */
  team1_id: TeamId;
  team2_id: TeamId;
  winner_id: TeamId | null;
  margin_type: "runs" | "wickets" | null;
  margin_value: number | null;
  is_tie: boolean;
  team1_captain: string | null;
  team2_captain: string | null;
  innings: SyncInnings[];
  /** Dismissal strings the parser didn't recognise — saved as not out. */
  warnings: string[];
}

const isCaptain = (raw: string) => /\((c|c & wk)\)/i.test(raw);

/** "c †Nitesh b Siddharth Rao" → the series tables' dismissal columns. */
function parseDismissal(
  howOut: string,
  matchId: string,
  fieldingTeam: string,
): { type: DismissalType; bowler: string | null; fielders: string | null } | null {
  const t = howOut.replace(/†/g, "").replace(/\s+/g, " ").trim();
  const name = (raw: string) => dashboardNameInText(matchId, fieldingTeam, raw.trim());
  const names = (raw: string) =>
    canonicalNamesInText(
      raw
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(name)
        .join(" / "),
    );
  let m: RegExpMatchArray | null;
  if (/^not out$/i.test(t)) return { type: "not_out", bowler: null, fielders: null };
  if (/^retired/i.test(t)) return { type: "retired_hurt", bowler: null, fielders: null };
  if ((m = t.match(/^c ?& ?b (.+)$/i))) {
    const b = name(m[1]);
    return { type: "caught", bowler: b, fielders: b };
  }
  if ((m = t.match(/^c (.+?) b (.+)$/i))) return { type: "caught", bowler: name(m[2]), fielders: names(m[1]) };
  if ((m = t.match(/^st (.+?) b (.+)$/i))) return { type: "stumped", bowler: name(m[2]), fielders: names(m[1]) };
  if ((m = t.match(/^lbw b (.+)$/i))) return { type: "lbw", bowler: name(m[1]), fielders: null };
  if ((m = t.match(/^hit wicket b (.+)$/i))) return { type: "hit_wicket", bowler: name(m[1]), fielders: null };
  if ((m = t.match(/^b (.+)$/i))) return { type: "bowled", bowler: name(m[1]), fielders: null };
  // Fielders go in caught_by, the column fielding credit reads first.
  if ((m = t.match(/^run out (.+)$/i))) return { type: "run_out", bowler: null, fielders: names(m[1]) };
  return null;
}

/** "5 wickets" / "20 runs" → margin. */
function parseMargin(winBy: string): { type: "runs" | "wickets"; value: number } | null {
  const m = winBy.trim().match(/^(\d+)\s+(run|wicket)s?$/i);
  return m ? { type: m[2].toLowerCase() === "run" ? "runs" : "wickets", value: Number(m[1]) } : null;
}

function buildMatch(match: RawMatch): DashboardMatch {
  const id = match.matchId;
  const warnings: string[] = [];
  const inns = data.innings.filter((i) => i.matchId === id).sort((a, b) => a.inning - b.inning);
  const bat = data.batting.filter((b) => b.matchId === id);
  const bowl = data.bowling.filter((b) => b.matchId === id);
  const fow = data.fallOfWickets.filter((f) => f.matchId === id);

  const nameOf = (r: { playerId: string; name: string }) => dashboardPlayerName(r.playerId, r.name);
  const nameById = new Map([...bat, ...bowl].map((r) => [r.playerId, nameOf(r)]));

  const captains = new Map<string, string>();
  for (const b of bat) if (isCaptain(b.name)) captains.set(b.team, nameOf(b));

  const innings: SyncInnings[] = inns.map((inn) => {
    const battingTeam = inn.team;
    const bowlingTeam = inns.find((o) => o.team !== battingTeam)?.team ?? "";
    const batters = bat.filter((b) => b.inning === inn.inning);
    const bowlers = bowl.filter((b) => b.inning === inn.inning);

    const batting: SyncInnings["batting"] = batters.map((b: RawBatting, i) => {
      const d = parseDismissal(b.howOut, id, bowlingTeam);
      if (!d) warnings.push(`${nameOf(b)}: "${b.howOut}"`);
      return {
        batting_order: i + 1,
        player_name: nameOf(b),
        runs: b.runs,
        balls_faced: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        dismissal_type: d?.type ?? "not_out",
        dismissed_by: d?.bowler ?? null,
        caught_by: d?.fielders ?? null,
      };
    });

    // The batting array is the squad list (lib/match-template.ts): anyone who
    // only bowled for this side in the other innings didn't bat in this one.
    const listed = new Set(batting.map((b) => b.player_name));
    for (const b of bowl.filter((r) => r.team === battingTeam)) {
      const n = nameOf(b);
      if (listed.has(n)) continue;
      listed.add(n);
      batting.push({
        batting_order: batting.length + 1,
        player_name: n,
        runs: 0,
        balls_faced: null,
        fours: 0,
        sixes: 0,
        dismissal_type: "did_not_bat",
        dismissed_by: null,
        caught_by: null,
      });
    }

    const wides = bowlers.reduce((s, b) => s + b.wides, 0);
    const noBalls = bowlers.reduce((s, b) => s + b.noBalls, 0);
    return {
      innings_no: inn.inning as 1 | 2,
      batting_team_id: TEAM_ID[battingTeam],
      bowling_team_id: TEAM_ID[bowlingTeam],
      total_runs: inn.runs,
      total_wickets: inn.wickets,
      total_overs: Number(inn.overs),
      // Every batter but the last one standing is out.
      all_out: inn.wickets > 0 && inn.wickets >= listed.size - 1,
      extras_wides: wides,
      extras_no_balls: noBalls,
      extras_byes: Math.max(0, inn.extras - wides - noBalls),
      extras_leg_byes: 0,
      fall_of_wickets: fow
        // An innings with no wickets carries one blank placeholder row.
        .filter((f) => f.inning === inn.inning && f.wicket > 0 && f.over)
        .sort((a, b) => a.wicket - b.wicket)
        .map((f) => ({ wkt: f.wicket, score: f.score, overs: f.over, player: nameById.get(f.playerId) ?? "" })),
      batting,
      bowling: bowlers.map((b, i) => ({
        bowling_order: i + 1,
        player_name: nameOf(b),
        overs: Number(b.overs),
        maidens: b.maidens,
        runs_conceded: b.runs,
        wickets: b.wickets,
        wides: b.wides,
        no_balls: b.noBalls,
      })),
    };
  });

  const t1 = inns[0]?.team ?? match.teamA;
  const t2 = inns[1]?.team ?? match.teamB;
  const isTie = match.result === "tie";
  const margin = isTie ? null : parseMargin(match.winBy);
  return {
    source_id: id,
    season: match.season,
    date: match.date,
    team1_id: TEAM_ID[t1],
    team2_id: TEAM_ID[t2],
    winner_id: !isTie && match.winner ? TEAM_ID[match.winner] : null,
    margin_type: margin?.type ?? null,
    margin_value: margin?.value ?? null,
    is_tie: isTie,
    team1_captain: captains.get(t1) ?? null,
    team2_captain: captains.get(t2) ?? null,
    innings,
    warnings,
  };
}

/** Every dashboard match of one season, oldest first. */
export function buildDashboardMatches(season: number): DashboardMatch[] {
  return data.matches
    .filter((m) => m.season === season)
    .sort((a, b) => a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId))
    .map(buildMatch);
}
