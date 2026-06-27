import { supabase } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SeriesTeamId = "mavericks" | "neurostrikers" | "outliers";
export type MatchStage = "league" | "final";
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
  team1_id: SeriesTeamId;
  team2_id: SeriesTeamId;
  toss_winner_id: SeriesTeamId | null;
  toss_decision: "bat" | "bowl" | null;
  team1_captain: string | null;
  team2_captain: string | null;
  squad: { team1: string[]; team2: string[] } | null;
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

export interface AllRounderRow {
  player_name: string;
  team_id: SeriesTeamId;
  matches: number;
  total_runs: number;
  total_wickets: number;
  batting_score: number;
  bowling_score: number;
  combined_score: number;
}

export interface FieldingRow {
  player_name: string;
  catches: number;
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

export async function fetchFullSeries(): Promise<FullSeries[]> {
  try {
    const { data: seriesList, error: se } = await supabase
      .from("series")
      .select("*")
      .order("series_no", { ascending: true });
    if (se || !seriesList) return [];

    const result: FullSeries[] = [];

    for (const s of seriesList) {
      const { data: matches } = await supabase
        .from("series_matches")
        .select("*")
        .eq("series_id", s.id)
        .order("match_no", { ascending: true });

      const fullMatches: FullSeriesMatch[] = [];

      for (const m of matches ?? []) {
        const { data: innings } = await supabase
          .from("series_innings")
          .select("*")
          .eq("match_id", m.id)
          .order("innings_no", { ascending: true });

        const fullInnings = [];
        for (const inn of innings ?? []) {
          const [{ data: batting }, { data: bowling }] = await Promise.all([
            supabase.from("series_batting").select("*").eq("innings_id", inn.id).order("batting_order"),
            supabase.from("series_bowling").select("*").eq("innings_id", inn.id).order("bowling_order"),
          ]);
          fullInnings.push({ ...inn, batting: batting ?? [], bowling: bowling ?? [] });
        }
        fullMatches.push({ ...m, innings: fullInnings });
      }
      result.push({ ...s, matches: fullMatches });
    }

    return result;
  } catch {
    return [];
  }
}

// ── Stats computation (pure, no I/O) ──────────────────────────────────────────

export function computeLeaderboards(series: FullSeries[], stageFilter?: MatchStage): {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  allRounders: AllRounderRow[];
  fielding: FieldingRow[];
} {
  // A batter counts as dismissed (for ICC average) for any mode of out;
  // not-out / retired-hurt / did-not-bat do NOT count as a dismissal.
  const DISMISSED = new Set(["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"]);
  const battingMap = new Map<string, { runs: number; balls: number; innings: number; outs: number; high: number; fours: number; sixes: number; team: SeriesTeamId }>();
  const bowlingMap = new Map<string, { wickets: number; overs: number; runs: number; innings: number; team: SeriesTeamId }>();
  const catchMap = new Map<string, number>();
  // Total matches a player appeared in (batted OR bowled) — for the "M" column.
  const playerMatchSet = new Map<string, Set<string>>();
  const touchMatch = (key: string, id: string) => {
    if (!playerMatchSet.has(key)) playerMatchSet.set(key, new Set());
    playerMatchSet.get(key)!.add(id);
  };

  for (const s of series) {
    for (const m of s.matches) {
      if (stageFilter && m.stage !== stageFilter) continue;
      // Squad list is the authoritative source for "matches played" — every named
      // squad member is credited an appearance even if they didn't bat or bowl.
      const sq = (m as SeriesMatch).squad;
      if (sq) {
        for (const name of [...(sq.team1 ?? []), ...(sq.team2 ?? [])]) {
          if (name?.trim()) touchMatch(name.trim(), m.id);
        }
      }
      for (const inn of m.innings) {
        for (const b of inn.batting) {
          const key = b.player_name;
          // Squad appearance — counts toward "matches" even for did-not-bat players.
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
          if (b.dismissal_type === "caught" && b.caught_by) {
            catchMap.set(b.caught_by, (catchMap.get(b.caught_by) ?? 0) + 1);
          }
        }
        for (const bw of inn.bowling) {
          const key = bw.player_name;
          touchMatch(key, m.id);
          const cur = bowlingMap.get(key) ?? { wickets: 0, overs: 0, runs: 0, innings: 0, team: bw.team_id };
          bowlingMap.set(key, {
            wickets: cur.wickets + bw.wickets,
            overs: cur.overs + bw.overs,
            innings: cur.innings + 1,
            runs: cur.runs + bw.runs_conceded,
            team: bw.team_id,
          });
        }
      }
    }
  }

  // Build raw batting list — most runs first; IPL Orange Cap tie-break: higher
  // strike rate, then higher average (runs per dismissal).
  const srOf = (p: { runs: number; balls: number }) => (p.balls > 0 ? p.runs / p.balls : 0);
  const avgOf = (p: { runs: number; outs: number }) => (p.outs > 0 ? p.runs / p.outs : Infinity);
  const rawBatting = Array.from(battingMap.entries())
    .map(([name, v]) => ({ player_name: name, ...v }))
    .sort((a, b) => b.runs - a.runs || srOf(b) - srOf(a) || avgOf(b) - avgOf(a));

  // Build raw bowling list — most wickets first; ties broken by better (lower)
  // economy, then fewer runs conceded.
  const econOf = (p: { overs: number; runs: number }) => (p.overs > 0 ? p.runs / p.overs : Infinity);
  const rawBowling = Array.from(bowlingMap.entries())
    .map(([name, v]) => ({ player_name: name, ...v }))
    .sort((a, b) => b.wickets - a.wickets || econOf(a) - econOf(b) || a.runs - b.runs);

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
    total_overs: p.overs,
    runs_conceded: p.runs,
    economy: p.overs > 0 ? Math.round((p.runs / p.overs) * 10) / 10 : 0,
    bowling_average: p.wickets > 0 ? Math.round((p.runs / p.wickets) * 100) / 100 : null,
    bowling_score: m === 1 ? 100 : Math.round(((m - 1 - i) / (m - 1)) * 100),
  }));

  // All-rounders: must appear in both leaderboards, min 1 wicket
  const batMap = new Map(battingRows.map((r) => [r.player_name, r]));
  const bowMap = new Map(bowlingRows.map((r) => [r.player_name, r]));

  const allRounders: AllRounderRow[] = [];
  for (const [name, bat] of batMap.entries()) {
    const bow = bowMap.get(name);
    if (!bow || bow.total_wickets < 1) continue;
    allRounders.push({
      player_name: name,
      team_id: bat.team_id,
      matches: bat.matches,
      total_runs: bat.total_runs,
      total_wickets: bow.total_wickets,
      batting_score: bat.batting_score,
      bowling_score: bow.bowling_score,
      combined_score: Math.round((bat.batting_score + bow.bowling_score) / 2),
    });
  }
  allRounders.sort((a, b) => b.combined_score - a.combined_score);

  // Fielding
  const fielding: FieldingRow[] = Array.from(catchMap.entries())
    .map(([name, catches]) => ({ player_name: name, catches }))
    .sort((a, b) => b.catches - a.catches);

  return { batting: battingRows, bowling: bowlingRows, allRounders, fielding };
}

