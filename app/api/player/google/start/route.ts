import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { googleAuthUrl, googleConfigured, newOAuthState, OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS } from "@/lib/google-login";

// Step 1 of the member login (lib/google-login.ts): the phone number. Checked
// here so a wrong or unapproved number is reported on the form, before the
// member is sent off to Google. Returns the Google URL to go to.
export async function POST(request: Request) {
  try {
    if (!googleConfigured()) {
      console.error("Google login is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
      return NextResponse.json({ error: "Login is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const { phone } = (await request.json().catch(() => ({}))) as { phone?: string };
    const searchPhone = String(phone ?? "").trim();
    if (!searchPhone) {
      return NextResponse.json({ error: "Please enter your registered phone number." }, { status: 400 });
    }

    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, is_active, approval_status")
      .eq("phone", searchPhone)
      .maybeSingle();

    if (error) {
      console.error("Player lookup error:", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    if (!player) {
      return NextResponse.json(
        { error: "No registered member found with this phone number. Please check the number or register as a new member." },
        { status: 404 }
      );
    }
    if (player.approval_status !== "approved" || !player.is_active) {
      return NextResponse.json(
        { error: "Your membership is pending admin approval or has been deactivated. Please contact JCC Support." },
        { status: 403 }
      );
    }

    const { state, cookie } = newOAuthState(player.id);
    const response = NextResponse.json({ url: googleAuthUrl(request, state) });
    response.cookies.set(OAUTH_COOKIE, cookie, OAUTH_COOKIE_OPTIONS);
    return response;
  } catch (err) {
    console.error("google/start error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
