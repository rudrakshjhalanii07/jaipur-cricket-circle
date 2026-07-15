import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { TeamId } from "@/lib/teams";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tournament_id, team1_id, team2_id } = await request.json() as {
      tournament_id: string;
      team1_id: TeamId;
      team2_id: TeamId;
    };

    if (!tournament_id || !team1_id || !team2_id || team1_id === team2_id) {
      return NextResponse.json(
        { error: "tournament_id, team1_id, and two distinct team2_id are required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("tournament_matches")
      .update({ team1_id, team2_id, updated_at: new Date().toISOString() })
      .eq("tournament_id", tournament_id)
      .eq("stage", "final");

    if (error) {
      console.error("Failed to set final matchup:", error);
      return NextResponse.json({ error: "Failed to set final matchup" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tournament/set-final error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
