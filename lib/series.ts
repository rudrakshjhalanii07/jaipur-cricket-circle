import { supabase } from "./supabase";
import type { TeamId } from "./teams";
import { computeMVP, parseFielders, runOutFielders } from "./mvp";
import type { MVPRow } from "./mvp";
import {
  ballsToOvers,
  matchesStageFilter,
  oversToDecimal,
} from "./cricket-format";
import type { MatchStage, StageFilter } from "./cricket-format";

// Re-exported so the many callers that import these from "@/lib/series" keep
// working; lib/cricket-format.ts is where they actually live now.
export type { MVPRow } from "./mvp";
export {
  PLAYOFF_STAGES,
  isPlayoffStage,
  matchesStageFilter,
  oversToDecimal,
} from "./cricket-format";
export type { MatchStage, StageFilter } from "./cricket-format";

// ── Types ──────────────────────────────────────────────────────────────────────

// Aliased to TeamId so lib/teams.ts stays the single source of truth: adding a
// team there is enough, and every standings/leaderboard function below picks it
// up automatically (they derive teams from match rows, never from a fixed list).
export type SeriesTeamId = TeamId;

export type DismissalType =
  | "bowled" | "caught" | "lbw" | "run_out" | "stumped"
  | "hit_wicket" | "retired_hurt" | "not_out" | "did_not_bat";

export interface FallOfWicket {
  wkt: number;
  score: number;
  overs: string;
  player: string;
}

export interface SeriesArticle {
  title: string;
  url: string;
}

export interface Series {
  id: string;
  name: string;
  series_no: number;
  week_no: number | null;   // schedule week this series belongs to, when seeded
  season_id: string | null;
  overs_per_innings: number;
  venue: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: "upcoming" | "in_progress" | "completed";
  notes: string | null;
  articles: SeriesArticle[];
  created_at: string;
  updated_at: string;
}

