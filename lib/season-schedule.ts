// Season 3 fixture list and playoff bracket resolution.
//
// The week-by-week pairings below are transcribed verbatim from the published
// Season 3 schedule poster. They are NOT generated: many different arrangements
// satisfy "each of the 6 pairs meets 7 times", and members have already seen
// this specific one — a generator would quietly contradict it.

import type { TeamId } from "./teams";
import type { MatchStage, SeriesStandingRow } from "./series";

export interface ScheduledFixture {
  match_no: number;
  stage: MatchStage;
  team1_id: TeamId | null;
  team2_id: TeamId | null;
  // Bracket fixtures know their seed or their feeder match, not their team.
  team1_seed: number | null;
  team2_seed: number | null;
  team1_from_match_no: number | null;
  team2_from_match_no: number | null;
}

export interface ScheduledWeek {
  week_no: number;
  fixtures: ScheduledFixture[];
}

const NS = "neurostrikers";
const MAV = "mavericks";
const OUT = "outliers";
const VIK = "vikings";

// Weeks 1-11: the league stage. 42 matches, each pair meeting exactly 7 times.
const LEAGUE_WEEKS: Array<Array<[TeamId, TeamId]>> = [
  /* W1  */ [[NS, VIK], [NS, OUT], [MAV, VIK], [OUT, MAV]],
  /* W2  */ [[OUT, VIK], [NS, VIK], [OUT, MAV], [NS, MAV]],
  /* W3  */ [[NS, OUT], [OUT, VIK], [NS, MAV], [MAV, VIK]],
  /* W4  */ [[MAV, VIK], [OUT, MAV], [NS, VIK], [NS, OUT]],
  /* W5  */ [[OUT, MAV], [NS, MAV], [OUT, VIK], [NS, VIK]],
  /* W6  */ [[NS, OUT], [MAV, VIK], [NS, MAV], [OUT, VIK]],
  /* W7  */ [[OUT, MAV], [NS, VIK], [NS, OUT], [MAV, VIK]],
  /* W8  */ [[NS, MAV], [OUT, VIK], [OUT, MAV], [NS, VIK]],
  /* W9  */ [[MAV, VIK], [NS, OUT], [OUT, VIK], [NS, MAV]],
  /* W10 */ [[NS, OUT], [MAV, VIK], [NS, VIK], [OUT, MAV]],
  /* W11 */ [[OUT, VIK], [NS, MAV]],
];

export const PLAYOFF_WEEK_NO = 12;

// Week 12. First place goes straight to the final; the other three play it out.
// Match 1: 3rd v 4th. Match 2: 2nd v winner of match 1. Match 3: 1st v winner of match 2.
const PLAYOFF_FIXTURES: ScheduledFixture[] = [
  {
    match_no: 1,
    stage: "eliminator",
    team1_id: null, team2_id: null,
    team1_seed: 3, team2_seed: 4,
    team1_from_match_no: null, team2_from_match_no: null,
  },
  {
    match_no: 2,
    stage: "qualifier",
    team1_id: null, team2_id: null,
    team1_seed: 2, team2_seed: null,
    team1_from_match_no: null, team2_from_match_no: 1,
  },
  {
    match_no: 3,
    stage: "final",
    team1_id: null, team2_id: null,
    team1_seed: 1, team2_seed: null,
    team1_from_match_no: null, team2_from_match_no: 2,
  },
];

export const SEASON_3_SCHEDULE: ScheduledWeek[] = [
  ...LEAGUE_WEEKS.map((week, i) => ({
    week_no: i + 1,
    fixtures: week.map(([t1, t2], j): ScheduledFixture => ({
      match_no: j + 1,
      stage: "league" as const,
      team1_id: t1,
      team2_id: t2,
      team1_seed: null,
      team2_seed: null,
      team1_from_match_no: null,
      team2_from_match_no: null,
    })),
  })),
  { week_no: PLAYOFF_WEEK_NO, fixtures: PLAYOFF_FIXTURES },
];

export const SEASON_3_LEAGUE_MATCH_COUNT = LEAGUE_WEEKS.flat().length;      // 42
export const SEASON_3_TOTAL_MATCH_COUNT =
  SEASON_3_LEAGUE_MATCH_COUNT + PLAYOFF_FIXTURES.length;                     // 45

