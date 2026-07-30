// Single source of truth for club-wide statistics. Every page that needs a
// club-wide number (homepage, seasons, members, admin dashboard) should
// read it from here instead of recomputing it inline.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeWeeksPlayed, computePlayersPool, fetchFullSeries } from "@/lib/series";

export type ClubStatistics = {
  /** Count of the Players Pool — everyone who has ever appeared in a recorded scorecard. Matches the /seasons page's Players Pool figure. */
  activeMembers: number;
  /** Sum of total_matches_played across every rivalry_seasons row (active + archived) — matches the /seasons page's Club Stats figure. */
  matchesPlayed: number;
  /** Founding-date baseline + one per recorded series — matches the /seasons page's Weeks Played figure. */
  activeWeeks: number;
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
    activeWeeks: computeWeeksPlayed(seriesRes.data ?? []),
  };
}

// Cached across requests/routes so the homepage, seasons page, members page,
// etc. all share one computation per revalidation window instead of each
// re-querying the database independently.
export const getClubStatistics = unstable_cache(
  computeClubStatistics,
  ["club-statistics"],
  { revalidate: 300, tags: ["club-stats"] },
);
