import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateSchedule } from "@/lib/tournament";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { week_label, overs_per_innings } = body as {
      week_label: string;
      overs_per_innings: number;
    };

    if (!week_label || !overs_per_innings) {
      return NextResponse.json(
        { error: "week_label and overs_per_innings are required" },
        { status: 400 }
      );
    }

    // Create tournament row
    const { data: tournament, error: tError } = await supabaseAdmin
      .from("tournaments")
      .insert({ week_label, overs_per_innings, status: "scheduled" })
      .select()
      .single();

    if (tError || !tournament) {
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

    return NextResponse.json({ tournament_id: tournament.id });
  } catch (err) {
    console.error("tournament/start error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
