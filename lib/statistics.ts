// Single source of truth for club-wide statistics. Every page that needs a
// club-wide number (homepage, seasons, members, admin dashboard) should
// read it from here instead of recomputing it inline.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeWeeksPlayed, computePlayersPool, fetchFullSeries, oversToDecimal } from "@/lib/series";
import { MATCH_SLOT_MINUTES } from "@/lib/season-schedule";

export type ClubStatistics = {
  /** Count of the Players Pool — everyone who has ever appeared in a recorded scorecard. Matches the /seasons page's Players Pool figure. */
  activeMembers: number;
  /** Sum of total_matches_played across every rivalry_seasons row (active + archived) — matches the /seasons page's Club Stats figure. */
  matchesPlayed: number;
  /** Founding-date baseline + one per recorded series — matches the /seasons page's Weeks Played figure. */
  activeWeeks: number;
  /**
   * Weeks cricket was actually played: every week from the club's first game
   * to the first recorded scorecard (the club played weekly before it kept
   * scorecards), plus each distinct week with a recorded match since.
   */
  weeksPlayed: number;
  /** Overs bowled across every recorded scorecard. Season 1 kept none, so it adds nothing. */
  oversBowled: number;
  /** Most players on one matchday, from the scorecards, and the day it happened. */
  biggestGathering: { players: number; date: string } | null;
  /** matchesPlayed × the 55-minute match slot, in whole hours. */
  hoursOfCricket: number;
  /** Teams in the active season. */
  competitiveTeams: number;
  /** Approved, active rows in the players table — the /members count. */
  approvedMembers: number;
};

/** The club's first game — 8 March 2026, the five founders. */
const FIRST_GAME = "2026-03-08";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday of the ISO week a date falls in, as YYYY-MM-DD. */
function weekOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function computeClubStatistics(): Promise<ClubStatistics> {
  const [seasonsRes, seriesRes, fullSeries, activeTeamsRes] = await Promise.all([
    supabaseAdmin.from("rivalry_seasons").select("total_matches_played"),
    supabaseAdmin.from("series").select("started_at"),
    fetchFullSeries(),
    supabaseAdmin.from("season_teams").select("team_id, rivalry_seasons!inner(status)").eq("rivalry_seasons.status", "active"),
  ]);
  const { count: approvedMembers } = await supabaseAdmin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "approved")
    .eq("is_active", true);

  const matchesPlayed = (seasonsRes.data ?? []).reduce(
    (sum, row) => sum + (row.total_matches_played || 0),
    0,
  );

  // Scorecard-derived figures: only matches that were actually played.
  let balls = 0;
  const weeks = new Set<string>();
  const playersByDay = new Map<string, Set<string>>();
  for (const s of fullSeries) {
    for (const m of s.matches) {
      if (!(m.winner_id || m.is_tie) || m.innings.length === 0 || !m.match_date) continue;
      weeks.add(weekOf(m.match_date));
      const day = playersByDay.get(m.match_date) ?? new Set<string>();
      for (const inn of m.innings) {
        balls += Math.round(oversToDecimal(inn.total_overs) * 6);
        for (const b of inn.batting) day.add(b.player_name);
        for (const b of inn.bowling) day.add(b.player_name);
      }
      playersByDay.set(m.match_date, day);
    }
  }
  const firstRecorded = [...weeks].sort()[0];
  const weeksBeforeRecords = firstRecorded
    ? Math.max(0, Math.round((new Date(firstRecorded).getTime() - new Date(weekOf(FIRST_GAME)).getTime()) / WEEK_MS))
    : 0;
  const biggest = [...playersByDay].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0];

  return {
    activeMembers: computePlayersPool(fullSeries).length,
    matchesPlayed,
    activeWeeks: computeWeeksPlayed(seriesRes.data ?? []),
    weeksPlayed: weeksBeforeRecords + weeks.size,
    oversBowled: Math.floor(balls / 6),
    biggestGathering: biggest ? { players: biggest[1].size, date: biggest[0] } : null,
    hoursOfCricket: Math.floor((matchesPlayed * MATCH_SLOT_MINUTES) / 60),
    competitiveTeams: new Set((activeTeamsRes.data ?? []).map((r) => r.team_id)).size,
    approvedMembers: approvedMembers ?? 0,
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
