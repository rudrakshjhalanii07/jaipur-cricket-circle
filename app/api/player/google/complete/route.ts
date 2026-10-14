import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encrypt } from "@/lib/auth-crypto";
import { profilePayload } from "@/lib/player-profile.server";
import { CLEAR_COOKIE_OPTIONS, HANDOFF_COOKIE, readHandoff } from "@/lib/google-login";

// Step 3 of the member login (lib/google-login.ts): the profile page, just
// back from Google, trades the one-time handoff cookie for the 1-hour
// profile-edit session token and the member's profile.
export async function POST(request: NextRequest) {
  const playerId = readHandoff(request.cookies.get(HANDOFF_COOKIE)?.value);
  const respond = (body: object, status = 200) => {
    const res = NextResponse.json(body, { status });
    res.cookies.set(HANDOFF_COOKIE, "", CLEAR_COOKIE_OPTIONS);
    return res;
  };
  if (!playerId) return respond({ error: "Your sign-in has expired. Please log in again." }, 401);

  try {
    const { data: player } = await supabaseAdmin.from("players").select("*").eq("id", playerId).maybeSingle();
    if (!player || player.approval_status !== "approved" || !player.is_active) {
      return respond({ error: "Membership is no longer approved or active. Please contact the JCC Admin." }, 403);
    }

    const sessionToken = encrypt(
      JSON.stringify({ playerId: player.id, phone: player.phone, expiresAt: Date.now() + 60 * 60 * 1000 })
    );
    return respond({ success: true, sessionToken, player: await profilePayload(player) });
  } catch (err) {
    console.error("google/complete error:", err);
    return respond({ error: "Something went wrong. Please log in again." }, 500);
  }
}
