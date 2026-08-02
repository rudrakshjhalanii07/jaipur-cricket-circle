// Most Valuable Player — one number for a player's whole contribution.
//
// Adapted from the CricHeroes MVP algorithm
// (https://blog.cricheroes.com/most-valuable-player-mvp-by-cricheroes/). The
// shape is theirs: 10 runs = 1 point, wickets priced by how good the dismissed
// batter was, fielders paid a slice of the wicket they created.
//
// Three deliberate departures, because the published version does not survive
// contact with a 10-over club game:
//
//  1. NO PAR SCORE BONUS. CricHeroes removed it themselves ("to make the
//     calculation less complicated") and it assumes a fixed 11-man side, which
//     JCC does not have — seasons declare their own rosters. The idea it
//     encoded, that a top-order wicket is worth more than a tail-end one,
//     survives in the wicket tiers below.
//
//  2. NO PENALTIES. Also per their own update: a slow innings or an expensive
//     spell scores zero bonus, never a negative. You cannot lose points for
//     turning up.
//
//  3. THE RATE BONUS IS REBUILT. Their formula
//       (TeamSR / PlayerSR) * (TeamSR - PlayerSR) * pct
//     multiplies a ratio by a run difference, so it is not in point units at
//     all — in their own worked example it returns -3.2, dwarfing the 3.06 the
//     bowler earned for three wickets. We instead measure the thing they were
//     reaching for directly: runs gained (or prevented) against the rate the
//     innings actually went at, converted at the same 10-runs-per-point rate.
//     Symmetric for bat and ball, and it cannot outrun the base score.

// Types only from lib/series — a value import would pull in its Supabase
// client and re-form the cycle that lib/cricket-format.ts exists to break.
import type { FullSeries, SeriesTeamId } from "@/lib/series";
import type { StageFilter } from "@/lib/cricket-format";
import { matchesStageFilter, oversToDecimal } from "@/lib/cricket-format";

/** The exchange rate the whole system is built on. */
const RUNS_PER_POINT = 10;

/**
 * Format constants, keyed by the innings length of the match.
 *
 * `baseRunsPerWicket` is what a top-order wicket is worth in runs; CricHeroes
 * derive it from a par total for the format spread across the order. JCC plays
 * 10 overs a side, so we land in the 8-12 band at 14 runs (1.4 points).
 *
 * `rateCredit` is the share of surplus/saved runs paid out as a bonus. It
 * descends with format length for the same reason CricHeroes' strike-rate
 * table did: in a 10-over game scoring rate is most of the contest, over five
 * days it is nearly none of it.
 *
 * `maidensPerWicket` is how many maiden overs equal one top-order wicket.
 */
type FormatRules = {
  baseRunsPerWicket: number;
  rateCredit: number;
  maidensPerWicket: number;
};

export function formatRules(oversPerInnings: number): FormatRules {
  const baseRunsPerWicket =
    oversPerInnings <= 7 ? 12
    : oversPerInnings <= 12 ? 14
    : oversPerInnings <= 16 ? 16
    : oversPerInnings <= 20 ? 18
    : oversPerInnings <= 26 ? 20
    : oversPerInnings <= 40 ? 22
    : oversPerInnings <= 50 ? 25
    : 27;

  const rateCredit =
    oversPerInnings <= 20 ? 0.5
    : oversPerInnings <= 35 ? 0.4
    : oversPerInnings <= 50 ? 0.3
    : 0.2;

  const maidensPerWicket =
    oversPerInnings <= 7 ? 1
    : oversPerInnings <= 26 ? 2
    : oversPerInnings <= 50 ? 3
    : 6;

  return { baseRunsPerWicket, rateCredit, maidensPerWicket };
}

/**
 * Multi-wicket bonus, rescaled for short-format cricket.
 *
 * CricHeroes reward 3 / 5 / 10 wickets, which is calibrated for 20-50 over
 * games. In 10 overs nobody bowls more than two or three, so a five-for is the
 * ceiling rather than a milestone on the way to one. Highest tier only, not
 * cumulative.
 */
