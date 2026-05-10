import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    const body = await request.json();
    const { match_id, player_id, role } = body;

    // 1. Validate Admin Password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!match_id || !player_id || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Handle Deletion (reset to 'player')
    if (role === "player") {
      const { error: delError } = await supabaseAdmin
        .from("match_player_roles")
        .delete()
        .eq("match_id", match_id)
        .eq("player_id", player_id);

      if (delError) throw delError;
      return NextResponse.json({ success: true, message: "Role reset to player" });
    }

    // 3. Captain Count Check (Max 2 per match)
    if (role === "captain") {
      const { data: captains, error: countError } = await supabaseAdmin
        .from("match_player_roles")
        .select("player_id")
        .eq("match_id", match_id)
        .eq("role", "captain");

      if (countError) throw countError;

      const currentCaptains = captains || [];
      const isAlreadyCaptain = currentCaptains.some(c => c.player_id === player_id);

      if (currentCaptains.length >= 2 && !isAlreadyCaptain) {
        return NextResponse.json(
          { error: "Only 2 captains allowed for this match." },
          { status: 400 }
        );
      }
    }

    // 4. Upsert Role
    const { error: upsertError } = await supabaseAdmin
      .from("match_player_roles")
      .upsert(
        { match_id, player_id, role },
        { onConflict: "match_id,player_id" }
      );

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, role });
  } catch (error: unknown) {
    console.error("API Assign Role Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
