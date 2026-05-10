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
    const { match_id, updates } = await req.json();

    if (!match_id) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 });
    }

    // If status is set to unscheduled, permanently delete the match record
    // This will also wipe registrations due to ON DELETE CASCADE
    if (updates.status === "unscheduled") {
      const { error: deleteError } = await supabaseAdmin
        .from("matches")
        .delete()
        .eq("id", match_id);
        
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true, match: null });
    }

    const { data, error } = await supabaseAdmin
      .from("matches")
      .update(updates)
      .eq("id", match_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    console.error("Match update error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
