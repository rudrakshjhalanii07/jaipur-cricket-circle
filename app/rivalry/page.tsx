import { fetchRivalrySeasons, type RivalrySeason } from "@/lib/rivalry";
import {
  fetchFullSeries,
  computeLeaderboards,
  computeSeriesStandings,
  computeOverallStandings,
  type FullSeries,
  type SeriesMatch,
  type SeriesStandingRow,
  type SeriesTeamId,
} from "@/lib/series";
import RivalryPageClient from "./RivalryPageClient";

type BaselineEntry = { team_id: SeriesTeamId; won: number; lost: number; tied: number };

// Build the overall-standings baseline from the frozen pre-import seed columns.
// These never include series-tracked wins, so there's no double-counting when
// merged with computeOverallStandings(fullSeries).
// Losses are derived: in the pre-import 2-team era, mav losses = NS wins and vice-versa.
function buildOverallBaseline(activeSeason: RivalrySeason | null): BaselineEntry[] {
  if (!activeSeason) return [];
  const mavW = activeSeason.mavericks_initial_wins  ?? 0;
  const nsW  = activeSeason.neurostrikers_initial_wins ?? 0;
  const outW = activeSeason.outliers_initial_wins   ?? 0;
  if (mavW === 0 && nsW === 0 && outW === 0) return [];
  const baseline: BaselineEntry[] = [
    { team_id: "mavericks",     won: mavW, lost: nsW + outW, tied: 0 },
    { team_id: "neurostrikers", won: nsW,  lost: mavW + outW, tied: 0 },
  ];
  if (outW > 0) baseline.push({ team_id: "outliers", won: outW, lost: mavW + nsW, tied: 0 });
  return baseline;
}

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


export default async function RivalryPage() {
  const [seasons, fullSeries] = await Promise.all([
    fetchRivalrySeasons(),
    fetchFullSeries(),
  ]);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const archivedSeasons = seasons.filter((s) => s.status === "archived");

  const overallStandings = mergeBaseline(computeOverallStandings(fullSeries), buildOverallBaseline(activeSeason));
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

  return (
    <RivalryPageClient
      liveActiveSeason={activeSeason}
      archivedSeasons={archivedSeasons}
      fullSeries={fullSeries}
      activeSeasonSeries={activeSeasonSeries}
      overallStandings={overallStandings}
      currentSeasonStandings={currentSeasonStandings}
      finalsStandings={finalsStandings}
      latestSeriesName={latestSeriesName}
      latestSeriesLeaderboards={latestSeriesLeaderboards}
      allLeagueLeaderboards={allLeagueLeaderboards}
      finalsLeaderboards={finalsLeaderboards}
    />
  );
}
