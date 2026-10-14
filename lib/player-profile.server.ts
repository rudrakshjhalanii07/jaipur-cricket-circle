// The member record the profile page shows, with captaincy read from the
// season being played rather than `players.group_role`.
//
// group_role is the admin panel's own record and goes stale the moment a
// season hands the armband to someone else — the profile kept showing
// "Captain" for members who led a side in an earlier season. Who captains
// *now* comes from the active season's season_teams, matched onto the roster
// the same way /members does it (see app/members/page.tsx captainIds()).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchSeasons } from "@/lib/seasons";
import { createRosterMatcher } from "@/lib/club-roster";
import { TEAMS } from "@/lib/teams";
import { parseFocus } from "@/lib/photo-focus";

type PlayerRow = Record<string, unknown> & { id: string; name: string; group_role?: string | null };

/** `{ group_role, captainOf }` for this player in the active season. */
export async function currentLeadership(player: PlayerRow): Promise<{ group_role: string; captainOf: string | null }> {
  const raw = player.group_role || "member";
  // Strip the stored armband; it is re-applied below only if still true.
  const base = raw === "captain" || raw === "vice-captain" ? "member" : raw;
  try {
    const [seasons, roster] = await Promise.all([
      fetchSeasons(),
      supabaseAdmin.from("players").select("id, name").eq("approval_status", "approved"),
    ]);
    const active = seasons.find((s) => s.status === "active");
    if (!active) return { group_role: base, captainOf: null };
    const matcher = createRosterMatcher(
      (roster.data ?? []).map((r) => ({ id: r.id as string, name: (r.name as string) ?? "", image_url: null, team: null, role: null })),
    );
    for (const t of active.teams) {
      if (t.captain?.trim() && matcher.find(t.captain)?.id === player.id) {
        return { group_role: "captain", captainOf: TEAMS[t.team_id]?.name ?? t.team_id };
      }
    }
    return { group_role: base, captainOf: null };
  } catch (error) {
    console.error("currentLeadership failed:", error);
    return { group_role: base, captainOf: null };
  }
}

/** The shape the profile page stores, built from a players row. */
export async function profilePayload(player: PlayerRow) {
  const lead = await currentLeadership(player);
  return {
    id: player.id,
    name: player.name,
    phone: player.phone,
    cricket_role: player.cricket_role,
    batting_style: (player.batting_style as string) || "Right-hand Bat",
    bowling_style: (player.bowling_style as string) || "N/A",
    bio: (player.short_bio as string) || "",
    image_url: (player.image_url as string) || null,
    image_focus: parseFocus(player.image_focus),
    team: (player.team as string) || "Unassigned",
    member_tag: (player.member_tag as string) || "member",
    group_role: lead.group_role,
    governance_role: (player.governance_role as string) || null,
    is_core_committee: Boolean(player.is_core_committee),
    is_exec_committee: Boolean(player.is_exec_committee),
    approval_status: player.approval_status,
  };
}
