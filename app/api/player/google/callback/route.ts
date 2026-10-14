import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { issueMemberPass, MEMBER_COOKIE, memberCookieOptions } from "@/lib/member-session";
import { getStatsAccess } from "@/lib/stats-access";
import {
  CLEAR_COOKIE_OPTIONS,
  exchangeCode,
  HANDOFF_COOKIE,
  HANDOFF_COOKIE_OPTIONS,
  issueHandoff,
  OAUTH_COOKIE,
  readOAuthState,
} from "@/lib/google-login";

// Step 2 of the member login (lib/google-login.ts): Google sends the member
// back here. Links the Google account on first sign-in, checks it on every
// later one, then hands over to the profile page. Every outcome is a redirect
// to /profile; failures carry ?login_error=<code>, which the page explains.
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/profile?login_error=${code}`, request.url));
    res.cookies.set(OAUTH_COOKIE, "", CLEAR_COOKIE_OPTIONS);
    return res;
  };

  try {
    const params = request.nextUrl.searchParams;
    // The member closed or cancelled Google's account chooser.
    if (params.get("error")) return fail("cancelled");

    const playerId = readOAuthState(request.cookies.get(OAUTH_COOKIE)?.value, params.get("state"));
    if (!playerId) return fail("expired");

    const code = params.get("code");
    const google = code ? await exchangeCode(request, code) : null;
    if (!google) return fail("google");

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, is_active, approval_status")
      .eq("id", playerId)
      .maybeSingle();
    if (!player || player.approval_status !== "approved" || !player.is_active) return fail("inactive");

    const { data: link, error: linkErr } = await supabaseAdmin
      .from("player_google_links")
      .select("google_sub")
      .eq("player_id", player.id)
      .maybeSingle();
    if (linkErr) {
      console.error("Google link lookup error:", linkErr);
      return fail("server");
    }

    const now = new Date().toISOString();
    if (link) {
      if (link.google_sub !== google.sub) return fail("other_account");
      await supabaseAdmin
        .from("player_google_links")
        .update({ last_login_at: now, ...(google.email ? { google_email: google.email } : {}) })
        .eq("player_id", player.id);
    } else {
      // First sign-in for this number: link it. google_sub is unique, so an
      // account already linked to another member is refused by the insert.
      const { error: insertErr } = await supabaseAdmin
        .from("player_google_links")
        .insert({ player_id: player.id, google_sub: google.sub, google_email: google.email, last_login_at: now });
      if (insertErr) {
        if (insertErr.code === "23505") return fail("account_in_use");
        console.error("Google link insert error:", insertErr);
        return fail("server");
      }
    }

    const res = NextResponse.redirect(new URL("/profile?login=google", request.url));
    res.cookies.set(OAUTH_COOKIE, "", CLEAR_COOKIE_OPTIONS);
    res.cookies.set(HANDOFF_COOKIE, issueHandoff(player.id), HANDOFF_COOKIE_OPTIONS);
    res.cookies.set(MEMBER_COOKIE, issueMemberPass(player.id), memberCookieOptions);
    // A first login starts the member's 14 days of stats access.
    await getStatsAccess(player.id);
    return res;
  } catch (err) {
    console.error("google/callback error:", err);
    return fail("server");
  }
}
