// Pure domain logic for the JCC weekly tournament.
// No I/O — all functions are deterministic and independently testable.

import { type TeamId, TEAM_ORDER } from "./teams";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TournamentStatus =
  | "scheduled"
  | "in_progress"
  | "final_pending"
  | "completed";

export type MatchStatus = "scheduled" | "toss_done" | "completed";
export type MatchStage = "league" | "final";
export type TossDecision = "bat" | "bowl";
export type MarginType = "runs" | "wickets";

export interface SuperOver {
  played: true;
  team1_runs: number;
  team2_runs: number;
  winner_id: TeamId;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  match_no: number;
  stage: MatchStage;
  team1_id: TeamId | null;
  team2_id: TeamId | null;
  toss_winner_id: TeamId | null;
  toss_decision: TossDecision | null;
  team1_runs: number | null;
  team1_wickets: number | null;
  team1_overs: number | null;   // stored as display decimal (9.4 = 9 overs 4 balls)
  team1_all_out: boolean;
  team2_runs: number | null;
  team2_wickets: number | null;
  team2_overs: number | null;
  team2_all_out: boolean;
  winner_id: TeamId | null;
  margin_type: MarginType | null;
  margin_value: number | null;
  is_tie: boolean;
  super_over: SuperOver | null;
  points_team1: number;
  points_team2: number;
  status: MatchStatus;
}

