import { fetchSeasons } from "@/lib/seasons";
import {
  fetchFullSeries,
  computeLeaderboards,
  computePlayersPool,
} from "@/lib/series";
import { getClubStatistics } from "@/lib/statistics";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { fetchClubRoster } from "@/lib/club-roster.server";
import SeasonsPageClient from "./SeasonsPageClient";

export default async function SeasonsPage() {
  const [seasons, fullSeries, clubStats, playerPhotos, clubRoster] =
    await Promise.all([
      fetchSeasons(),
      fetchFullSeries(),
      getClubStatistics(),
      fetchPlayerPhotos(),
      fetchClubRoster(),
    ]);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const archivedSeasons = seasons.filter((s) => s.status === "archived");

  // Sourced from the centralized statistics service (lib/statistics.ts) so this
  // page and the homepage/about page never drift apart.
  const totalClubMatches = clubStats.matchesPlayed;
  const weeksPlayed = clubStats.activeWeeks;
  const activeSeasonSeries = activeSeason
    ? fullSeries.filter((s) => s.season_id === activeSeason.id)
    : [];
  // Scorecard-derived, so scoped to the season on screen. The club-wide list is
  // the maintained `players` roster, fetched above — see lib/club-roster.ts.
  const playersPool = computePlayersPool(activeSeasonSeries);
  const careerPool = computePlayersPool(fullSeries);
  // Player stats follow the IPL convention: Orange/Purple Cap aggregates count
  // playoff matches too, so these carry NO stage filter. Only the points table
  // stays league-only (computeOverallStandings hardcodes that).
  //
  // The season board is scoped to the ACTIVE season's series; career is every
  // season the club has played. Those are the only two views since Season 3.
  const seasonLeaderboards = computeLeaderboards(activeSeasonSeries);
  const careerLeaderboards = computeLeaderboards(fullSeries);

  return (
    <SeasonsPageClient
      liveActiveSeason={activeSeason}
      archivedSeasons={archivedSeasons}
      totalClubMatches={totalClubMatches}
      weeksPlayed={weeksPlayed}
      playersPool={playersPool}
      careerPool={careerPool}
      clubRoster={clubRoster}
      fullSeries={fullSeries}
      activeSeasonSeries={activeSeasonSeries}
      seasonLeaderboards={seasonLeaderboards}
      careerLeaderboards={careerLeaderboards}
      playerPhotos={playerPhotos}
    />
  );
}
