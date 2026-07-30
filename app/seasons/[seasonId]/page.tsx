import { notFound } from "next/navigation";
import { fetchSeasons } from "@/lib/seasons";
import {
  fetchFullSeries,
  computeLeaderboards,
  computeSeriesStandings,
  computeOverallStandings,
  computePlayersPool,
  type SeriesMatch,
} from "@/lib/series";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { fetchClubRoster } from "@/lib/club-roster.server";
import SeasonDetailClient from "./SeasonDetailClient";

export default async function SeasonDetailPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params;

  const [seasons, fullSeries, playerPhotos, clubRoster] = await Promise.all([
    fetchSeasons(),
    fetchFullSeries(),
    fetchPlayerPhotos(),
    fetchClubRoster(),
  ]);

  const season = seasons.find((s) => s.id === seasonId) ?? null;
  const series = fullSeries.filter((s) => s.season_id === seasonId);

  // A season with no linked tri-series has nothing to show on a detail
  // page — same reason its ArchivedEraCard on /seasons never links here.
  if (!season || series.length === 0) notFound();

  const playersPool = computePlayersPool(series);
  const careerPool = computePlayersPool(fullSeries);
  const overallStandings = computeOverallStandings(series);
  const latestSeries = series.reduce((a, b) => (b.series_no > a.series_no ? b : a));
  const currentSeriesStandings = computeOverallStandings([latestSeries]);
  // League + playoffs combined, per the IPL Orange/Purple Cap convention. The
  // board offers this season vs. the club's whole career — nothing narrower.
  const seasonLeaderboards = computeLeaderboards(series);
  const careerLeaderboards = computeLeaderboards(fullSeries);
  const finalsStandings = computeSeriesStandings(
    series.flatMap((s) => s.matches as SeriesMatch[]),
    "playoffs",
  );

  return (
    <SeasonDetailClient
      season={season}
      series={series}
      playersPool={playersPool}
      careerPool={careerPool}
      clubRoster={clubRoster}
      overallStandings={overallStandings}
      currentSeriesStandings={currentSeriesStandings}
      finalsStandings={finalsStandings}
      latestSeriesName={latestSeries.name}
      seasonLeaderboards={seasonLeaderboards}
      careerLeaderboards={careerLeaderboards}
      playerPhotos={playerPhotos}
    />
  );
}
