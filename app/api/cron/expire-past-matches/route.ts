import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const adminHeader = request.headers.get("x-admin-password");
  if (adminPassword && adminHeader === adminPassword) return true;

  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Find all matches whose date has passed
  const { data: expiredMatches, error: fetchError } = await supabaseAdmin
    .from("matches")
    .select("id, match_date")
    .lt("match_date", today);

  if (fetchError) {
    console.error("expire-past-matches: fetch error", fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expiredMatches || expiredMatches.length === 0) {
    return NextResponse.json({ deleted: 0, message: "No expired matches found" });
  }

  const ids = expiredMatches.map((m) => m.id);

  // Hard delete — ON DELETE CASCADE wipes registrations and match_player_roles
  const { error: deleteError } = await supabaseAdmin
    .from("matches")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("expire-past-matches: delete error", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  console.log(`expire-past-matches: deleted ${ids.length} past match(es)`);
  return NextResponse.json({ deleted: ids.length, ids });
}

// Allow Vercel cron to call via GET as well
export async function GET(request: Request) {
  return POST(request);
}
