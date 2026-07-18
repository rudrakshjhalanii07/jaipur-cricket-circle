import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "@/lib/auctionos/core/auth";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");

    const body = await request.json();
    const { auction_id } = body as { auction_id: string };

    if (!auction_id) {
      return NextResponse.json({ error: "auction_id is required" }, { status: 400 });
    }

    if (!password || !(await verifyAdminPassword(auction_id, password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc("auctionos_advance_lot", {
      p_auction_id: auction_id,
    });

    if (error) {
      console.error("auctionos/advance error:", error);
      return NextResponse.json({ error: "Failed to advance lot" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("auctionos/advance error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
