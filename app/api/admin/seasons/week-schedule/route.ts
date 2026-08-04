import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Sets (or clears) where and when a scheduled week is played. Both live on the
// week rather than the match: a week is one booking at one ground, played as an
// unbroken run of matches from a single start time — see resolveVenue and
// resolveMatchTime in lib/season-schedule.ts.
interface WeekScheduleBody {
  series_id: string;
  venue?: string | null;
  /** 24h "HH:MM", as an <input type="time"> produces it. */
  start_time?: string | null;
}

/** "19:30" → "19:30"; anything else → null, so junk can't reach the schedule. */
function normalizeTime(raw: string | null | undefined): string | null {
  const m = raw?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function PATCH(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as WeekScheduleBody;
    if (!body.series_id) {
      return NextResponse.json({ error: "Missing series_id" }, { status: 400 });
    }

    // An empty field means "un-book this", which has to land as NULL so the
    // schedule shows TBC instead of printing "". Only the fields the caller
    // actually sent are touched, so saving a venue can't wipe a start time.
    const patch: { venue?: string | null; start_time?: string | null } = {};
    if ("venue" in body) {
      patch.venue = body.venue?.trim() ? body.venue.trim() : null;
    }
    if ("start_time" in body) {
      patch.start_time = normalizeTime(body.start_time);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("series")
      .update(patch)
      .eq("id", body.series_id)
      .select("id, name, week_no, venue, start_time")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to update week schedule", detail: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, series: data });
  } catch (err) {
    console.error("admin/seasons/week-schedule error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
