// Scoring primitives with no dependencies — no Supabase, no data model.
//
// These used to live in lib/series.ts, but that module opens a Supabase client
// on import. Once lib/mvp.ts needed the same overs arithmetic and stage
// filtering, importing them from there created a runtime import cycle
// (series -> mvp -> series) and dragged a database client into a pure
// calculation. They sit here so both sides can share them freely.

// The final week of a season is a three-round bracket:
// eliminator (3rd v 4th) -> qualifier (2nd v eliminator winner)
// -> final (1st v qualifier winner).
export type MatchStage = "league" | "eliminator" | "qualifier" | "final";

export const PLAYOFF_STAGES: MatchStage[] = ["eliminator", "qualifier", "final"];

export function isPlayoffStage(stage: MatchStage): boolean {
  return stage !== "league";
}

// What callers actually want to slice by. "playoffs" spans all three bracket
// rounds — before the bracket existed this was just the single "final" stage.
export type StageFilter = "league" | "playoffs";

export function matchesStageFilter(stage: MatchStage, filter?: StageFilter): boolean {
  if (!filter) return true;
  return filter === "league" ? stage === "league" : isPlayoffStage(stage);
}

// Convert display overs (9.4 = 9 overs 4 balls) to decimal sixths (9.667) for
// arithmetic like NRR and economy — dividing directly by the display value
// (e.g. runs / 0.4) is wrong since "0.4" means 4 balls, not 0.4 of an over.
export function oversToDecimal(displayOvers: number): number {
  const full = Math.floor(displayOvers);
  const balls = Math.round((displayOvers - full) * 10);
  return full + balls / 6;
}

// Convert total balls bowled back to display overs notation (e.g. 58 -> 9.4).
export function ballsToOvers(balls: number): number {
  return Math.floor(balls / 6) + (balls % 6) / 10;
}
