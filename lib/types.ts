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
  team: "Mavericks" | "NeuroStrikers" | "The Outliers" | "Unassigned";
  tags: MemberTag[];
  battingStyle: string;
  bowlingStyle: string;
  shortBio: string;
  joinedDate: string;
}

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
