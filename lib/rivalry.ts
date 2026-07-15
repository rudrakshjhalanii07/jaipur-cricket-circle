import { supabase } from "./supabase";

export interface RivalrySeason {
  id: string;
  title: string;
  season_label: string | null;
  status: "active" | "archived";
  mavericks_captain: string;
  neurostrikers_captain: string;
  outliers_captain: string | null;
  // Running totals (initial baseline + all recorded series wins) — kept live by DB trigger
  mavericks_main_wins: number;
  neurostrikers_main_wins: number;
  outliers_main_wins: number;
  mavericks_exhibition_wins: number;
  neurostrikers_exhibition_wins: number;
  outliers_exhibition_wins: number;
  mavericks_main_ties?: number;
  neurostrikers_main_ties?: number;
  outliers_main_ties?: number;
  mavericks_exhibition_ties?: number;
  neurostrikers_exhibition_ties?: number;
  outliers_exhibition_ties?: number;
  // Frozen pre-import seed values — used only for the overall standings merge
  mavericks_initial_wins?: number;
  neurostrikers_initial_wins?: number;
  outliers_initial_wins?: number;
  total_initial_matches?: number;
  total_matches_played: number;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const fallbackRivalrySeasons: RivalrySeason[] = [
  {
    id: "rawat-sharma-2026",
    title: "The Sagar-Anil-Rudraksh Era",
    season_label: "Current Season",
    status: "active",
    mavericks_captain: "Anil Rawat",
    neurostrikers_captain: "Sagar Sharma",
    outliers_captain: "Rudraksh Jhalani",
    total_matches_played: 2,
    mavericks_main_wins: 1,
    neurostrikers_main_wins: 1,
    outliers_main_wins: 0,
    mavericks_exhibition_wins: 0,
    neurostrikers_exhibition_wins: 0,
    outliers_exhibition_wins: 0,
    started_at: "2026-05-17",
    ended_at: null,
    notes: "Current active 3-captain rivalry season.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "setia-chaudhary-legacy",
    title: "The Opal-Nitin Era",
    season_label: "Legacy Season",
    status: "archived",
    mavericks_captain: "Mr. Nitin Setia",
    neurostrikers_captain: "Mr. Opal Chaudhary",
    outliers_captain: null,
    total_matches_played: 24,
    mavericks_main_wins: 10,
    neurostrikers_main_wins: 10,
    outliers_main_wins: 0,
    mavericks_exhibition_wins: 3,
    neurostrikers_exhibition_wins: 1,
    outliers_exhibition_wins: 0,
    started_at: null,
    ended_at: null,
    notes: "First recorded rivalry era. 2-captain format. Match-by-match records were not maintained, so summary data is seeded manually.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  // Skip honorifics like "Mr.", "Mrs.", "Dr."
  const first = parts.find(p => !/^(Mr|Mrs|Ms|Dr)\.?$/i.test(p));
  return first ?? parts[0];
}

export function eraFirstNames(season: RivalrySeason): string[] {
  return [
    season.neurostrikers_captain,
    season.mavericks_captain,
    ...(season.outliers_captain ? [season.outliers_captain] : []),
  ].map(firstName);
}

export async function fetchRivalrySeasons(): Promise<RivalrySeason[]> {
  try {
    const { data, error } = await supabase
      .from("rivalry_seasons")
      .select("*")
      .order("status", { ascending: true }) // 'active' sorts before 'archived' alphabetically
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching rivalry seasons from Supabase. Using fallback constants:", error.message);
      return fallbackRivalrySeasons;
    }

    if (!data || data.length === 0) {
      return fallbackRivalrySeasons;
    }

    return data as RivalrySeason[];
  } catch (err) {
    console.error("Failed to fetch rivalry seasons:", err);
    return fallbackRivalrySeasons;
  }
}
