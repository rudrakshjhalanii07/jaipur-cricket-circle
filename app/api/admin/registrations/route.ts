import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The latest match and its registrations, phone numbers included, for the
// admin Registrations and Roles panels. The browser can't read the phone
// snapshot directly (supabase/lock_down_member_data.sql).
//
// GET → { match: <latest match row> | null, registrations: [...] }
export async function GET(request: Request) {
  if (request.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: match, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select("*")
    .order("match_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });
  if (!match) return NextResponse.json({ match: null, registrations: [] });

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("*, players:player_id (image_url, team, member_tag, batting_style, bowling_style, short_bio)")
    .eq("match_id", match.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ match, registrations: data ?? [] });
}
