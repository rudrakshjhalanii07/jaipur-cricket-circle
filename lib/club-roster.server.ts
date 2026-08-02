import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDisplayRole } from "@/lib/member-role";
import type { ClubRosterRow } from "@/lib/club-roster";

/**
 * The club's maintained roster — approved, active `players` rows, the same set
 * /members renders. Server-only: the service-role client must never reach the
 * browser bundle.
 */
export const fetchClubRoster = unstable_cache(
  async (): Promise<ClubRosterRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select(
        // No `bio` column here: `players` has only `short_bio`, and asking
        // PostgREST for a column that doesn't exist fails the whole select,
        // which made this function return [] for every caller.
        "id, name, image_url, team, member_tag, group_role, cricket_role, batting_style, bowling_style, short_bio, approved_at, created_at",
      )
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) return [];

    return data
      .filter((p) => !!p.name)
      .map((p) => ({
        id: p.id,
        name: p.name,
        image_url: p.image_url ?? null,
        team: p.team ?? null,
        role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role) ?? null,
        batting_style: p.batting_style ?? null,
        bowling_style: p.bowling_style ?? null,
        short_bio: p.short_bio ?? null,
        joined_date: p.approved_at ?? p.created_at ?? null,
      }));
  },
  ["club-roster-v1"],
  { revalidate: 300 },
);