function haulBonus(wickets: number): number {
  if (wickets >= 5) return 1.5;
  if (wickets >= 4) return 1.0;
  if (wickets >= 3) return 0.5;
  return 0;
}

/**
 * How much of a top-order wicket this batting position is worth.
 *
 * CricHeroes fix the tiers at positions 1-4 / 5-8 / 9-11 for an 11-man side.
 * JCC squads vary by season, so we split whatever the squad actually was into
 * thirds — the top third are the batters you least want to be facing.
 */
function positionWeight(battingOrder: number | null, squadSize: number): number {
  if (!battingOrder || squadSize <= 0) return 0.8; // unknown order — middle it
  const third = Math.ceil(squadSize / 3);
  if (battingOrder <= third) return 1.0;
  if (battingOrder <= third * 2) return 0.8;
  return 0.6;
}

/**
 * Fielders named on a run out.
 *
 * The scorer writes them into `caught_by` as free text, already canonicalised
 * and slash-joined by canonicalNamesInText: "Nitesh" is a direct hit, "Vikas /
 * Kunwar Gaurav" is a throw and a receive. We do not try to judge which half
 * was harder — two names split the wicket down the middle.
 */
export function parseFielders(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The fielders on a run out, from whichever column the scorer reached for.
 *
 * `caught_by` is the right home for them, but the import screen disabled that
 * input for every dismissal except a catch, so most run outs went into
 * `dismissed_by` instead — 25 of the first 34 recorded. Reading both is not a
 * migration we can skip past: the column a name landed in depended only on
 * which build of the form was live that evening.
 *
 * Safe to conflate, because a run out has no bowler to credit — nothing else
 * reads `dismissed_by` on these rows.
 */
export function runOutFielders(b: {
  caught_by: string | null;
  dismissed_by: string | null;
}): string[] {
  const fromCatch = parseFielders(b.caught_by);
  return fromCatch.length > 0 ? fromCatch : parseFielders(b.dismissed_by);
}

// ── Result shape ──────────────────────────────────────────────────────────────

export interface MVPRow {
  player_name: string;
  team_id: SeriesTeamId;
  matches: number;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  total_points: number;
  /** Carried through so the board can show what earned the score. */
  total_runs: number;
  total_wickets: number;
  fielding_dismissals: number;
}

type Acc = {
  team: SeriesTeamId;
  bat: number;
  bowl: number;
  field: number;
  runs: number;
  wickets: number;
  dismissals: number;
  matches: Set<string>;
};

/**
 * MVP points for every player across the given series.
 *
 * Pure — takes the same fully-hydrated series tree the leaderboards use and
 * touches no I/O, so it is safe to run per request and trivial to test.
 */
export function computeMVP(series: FullSeries[], stageFilter?: StageFilter): MVPRow[] {
  const acc = new Map<string, Acc>();

  const ensure = (name: string, team: SeriesTeamId): Acc => {
    let cur = acc.get(name);
    if (!cur) {
      cur = { team, bat: 0, bowl: 0, field: 0, runs: 0, wickets: 0, dismissals: 0, matches: new Set() };
      acc.set(name, cur);
    }
    return cur;
  };

  for (const s of series) {
    const rules = formatRules(s.overs_per_innings);
    const topWicketPoints = (rules.baseRunsPerWicket * 1.0) / RUNS_PER_POINT;

    for (const m of s.matches) {
      if (!matchesStageFilter(m.stage, stageFilter)) continue;

      for (const inn of m.innings) {
        // The batting array is the full squad list (non-batters carry
        // "did_not_bat"), so its length is the squad size the tiers split.
        const squadSize = inn.batting.length;
        const teamBalls = Math.round(oversToDecimal(inn.total_overs) * 6);
        // Runs per ball for the innings as a whole — the bar both the batters
        // and the bowlers who conceded them are measured against.
        const teamRPB = teamBalls > 0 ? inn.total_runs / teamBalls : 0;

        // ── Batting ──────────────────────────────────────────────────────────
        for (const b of inn.batting) {
          const a = ensure(b.player_name, b.team_id);
          a.matches.add(m.id);
          if (b.dismissal_type === "did_not_bat") continue;

          const basePoints = b.runs / RUNS_PER_POINT;
          // Runs made beyond what the innings' own rate would have produced
          // off the same deliveries. Zero when he scored at or below it.
          const balls = b.balls_faced ?? 0;
          const surplus = balls > 0 ? b.runs - teamRPB * balls : 0;
          const rateBonus = surplus > 0 ? (surplus / RUNS_PER_POINT) * rules.rateCredit : 0;

          a.bat += basePoints + rateBonus;
          a.runs += b.runs;
        }

        // ── Wickets: bowling and fielding credit ─────────────────────────────
        for (const b of inn.batting) {
          if (!b.dismissal_type || b.dismissal_type === "not_out") continue;
          if (b.dismissal_type === "did_not_bat" || b.dismissal_type === "retired_hurt") continue;

          const wicketPoints =
            (rules.baseRunsPerWicket * positionWeight(b.batting_order, squadSize)) / RUNS_PER_POINT;

          if (b.dismissal_type === "run_out") {
            // No bowler earns anything. The fielders take the whole wicket —
            // in full for a direct hit, halved when two of them combined.
            const fielders = runOutFielders(b);
            if (fielders.length > 0) {
              const share = 1 / fielders.length;
              for (const f of fielders) {
                const a = ensure(f, inn.bowling_team_id);
                a.field += wicketPoints * share;
                a.dismissals += share;
              }
            }
            continue;
          }

          // Everything else is the bowler's wicket, at full value — CricHeroes
          // stopped splitting with the fielder in Jan 2020.
          if (b.dismissed_by) {
            const a = ensure(b.dismissed_by, inn.bowling_team_id);
            a.bowl += wicketPoints;
          }

          // Catches and stumpings pay the fielder an extra 20% on top.
          if ((b.dismissal_type === "caught" || b.dismissal_type === "stumped") && b.caught_by) {
            for (const f of parseFielders(b.caught_by)) {
              const a = ensure(f, inn.bowling_team_id);
              a.field += wicketPoints * 0.2;
              a.dismissals += 1;
            }
          }
        }

        // ── Bowling: economy and maidens ──────────────────────────────────────
        for (const bw of inn.bowling) {
          const a = ensure(bw.player_name, bw.team_id);
          a.matches.add(m.id);
          a.wickets += bw.wickets;

          a.bowl += haulBonus(bw.wickets);

          // Runs the spell prevented against the innings rate. A maiden makes
          // this large rather than undefined, which is the whole reason
          // CricHeroes needed a separate maiden rule.
          const balls = Math.round(oversToDecimal(bw.overs) * 6);
          const saved = balls > 0 ? teamRPB * balls - bw.runs_conceded : 0;
          if (saved > 0) a.bowl += (saved / RUNS_PER_POINT) * rules.rateCredit;

          // Maidens are still worth calling out on their own: in a 10-over
          // game two of them is a wicket's worth of pressure.
          if (bw.maidens > 0) {
            a.bowl += (bw.maidens / rules.maidensPerWicket) * topWicketPoints;
          }
        }
      }
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return Array.from(acc.entries())
    .map(([player_name, v]) => ({
      player_name,
      team_id: v.team,
      matches: v.matches.size,
      batting_points: round2(v.bat),
      bowling_points: round2(v.bowl),
      fielding_points: round2(v.field),
      total_points: round2(v.bat + v.bowl + v.field),
      total_runs: v.runs,
      total_wickets: v.wickets,
      fielding_dismissals: round2(v.dismissals),
    }))
    // Most points first. Ties go to the bigger all-round contribution — a
    // player who did it with bat AND ball outranks one who did it with either.
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        Math.min(b.batting_points, b.bowling_points) - Math.min(a.batting_points, a.bowling_points) ||
        b.total_runs - a.total_runs,
    );
}
