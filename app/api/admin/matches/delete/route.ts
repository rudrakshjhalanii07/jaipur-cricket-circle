import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const adminPassword = req.headers.get("x-admin-password");
  
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { match_id } = await req.json();

    if (!match_id) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 });
    }

    // Registrations will be deleted automatically due to ON DELETE CASCADE
    const { error } = await supabaseAdmin
      .from("matches")
      .delete()
      .eq("id", match_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Match deletion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
