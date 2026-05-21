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

    // Auto-register approved player for the upcoming match
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: matchData } = await supabaseAdmin
        .from("matches")
        .select("*")
        .gte("match_date", today)
        .order("match_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (matchData) {
        // Check if already registered
        const { data: existingReg } = await supabaseAdmin
          .from("registrations")
          .select("id")
          .eq("match_id", matchData.id)
          .eq("player_id", id)
          .maybeSingle();

        if (!existingReg) {
          // Fetch current registrations count to check limit
          const { data: regs } = await supabaseAdmin
            .from("registrations")
            .select("status")
            .eq("match_id", matchData.id);

          const registeredCount = regs?.filter(r => r.status === "registered").length || 0;
          const registrationStatus = registeredCount < matchData.player_limit ? "registered" : "waitlist";

          // Insert registration
          await supabaseAdmin
            .from("registrations")
            .insert({
              match_id: matchData.id,
              player_id: id,
              name: data.name,
              phone: data.phone,
              cricket_role: data.cricket_role,
              status: registrationStatus
            });
        }
      }
    } catch (regErr) {
      // Log error but do not fail the overall approval response
      console.error("Auto-registration error on approval:", regErr);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Admin Player Approve Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
