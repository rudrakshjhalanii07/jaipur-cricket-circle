// Matches the database has and the CricHeroes export doesn't — the ones scored
// in /admin/series-import after the last export — in the export's own shape,
// so /stats can show them with everything else (compute.ts, withMatches).
//
// The export stays the standard: a database match that the export also has
// (same date, same two teams) is left out, so nothing is ever counted twice.
// Season 2 is excluded outright — the export is complete for it, and its two
// database-only finals are still awaiting a decision.
//
// What a scorecard can't carry stays empty: dot balls and boundaries conceded
// read 0 for these matches.

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { runOutFielders } from "@/lib/mvp";
import { dashboardData, dashboardIdForName, type DashboardInput } from "./compute";

/** TeamId → the team name the export uses. */
const EXPORT_TEAM: Record<string, string> = {
  neurostrikers: "Neuro strikers",
  vikings: "VIKINGS",
  mavericks: "Mavericks",
  outliers: "Outliers",
};
const exportTeamName: Record<string, string> = Object.fromEntries(
  Object.entries(EXPORT_TEAM).map(([id, n]) => [n, id]),
);

const FIRST_DB_SEASON = 3;

interface DbBat {
  player_name: string;
  batting_order: number;
  runs: number;
  balls_faced: number | null;
  fours: number;
  sixes: number;
  dismissal_type: string | null;
  dismissed_by: string | null;
  caught_by: string | null;
}
interface DbBowl {
  player_name: string;
  bowling_order: number;
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
}
interface DbInnings {
  innings_no: number;
  batting_team_id: string;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  extras_wides: number;
  extras_no_balls: number;
  extras_byes: number;
  extras_leg_byes: number;
  fall_of_wickets: Array<{ wkt: number; score: number; overs: string; player: string }> | null;
  series_batting: DbBat[];
  series_bowling: DbBowl[];
}
interface DbMatch {
  id: string;
  match_date: string | null;
  venue: string | null;
  team1_id: string | null;
  team2_id: string | null;
  winner_id: string | null;
  is_tie: boolean;
  margin_type: string | null;
  margin_value: number | null;
  series_innings: DbInnings[];
}

/** The dismissal written the way the export writes it ("c Nitesh b Sagar"). */
function howOut(b: DbBat): string {
  const bowler = b.dismissed_by ?? "";
  switch (b.dismissal_type) {
    case "bowled":
      return `b ${bowler}`;
    case "lbw":
      return `lbw b ${bowler}`;
    case "caught":
      return b.caught_by && b.caught_by !== bowler ? `c ${b.caught_by} b ${bowler}` : `c&b ${bowler}`;
    case "stumped":
      return `st ${b.caught_by ?? ""} b ${bowler}`;
    case "hit_wicket":
      return `hit wicket b ${bowler}`;
    case "run_out":
      return `run out ${runOutFielders(b).join(" / ")}`.trim();
    case "retired_hurt":
      return "retired hurt";
    default:
      return "not out";
  }
}

const key = (date: string, a: string, b: string) => `${date}|${[a, b].sort().join("|")}`;

/**
 * Cached, and dropped by the "scorecards" tag (lib/scorecards-cache.ts) — every
 * match saved in the admin and the Sunday cron refresh it, so /stats and the
 * Boundary Banter reports pick a new week up straight away.
 */
export const fetchDbOnlyMatches = unstable_cache(loadDbOnlyMatches, ["db-only-matches-v1"], {
  revalidate: 3600,
  tags: ["scorecards"],
});

