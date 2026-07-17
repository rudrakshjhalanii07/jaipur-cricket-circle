import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The one piece of `auctions` data every visitor inside the hall needs to
// poll (status, current_lot_id, ...) without ever being able to list or
// enumerate auction rows themselves — auctions has no public RLS read
// policy since the SaaS pivot (see AUCTIONOS.md's "Landing philosophy"),
// so browser code can no longer query the table directly. This route is
// deliberately unauthenticated (like the old public RLS policy was) but
// strips access_code, the one field that must never leave the server.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("id, template_id, name, status, starts_at, current_lot_id, created_at, updated_at")
    .in("status", ["scheduled", "live", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load auction" }, { status: 500 });
  }
  return NextResponse.json({ auction: data ?? null });
}
