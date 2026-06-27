import { fetchRivalrySeasons, type RivalrySeason } from "@/lib/rivalry";
import {
  fetchFullSeries,
  computeLeaderboards,
  computeTriSeriesWins,
  computeSeriesStandings,
  computeOverallStandings,
  type FullSeries,
  type SeriesMatch,
  type SeriesStandingRow,
  type SeriesTeamId,
} from "@/lib/series";
import RivalryPageClient from "./RivalryPageClient";

type BaselineEntry = { team_id: SeriesTeamId; won: number; lost: number; tied: number };

// Prior matches played before the tri-series import system existed.
const CURRENT_SEASON_BASELINE: BaselineEntry[] = [
  { team_id: "mavericks", won: 5, lost: 3, tied: 0 },
  { team_id: "neurostrikers", won: 3, lost: 5, tied: 0 },
];
const OVERALL_BASELINE: BaselineEntry[] = [
  { team_id: "mavericks", won: 5, lost: 3, tied: 0 },
  { team_id: "neurostrikers", won: 3, lost: 5, tied: 0 },
];

function mergeBaseline(rows: SeriesStandingRow[], baseline: BaselineEntry[]): SeriesStandingRow[] {
  const map = new Map<string, SeriesStandingRow>(rows.map((r) => [r.team_id, { ...r }]));
  for (const b of baseline) {
    const cur = map.get(b.team_id) ?? { team_id: b.team_id, played: 0, won: 0, lost: 0, tied: 0, points: 0, win_pct: 0, nrr: 0 };
    cur.won += b.won; cur.lost += b.lost; cur.tied += b.tied;
    cur.played = cur.won + cur.lost + cur.tied;
    cur.points = cur.won * 2 + cur.tied;
    map.set(b.team_id, cur);
  }
  const out = [...map.values()];
  for (const r of out) r.win_pct = r.played > 0 ? Math.round((r.points / (r.played * 2)) * 100) : 0;
  return out.sort((a, b) => b.win_pct - a.win_pct || b.points - a.points);
}

function applyLiveSeasonStats(season: RivalrySeason, matches: SeriesMatch[]): RivalrySeason {
  const league = computeSeriesStandings(matches, "league");
  const final = computeSeriesStandings(matches, "final");
  const get = (rows: SeriesStandingRow[], id: string, k: "won" | "tied") =>
    rows.find((r) => r.team_id === id)?.[k] ?? 0;
  const base = (id: string) => CURRENT_SEASON_BASELINE.find((b) => b.team_id === id)?.won ?? 0;
  const baseTotal = CURRENT_SEASON_BASELINE.reduce((s, b) => s + b.won, 0);
  return {
    ...season,
    neurostrikers_main_wins: get(league, "neurostrikers", "won") + base("neurostrikers"),
    mavericks_main_wins: get(league, "mavericks", "won") + base("mavericks"),
    outliers_main_wins: get(league, "outliers", "won") + base("outliers"),
    neurostrikers_exhibition_wins: get(final, "neurostrikers", "won"),
    mavericks_exhibition_wins: get(final, "mavericks", "won"),
    outliers_exhibition_wins: get(final, "outliers", "won"),
    neurostrikers_main_ties: get(league, "neurostrikers", "tied"),
    mavericks_main_ties: get(league, "mavericks", "tied"),
    outliers_main_ties: get(league, "outliers", "tied"),
    neurostrikers_exhibition_ties: get(final, "neurostrikers", "tied"),
    mavericks_exhibition_ties: get(final, "mavericks", "tied"),
    outliers_exhibition_ties: get(final, "outliers", "tied"),
    total_matches_played:
      matches.filter((m) => m.stage === "league" && (m.winner_id || m.is_tie)).length + baseTotal,
  };
}

export default async function RivalryPage() {
  const [seasons, fullSeries] = await Promise.all([
    fetchRivalrySeasons(),
    fetchFullSeries(),
  ]);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const archivedSeasons = seasons.filter((s) => s.status === "archived");

  const baseWins = {
    mavericks: seasons.reduce((s, e) => s + e.mavericks_main_wins, 0),
    neurostrikers: seasons.reduce((s, e) => s + e.neurostrikers_main_wins, 0),
    outliers: seasons.reduce((s, e) => s + (e.outliers_main_wins ?? 0), 0),
  };
  const triWins = computeTriSeriesWins(fullSeries);
  const totalWins = {
    mavericks: baseWins.mavericks + triWins.mavericks,
    neurostrikers: baseWins.neurostrikers + triWins.neurostrikers,
    outliers: triWins.outliers,
  };

  const overallStandings = mergeBaseline(computeOverallStandings(fullSeries), OVERALL_BASELINE);
  const activeSeasonSeries = activeSeason
    ? fullSeries.filter((s) => s.season_id === activeSeason.id)
    : [];
  const latestSeries = activeSeasonSeries.length
    ? activeSeasonSeries.reduce((a, b) => (b.series_no > a.series_no ? b : a))
    : null;
  const currentSeasonStandings = latestSeries ? computeOverallStandings([latestSeries]) : [];
  const latestSeriesName = latestSeries?.name ?? null;
  const latestSeriesLeaderboards = computeLeaderboards(latestSeries ? [latestSeries] : [], "league");
  const allLeagueLeaderboards = computeLeaderboards(fullSeries, "league");
  const finalsLeaderboards = computeLeaderboards(fullSeries, "final");
  const finalsStandings = computeSeriesStandings(
    fullSeries.flatMap((s) => s.matches as SeriesMatch[]),
    "final",
  );
  const liveActiveSeason = activeSeason
    ? applyLiveSeasonStats(
        activeSeason,
        activeSeasonSeries.flatMap((s) => s.matches as SeriesMatch[]),
      )
    : null;

  return (
    <RivalryPageClient
      liveActiveSeason={liveActiveSeason}
      archivedSeasons={archivedSeasons}
      fullSeries={fullSeries}
      activeSeasonSeries={activeSeasonSeries}
      overallStandings={overallStandings}
      currentSeasonStandings={currentSeasonStandings}
      finalsStandings={finalsStandings}
      latestSeriesName={latestSeriesName}
      totalWins={totalWins}
      latestSeriesLeaderboards={latestSeriesLeaderboards}
      allLeagueLeaderboards={allLeagueLeaderboards}
      finalsLeaderboards={finalsLeaderboards}
    />
  );
}
