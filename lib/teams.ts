// Single source of truth for JCC team configuration.
// Used by tournament, toss, and any other page that renders team data.

export type TeamId = "mavericks" | "neurostrikers" | "outliers";
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
    logo: "/teams/mavericks-logo.png",
    captain: "Anil Rawat",
    captainShort: "ANIL",
    jerseyNumber: 4,
    primary: "#E8A820",
    secondary: "#0D0D0D",
    accent: "#F5C842",
    glow: "rgba(245, 200, 66, 0.55)",
    tagline: "Top Guns",
    patternType: "tribal",
  },
  neurostrikers: {
    id: "neurostrikers",
    name: "NeuroStrikers",
    shortName: "NS",
    logo: "/teams/neurostrikers-logo.png",
    captain: "Sagar Sharma",
    captainShort: "SAGAR",
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
    logo: "/teams/outliers-logo.png",
    captain: "Rudraksh Jhalani",
    captainShort: "RUDRA",
    jerseyNumber: 7,
    primary: "#1A7A5E",
    secondary: "#1A1A1A",
    accent: "#22C97A",
    glow: "rgba(34, 201, 122, 0.55)",
    tagline: "Against the Odds",
    patternType: "scratch",
  },
};

export const TEAM_ORDER: TeamId[] = ["mavericks", "neurostrikers", "outliers"];

export function getTeam(id: TeamId): TeamConfig {
  return TEAMS[id];
}
