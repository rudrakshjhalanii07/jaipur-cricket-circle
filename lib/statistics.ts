// Single source of truth for club-wide statistics. Every page that needs a
// club-wide number (homepage, rivalry, members, admin dashboard) should
// read it from here instead of recomputing it inline.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeSundaysPlayed, computePlayersPool, fetchFullSeries } from "@/lib/series";

export type ClubStatistics = {
  /** Count of the Players Pool — everyone who has ever appeared in a recorded scorecard. Matches the /rivalry page's Players Pool figure. */
  activeMembers: number;
  /** Sum of total_matches_played across every rivalry_seasons row (active + archived) — matches the /rivalry page's Club Stats figure. */
  matchesPlayed: number;
  /** Founding-Sunday baseline + one per recorded tri-series — matches the /rivalry page's Sundays Played figure. */
  activeSundays: number;
};

async function computeClubStatistics(): Promise<ClubStatistics> {
  const [seasonsRes, seriesRes, fullSeries] = await Promise.all([
    supabaseAdmin.from("rivalry_seasons").select("total_matches_played"),
    supabaseAdmin.from("series").select("started_at"),
    fetchFullSeries(),
  ]);

  const matchesPlayed = (seasonsRes.data ?? []).reduce(
    (sum, row) => sum + (row.total_matches_played || 0),
    0,
  );

  return {
    activeMembers: computePlayersPool(fullSeries).length,
    matchesPlayed,
    activeSundays: computeSundaysPlayed(seriesRes.data ?? []),
  };
}

// Cached across requests/routes so the homepage, rivalry page, members page,
// etc. all share one computation per revalidation window instead of each
// re-querying the database independently.
export const getClubStatistics = unstable_cache(
  computeClubStatistics,
  ["club-statistics"],
  { revalidate: 300, tags: ["club-stats"] },
);
