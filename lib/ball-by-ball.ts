// Ball-by-ball scoring for /admin/series-import.
//
// The scorer records a log of events; everything else — the batting card, the
// bowling figures, extras, fall of wickets, who is on strike, whether the over
// or the innings is done — is replayed from that log. Undo is popping the last
// event, and the log alone is what a draft saves. Nothing here touches I/O.
//
// Each delivery names its striker, non-striker and bowler explicitly, so the
// log never depends on the strike rotation having been inferred correctly:
// replay infers where the batters stand *next*, and the scorer can override it
// (swap strike) before the next ball is recorded.
//
// The output is the innings shape /api/series/save takes, so a ball-by-ball
// match lands in the same tables as every scorecard before it.

import type { DismissalType } from "./series";

export type Extra = "wd" | "nb" | "b" | "lb";

/** Dismissals that happen on a delivery. Retiring is its own event. */
export type WicketKind = "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket";

/** Credited to the bowler — everything but a run out. */
const BOWLER_WICKETS = new Set<WicketKind>(["bowled", "caught", "lbw", "stumped", "hit_wicket"]);

export interface BallEvent {
  t: "ball";
  striker: string;
  /** "" when the last batter is batting alone (last man stands). */
  nonStriker: string;
  bowler: string;
  /** Runs off the bat — also on a no-ball. */
  bat: number;
  extra: Extra | null;
  /**
   * Extra runs on this delivery. wd: the 1 plus anything run (a wide that
   * runs away for four is 5). nb: the 1 penalty. b / lb: the runs taken.
   */
  extraRuns: number;
  wicket: { kind: WicketKind; out: string; fielders: string[] } | null;
}

/** A batter leaving without a delivery — the club counts it as retired out. */
export interface RetireEvent {
  t: "retire";
  player: string;
}

export type ScoreEvent = BallEvent | RetireEvent;

export interface BatterLine {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: { type: DismissalType; bowler: string | null; fielders: string | null } | null;
}

export interface BowlerLine {
  name: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
}

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: { wd: number; nb: number; b: number; lb: number };
  batters: BatterLine[];
  bowlers: BowlerLine[];
  fow: Array<{ wkt: number; score: number; overs: string; player: string }>;
  /** Where the batters stand for the next delivery; null = needs a new batter. */
  striker: string | null;
  nonStriker: string | null;
  /** Bowler of the over in progress; null between overs. */
  bowler: string | null;
  /** Who bowled the last completed over — can't bowl the next one. */
  lastOverBowler: string | null;
  /** Labels for the over in progress ("1", "4", "W", "1wd" …). */
  thisOver: string[];
}