async function loadDbOnlyMatches(): Promise<DashboardInput | null> {
  try {
    const [{ data: seasons }, { data: series }] = await Promise.all([
      supabaseAdmin.from("rivalry_seasons").select("id, title, season_label"),
      supabaseAdmin
        .from("series")
        .select(
          "season_id, venue, overs_per_innings, series_matches(id, match_date, venue, team1_id, team2_id, winner_id, is_tie, margin_type, margin_value, series_innings(innings_no, batting_team_id, total_runs, total_wickets, total_overs, extras_wides, extras_no_balls, extras_byes, extras_leg_byes, fall_of_wickets, series_batting(player_name, batting_order, runs, balls_faced, fours, sixes, dismissal_type, dismissed_by, caught_by), series_bowling(player_name, bowling_order, overs, maidens, runs_conceded, wickets, wides, no_balls)))",
        ),
    ]);
    if (!seasons || !series) return null;
    const seasonNo = new Map(
      seasons.map((s) => [s.id, Number((s.season_label ?? s.title).match(/(\d+)/)?.[1]) || 0]),
    );

    const inExport = new Set(
      dashboardData.matches.map((m) =>
        key(m.date, exportTeamName[m.teamA] ?? m.teamA, exportTeamName[m.teamB] ?? m.teamB),
      ),
    );

    const out: DashboardInput = { matches: [], innings: [], batting: [], bowling: [], fallOfWickets: [] };
    // Names with no history in the export get a stable id of their own.
    const idFor = (name: string) => dashboardIdForName(name) ?? `db:${name.trim()}`;

    for (const s of series) {
      const season = seasonNo.get(s.season_id) ?? 0;
      if (season < FIRST_DB_SEASON) continue;
      for (const m of s.series_matches as DbMatch[]) {
        if (!m.match_date || !m.team1_id || !m.team2_id) continue;
        if (!(m.winner_id || m.is_tie) || m.series_innings.length === 0) continue;
        if (inExport.has(key(m.match_date, m.team1_id, m.team2_id))) continue;

        const matchId = `db:${m.id}`;
        const team = (id: string) => EXPORT_TEAM[id] ?? id;
        out.matches.push({
          season,
          matchId,
          date: m.match_date,
          venue: m.venue ?? s.venue ?? "",
          overs: s.overs_per_innings,
          teamA: team(m.team1_id),
          teamB: team(m.team2_id),
          winner: m.winner_id ? team(m.winner_id) : null,
          result: m.is_tie ? "tie" : "resulted",
          winBy: m.is_tie ? "" : `${m.margin_value ?? 0} ${m.margin_type === "wickets" ? (m.margin_value === 1 ? "wicket" : "wickets") : "runs"}`,
        });

        for (const inn of m.series_innings) {
          const batting = team(inn.batting_team_id);
          const bowlingId = inn.batting_team_id === m.team1_id ? m.team2_id : m.team1_id;
          const bowling = team(bowlingId);
          out.innings.push({
            matchId,
            inning: inn.innings_no,
            team: batting,
            runs: inn.total_runs,
            wickets: inn.total_wickets,
            overs: String(inn.total_overs),
            extras: inn.extras_wides + inn.extras_no_balls + inn.extras_byes + inn.extras_leg_byes,
          });
          for (const b of [...inn.series_batting].sort((x, y) => x.batting_order - y.batting_order)) {
            // The export lists only those who batted; non-batters still count
            // as present through their bowling.
            if (b.dismissal_type === "did_not_bat") continue;
            out.batting.push({
              matchId,
              inning: inn.innings_no,
              playerId: idFor(b.player_name),
              name: b.player_name,
              team: batting,
              runs: b.runs,
              balls: b.balls_faced ?? 0,
              fours: b.fours,
              sixes: b.sixes,
              howOut: howOut(b),
            });
          }
          for (const b of [...inn.series_bowling].sort((x, y) => x.bowling_order - y.bowling_order)) {
            out.bowling.push({
              matchId,
              inning: inn.innings_no,
              playerId: idFor(b.player_name),
              name: b.player_name,
              team: bowling,
              overs: String(b.overs),
              maidens: b.maidens,
              runs: b.runs_conceded,
              wickets: b.wickets,
              dots: 0,
              wides: b.wides,
              noBalls: b.no_balls,
              fours: 0,
              sixes: 0,
            });
          }
          for (const f of inn.fall_of_wickets ?? []) {
            if (!f.player) continue;
            out.fallOfWickets.push({
              matchId,
              inning: inn.innings_no,
              playerId: idFor(f.player),
              wicket: f.wkt,
              score: f.score,
              over: String(f.overs),
            });
          }
        }
      }
    }
    return out;
  } catch (err) {
    console.error("fetchDbOnlyMatches:", err);
    return null;
  }
}
