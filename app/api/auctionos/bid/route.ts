import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTemplate } from "@/lib/auctionos/core/registry";
import { fetchAuctionTemplateRow } from "@/lib/auctionos/core/data";
import { verifyAdminPassword } from "@/lib/auctionos/core/auth";
import type { Auction, AuctionWallet, AuctionLot, AuctionCategory } from "@/lib/auctionos/core/types";
import "@/lib/auctionos/templates";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");

    const body = await request.json();
    const { lot_id, wallet_id } = body as {
      lot_id: string;
      wallet_id: string;
    };

    if (!lot_id || !wallet_id) {
      return NextResponse.json(
        { error: "lot_id and wallet_id are required" },
        { status: 400 }
      );
    }

    const { data: lot, error: lotError } = await supabaseAdmin
      .from("auction_lots")
      .select("*")
      .eq("id", lot_id)
      .single();
    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const { data: auction, error: auctionError } = await supabaseAdmin
      .from("auctions")
      .select("*")
      .eq("id", (lot as AuctionLot).auction_id)
      .single();
    if (auctionError || !auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    if (!password || !(await verifyAdminPassword((auction as Auction).id, password))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("auction_wallets")
      .select("*")
      .eq("id", wallet_id)
      .single();
    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const templateRow = await fetchAuctionTemplateRow((auction as Auction).template_id);
    if (!templateRow) {
      return NextResponse.json({ error: "Unknown template" }, { status: 500 });
    }
    let template;
    try {
      template = getTemplate(templateRow.module_key);
    } catch {
      return NextResponse.json({ error: "Unknown template" }, { status: 500 });
    }

    let category: AuctionCategory | null = null;
    if ((lot as AuctionLot).category_id) {
      const { data: categoryRow } = await supabaseAdmin
        .from("auction_categories")
        .select("*")
        .eq("id", (lot as AuctionLot).category_id as string)
        .maybeSingle();
      category = (categoryRow as AuctionCategory) ?? null;
    }

    const currentBid = (lot as AuctionLot).current_bid ?? (lot as AuctionLot).base_price;
    const increment = template.bidIncrements.nextIncrement(currentBid, lot as AuctionLot, auction as Auction, category);
    const newBid = currentBid + increment;

    const validation = template.validation.validateBid({
      auction: auction as Auction,
      lot: lot as AuctionLot,
      wallet: wallet as AuctionWallet,
      proposedAmount: newBid,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason ?? "Bid rejected" }, { status: 400 });
    }

    // p_expected_version is the just-read lot version — correct for now
    // since this route reads-then-writes without a client round-trip; the
    // client-side version-tracking described in AUCTIONOS.md §10 is future
    // work for the admin UI, not this pass.
    const { data, error } = await supabaseAdmin.rpc("auctionos_raise_bid", {
      p_lot_id: lot_id,
      p_wallet_id: wallet_id,
      p_new_bid: newBid,
      p_expected_version: (lot as AuctionLot).version,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to raise bid" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("auctionos/bid error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
