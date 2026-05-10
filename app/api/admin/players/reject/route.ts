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

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({ 
        approval_status: "rejected"
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Admin Player Reject Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
