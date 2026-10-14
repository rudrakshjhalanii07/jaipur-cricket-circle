import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Every player row, phone numbers included, for the admin Members panel. The
// browser can't read phones directly (supabase/lock_down_member_data.sql).
export async function GET(request: Request) {
  if (request.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin.from("players").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ players: data ?? [] });
}
