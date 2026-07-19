import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTemplate } from "@/lib/auctionos/core/registry";
import { fetchAuctionTemplateRow } from "@/lib/auctionos/core/data";
import { verifyAdminPassword } from "@/lib/auctionos/core/auth";
import { violatesReserve, withCaptainBonus } from "@/lib/auctionos/core/reserve";
import type { Auction, AuctionWallet, AuctionLot, AuctionCategory, AuctionCaptain, PlayerPurchase } from "@/lib/auctionos/core/types";
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

    // Reserve check — generic, not template-owned (see reserve.ts): this
    // team must still be able to afford every OTHER mandatory slot it
    // hasn't filled yet after winning this lot.
    const { data: auctionCategories } = await supabaseAdmin
      .from("auction_categories")
      .select("*")
      .eq("auction_id", (auction as Auction).id);

    const { data: walletPurchases } = await supabaseAdmin
      .from("player_purchases")
      .select("category_id")
      .eq("wallet_id", wallet_id)
      .is("reversed_at", null);

    const purchaseCountByCategory: Record<string, number> = {};
    for (const purchase of (walletPurchases ?? []) as Pick<PlayerPurchase, "category_id">[]) {
      if (!purchase.category_id) continue;
      purchaseCountByCategory[purchase.category_id] = (purchaseCountByCategory[purchase.category_id] ?? 0) + 1;
    }

    // A team's captain occupies one slot of their own category without a
    // purchase row backing it (see reserve.ts's withCaptainBonus) — folded
    // in here so the reserve check doesn't over-reserve for a slot the
    // captain already fills.
    const { data: auctionCaptains } = await supabaseAdmin
      .from("auction_captains")
      .select("team_id, auction_team_id, category_id")
      .eq("auction_id", (auction as Auction).id);

    const acquiredCountByCategory = withCaptainBonus(
      purchaseCountByCategory,
      wallet as AuctionWallet,
      (auctionCaptains ?? []) as Pick<AuctionCaptain, "team_id" | "auction_team_id" | "category_id">[]
    );

    // Quota ceiling — distinct from the reserve check below, which only
    // protects a team's ability to still afford its remaining MANDATORY
    // slots. A category's max_allowed (when set) is a hard cap: once a
    // team's acquired count (purchases + its own captain's slot) reaches
    // it, they're done in that category and can't bid on more lots there,
    // even if they can easily afford it.
    if (category?.max_allowed != null && (acquiredCountByCategory[category.id] ?? 0) >= category.max_allowed) {
      return NextResponse.json(
        { error: "This team has already filled its quota for this category" },
        { status: 400 }
      );
    }

    if (
      violatesReserve(
        {
          wallet: wallet as AuctionWallet,
          categories: (auctionCategories ?? []) as AuctionCategory[],
          acquiredCountByCategory,
        },
        (lot as AuctionLot).category_id,
        newBid
      )
    ) {
      return NextResponse.json(
        { error: "Bid would leave this team unable to afford its remaining mandatory slots" },
        { status: 400 }
      );
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
