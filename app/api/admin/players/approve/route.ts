import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Player ID required" }, { status: 400 });
    }

    // Fetch current player to see if tags/roles are already set
    const { data: currentPlayer } = await supabaseAdmin
      .from("players")
      .select("member_tag, group_role")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({ 
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: "admin",
        is_active: true,
        member_tag: currentPlayer?.member_tag || "member",
        group_role: currentPlayer?.group_role || "member"
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Admin Player Approve Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
