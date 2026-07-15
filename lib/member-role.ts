// Single source of truth for how a player's role/tag is displayed anywhere
// on the site (homepage community section, /members, /members/[id], the
// Profile portal, and the About page's committee grids). Previously this
// logic was copy-pasted across three page files and the Profile page read
// only member_tag — silently dropping group_role and is_exec_committee —
// which is why the same person could show as "Member" in one place and
// "Captain" in another.

export interface PlayerRoleFields {
  member_tag?: string | null;
  group_role?: string | null;
  cricket_role?: string | null;
}

/** The badge shown for a player's standing/leadership across the site. */
export function getDisplayRole(
  memberTag?: string | null,
  groupRole?: string | null,
  cricketRole?: string | null
): string {
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

// ---- Governance (Core / Executive Committee) ----
// Backed by players.governance_role / is_core_committee / is_exec_committee
// (see supabase/add_governance_fields.sql). Captaincy is NOT a separate
// governance flag — it reuses the same group_role === "captain" the rest of
// the site already reads, so "Captain" means the same thing everywhere.

export interface GovernanceFields {
  name?: string;
  team?: string | null;
  governance_role?: string | null; // "co-founder" | "permanent-member"
  is_core_committee?: boolean | null;
  is_exec_committee?: boolean | null;
  group_role?: string | null;
  governance_order?: number | null;
}

export function getGovernanceRoleLabel(p: GovernanceFields): string {
  if (p.governance_role === "co-founder") return "Co-Founder";
  if (p.governance_role === "permanent-member") return "Permanent Member";
  return "Committee Member";
}

export function isCommitteeCaptain(p: GovernanceFields): boolean {
  return p.group_role === "captain";
}

/**
 * The one committee member with no `players` row — phone is NOT NULL UNIQUE
 * on that table and no real number is on file for him, so fabricating a
 * player record isn't safe. Kept here, not in app/about/page.tsx, so this
 * remains the single documented exception rather than a second hardcoded
 * roster creeping back in.
 */
export const HONORARY_GOVERNANCE_MEMBERS: (GovernanceFields & { id: string })[] = [
  {
    id: "honorary-abhijeet-singh-shekhawat",
    name: "Abhijeet Singh Shekhawat",
    governance_role: "co-founder",
    is_core_committee: true,
    is_exec_committee: true,
    group_role: "member",
    governance_order: 5,
  },
];
