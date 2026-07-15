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
  code: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledFixture {
  match_no: number;
  stage: MatchStage;
  team1_id: TeamId | null;
  team2_id: TeamId | null;
}

// ─── Join code generator ───────────────────────────────────────────────────────

// Excludes visually ambiguous characters (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTournamentCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
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

