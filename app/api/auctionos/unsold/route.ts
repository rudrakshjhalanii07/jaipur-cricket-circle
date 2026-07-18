import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "@/lib/auctionos/core/auth";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");

    const body = await request.json();
    const { lot_id } = body as { lot_id: string };

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

    const { data, error } = await supabaseAdmin.rpc("auctionos_mark_unsold", {
      p_lot_id: lot_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to mark unsold" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("auctionos/unsold error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