/** "9.4" notation from balls, always with the decimal ("2.0", not "2"). */
export function oversLabel(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

const isLegal = (b: BallEvent) => b.extra !== "wd" && b.extra !== "nb";

/** Runs the batters actually ran — decides whether they crossed. */
function runsRun(b: BallEvent): number {
  switch (b.extra) {
    case "wd":
      return b.extraRuns - 1;
    case "nb":
      return b.bat + (b.extraRuns - 1);
    case "b":
    case "lb":
      return b.extraRuns;
    default:
      return b.bat;
  }
}

/** Short label for the over strip. */
export function ballLabel(b: BallEvent): string {
  const w = b.wicket ? "W" : "";
  switch (b.extra) {
    case "wd":
      return `${b.extraRuns > 1 ? b.extraRuns : ""}wd${w ? "+W" : ""}`;
    case "nb":
      return `${b.bat || ""}nb${w ? "+W" : ""}`;
    case "b":
      return `${b.extraRuns}b${w ? "+W" : ""}`;
    case "lb":
      return `${b.extraRuns}lb${w ? "+W" : ""}`;
    default:
      return w ? (b.bat ? `${b.bat}+W` : "W") : String(b.bat);
  }
}

export function replayInnings(events: ScoreEvent[]): InningsState {
  const s: InningsState = {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    batters: [],
    bowlers: [],
    fow: [],
    striker: null,
    nonStriker: null,
    bowler: null,
    lastOverBowler: null,
    thisOver: [],
  };
  const batter = (name: string) => {
    let b = s.batters.find((x) => x.name === name);
    if (!b) {
      b = { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
      s.batters.push(b);
    }
    return b;
  };
  const bowlerLine = (name: string) => {
    let b = s.bowlers.find((x) => x.name === name);
    if (!b) {
      b = { name, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0 };
      s.bowlers.push(b);
    }
    return b;
  };
  // Runs charged to the bowler of the over in progress, for maidens.
  let overConceded = 0;

  for (const e of events) {
    if (e.t === "retire") {
      const b = batter(e.player);
      b.out = { type: "retired_hurt", bowler: null, fielders: null };
      if (s.striker === e.player) s.striker = null;
      if (s.nonStriker === e.player) s.nonStriker = null;
      continue;
    }

    const striker = batter(e.striker);
    // Last man stands: the lone batter faces with nobody at the other end.
    const alone = !e.nonStriker;
    if (!alone) batter(e.nonStriker);
    const bowler = bowlerLine(e.bowler);
    if (s.bowler !== e.bowler) overConceded = 0;
    s.bowler = e.bowler;

    const total = e.bat + e.extraRuns;
    s.runs += total;
    striker.runs += e.bat;
    if (e.bat === 4) striker.fours++;
    if (e.bat === 6) striker.sixes++;
    if (e.extra !== "wd") striker.balls++;

    // Byes and leg byes aren't the bowler's; wides and no-balls are.
    const charged = e.extra === "b" || e.extra === "lb" ? 0 : total;
    bowler.runs += charged;
    overConceded += charged;
    if (e.extra) s.extras[e.extra] += e.extraRuns;
    if (e.extra === "wd") bowler.wides++;
    if (e.extra === "nb") bowler.noBalls++;
    if (isLegal(e)) {
      s.legalBalls++;
      bowler.balls++;
    }
    s.thisOver.push(ballLabel(e));

    // Crossing, then the dismissal, then the end of the over.
    // Alone, there's no one to cross with: the batter keeps the strike.
    let onStrike: string | null = e.striker;
    let offStrike: string | null = alone ? null : e.nonStriker;
    if (!alone && runsRun(e) % 2 === 1) [onStrike, offStrike] = [offStrike, onStrike];

    if (e.wicket) {
      const w = e.wicket;
      s.wickets++;
      if (BOWLER_WICKETS.has(w.kind)) bowler.wickets++;
      batter(w.out).out = {
        type: w.kind,
        bowler: BOWLER_WICKETS.has(w.kind) ? e.bowler : null,
        fielders: w.fielders.length ? w.fielders.join(" / ") : null,
      };
      s.fow.push({ wkt: s.wickets, score: s.runs, overs: oversLabel(s.legalBalls), player: w.out });
      if (onStrike === w.out) onStrike = null;
      if (offStrike === w.out) offStrike = null;
    }

    if (isLegal(e) && s.legalBalls % 6 === 0) {
      if (overConceded === 0) bowler.maidens++;
      overConceded = 0;
      if (!alone) [onStrike, offStrike] = [offStrike, onStrike];
      s.lastOverBowler = e.bowler;
      s.bowler = null;
      s.thisOver = [];
    }
    s.striker = onStrike;
    s.nonStriker = offStrike;
  }
  return s;
}

export interface InningsLimits {
  overs: number;
  /** Players in the batting side — all out at squad − 1 wickets, or at squad with lastManStands. */
  squadSize: number;
  /**
   * Last man stands: when one batter is left they bat on alone, and the side
   * is all out only once every batter is out.
   */
  lastManStands?: boolean;
  /** Second innings only: runs needed to win. */
  target: number | null;
}

/** Why the innings is over, or null while it goes on. */
export function inningsOver(s: InningsState, lim: InningsLimits): "overs" | "all_out" | "target" | null {
  if (lim.target != null && s.runs >= lim.target) return "target";
  const lms = !!lim.lastManStands;
  if (s.wickets >= Math.max(1, lim.squadSize - (lms ? 0 : 1))) return "all_out";
  // Retirements leave the crease short without a wicket. Normally the last
  // batter can't continue alone; under last man stands they can.
  const left = lim.squadSize - s.batters.filter((b) => b.out).length;
  if (s.batters.length > 0 && left < (lms ? 1 : 2)) return "all_out";
  if (s.legalBalls >= lim.overs * 6) return "overs";
  return null;
}

/** The innings in the shape /api/series/save takes. */
export function toSaveInnings(
  s: InningsState,
  opts: { inningsNo: 1 | 2; battingTeam: string; bowlingTeam: string; squad: string[]; allOut: boolean },
) {
  const batted = s.batters.map((b, i) => ({
    batting_order: i + 1,
    player_name: b.name,
    runs: b.runs,
    balls_faced: b.balls,
    fours: b.fours,
    sixes: b.sixes,
    dismissal_type: (b.out?.type ?? "not_out") as DismissalType,
    dismissed_by: b.out?.bowler ?? null,
    caught_by: b.out?.fielders ?? null,
  }));
  // Every squad member goes in the batting array — it's how appearances are
  // counted (lib/match-template.ts).
  const dnb = opts.squad
    .filter((p) => !s.batters.some((b) => b.name === p))
    .map((p, i) => ({
      batting_order: batted.length + i + 1,
      player_name: p,
      runs: 0,
      balls_faced: null,
      fours: 0,
      sixes: 0,
      dismissal_type: "did_not_bat" as DismissalType,
      dismissed_by: null,
      caught_by: null,
    }));
  return {
    innings_no: opts.inningsNo,
    batting_team_id: opts.battingTeam,
    bowling_team_id: opts.bowlingTeam,
    total_runs: s.runs,
    total_wickets: s.wickets,
    total_overs: Number(oversLabel(s.legalBalls)),
    all_out: opts.allOut,
    extras_wides: s.extras.wd,
    extras_no_balls: s.extras.nb,
    extras_byes: s.extras.b,
    extras_leg_byes: s.extras.lb,
    fall_of_wickets: s.fow,
    batting: [...batted, ...dnb],
    bowling: s.bowlers.map((b, i) => ({
      bowling_order: i + 1,
      player_name: b.name,
      overs: Number(oversLabel(b.balls)),
      maidens: b.maidens,
      runs_conceded: b.runs,
      wickets: b.wickets,
      wides: b.wides,
      no_balls: b.noBalls,
    })),
  };
}

/** Result from the two innings, the way the club scores margins. */
export function matchResult(
  first: { team: string; runs: number },
  second: { team: string; runs: number; wickets: number; squadSize: number; lastManStands?: boolean },
): { winner: string | null; marginType: "runs" | "wickets" | null; marginValue: number | null; tie: boolean } {
  if (second.runs > first.runs) {
    return {
      winner: second.team,
      marginType: "wickets",
      // Wickets in hand: under last man stands the last batter is one too.
      marginValue: Math.max(0, second.squadSize - (second.lastManStands ? 0 : 1) - second.wickets),
      tie: false,
    };
  }
  if (first.runs > second.runs) {
    return { winner: first.team, marginType: "runs", marginValue: first.runs - second.runs, tie: false };
  }
  return { winner: null, marginType: null, marginValue: null, tie: true };
}
