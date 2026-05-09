import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    const body = await request.json();
    const { match_id, updates } = body;

    // 1. Validate Admin Password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!match_id || !updates) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 2. Update Match
    const { error } = await supabaseAdmin
      .from("matches")
      .update(updates)
      .eq("id", match_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Match updated successfully" });
  } catch (error: any) {
    console.error("API Update Match Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
