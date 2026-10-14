// Who may see stats, and for how long.
//
// /stats and the stats on a member's own profile are open to every approved
// member for 14 days, counted from his first login. Seven founding accounts
// keep them for good. Each member's start is stamped once on the players row
// (supabase/add_stats_access_window.sql) and never moves, so logging out and
// back in doesn't restart the clock.

import { supabaseAdmin } from "@/lib/supabase-admin";

export const STATS_TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// The seven permanent members — all-time stats access. The list lives in
// lib/permanent-members.ts so client pages (Members) can use it too.
export { PERMANENT_MEMBER_IDS as PERMANENT_STATS_ACCESS } from "@/lib/permanent-members";
import { PERMANENT_MEMBER_IDS as PERMANENT_STATS_ACCESS } from "@/lib/permanent-members";

export type StatsAccess =
  | { kind: "permanent" }
  | { kind: "trial"; startedAt: string; endsAt: string; daysLeft: number }
  | { kind: "expired"; startedAt: string; endsAt: string }
  /** The start can't be recorded (migration not run yet) — allowed, uncounted. */
  | { kind: "untracked" };

export const hasStatsAccess = (a: StatsAccess) => a.kind !== "expired";

/** Running locally (`next dev`): full access for everyone, no clocks started. */
export const isLocalDev = process.env.NODE_ENV === "development";

/** Where a member stands, given when his 14 days started. Pure — shared with the admin panel. */
export function accessFromStart(playerId: string, started: string | null, now = Date.now()): StatsAccess {
  if (PERMANENT_STATS_ACCESS.has(playerId)) return { kind: "permanent" };
  if (!started) return { kind: "untracked" };
  const ends = new Date(new Date(started).getTime() + STATS_TRIAL_DAYS * DAY_MS);
  const left = ends.getTime() - now;
  if (left <= 0) return { kind: "expired", startedAt: started, endsAt: ends.toISOString() };
  return { kind: "trial", startedAt: started, endsAt: ends.toISOString(), daysLeft: Math.ceil(left / DAY_MS) };
}

/**
 * This member's access, starting his 14 days now if they haven't started.
 * Called on login and on every stats request, so the first of those stamps it.
 */
export async function getStatsAccess(playerId: string): Promise<StatsAccess> {
  if (PERMANENT_STATS_ACCESS.has(playerId) || isLocalDev) return { kind: "permanent" };

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("stats_access_started_at")
    .eq("id", playerId)
    .maybeSingle();
  if (error || !data) {
    console.error("stats access lookup failed:", error?.message);
    return { kind: "untracked" };
  }

  let started = data.stats_access_started_at as string | null;
  if (!started) {
    const now = new Date().toISOString();
    // Only stamps an empty column, so two requests racing can't move it.
    const { data: stamped } = await supabaseAdmin
      .from("players")
      .update({ stats_access_started_at: now })
      .eq("id", playerId)
      .is("stats_access_started_at", null)
      .select("stats_access_started_at")
      .maybeSingle();
    started = (stamped?.stats_access_started_at as string | undefined) ?? now;
  }

  return accessFromStart(playerId, started);
}
