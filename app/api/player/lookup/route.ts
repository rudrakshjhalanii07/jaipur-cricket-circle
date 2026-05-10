import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Lookup player by exact phone match using admin client
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, name, cricket_role, image_url, team, member_tag, approval_status")
      .eq("phone", phone)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;

    if (!player) {
      return NextResponse.json({ found: false });
    }

    // Return limited fields as requested
    return NextResponse.json({ 
      found: true, 
      player: {
        id: player.id,
        name: player.name,
        cricket_role: player.cricket_role,
        team: player.team,
        member_tag: player.member_tag,
        image_url: player.image_url,
        approval_status: player.approval_status
      }
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
