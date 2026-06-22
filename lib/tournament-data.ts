// Anon-client read helpers for the tournament system.
// Writes go through /api/tournament/* route handlers (service-role client).

import { supabase } from "./supabase";
import type { Tournament, TournamentMatch } from "./tournament";

export async function fetchActiveTournament(): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .in("status", ["scheduled", "in_progress", "final_pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as Tournament;
  } catch {
    return null;
  }
}

export async function fetchTournamentMatches(
  tournamentId: string
): Promise<TournamentMatch[]> {
  try {
    const { data, error } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("match_no", { ascending: true });

    if (error || !data) return [];
    return data as TournamentMatch[];
  } catch {
    return [];
  }
}

export async function fetchCompletedTournaments(): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as Tournament[];
  } catch {
    return [];
  }
}
