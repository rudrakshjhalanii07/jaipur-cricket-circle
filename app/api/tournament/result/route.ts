import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TeamId } from "@/lib/teams";
import {
  computeStandings,
  resolveFinalists,
  type MarginType,
  type SuperOver,
  type TournamentMatch,
} from "@/lib/tournament";

interface ResultBody {
  match_id: string;
  tournament_id: string;
  // Winner (null only for genuine tie with no super over)
  winner_id: TeamId | null;
  margin_type: MarginType | null;
  margin_value: number | null;
  is_tie: boolean;
  // Innings
  team1_runs: number;
  team1_wickets: number;
  team1_overs: number;   // display decimal e.g. 9.4
  team1_all_out: boolean;
  team2_runs: number;
  team2_wickets: number;
  team2_overs: number;
  team2_all_out: boolean;
  // Super over (optional)
  super_over?: {
    team1_runs: number;
    team2_runs: number;
    winner_id: TeamId;
  };
}

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as ResultBody;
    const {
      match_id, tournament_id,
      winner_id, margin_type, margin_value, is_tie,
      team1_runs, team1_wickets, team1_overs, team1_all_out,
      team2_runs, team2_wickets, team2_overs, team2_all_out,
      super_over: superOverInput,
    } = body;

    if (!match_id || !tournament_id) {
      return NextResponse.json({ error: "match_id and tournament_id required" }, { status: 400 });
    }

    // Build super_over jsonb
    const superOver: SuperOver | null = superOverInput
      ? { played: true, ...superOverInput }
      : null;

    // Points: winner gets 2, loser 0; tie (no super over) → 1 each
    let points_team1 = 0;
    let points_team2 = 0;

    // Fetch current match to know team1_id / team2_id
    const { data: matchRow } = await supabaseAdmin
      .from("tournament_matches")
      .select("team1_id, team2_id, stage")
      .eq("id", match_id)
      .single();

    if (!matchRow) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const effectiveWinner = superOverInput ? superOverInput.winner_id : winner_id;
    if (effectiveWinner) {
      if (effectiveWinner === matchRow.team1_id) {
        points_team1 = 2;
      } else {
        points_team2 = 2;
      }
    } else if (is_tie) {
      points_team1 = 1;
      points_team2 = 1;
    }

    // Update the match row
    const { error: updateError } = await supabaseAdmin
      .from("tournament_matches")
      .update({
        team1_runs, team1_wickets, team1_overs, team1_all_out,
        team2_runs, team2_wickets, team2_overs, team2_all_out,
        winner_id: effectiveWinner ?? null,
        margin_type: margin_type ?? null,
        margin_value: margin_value ?? null,
        is_tie,
        super_over: superOver,
        points_team1,
        points_team2,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match_id);

    if (updateError) {
      console.error("Failed to update match result:", updateError);
      return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
    }

    // Refetch all matches for this tournament to recompute standings
    const { data: allMatches } = await supabaseAdmin
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournament_id)
      .order("match_no", { ascending: true });

    if (!allMatches) {
      return NextResponse.json({ ok: true, standings: null });
    }

    const typedMatches = allMatches as TournamentMatch[];

    // Fetch tournament for overs_per_innings
    const { data: tournament } = await supabaseAdmin
      .from("tournaments")
      .select("overs_per_innings, status")
      .eq("id", tournament_id)
      .single();

    const oversPerInnings = tournament?.overs_per_innings ?? 10;

    const leagueCompleted = typedMatches
      .filter((m) => m.stage === "league")
      .every((m) => m.status === "completed");

    if (leagueCompleted && matchRow.stage === "league") {
      // Compute standings and fill the final
      const standings = computeStandings(typedMatches, oversPerInnings);
      const [finalist1, finalist2] = resolveFinalists(standings);

      const finalMatch = typedMatches.find((m) => m.stage === "final");
      if (finalMatch) {
        await supabaseAdmin
          .from("tournament_matches")
          .update({
            team1_id: finalist1,
            team2_id: finalist2,
            updated_at: new Date().toISOString(),
          })
          .eq("id", finalMatch.id);
      }

      await supabaseAdmin
        .from("tournaments")
        .update({ status: "final_pending", updated_at: new Date().toISOString() })
        .eq("id", tournament_id);

      return NextResponse.json({ ok: true, leagueCompleted: true, finalists: [finalist1, finalist2] });
    }

    // If this was the final, mark tournament completed
    if (matchRow.stage === "final" && effectiveWinner) {
      await supabaseAdmin
        .from("tournaments")
        .update({
          status: "completed",
          champion_team_id: effectiveWinner,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tournament_id);

      return NextResponse.json({ ok: true, champion: effectiveWinner });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tournament/result error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
