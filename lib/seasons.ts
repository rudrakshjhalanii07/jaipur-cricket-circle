import { supabase } from "./supabase";
import { TEAMS, type TeamId } from "./teams";

// One team's participation in one season. Seasons declare their own roster —
// the legacy 2-captain era has two of these, Season 3 has four — so nothing in
// the app assumes a team count.
export interface SeasonTeam {
  team_id: TeamId;
  captain: string | null;
  display_order: number;
  main_wins: number;
  playoff_wins: number;
  main_ties: number;
  playoff_ties: number;
  // Frozen pre-import seed values — used only for the overall standings merge.
  initial_wins: number;
  initial_exh_wins: number;
  // Free-text caveat shown under the team's win count on the archive card, for
  // when the raw count would mislead: a side that entered a season late has
  // fewer wins because it played fewer matches, not because it was worse.
  // Optional everywhere — most teams have nothing to explain.
  note?: string | null;
}

export interface Season {
  id: string;
  title: string;
  season_label: string | null;
  status: "active" | "archived";
  teams: SeasonTeam[];
  total_initial_matches?: number;
  total_matches_played: number;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function team(
  team_id: TeamId,
  captain: string,
  display_order: number,
  main_wins = 0,
  playoff_wins = 0,
): SeasonTeam {
  return {
    team_id,
    captain,
    display_order,
    main_wins,
    playoff_wins,
    main_ties: 0,
    playoff_ties: 0,
    initial_wins: 0,
    initial_exh_wins: 0,
  };
}

// Rendered only when Supabase is unreachable, so these must stay in step with
// the real rows — a fallback that names the wrong active season is worse than
// no fallback at all.
export const fallbackSeasons: Season[] = [
  {
    id: "jcc-season-3",
    title: "JCC Season 3",
    season_label: "Season 3",
    status: "active",
    teams: [
      team("neurostrikers", "Saurabh Charan", 0),
      team("mavericks", "Nitesh Jhurani", 1),
      team("outliers", "Naman Saini", 2),
      team("vikings", "Bhairav Deep", 3),
    ],
    total_matches_played: 0,
    started_at: "2026-07-24",
    ended_at: null,
    notes: "Current active season. 4 teams, 12-week format, 45 matches.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rawat-sharma-2026",
    title: "JCC Season 2",
    season_label: "Season 2",
    status: "archived",
    teams: [
      team("neurostrikers", "Sagar Sharma", 0, 1),
      team("mavericks", "Anil Rawat", 1, 1),
      {
        ...team("outliers", "Rudraksh Jhalani", 2, 0),
        note: "Entered mid-season — about half the fixtures of the other two.",
      },
    ],
    total_matches_played: 2,
    started_at: "2026-05-17",
    ended_at: null,
    notes: "3-captain season.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "setia-chaudhary-legacy",
    title: "JCC Season 1",
    season_label: "Legacy Season",
    status: "archived",
    teams: [
      team("neurostrikers", "Mr. Opal Chaudhary", 0, 10, 1),
      team("mavericks", "Mr. Nitin Setia", 1, 10, 3),
    ],
    total_matches_played: 24,
    started_at: null,
    ended_at: null,
    notes:
      "First recorded era. 2-captain format. Match-by-match records were not maintained, so summary data is seeded manually.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  // Skip honorifics like "Mr.", "Mrs.", "Dr."
  const first = parts.find((p) => !/^(Mr|Mrs|Ms|Dr)\.?$/i.test(p));
  return first ?? parts[0];
}

export function eraFirstNames(season: Season): string[] {
  return season.teams
    .map((t) => t.captain)
    .filter((c): c is string => !!c?.trim())
    .map(firstName);
}

// "Mavericks (5) - (3) NeuroStrikers" reads fine for two teams but breaks down
// past that, so anything with a third team gets a flat "Name 5 · Name 3" list.
// Used by the homepage and Boundary Banter tickers.
export function seasonScoreline(season: Season): string {
  const parts = (season.teams ?? []).map((t) => ({
    name: TEAMS[t.team_id]?.name ?? t.team_id,
    wins: t.main_wins,
  }));
  if (parts.length === 0) return "No teams recorded";
  if (parts.length === 2) {
    return `${parts[0].name} (${parts[0].wins}) - (${parts[1].wins}) ${parts[1].name}`;
  }
  return parts.map((p) => `${p.name} ${p.wins}`).join(" · ");
}

// Convenience for the common "who captains X this season" lookup.
export function captainOf(season: Season, teamId: TeamId): string | null {
  return season.teams.find((t) => t.team_id === teamId)?.captain ?? null;
}

export type SeasonRow = Omit<Season, "teams"> & { season_teams?: SeasonTeam[] | null };

// Flattens the embedded season_teams rows into Season.teams. Exported because
// the homepage queries rivalry_seasons directly rather than via fetchSeasons,
// and must produce the same shape — a Season without `teams` breaks every
// consumer that iterates the roster.
export function normalizeSeason(row: SeasonRow): Season {
  const { season_teams, ...rest } = row;
  return {
    ...rest,
    teams: [...(season_teams ?? [])].sort((a, b) => a.display_order - b.display_order),
  };
}

export async function fetchSeasons(): Promise<Season[]> {
  try {
    const { data, error } = await supabase
      .from("rivalry_seasons")
      .select("*, season_teams(*)")
      .order("status", { ascending: true }) // 'active' sorts before 'archived' alphabetically
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching seasons from Supabase. Using fallback constants:", error.message);
      return fallbackSeasons;
    }

    if (!data || data.length === 0) {
      return fallbackSeasons;
    }

    return (data as unknown as SeasonRow[]).map(normalizeSeason);
  } catch (err) {
    console.error("Failed to fetch seasons:", err);
    return fallbackSeasons;
  }
}