export interface Tournament {
  id: string;
  week_label: string;
  overs_per_innings: number;
  status: TournamentStatus;
  champion_team_id: TeamId | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledFixture {
  match_no: number;
  stage: MatchStage;
  team1_id: TeamId | null;
  team2_id: TeamId | null;
}

export interface TeamStanding {
  team_id: TeamId;
  played: number;
  won: number;
  lost: number;
  tied: number;   // includes ties resolved by super over (for record keeping)
  points: number;
  nrr: number;
}

// ─── NRR helpers ─────────────────────────────────────────────────────────────

// Convert display overs (e.g. 9.4 meaning 9 overs 4 balls) to decimal sixths.
// 9.4 → 9 + 4/6 = 9.6̄
export function oversToDecimal(displayOvers: number): number {
  const fullOvers = Math.floor(displayOvers);
  const balls = Math.round((displayOvers - fullOvers) * 10); // digit after decimal
  return fullOvers + balls / 6;
}

// NRR for a single team across all their completed league innings.
// all_out rule: if bowled out early, count the full quota of overs.
// Super-over runs are never included (passed in separately as regular innings only).
function teamNRR(
  runsScored: number,
  oversConsumed: number, // already in sixths decimal
  runsConceded: number,
  oversBowled: number,   // already in sixths decimal
): number {
  if (oversConsumed === 0 || oversBowled === 0) return 0;
  return runsScored / oversConsumed - runsConceded / oversBowled;
}

// ─── Schedule generator ───────────────────────────────────────────────────────

// 3-team round-robin has exactly 3 fixtures: A-B, B-C, A-C.
// We randomize the play ORDER and which team is listed as team1/team2.
export function generateSchedule(): ScheduledFixture[] {
  const [a, b, c] = TEAM_ORDER;

  // Fixed round-robin pairings
  const pairings: [TeamId, TeamId][] = [
    [a, b],
    [b, c],
    [a, c],
  ];

  // Randomly flip team1/team2 within each pairing
  const fixtures: [TeamId, TeamId][] = pairings.map(([x, y]) =>
    Math.random() < 0.5 ? [x, y] : [y, x]
  );

  // Randomly shuffle play order
  for (let i = fixtures.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
  }

  const leagueMatches: ScheduledFixture[] = fixtures.map(([t1, t2], idx) => ({
    match_no: idx + 1,
    stage: "league",
    team1_id: t1,
    team2_id: t2,
  }));

  // Final — TBD until top 2 are resolved
  const final: ScheduledFixture = {
    match_no: 4,
    stage: "final",
    team1_id: null,
    team2_id: null,
  };

  return [...leagueMatches, final];
}

// ─── Standings computation ────────────────────────────────────────────────────

export function computeStandings(
  matches: TournamentMatch[],
  oversPerInnings: number,
): TeamStanding[] {
  const leagueMatches = matches.filter(
    (m) => m.stage === "league" && m.status === "completed"
  );

  // Accumulator per team
  const acc: Record<
    string,
    {
      played: number;
      won: number;
      lost: number;
      tied: number;
      points: number;
      runsScored: number;
      oversConsumed: number;  // sixths decimal
      runsConceded: number;
      oversBowled: number;    // sixths decimal
    }
  > = {};

  function ensure(id: string) {
    if (!acc[id]) {
      acc[id] = {
        played: 0, won: 0, lost: 0, tied: 0, points: 0,
        runsScored: 0, oversConsumed: 0,
        runsConceded: 0, oversBowled: 0,
      };
    }
  }

  for (const m of leagueMatches) {
    if (!m.team1_id || !m.team2_id) continue;
    if (
      m.team1_runs === null || m.team1_overs === null ||
      m.team2_runs === null || m.team2_overs === null
    ) continue;

    ensure(m.team1_id);
    ensure(m.team2_id);

    const t1 = acc[m.team1_id];
    const t2 = acc[m.team2_id];

    t1.played++;
    t2.played++;

    // Overs: apply all-out rule (faced full quota if bowled out)
    const t1OversConsumed = m.team1_all_out
      ? oversPerInnings
      : oversToDecimal(m.team1_overs);
    const t2OversConsumed = m.team2_all_out
      ? oversPerInnings
      : oversToDecimal(m.team2_overs);

    // NRR accumulation (super-over runs excluded — we only use regular innings data)
    t1.runsScored += m.team1_runs;
    t1.oversConsumed += t1OversConsumed;
    t1.runsConceded += m.team2_runs;
    t1.oversBowled += t2OversConsumed;

    t2.runsScored += m.team2_runs;
    t2.oversConsumed += t2OversConsumed;
    t2.runsConceded += m.team1_runs;
    t2.oversBowled += t1OversConsumed;

    // Points
    if (m.winner_id) {
      // Has a definitive winner (including super-over winner getting 2 points IPL-style)
      const winnerId = m.winner_id;
      const loserId = winnerId === m.team1_id ? m.team2_id : m.team1_id;
      acc[winnerId].won++;
      acc[winnerId].points += 2;
      acc[loserId].lost++;
    } else if (m.is_tie) {
      // Genuine tie with no super over played
      t1.tied++;
      t1.points += 1;
      t2.tied++;
      t2.points += 1;
    }
  }

  // Build standings for all 3 teams (include teams with 0 matches played)
  const standings: TeamStanding[] = (["mavericks", "neurostrikers", "outliers"] as TeamId[]).map(
    (id) => {
      const a = acc[id] ?? {
        played: 0, won: 0, lost: 0, tied: 0, points: 0,
        runsScored: 0, oversConsumed: 0, runsConceded: 0, oversBowled: 0,
      };
      return {
        team_id: id,
        played: a.played,
        won: a.won,
        lost: a.lost,
        tied: a.tied,
        points: a.points,
        nrr: teamNRR(a.runsScored, a.oversConsumed, a.runsConceded, a.oversBowled),
      };
    }
  );

  return sortStandings(standings, leagueMatches);
}

// Sort: Points → NRR → head-to-head
function sortStandings(
  standings: TeamStanding[],
  leagueMatches: TournamentMatch[],
): TeamStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (Math.abs(b.nrr - a.nrr) > 0.0001) return b.nrr - a.nrr;
    // Head-to-head: did a beat b directly?
    const h2h = leagueMatches.find(
      (m) =>
        (m.team1_id === a.team_id && m.team2_id === b.team_id) ||
        (m.team1_id === b.team_id && m.team2_id === a.team_id)
    );
    if (h2h?.winner_id === a.team_id) return -1;
    if (h2h?.winner_id === b.team_id) return 1;
    return 0;
  });
}

// ─── Finalists resolver ───────────────────────────────────────────────────────

export function resolveFinalists(standings: TeamStanding[]): [TeamId, TeamId] {
  return [standings[0].team_id, standings[1].team_id];
}

// ─── Result string builder (for display) ─────────────────────────────────────

export function buildResultString(match: TournamentMatch): string {
  if (!match.winner_id || !match.margin_type || match.margin_value === null) {
    if (match.is_tie) return "Match tied";
    return "Result pending";
  }
  const winnerName =
    match.winner_id === match.team1_id ? "Team 1" : "Team 2"; // caller should substitute actual names
  if (match.margin_type === "runs") {
    return `${winnerName} won by ${match.margin_value} run${match.margin_value !== 1 ? "s" : ""}`;
  }
  return `${winnerName} won by ${match.margin_value} wicket${match.margin_value !== 1 ? "s" : ""}`;
}

// ─── NRR display formatter ────────────────────────────────────────────────────

export function formatNRR(nrr: number): string {
  const sign = nrr >= 0 ? "+" : "";
  return `${sign}${nrr.toFixed(3)}`;
}
