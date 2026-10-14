import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readMemberPass, MEMBER_COOKIE } from "@/lib/member-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { profilePayload } from "@/lib/player-profile.server";

// The signed-in member's current record, for the profile page. The page keeps
// a copy in localStorage from login, which goes stale (an old captaincy, a
// team change); it calls this on load to replace it. Authenticated by the
// 30-day member pass, so it works long after the 1-hour edit token expires.
export async function GET() {
  const id = readMemberPass((await cookies()).get(MEMBER_COOKIE)?.value);
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: player } = await supabaseAdmin.from("players").select("*").eq("id", id).maybeSingle();
  if (!player || player.approval_status !== "approved" || player.is_active === false) {
    return NextResponse.json({ error: "Membership is not active." }, { status: 403 });
  }
  return NextResponse.json({ player: await profilePayload(player) });
}