// ── 3-way scoreline ────────────────────────────────────────────────────────────

export interface TriSeriesScoreline {
  neurostrikers: number;
  mavericks: number;
  outliers: number;
}

export function computeTriSeriesWins(series: FullSeries[]): TriSeriesScoreline {
  const wins: TriSeriesScoreline = { neurostrikers: 0, mavericks: 0, outliers: 0 };
  for (const s of series) {
    for (const m of s.matches) {
      if (m.winner_id && m.winner_id in wins) {
        wins[m.winner_id as keyof TriSeriesScoreline]++;
      }
    }
  }
  return wins;
}

// ── Series standings (points table) ───────────────────────────────────────────

export interface SeriesStandingRow {
  team_id: SeriesTeamId;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  win_pct: number;  // 0-100
  nrr: number;      // net run rate; 0 when no innings data available
}

export function computeSeriesStandings(
  matches: SeriesMatch[],
  stage?: "league" | "final"
): SeriesStandingRow[] {
  const map = new Map<SeriesTeamId, SeriesStandingRow>();

  const ensure = (id: SeriesTeamId): SeriesStandingRow => {
    if (!map.has(id)) {
      map.set(id, { team_id: id, played: 0, won: 0, lost: 0, tied: 0, points: 0, win_pct: 0, nrr: 0 });
    }
    return map.get(id)!;
  };

  for (const m of matches) {
    if (stage && m.stage !== stage) continue;
    if (!m.winner_id && !m.is_tie) continue;

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

  const rows = Array.from(map.values());
  for (const r of rows) {
    // Points percentage: points earned ÷ max possible (2 per game).
    // A tie (1 pt) counts as half a win, so two ties ≠ one win — and the
    // W/T/L columns still show the real breakdown.
    r.win_pct = r.played > 0 ? Math.round((r.points / (r.played * 2)) * 100) : 0;
  }
  return rows.sort((a, b) => b.win_pct - a.win_pct || b.points - a.points);
}

// Convert display overs (9.4 = 9 overs 4 balls) to decimal sixths for NRR math.
function oversToDecimalSeries(displayOvers: number): number {
  const full = Math.floor(displayOvers);
  const balls = Math.round((displayOvers - full) * 10);
  return full + balls / 6;
}

// Compute NRR per team from innings data. Only matches with both innings recorded
// are included; unrecorded matches contribute NRR = 0.
export function computeSeriesNRR(
  fullSeries: FullSeries[],
  stage?: "league" | "final",
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
      if (stage && m.stage !== stage) continue;
      if (!m.winner_id && !m.is_tie) continue;
      if (!m.innings || m.innings.length < 2) continue;
      const inn1 = m.innings.find((i) => i.innings_no === 1);
      const inn2 = m.innings.find((i) => i.innings_no === 2);
      if (!inn1 || !inn2) continue;

      const o1 = inn1.all_out ? overs : oversToDecimalSeries(inn1.total_overs);
      const o2 = inn2.all_out ? overs : oversToDecimalSeries(inn2.total_overs);

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
  // League matches only — exhibition/final games never count toward the points table.
  const rows = computeSeriesStandings(series.flatMap((s) => s.matches as SeriesMatch[]), "league");
  const nrrMap = computeSeriesNRR(series, "league");
  for (const r of rows) r.nrr = nrrMap.get(r.team_id) ?? 0;
  return rows;
}