// ── Venue and start-time resolution ─────────────────────────────────────────
// A week is always played at a single ground in one unbroken block, so both the
// venue (`series.venue`) and the first match's slot (`series.start_time`) live
// on the week; a match only carries its own venue when that week was split.
//
// Weeks are booked a few days out, so most upcoming ones have neither yet. An
// unbooked week says TBC rather than borrowing the club's usual ground or a
// habitual start time: a default that looks like a fact is worse than an
// admitted blank, because a member reads it as one and turns up.

export type VenueStatus = "confirmed" | "tbc";

export interface ResolvedVenue {
  /** Null until the week is booked — render as TBC. */
  name: string | null;
  status: VenueStatus;
}

export function resolveVenue(
  matchVenue: string | null | undefined,
  weekVenue: string | null | undefined,
): ResolvedVenue {
  const booked = matchVenue?.trim() || weekVenue?.trim();
  if (booked) return { name: booked, status: "confirmed" };
  return { name: null, status: "tbc" };
}

/** Minutes between one match's start and the next, within a week. */
export const MATCH_SLOT_MINUTES = 55;

/**
 * When a given match of the week starts, or null while the week has no slot.
 *
 * The week stores only its first start time; the rest of the card follows it
 * back to back, so match 3 of a week starting 07:30 PM is 09:20 PM. Times are
 * derived rather than stored per match because that is how they are actually
 * decided — one booking, one running order.
 */
export function resolveMatchTime(
  weekStart: string | null | undefined,
  matchNo: number,
): string | null {
  const parts = weekStart?.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!parts) return null;
  const h = Number(parts[1]);
  const m = Number(parts[2]);
  if (h > 23 || m > 59) return null;

  const total =
    h * 60 + m + (Math.max(matchNo, 1) - 1) * MATCH_SLOT_MINUTES;
  // Wrapped, so a week long enough to run past midnight still reads as a time
  // rather than as "25:15".
  const h24 = Math.floor(total / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(total % 60).padStart(2, "0")} ${
    h24 < 12 ? "AM" : "PM"
  }`;
}

// ── Bracket resolution ──────────────────────────────────────────────────────

/** A bracket match with its participants filled in as far as they are known. */
export interface ResolvedBracketMatch {
  match_no: number;
  stage: MatchStage;
  team1_id: TeamId | null;
  team2_id: TeamId | null;
  /** Human-readable placeholder for a slot that isn't decided yet. */
  team1_label: string;
  team2_label: string;
  winner_id: TeamId | null;
}

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];

function seedLabel(seed: number | null, fromMatch: number | null): string {
  if (seed) return `${ORDINAL[seed] ?? `#${seed}`} place`;
  if (fromMatch) return `Winner of Match ${fromMatch}`;
  return "TBD";
}

/**
 * Walks the bracket in match order, filling each slot from either the final
 * league standings (by seed) or the winner of an earlier bracket match.
 *
 * `standings` must be the completed league table, best-first — the same shape
 * computeOverallStandings returns. `results` maps a bracket match_no to its
 * winner, for rounds that have already been played.
 */
export function resolveBracket(
  fixtures: ScheduledFixture[],
  standings: SeriesStandingRow[],
  results: Map<number, TeamId | null> = new Map(),
): ResolvedBracketMatch[] {
  const bySeed = (seed: number): TeamId | null =>
    (standings[seed - 1]?.team_id as TeamId | undefined) ?? null;

  const resolved: ResolvedBracketMatch[] = [];
  const winnerOf = new Map<number, TeamId | null>();

  for (const f of [...fixtures].sort((a, b) => a.match_no - b.match_no)) {
    const pick = (
      teamId: TeamId | null,
      seed: number | null,
      fromMatch: number | null,
    ): TeamId | null => {
      // An explicitly assigned team always wins — once a fixture is played and
      // imported, the stored team ids are the record.
      if (teamId) return teamId;
      if (seed) return bySeed(seed);
      if (fromMatch) return winnerOf.get(fromMatch) ?? null;
      return null;
    };

    const team1 = pick(f.team1_id, f.team1_seed, f.team1_from_match_no);
    const team2 = pick(f.team2_id, f.team2_seed, f.team2_from_match_no);
    const winner = results.get(f.match_no) ?? null;
    winnerOf.set(f.match_no, winner);

    resolved.push({
      match_no: f.match_no,
      stage: f.stage,
      team1_id: team1,
      team2_id: team2,
      team1_label: seedLabel(f.team1_seed, f.team1_from_match_no),
      team2_label: seedLabel(f.team2_seed, f.team2_from_match_no),
      winner_id: winner,
    });
  }

  return resolved;
}
