import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Member, MemberTag } from "@/lib/types";
import MembersClient from "./MembersClient";

export const metadata: Metadata = {
  title: "Members",
  description: "Meet the legends who define Sunday cricket in Jaipur.",
};

function getDisplayRole(memberTag?: string, groupRole?: string, cricketRole?: string): string {
  const isFounder = memberTag === "founding-member" || groupRole === "founding-member";
  if (groupRole === "captain") return isFounder ? "Founder & Captain" : "Captain";
  if (groupRole === "vice-captain") return isFounder ? "Founding Member & Vice Captain" : "Vice Captain";
  if (groupRole === "admin") return isFounder ? "Founding Member & Admin" : "Admin";
  if (isFounder) return "Founding Member";
  if (cricketRole) {
    if (cricketRole === "all-rounder") return "All-Rounder";
    if (cricketRole === "wicketkeeper") return "Wicketkeeper";
    return cricketRole.charAt(0).toUpperCase() + cricketRole.slice(1);
  }
  return "Member";
}

const getMembers = unstable_cache(
  async (): Promise<Member[]> => {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) return [];

    return data.map((p) => {
      const tags: MemberTag[] = [];
      if (p.member_tag && p.member_tag !== "member") tags.push(p.member_tag as MemberTag);
      if (p.cricket_role) tags.push(p.cricket_role as MemberTag);
      if (
        p.group_role &&
        (p.group_role === "captain" || p.group_role === "vice-captain") &&
        !tags.includes(p.group_role as MemberTag)
      ) {
        tags.push(p.group_role as MemberTag);
      }
      return {
        id: p.id,
        name: p.name,
        initials: p.name
          ? p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
          : "🏏",
        team: p.team || "Unassigned",
        role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role),
        tags,
        image: p.image_url || p.image,
        cricketRole: p.cricket_role as Member["cricketRole"],
        battingStyle: p.batting_style || "Right-hand bat",
        bowlingStyle: p.bowling_style || "N/A",
        shortBio: p.short_bio || p.bio || "A valued member of the circle.",
        joinedDate: p.approved_at || p.created_at || new Date().toISOString(),
      } as Member;
    });
  },
  ["members-page-players"],
  { revalidate: 300 }
);

export default async function MembersPage() {
  const members = await getMembers();
  return <MembersClient members={members} />;
}
