// Single source of truth for JCC team configuration.
// Used by tournament, toss, and any other page that renders team data.

export type TeamId = "mavericks" | "neurostrikers" | "outliers" | "vikings";
export type PatternType = "tribal" | "lightning" | "scratch";

export interface TeamConfig {
  id: TeamId;
  name: string;
  shortName: string;
  logo: string;
  captain: string;
  captainShort: string;
  jerseyNumber: number | null;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  tagline: string;
  patternType: PatternType;
}

export const TEAMS: Record<TeamId, TeamConfig> = {
  mavericks: {
    id: "mavericks",
    name: "Mavericks",
    shortName: "MAV",
    logo: "/teams/mavericks-logo.webp",
    captain: "Nitesh Jhurani",
    captainShort: "NITESH",
    jerseyNumber: 4,
    primary: "#E8A820",
    secondary: "#0D0D0D",
    accent: "#F5C842",
    glow: "rgba(245, 200, 66, 0.55)",
    tagline: "Born to Dominate",
    patternType: "tribal",
  },
  neurostrikers: {
    id: "neurostrikers",
    name: "NeuroStrikers",
    shortName: "NS",
    logo: "/teams/neurostrikers-logo.webp",
    captain: "Saurabh",
    captainShort: "SAURABH",
    jerseyNumber: 1,
    primary: "#3B6FC4",
    secondary: "#111827",
    accent: "#D9172A",
    glow: "rgba(96, 179, 255, 0.55)",
    tagline: "Beyond Fear",
    patternType: "lightning",
  },
  outliers: {
    id: "outliers",
    name: "The Outliers",
    shortName: "OUT",
    logo: "/teams/outliers-logo.webp",
    captain: "Naman Saini",
    captainShort: "NAMAN",
    jerseyNumber: 7,
    primary: "#1A7A5E",
    secondary: "#1A1A1A",
    accent: "#22C97A",
    glow: "rgba(34, 201, 122, 0.55)",
    tagline: "Against the Odds",
    patternType: "scratch",
  },
  // Colors sampled directly from the Vikings crest (public/teams/vikings-logo.png):
  // fjord-teal shield/ball (#176178), bronze/gold horn & sword trim (#BB7E42),
  // near-black steel base.
  vikings: {
    id: "vikings",
    name: "Vikings",
    shortName: "VIK",
    logo: "/teams/vikings-logo.png",
    captain: "Bhairav Deep",
    captainShort: "BHAIRAV",
    jerseyNumber: 100,
    primary: "#176178",
    secondary: "#0B1620",
    accent: "#BB7E42",
    glow: "rgba(224, 168, 68, 0.55)",
    tagline: "Claim the Throne",
    patternType: "lightning",
  },
};

export const TEAM_ORDER: TeamId[] = ["mavericks", "neurostrikers", "outliers"];

// All 4 teams, including Vikings — used by the auction (which is not bound
// to the existing 3-team weekly tournament's round-robin assumptions).
// Do NOT use this for tournament scheduling; see TEAM_ORDER above.
export const TEAM_ORDER_ALL: TeamId[] = [
  "mavericks",
  "neurostrikers",
  "outliers",
  "vikings",
];

export function getTeam(id: TeamId): TeamConfig {
  return TEAMS[id];
}
