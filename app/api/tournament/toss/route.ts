import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TeamId } from "@/lib/teams";
import type { TossDecision } from "@/lib/tournament";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match_id, toss_winner_id, toss_decision, code } = body as {
      match_id: string;
      toss_winner_id: TeamId;
      toss_decision: TossDecision;
      code: string;
    };

    if (!match_id || !toss_winner_id || !toss_decision || !code) {
      return NextResponse.json(
        { error: "match_id, toss_winner_id, toss_decision, and code are required" },
        { status: 400 }
      );
    }

    // The tournament join code (not the admin password) gates who can toss —
    // anyone who has the code for this tournament may conduct its tosses.
    const { data: match } = await supabaseAdmin
      .from("tournament_matches")
      .select("tournament_id")
      .eq("id", match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const { data: tournament } = await supabaseAdmin
      .from("tournaments")
      .select("code, status")
      .eq("id", match.tournament_id)
      .single();

    if (!tournament || !tournament.code || tournament.code !== code.trim().toUpperCase()) {
      return NextResponse.json({ error: "Invalid tournament code" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from("tournament_matches")
      .update({
        toss_winner_id,
        toss_decision,
        status: "toss_done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match_id)
      .eq("status", "scheduled"); // guard: can only set toss once

    if (error) {
      console.error("Failed to record toss:", error);
      return NextResponse.json({ error: "Failed to record toss" }, { status: 500 });
    }

    // Also mark the tournament in_progress if it's still scheduled
    if (tournament.status === "scheduled") {
      await supabaseAdmin
        .from("tournaments")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", match.tournament_id)
        .eq("status", "scheduled");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tournament/toss error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
