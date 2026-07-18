import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardAdminAccess } from "@/lib/auctionos/core/dashboard-guard";

// Locks the wizard: draft -> scheduled. Gated by admin password only — NOT
// guardDraftMutation's status check, since auctionos_begin_auction owns its
// own completeness + status validation and raises a descriptive Postgres
// exception (caught below) rather than a route-level guard duplicating that
// logic.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardAdminAccess(id, request);
    if (!guard.ok) return guard.response;

    const { data, error } = await supabaseAdmin.rpc("auctionos_begin_auction", {
      p_auction_id: id,
    });

    if (error) {
      // Surface the RPC's RAISE EXCEPTION message directly rather than a
      // raw 500 — this is user-facing validation feedback (e.g. "add at
      // least one category before beginning the auction"), not a server
      // error.
      return NextResponse.json({ error: error.message || "Failed to begin auction" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("auctionos/[id]/begin error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
