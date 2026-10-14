import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseFocus } from "@/lib/photo-focus";
import { refreshMembers } from "@/lib/members-cache";

// Admin "Photo framing" (components/admin/PhotoFramingControl.tsx): every
// member photo with where its face is (players.image_focus, see
// lib/photo-focus.ts). Detection runs in the admin's browser; this only reads
// and writes the result.
//
// GET                          → members with a photo, and their framing
// POST { playerId, focus }     → save a framing (focus null clears it)

const authorized = (request: Request) => {
  const password = request.headers.get("x-admin-password");
  return !!password && password === process.env.ADMIN_PASSWORD;
};

const MISSING = "Run supabase/add_player_image_focus.sql in the Supabase SQL editor first.";

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id, name, team, image_url, image_focus, approval_status")
    .not("image_url", "is", null)
    .order("name");
  if (error) {
    const missing = /image_focus/i.test(error.message);
    return NextResponse.json({ error: missing ? MISSING : error.message }, { status: missing ? 409 : 500 });
  }

  return NextResponse.json({
    members: (data ?? [])
      .filter((p) => !!p.image_url)
      .map((p) => ({
        id: p.id as string,
        name: (p.name as string) ?? "",
        team: (p.team as string | null) ?? null,
        approved: p.approval_status === "approved",
        image_url: p.image_url as string,
        focus: parseFocus(p.image_focus),
      })),
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { playerId?: unknown; focus?: unknown } | null;
  if (!body || typeof body.playerId !== "string") return NextResponse.json({ error: "playerId required" }, { status: 400 });
  const focus = body.focus === null ? null : parseFocus(body.focus);
  if (body.focus !== null && !focus) return NextResponse.json({ error: "Invalid framing" }, { status: 400 });

  const { error } = await supabaseAdmin.from("players").update({ image_focus: focus }).eq("id", body.playerId);
  if (error) {
    const missing = /image_focus/i.test(error.message);
    return NextResponse.json({ error: missing ? MISSING : error.message }, { status: missing ? 409 : 500 });
  }
  refreshMembers();
  return NextResponse.json({ ok: true, focus });
}
