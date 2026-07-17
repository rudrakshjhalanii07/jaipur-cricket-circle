import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The auction hall's front door: the ONLY way a spectator/participant
// learns an auction's id. Deliberately returns nothing beyond id/status —
// never access_code (that's shown to the organizer exactly once, at
// creation) and never enough to enumerate other auctions.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "Enter an auction code." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("id, status")
    .ilike("access_code", code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "That code doesn't match any auction." }, { status: 404 });
  }

  return NextResponse.json({ auctionId: data.id, status: data.status });
}
