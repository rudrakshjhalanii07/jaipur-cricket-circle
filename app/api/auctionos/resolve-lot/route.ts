import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "@/lib/auctionos/core/auth";

// Organizer-only manual escape hatch for a 'blocked' lot (see
// auctionos_mark_unsold's quota logic in add_auctionos_quota.sql) — the
// system parks a lot here rather than guessing when 2+ teams are tied for
// the category's last mandatory slot, or the one short team can't afford
// base_price. wallet_id given force-allots to that team; omitted/null
// gives up and finalizes the lot as terminally unsold.
export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");

    const body = await request.json();
    const { lot_id, wallet_id } = body as { lot_id: string; wallet_id?: string | null };

    if (!lot_id) {
      return NextResponse.json({ error: "lot_id is required" }, { status: 400 });
    }

    const { data: lot, error: lotError } = await supabaseAdmin
      .from("auction_lots")
      .select("auction_id")
      .eq("id", lot_id)
      .single();
    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    if (!password || !(await verifyAdminPassword(lot.auction_id as string, password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc("auctionos_resolve_blocked_lot", {
      p_lot_id: lot_id,
      p_wallet_id: wallet_id ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to resolve lot" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("auctionos/resolve-lot error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
