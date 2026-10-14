import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { accessFromStart, PERMANENT_STATS_ACCESS, STATS_TRIAL_DAYS } from "@/lib/stats-access";

// Admin view of the 14-day stats window (lib/stats-access.ts): every approved
// member with where his clock stands, and the levers to change it. The window
// is just players.stats_access_started_at — every action moves that one date.
//
// GET                         → all members and their access
// POST { playerId, action }   → action: "renew"  start a fresh 14 days now
//                                       "extend" push the end out by `days`
//                                       "end"    end access now
//                                       "clear"  forget the start; the clock
//                                                restarts at his next login

const DAY_MS = 24 * 60 * 60 * 1000;

const authorized = (request: Request) => {
  const password = request.headers.get("x-admin-password");
  return !!password && password === process.env.ADMIN_PASSWORD;
};

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id, name, image_url, team, stats_access_started_at")
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    image_url: p.image_url,
    team: p.team,
    startedAt: p.stats_access_started_at as string | null,
    access: accessFromStart(p.id, p.stats_access_started_at),
  }));
  return NextResponse.json({ ok: true, trialDays: STATS_TRIAL_DAYS, members });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { playerId, action, days } = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    action?: "renew" | "extend" | "end" | "clear";
    days?: number;
  };
  if (!playerId || !action) return NextResponse.json({ error: "playerId and action required" }, { status: 400 });
  if (PERMANENT_STATS_ACCESS.has(playerId)) {
    return NextResponse.json({ error: "Permanent members have no clock to change." }, { status: 400 });
  }

  const { data: row, error: readErr } = await supabaseAdmin
    .from("players")
    .select("stats_access_started_at")
    .eq("id", playerId)
    .maybeSingle();
  if (readErr || !row) return NextResponse.json({ error: readErr?.message ?? "Member not found" }, { status: 404 });

  const now = Date.now();
  const current = row.stats_access_started_at ? new Date(row.stats_access_started_at).getTime() : null;
  let next: string | null;
  switch (action) {
    case "renew":
      next = new Date(now).toISOString();
      break;
    case "extend": {
      const n = Math.max(1, Math.min(365, Math.round(Number(days) || 7)));
      // Moving the start forward moves the end with it. An expired window is
      // extended from today, not from a date that has already passed.
      const end = Math.max(current != null ? current + STATS_TRIAL_DAYS * DAY_MS : now, now);
      next = new Date(end + n * DAY_MS - STATS_TRIAL_DAYS * DAY_MS).toISOString();
      break;
    }
    case "end":
      next = new Date(now - STATS_TRIAL_DAYS * DAY_MS - 1000).toISOString();
      break;
    case "clear":
      next = null;
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("players").update({ stats_access_started_at: next }).eq("id", playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, startedAt: next, access: accessFromStart(playerId, next) });
}
