import { NextResponse } from "next/server";
import { decrypt } from "@/lib/auth-crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { issueMemberPass, MEMBER_COOKIE, memberCookieOptions } from "@/lib/member-session";
import { getStatsAccess } from "@/lib/stats-access";

// Issues the member pass for a profile login that predates it.
//
// Members already signed in on /profile hold a session token in localStorage
// but no pass cookie, so /stats would ask them to log in again. The profile
// page posts that token here; if it is still valid and the member is still
// approved, the pass is set and they're through.
export async function POST(request: Request) {
  try {
    const { sessionToken } = await request.json();
    let payload: { playerId?: string; expiresAt?: number };
    try {
      payload = JSON.parse(decrypt(String(sessionToken ?? "")));
    } catch {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }
    if (!payload.playerId || !payload.expiresAt || Date.now() > payload.expiresAt) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, approval_status, is_active")
      .eq("id", payload.playerId)
      .maybeSingle();
    if (!player || player.approval_status !== "approved" || player.is_active === false) {
      return NextResponse.json({ error: "Membership is not active." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(MEMBER_COOKIE, issueMemberPass(player.id), memberCookieOptions);
    await getStatsAccess(player.id);
    return response;
  } catch (err) {
    console.error("player/session error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