export interface SeriesMatch {
  id: string;
  series_id: string;
  match_no: number;
  stage: MatchStage;
  match_date: string | null;
  venue: string | null;
  // Null on an unresolved bracket fixture — a qualifier seeded before the
  // league table settles knows its seed, not yet its team.
  team1_id: SeriesTeamId | null;
  team2_id: SeriesTeamId | null;
  team1_seed: number | null;           // 1-indexed league position
  team2_seed: number | null;
  team1_from_match_no: number | null;  // "winner of match N", chains the bracket
  team2_from_match_no: number | null;
  toss_winner_id: SeriesTeamId | null;
  toss_decision: "bat" | "bowl" | null;
  team1_captain: string | null;
  team2_captain: string | null;
  winner_id: SeriesTeamId | null;
  margin_type: "runs" | "wickets" | null;
  margin_value: number | null;
  is_tie: boolean;
  super_over: Record<string, unknown> | null;
  player_of_match: string | null;
  match_notes: string | null;
  ai_analysis: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeriesInnings {
  id: string;
  match_id: string;
  innings_no: 1 | 2;
  batting_team_id: SeriesTeamId;
  bowling_team_id: SeriesTeamId;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  all_out: boolean;
  extras_wides: number;
  extras_no_balls: number;
  extras_byes: number;
  extras_leg_byes: number;
  fall_of_wickets: FallOfWicket[];
  created_at: string;
}

export interface BattingPerf {
  id: string;
  innings_id: string;
  team_id: SeriesTeamId;
  player_name: string;
  player_id: string | null;
  batting_order: number;
  runs: number;
  balls_faced: number | null;
  fours: number;
  sixes: number;
  dismissal_type: DismissalType | null;
  dismissed_by: string | null;
  caught_by: string | null;
  created_at: string;
}

export interface BowlingPerf {
  id: string;
  innings_id: string;
  team_id: SeriesTeamId;
  player_name: string;
  player_id: string | null;
  bowling_order: number;
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
  created_at: string;
}

// Full match with nested innings + performances
export interface FullSeriesMatch extends SeriesMatch {
  innings: Array<SeriesInnings & {
    batting: BattingPerf[];
    bowling: BowlingPerf[];
  }>;
}

export interface FullSeries extends Series {
  matches: FullSeriesMatch[];
}

// ── Leaderboard types ──────────────────────────────────────────────────────────

export interface BattingLeaderRow {
  player_name: string;
  team_id: SeriesTeamId;
  matches: number;
  innings: number;
  total_runs: number;
  high_score: number;
  fours: number;
  sixes: number;
  outs: number;                    // dismissals (not-outs excluded), for ICC average
  balls_faced: number;
  strike_rate: number | null;      // runs / balls × 100; null when no balls recorded
  batting_average: number | null;  // runs / outs; null when never dismissed
  batting_score: number;  // 0-100 normalized rank
}

export interface BowlingLeaderRow {
  player_name: string;
  team_id: SeriesTeamId;
  matches: number;
  innings: number;
  total_wickets: number;
  total_overs: number;
  runs_conceded: number;
  economy: number;
  bowling_average: number | null;  // runs conceded / wickets; null when no wickets
  bowling_score: number;  // 0-100 normalized rank
}

export interface FieldingRow {
  player_name: string;
  team_id?: SeriesTeamId;
  catches: number;
  stumpings: number;
  /**
   * Run outs, split evenly between the fielders named. A direct hit is one
   * name in `caught_by` and scores a full 1; a throw-and-receive names two and
   * each takes 0.5, because there is no honest way to say whose half was
   * harder. Unrounded — format at the point of display.
   */
  run_outs: number;
  /** catches + stumpings + run_outs — what the board ranks on. Unrounded. */
  dismissals: number;
}

// ── Fetch functions ────────────────────────────────────────────────────────────

export async function fetchAllSeries(): Promise<Series[]> {
  try {
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .order("series_no", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Series[];
  } catch {
    return [];
  }
}

/** The fixture rows of one series — seeded schedule entries, played or not. */
export async function fetchSeriesMatches(seriesId: string): Promise<SeriesMatch[]> {
  try {
    const { data, error } = await supabase
      .from("series_matches")
      .select("*")
      .eq("series_id", seriesId)
      .order("match_no", { ascending: true });
    if (error) throw error;
    return (data ?? []) as SeriesMatch[];
  } catch {
    return [];
  }
}

export async function fetchFullSeries(): Promise<FullSeries[]> {
  try {
    const { data, error } = await supabase
      .from("series")
      .select(`
        *,
        series_matches (
          *,
          series_innings (
            *,
            series_batting ( * ),
            series_bowling ( * )
          )
        )
      `)
      .order("series_no", { ascending: true });

    if (error || !data) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((s) => ({
      ...s,
      matches: ((s.series_matches ?? []) as any[])
        .sort((a, b) => a.match_no - b.match_no)
        .map((m) => ({
          ...m,
          innings: ((m.series_innings ?? []) as any[])
            .sort((a, b) => a.innings_no - b.innings_no)
            .map((inn) => ({
              ...inn,
              batting: ((inn.series_batting ?? []) as any[]).sort((a, b) => a.batting_order - b.batting_order),
              bowling: ((inn.series_bowling ?? []) as any[]).sort((a, b) => a.bowling_order - b.bowling_order),
            })),
        })),
    })) as FullSeries[];
  } catch {
    return [];
  }
}

// ── Stats computation (pure, no I/O) ──────────────────────────────────────────

export function computeLeaderboards(series: FullSeries[], stageFilter?: StageFilter): {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  mvp: MVPRow[];
  fielding: FieldingRow[];
} {
  // A batter counts as dismissed (for ICC average) for any mode of out;
  // not-out / retired-hurt / did-not-bat do NOT count as a dismissal.
  const DISMISSED = new Set(["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"]);
  const battingMap = new Map<string, { runs: number; balls: number; innings: number; outs: number; high: number; fours: number; sixes: number; team: SeriesTeamId }>();
  const bowlingMap = new Map<string, { wickets: number; balls: number; runs: number; innings: number; team: SeriesTeamId }>();
  type FieldAcc = { catches: number; stumpings: number; runOuts: number; team?: SeriesTeamId };
  const fieldMap = new Map<string, FieldAcc>();
  const field = (name: string, team: SeriesTeamId): FieldAcc => {
    let cur = fieldMap.get(name);
    if (!cur) {
      cur = { catches: 0, stumpings: 0, runOuts: 0, team };
      fieldMap.set(name, cur);
    }
    return cur;
  };
  // Total matches a player appeared in (batted OR bowled) — for the "M" column.
  const playerMatchSet = new Map<string, Set<string>>();
  const touchMatch = (key: string, id: string) => {
    if (!playerMatchSet.has(key)) playerMatchSet.set(key, new Set());
    playerMatchSet.get(key)!.add(id);
  };

  for (const s of series) {
    for (const m of s.matches) {
      if (!matchesStageFilter(m.stage, stageFilter)) continue;
      for (const inn of m.innings) {
        for (const b of inn.batting) {
          const key = b.player_name;
          // The batting array IS the squad list: lib/match-template.ts requires
          // every squad member to appear in it, non-batters carrying
          // dismissal_type "did_not_bat". So this one loop credits an
          // appearance to everyone who was there, not just those who batted.
          touchMatch(key, m.id);
          // …but did-not-bat does NOT count as a batting innings / stats.
          if (b.dismissal_type === "did_not_bat") continue;
          const cur = battingMap.get(key) ?? { runs: 0, balls: 0, innings: 0, outs: 0, high: 0, fours: 0, sixes: 0, team: b.team_id };
          battingMap.set(key, {
            runs: cur.runs + b.runs,
            balls: cur.balls + (b.balls_faced ?? 0),
            innings: cur.innings + 1,
            outs: cur.outs + (b.dismissal_type && DISMISSED.has(b.dismissal_type) ? 1 : 0),
            high: Math.max(cur.high, b.runs),
            fours: cur.fours + (b.fours ?? 0),
            sixes: cur.sixes + (b.sixes ?? 0),
            team: b.team_id,
          });
          // Fielding credit. The fielder is always on the side that was
          // bowling. Names are free text: one, or two slash-joined when a run
          // out took a throw and a receive (see parseFielders).
          if (b.dismissal_type === "caught" && b.caught_by) {
            for (const f of parseFielders(b.caught_by)) field(f, inn.bowling_team_id).catches += 1;
          } else if (b.dismissal_type === "stumped" && b.caught_by) {
            for (const f of parseFielders(b.caught_by)) field(f, inn.bowling_team_id).stumpings += 1;
          } else if (b.dismissal_type === "run_out") {
            // runOutFielders, not caught_by — most run outs on record named
            // their fielders in dismissed_by instead.
            const fielders = runOutFielders(b);
            const share = 1 / fielders.length;
            for (const f of fielders) field(f, inn.bowling_team_id).runOuts += share;
          }
        }
        for (const bw of inn.bowling) {
          const key = bw.player_name;
          touchMatch(key, m.id);
          const cur = bowlingMap.get(key) ?? { wickets: 0, balls: 0, runs: 0, innings: 0, team: bw.team_id };
          bowlingMap.set(key, {
            wickets: cur.wickets + bw.wickets,
            balls: cur.balls + Math.round(oversToDecimal(bw.overs) * 6),
            innings: cur.innings + 1,
            runs: cur.runs + bw.runs_conceded,
            team: bw.team_id,
          });
        }
      }
    }
  }

  // Build raw batting list — most runs first; IPL Orange Cap tie-break: higher
  // strike rate, then higher average (runs per dismissal), then the name so the
  // order is stable. The name also covers two players who never got out, where
  // avgOf is Infinity on both sides and the subtraction is NaN.
  const srOf = (p: { runs: number; balls: number }) => (p.balls > 0 ? p.runs / p.balls : 0);
  const avgOf = (p: { runs: number; outs: number }) => (p.outs > 0 ? p.runs / p.outs : Infinity);
  const rawBatting = Array.from(battingMap.entries())
    .map(([name, v]) => ({ player_name: name, ...v }))
    .sort(
      (a, b) =>
        b.runs - a.runs ||
        srOf(b) - srOf(a) ||
        avgOf(b) - avgOf(a) ||
        a.player_name.localeCompare(b.player_name),
    );

  // Build raw bowling list — most wickets first; IPL Purple Cap tie-break:
  // better (lower) economy, then fewer runs conceded, then the name. As above,
  // the name also covers econOf being Infinity on both sides.
  const econOf = (p: { balls: number; runs: number }) => (p.balls > 0 ? p.runs / (p.balls / 6) : Infinity);
  const rawBowling = Array.from(bowlingMap.entries())
    .map(([name, v]) => ({ player_name: name, ...v }))
    .sort(
      (a, b) =>
        b.wickets - a.wickets ||
        econOf(a) - econOf(b) ||
        a.runs - b.runs ||
        a.player_name.localeCompare(b.player_name),
    );

  const n = Math.max(rawBatting.length, 1);
  const m = Math.max(rawBowling.length, 1);

  // Normalized score: top player = 100, last = 0
  const battingRows: BattingLeaderRow[] = rawBatting.map((p, i) => ({
    player_name: p.player_name,
    team_id: p.team,
    matches: playerMatchSet.get(p.player_name)?.size ?? p.innings,
    innings: p.innings,
    total_runs: p.runs,
    high_score: p.high,
    fours: p.fours,
    sixes: p.sixes,
    outs: p.outs,
    balls_faced: p.balls,
    strike_rate: p.balls > 0 ? Math.round((p.runs / p.balls) * 10000) / 100 : null,
    batting_average: p.outs > 0 ? Math.round((p.runs / p.outs) * 100) / 100 : null,
    batting_score: n === 1 ? 100 : Math.round(((n - 1 - i) / (n - 1)) * 100),
  }));

  const bowlingRows: BowlingLeaderRow[] = rawBowling.map((p, i) => ({
    player_name: p.player_name,
    team_id: p.team,
    matches: playerMatchSet.get(p.player_name)?.size ?? 0,
    innings: p.innings,
    total_wickets: p.wickets,
    total_overs: ballsToOvers(p.balls),
    runs_conceded: p.runs,
    economy: p.balls > 0 ? Math.round((p.runs / (p.balls / 6)) * 10) / 10 : 0,
    bowling_average: p.wickets > 0 ? Math.round((p.runs / p.wickets) * 100) / 100 : null,
    bowling_score: m === 1 ? 100 : Math.round(((m - 1 - i) / (m - 1)) * 100),
  }));

  // MVP — bat, ball and field on one scale. See lib/mvp.ts for the pricing.
  const mvp = computeMVP(series, stageFilter);

  // Fielding. Ranked on total dismissals; ties go to the harder skill first,
  // run outs over stumpings over catches, then alphabetically so two players
  // level on all three don't swap places between renders.
  //
  // The shares stay unrounded here. A run out split three ways is 0.333 each,
  // and rounding it to 0.3 before the sort would make three of those tie with
  // a player on a clean 0.9 — the formatting belongs at the point of display.
  const fielding: FieldingRow[] = Array.from(fieldMap.entries())
    .map(([name, v]) => ({
      player_name: name,
      team_id: v.team,
      catches: v.catches,
      stumpings: v.stumpings,
      run_outs: v.runOuts,
      dismissals: v.catches + v.stumpings + v.runOuts,
    }))
    .filter((r) => r.dismissals > 0)
    .sort(
      (a, b) =>
        b.dismissals - a.dismissals ||
        b.run_outs - a.run_outs ||
        b.stumpings - a.stumpings ||
        a.player_name.localeCompare(b.player_name),
    );

  return { batting: battingRows, bowling: bowlingRows, mvp, fielding };
}

// ── Series standings (points table) ───────────────────────────────────────────

export interface SeriesStandingRow {
  team_id: SeriesTeamId;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  nrr: number;      // net run rate; 0 when no innings data available
}

// IPL ranking order: points first, then net run rate, then wins as a final
// separator. NRR is only meaningful once computeSeriesNRR has been applied, so
// computeSeriesStandings sorts on points alone and computeOverallStandings
// re-sorts through here after attaching it.
export function sortStandings(rows: SeriesStandingRow[]): SeriesStandingRow[] {
  return rows.sort(
    (a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won,
  );
}

export function computeSeriesStandings(
  matches: SeriesMatch[],
  stage?: StageFilter
): SeriesStandingRow[] {
  const map = new Map<SeriesTeamId, SeriesStandingRow>();

  const ensure = (id: SeriesTeamId): SeriesStandingRow => {
    if (!map.has(id)) {
      map.set(id, { team_id: id, played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0 });
    }
    return map.get(id)!;
  };

  for (const m of matches) {
    if (!matchesStageFilter(m.stage, stage)) continue;
    if (!m.winner_id && !m.is_tie) continue;
    // Unresolved bracket fixture — seeded but not yet assigned a team.
    if (!m.team1_id || !m.team2_id) continue;

    const t1 = ensure(m.team1_id);
    const t2 = ensure(m.team2_id);
    t1.played++;
    t2.played++;

    if (m.is_tie && !m.winner_id) {
      t1.tied++; t1.points++;
      t2.tied++; t2.points++;
    } else if (m.winner_id) {
      const winner = ensure(m.winner_id);
      const loser_id = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
      const loser = ensure(loser_id);
      winner.won++; winner.points += 2;
      loser.lost++;
    }
  }

  // NRR is still zero here; computeOverallStandings re-sorts once it's attached.
  return sortStandings(Array.from(map.values()));
}


// Compute NRR per team from innings data. Only matches with both innings recorded
// are included; unrecorded matches contribute NRR = 0.
export function computeSeriesNRR(
  fullSeries: FullSeries[],
  stage?: StageFilter,
): Map<SeriesTeamId, number> {
  type Acc = { runsScored: number; oversConsumed: number; runsConceded: number; oversBowled: number };
  const acc = new Map<SeriesTeamId, Acc>();
  const ensure = (id: SeriesTeamId): Acc => {
    if (!acc.has(id)) acc.set(id, { runsScored: 0, oversConsumed: 0, runsConceded: 0, oversBowled: 0 });
    return acc.get(id)!;
  };

  for (const s of fullSeries) {
    const overs = s.overs_per_innings;
    for (const m of s.matches) {
      if (!matchesStageFilter(m.stage, stage)) continue;
      if (!m.winner_id && !m.is_tie) continue;
      if (!m.innings || m.innings.length < 2) continue;
      const inn1 = m.innings.find((i) => i.innings_no === 1);
      const inn2 = m.innings.find((i) => i.innings_no === 2);
      if (!inn1 || !inn2) continue;

      const o1 = inn1.all_out ? overs : oversToDecimal(inn1.total_overs);
      const o2 = inn2.all_out ? overs : oversToDecimal(inn2.total_overs);

      const t1 = ensure(inn1.batting_team_id);
      t1.runsScored += inn1.total_runs;
      t1.oversConsumed += o1;
      t1.runsConceded += inn2.total_runs;
      t1.oversBowled += o2;

      const t2 = ensure(inn2.batting_team_id);
      t2.runsScored += inn2.total_runs;
      t2.oversConsumed += o2;
      t2.runsConceded += inn1.total_runs;
      t2.oversBowled += o1;
    }
  }

  const result = new Map<SeriesTeamId, number>();
  for (const [id, a] of acc) {
    result.set(
      id,
      a.oversConsumed > 0 && a.oversBowled > 0
        ? a.runsScored / a.oversConsumed - a.runsConceded / a.oversBowled
        : 0,
    );
  }
  return result;
}

export function computeOverallStandings(series: FullSeries[]): SeriesStandingRow[] {
  // League matches only — playoff games never count toward the points table.
  const rows = computeSeriesStandings(series.flatMap((s) => s.matches as SeriesMatch[]), "league");
  const nrrMap = computeSeriesNRR(series, "league");
  for (const r of rows) r.nrr = nrrMap.get(r.team_id) ?? 0;
  // Re-sort now that NRR is populated — it's the tiebreaker on level points.
  return sortStandings(rows);
}

export interface PlayerPoolRow {
  name: string;
  matches: number;
  teams: SeriesTeamId[];
}

// Every player who appeared in a recorded scorecard of the given series, with
// the teams he turned out for. The batting array doubles as the squad list —
// lib/match-template.ts requires non-batters to be listed with
// dismissal_type "did_not_bat" — so this counts everyone who was there.
// Sorted alphabetically by name.
export function computePlayersPool(series: FullSeries[]): PlayerPoolRow[] {
  const matchSet = new Map<string, Set<string>>();
  const teamSet = new Map<string, Set<SeriesTeamId>>();

  const touch = (name: string | null | undefined, matchId: string, team?: SeriesTeamId | null) => {
    const key = name?.trim();
    if (!key) return;
    if (!matchSet.has(key)) matchSet.set(key, new Set());
    matchSet.get(key)!.add(matchId);
    if (team) {
      if (!teamSet.has(key)) teamSet.set(key, new Set());
      teamSet.get(key)!.add(team);
    }
  };

  for (const s of series) {
    for (const m of s.matches) {
      // The batting array carries the whole squad — see computeLeaderboards.
      for (const inn of m.innings) {
        for (const b of inn.batting) touch(b.player_name, m.id, b.team_id);
        for (const bw of inn.bowling) touch(bw.player_name, m.id, bw.team_id);
      }
    }
  }

  return Array.from(matchSet.keys())
    .map((name) => ({
      name,
      matches: matchSet.get(name)!.size,
      teams: Array.from(teamSet.get(name) ?? []).sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Club founding date. The club plays once a week, so every elapsed week counts
// as a club week whether or not a series was recorded for it. The specific day
// is deliberately not encoded — it has been Sunday and is now Friday, and the
// count must survive any future change.
const CLUB_FOUNDING_DATE = new Date("2026-03-01T00:00:00Z");

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function countWeeksBetween(startInclusive: Date, endExclusive: Date): number {
  const ms = endExclusive.getTime() - startInclusive.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / MS_PER_WEEK);
}

// Total weeks played by the club: weeks elapsed between the founding date and
// the first tracked series (untracked baseline, assumed played weekly) plus one
// week for every series recorded since — each series upload IS that week's
// fixture, so no separate date math is needed going forward.
export function computeWeeksPlayed(series: { started_at: string | null }[]): number {
  if (series.length === 0) {
    return countWeeksBetween(CLUB_FOUNDING_DATE, new Date());
  }
  const firstSeriesDate = series
    .map((s) => (s.started_at ? new Date(s.started_at) : null))
    .filter((d): d is Date => d !== null)
    .reduce((a, b) => (b < a ? b : a));
  const baseline = countWeeksBetween(CLUB_FOUNDING_DATE, firstSeriesDate);
  return baseline + series.length;
}
