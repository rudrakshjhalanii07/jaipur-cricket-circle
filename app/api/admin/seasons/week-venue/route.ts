import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Sets (or clears) the ground a scheduled week is played at. Venue lives on the
// week rather than the match because a week is always played at one ground —
// see resolveVenue in lib/season-schedule.ts.
interface WeekVenueBody {
  series_id: string;
  venue: string | null;
}

export async function PATCH(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as WeekVenueBody;
    if (!body.series_id) {
      return NextResponse.json({ error: "Missing series_id" }, { status: 400 });
    }

    // An empty string means "un-book this week", which must land as NULL so the
    // schedule falls back to the provisional default instead of printing "".
    const venue = body.venue?.trim() ? body.venue.trim() : null;

    const { data, error } = await supabaseAdmin
      .from("series")
      .update({ venue })
      .eq("id", body.series_id)
      .select("id, name, week_no, venue")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to update week venue", detail: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, series: data });
  } catch (err) {
    console.error("admin/seasons/week-venue error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
