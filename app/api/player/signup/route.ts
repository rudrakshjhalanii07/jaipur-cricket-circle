import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { insertPendingPlayer } from "@/lib/player-insert";
import { parseFocus } from "@/lib/photo-focus";

// A membership request from /profile or /register. Runs on the server because
// the browser can no longer read phone numbers or write to players
// (supabase/lock_down_member_data.sql) — and so a sign-up can only ever create
// a *pending* member, whatever the request says.
//
// → { status: "pending" }   request recorded (or one was already waiting)
// → 409                     the number belongs to an approved member
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      phone?: string;
      cricket_role?: string;
      image_url?: string | null;
      image_focus?: unknown;
    };
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const cricketRole = body.cricket_role ?? "all-rounder";
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone number are required." }, { status: 400 });
    }
    if (!["all-rounder", "batter", "bowler", "wicketkeeper"].includes(cricketRole)) {
      return NextResponse.json({ error: "Invalid cricket role selected." }, { status: 400 });
    }

    const { data: existing, error: existErr } = await supabaseAdmin
      .from("players")
      .select("approval_status")
      .eq("phone", phone)
      .maybeSingle();
    if (existErr) throw existErr;
    if (existing) {
      if (existing.approval_status === "approved") {
        return NextResponse.json({ error: "You are already an approved member. Please log in instead." }, { status: 409 });
      }
      return NextResponse.json({ status: "pending" });
    }

    const focus = body.image_url && body.image_focus ? parseFocus(body.image_focus) : null;
    const { error: createErr } = await insertPendingPlayer(supabaseAdmin, {
      name,
      phone,
      cricket_role: cricketRole,
      approval_status: "pending",
      image_url: body.image_url || null,
      ...(focus ? { image_focus: focus } : {}),
    });
    if (createErr) throw createErr;
    return NextResponse.json({ status: "pending" });
  } catch (err) {
    console.error("player/signup error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
