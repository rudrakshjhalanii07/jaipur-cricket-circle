export type MemberTag =
  | "founding-member"
  | "captain"
  | "vice-captain"
  | "batter"
  | "bowler"
  | "all-rounder"
  | "wicketkeeper";

export type CricketRole =
  | "batter"
  | "bowler"
  | "all-rounder"
  | "wicketkeeper";

export interface Member {
  id: string;
  name: string;
  initials: string;
  image?: string;
  role: string;
  cricketRole: CricketRole;
  team: "Mavericks" | "NeuroStrikers" | "The Outliers" | "Vikings" | "Unassigned";
  tags: MemberTag[];
  battingStyle: string;
  bowlingStyle: string;
  shortBio: string;
  joinedDate: string;
  /** Career appearances, summed from every scorecard spelling of the name. */
  matchesPlayed?: number;
  /** Standing in the club, highest the person holds — orders the directory. */
  standing?: MemberStanding;
}

/** Ordered highest to lowest; the index is the sort rank. */
export const MEMBER_STANDING_ORDER = [
  "founder",
  "executive",
  "captain",
  "member",
] as const;

export type MemberStanding = (typeof MEMBER_STANDING_ORDER)[number];

export interface ContentSection {
  type: "text" | "heading" | "image";
  content: string;
  caption?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  coverImage: string;
  contentSections: ContentSection[];
  date: string;
  author: string;
  readTime: string;
  tags: string[];
}
