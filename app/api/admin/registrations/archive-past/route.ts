import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch matches that have passed
    const { data: pastMatches, error: matchesError } = await supabaseAdmin
      .from("matches")
      .select("id")
      .lt("match_date", today);

    if (matchesError) throw matchesError;

    if (!pastMatches || pastMatches.length === 0) {
      return NextResponse.json({ success: true, message: "No past matches to archive" });
    }

    const pastMatchIds = pastMatches.map(m => m.id);

    // 2. Mark registrations for these matches as archived
    const { error: regError } = await supabaseAdmin
      .from("registrations")
      .update({ status: "archived" })
      .in("match_id", pastMatchIds)
      .neq("status", "archived");

    if (regError) throw regError;

    // 3. Mark the matches as closed if not already
    const { error: matchUpdateError } = await supabaseAdmin
      .from("matches")
      .update({ status: "closed" })
      .in("id", pastMatchIds)
      .neq("status", "closed");

    if (matchUpdateError) throw matchUpdateError;

    return NextResponse.json({ success: true, archived_count: pastMatchIds.length });
  } catch (error) {
    console.error("Admin Archive Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
