import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The Google account each member signs in with (lib/google-login.ts), for the
// Members panel.
//
// GET                   → every link: { player_id, google_email, linked_at, last_login_at }
// POST { playerId }     → clear that member's link; the next Google account
//                         they sign in with becomes the linked one

const authorized = (request: Request) => {
  const password = request.headers.get("x-admin-password");
  return !!password && password === process.env.ADMIN_PASSWORD;
};

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("player_google_links")
    .select("player_id, google_email, linked_at, last_login_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { playerId } = (await request.json().catch(() => ({}))) as { playerId?: string };
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("player_google_links").delete().eq("player_id", playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
