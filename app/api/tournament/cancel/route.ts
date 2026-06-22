import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tournament_id } = await request.json() as { tournament_id: string };
    if (!tournament_id) {
      return NextResponse.json({ error: "tournament_id required" }, { status: 400 });
    }

    // Cascade delete handles tournament_matches automatically
    const { error } = await supabaseAdmin
      .from("tournaments")
      .delete()
      .eq("id", tournament_id);

    if (error) {
      console.error("Failed to cancel tournament:", error);
      return NextResponse.json({ error: "Failed to cancel tournament" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tournament/cancel error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
