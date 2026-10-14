// Who captained each side in each match, and who won the toss — for the
// Captains tab on /stats.
//
// Captains come from the CricHeroes export, which tags them "(c)" on the
// batting and bowling cards; matches scored in the admin carry the captain's
// name on series_matches. The toss is only in the database (the export never
// records it), so toss figures cover the matches scored in the admin.
//
// A database match is paired with its export twin by date and the two teams;
// when the same two teams met twice that day, by order of play.

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TEAMS, type TeamId } from "@/lib/teams";
import { dashboardData, dashboardMergedId } from "./compute";

export type CaptaincyRow = {
  /** CardData match id: the export's, or "db:<uuid>" for a database-only match. */
  matchId: string;
  /** Team display name, as CardData writes it ("The Outliers"). */
  team: string;
  /** Merged export player id, when the export tagged the captain. */
  captainId: string | null;
  /** Captain's name as recorded in the database (for database-only matches). */
  captainName: string | null;
  toss: "won" | "lost" | null;
  decision: "bat" | "bowl" | null;
};

const EXPORT_TEAM: Record<string, string> = {
  neurostrikers: "Neuro strikers",
  vikings: "VIKINGS",
  mavericks: "Mavericks",
  outliers: "Outliers",
};
const ID_OF: Record<string, string> = Object.fromEntries(Object.entries(EXPORT_TEAM).map(([id, n]) => [n, id]));
const pairKey = (date: string, a: string, b: string) => `${date}|${[a, b].sort().join("|")}`;

type DbRow = {
  id: string;
  match_no: number;
  match_date: string | null;
  team1_id: string;
  team2_id: string;
  toss_winner_id: string | null;
  toss_decision: "bat" | "bowl" | null;
  team1_captain: string | null;
  team2_captain: string | null;
  winner_id: string | null;
  is_tie: boolean;
};

export async function loadCaptaincy(): Promise<CaptaincyRow[]> {
  // Captains the export tagged, per match and team.
  const tagged = new Map<string, string>();
  for (const r of [...dashboardData.batting, ...dashboardData.bowling]) {
    if (/\(c( & wk)?\)/i.test(r.name)) tagged.set(`${r.matchId}|${r.team}`, dashboardMergedId(r.playerId));
  }

  const { data } = await supabaseAdmin
    .from("series_matches")
    .select("id, match_no, match_date, team1_id, team2_id, toss_winner_id, toss_decision, team1_captain, team2_captain, winner_id, is_tie");
  const db = ((data ?? []) as DbRow[]).filter((m) => m.match_date && (m.winner_id || m.is_tie));

  // Export matches grouped by date + pair, in order of play.
  const exportBy = new Map<string, string[]>();
  for (const m of [...dashboardData.matches].sort((a, b) => a.matchId.localeCompare(b.matchId))) {
    const k = pairKey(m.date, ID_OF[m.teamA] ?? m.teamA, ID_OF[m.teamB] ?? m.teamB);
    (exportBy.get(k) ?? exportBy.set(k, []).get(k)!).push(m.matchId);
  }
  const dbBy = new Map<string, DbRow[]>();
  for (const m of [...db].sort((a, b) => a.match_no - b.match_no)) {
    const k = pairKey(m.match_date!, m.team1_id, m.team2_id);
    (dbBy.get(k) ?? dbBy.set(k, []).get(k)!).push(m);
  }

  const rows: CaptaincyRow[] = [];
  const seen = new Set<string>();
  const push = (matchId: string, teamId: string, dbm: DbRow | undefined) => {
    const team = EXPORT_TEAM[teamId] ?? teamId;
    const k = `${matchId}|${team}`;
    if (seen.has(k)) return;
    seen.add(k);
    const isTeam1 = dbm?.team1_id === teamId;
    rows.push({
      matchId,
      team: TEAMS[teamId as TeamId]?.name ?? team,
      captainId: tagged.get(k) ?? null,
      captainName: dbm ? (isTeam1 ? dbm.team1_captain : dbm.team2_captain) : null,
      toss: dbm?.toss_winner_id ? (dbm.toss_winner_id === teamId ? "won" : "lost") : null,
      decision: dbm?.toss_winner_id ? (dbm.toss_winner_id === teamId ? dbm.toss_decision : dbm.toss_decision === "bat" ? "bowl" : dbm.toss_decision === "bowl" ? "bat" : null) : null,
    });
  };

  for (const [k, ids] of exportBy) {
    const dbs = dbBy.get(k) ?? [];
    ids.forEach((matchId, i) => {
      const m = dashboardData.matches.find((x) => x.matchId === matchId)!;
      const dbm = dbs[i];
      for (const t of [m.teamA, m.teamB]) push(matchId, ID_OF[t] ?? t, dbm);
    });
  }
  // Database-only matches (scored after the export).
  for (const [k, dbs] of dbBy) {
    const exported = exportBy.get(k)?.length ?? 0;
    for (const dbm of dbs.slice(exported)) for (const t of [dbm.team1_id, dbm.team2_id]) push(`db:${dbm.id}`, t, dbm);
  }
  return rows;
}

export const fetchCaptaincy = unstable_cache(loadCaptaincy, ["captaincy-v1"], { revalidate: 3600, tags: ["scorecards"] });
