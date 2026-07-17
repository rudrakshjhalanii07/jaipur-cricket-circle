import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { auction_id } = body as { auction_id: string };

    if (!auction_id) {
      return NextResponse.json({ error: "auction_id is required" }, { status: 400 });
    }

    // Single DELETE, cascades to auction_wallets/lots/bids/events via FK —
    // no multi-step rollback needed for a plain cascading delete.
    const { error } = await supabaseAdmin
      .from("auctions")
      .delete()
      .eq("id", auction_id);

    if (error) {
      console.error("auctionos/cancel error:", error);
      return NextResponse.json({ error: "Failed to cancel auction" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/cancel error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
