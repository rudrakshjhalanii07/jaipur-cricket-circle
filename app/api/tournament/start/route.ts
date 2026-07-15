import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateSchedule, generateTournamentCode } from "@/lib/tournament";

const DEFAULT_OVERS_PER_INNINGS = 10;
const MAX_CODE_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { week_label } = body as { week_label: string };

    if (!week_label) {
      return NextResponse.json({ error: "week_label is required" }, { status: 400 });
    }

    // Create tournament row, retrying on the rare join-code collision.
    let tournament: { id: string; code: string } | null = null;
    let tError: unknown = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !tournament; attempt++) {
      const code = generateTournamentCode();
      const { data, error } = await supabaseAdmin
        .from("tournaments")
        .insert({ week_label, overs_per_innings: DEFAULT_OVERS_PER_INNINGS, status: "scheduled", code })
        .select()
        .single();
      if (data) { tournament = data; break; }
      tError = error;
      // 23505 = unique_violation — only worth retrying if it's a code collision.
      if ((error as { code?: string } | null)?.code !== "23505") break;
    }

    if (!tournament) {
      console.error("Failed to create tournament:", tError);
      return NextResponse.json({ error: "Failed to create tournament" }, { status: 500 });
    }

    // Generate random schedule and insert 4 match rows
    const fixtures = generateSchedule();
    const matchRows = fixtures.map((f) => ({
      tournament_id: tournament.id,
      match_no: f.match_no,
      stage: f.stage,
      team1_id: f.team1_id,
      team2_id: f.team2_id,
      status: "scheduled",
    }));

    const { error: mError } = await supabaseAdmin
      .from("tournament_matches")
      .insert(matchRows);

    if (mError) {
      console.error("Failed to insert matches:", mError);
      // Roll back tournament
      await supabaseAdmin.from("tournaments").delete().eq("id", tournament.id);
      return NextResponse.json({ error: "Failed to create match schedule" }, { status: 500 });
    }

    return NextResponse.json({ tournament_id: tournament.id, code: tournament.code });
  } catch (err) {
    console.error("tournament/start error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
