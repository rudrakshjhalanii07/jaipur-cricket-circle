import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

// Wallets step — auction_wallet_kinds (the shared per-auction concept a
// category points at, e.g. "Main Purse"). Creating a kind backfills one
// auction_wallets row per existing auction_teams row for this auction, the
// mirror image of teams/route.ts's POST (which backfills per-kind when a
// team is created) — same budget-seeding shape, same source
// (auctionos_create_auction's original wallet-per-team-per-kind loop).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { name, initial_balance, transfer_enabled, sort_order } = body as {
      name?: string;
      initial_balance?: number;
      transfer_enabled?: boolean;
      sort_order?: number;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (typeof initial_balance !== "number" || Number.isNaN(initial_balance)) {
      return NextResponse.json({ error: "initial_balance is required" }, { status: 400 });
    }

    const { data: kind, error: kindError } = await supabaseAdmin
      .from("auction_wallet_kinds")
      .insert({
        auction_id: id,
        name,
        initial_balance,
        transfer_enabled: transfer_enabled ?? false,
        sort_order: sort_order ?? 0,
      })
      .select("*")
      .single();

    if (kindError || !kind) {
      return NextResponse.json({ error: kindError?.message || "Failed to create wallet kind" }, { status: 400 });
    }

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("auction_teams")
      .select("id")
      .eq("auction_id", id);

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message || "Failed to load teams" }, { status: 400 });
    }

    let wallets: unknown[] = [];
    if (teams && teams.length > 0) {
      const rows = teams.map((team) => ({
        auction_id: id,
        wallet_kind_id: kind.id,
        auction_team_id: team.id,
        budget_total: kind.initial_balance,
        budget_remaining: kind.initial_balance,
        acquired_count: 0,
      }));

      const { data: insertedWallets, error: walletsError } = await supabaseAdmin
        .from("auction_wallets")
        .insert(rows)
        .select("*");

      if (walletsError) {
        return NextResponse.json({ error: walletsError.message || "Failed to seed wallets" }, { status: 400 });
      }
      wallets = insertedWallets ?? [];
    }

    return NextResponse.json({ wallet_kind: kind, wallets });
  } catch (err) {
    console.error("auctionos/[id]/wallet-kinds POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const kindId = url.searchParams.get("wallet_kind_id");
    if (!kindId) {
      return NextResponse.json({ error: "wallet_kind_id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const { name, initial_balance, transfer_enabled, sort_order } = body as {
      name?: string;
      initial_balance?: number;
      transfer_enabled?: boolean;
      sort_order?: number;
    };

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (initial_balance !== undefined) patch.initial_balance = initial_balance;
    if (transfer_enabled !== undefined) patch.transfer_enabled = transfer_enabled;
    if (sort_order !== undefined) patch.sort_order = sort_order;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auction_wallet_kinds")
      .update(patch)
      .eq("id", kindId)
      .eq("auction_id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update wallet kind" }, { status: 400 });
    }

    return NextResponse.json({ wallet_kind: data });
  } catch (err) {
    console.error("auctionos/[id]/wallet-kinds PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const kindId = url.searchParams.get("wallet_kind_id");
    if (!kindId) {
      return NextResponse.json({ error: "wallet_kind_id query param is required" }, { status: 400 });
    }

    // FK ON DELETE CASCADE on auction_wallets.wallet_kind_id takes care of
    // every wallet instance of this kind.
    const { error } = await supabaseAdmin
      .from("auction_wallet_kinds")
      .delete()
      .eq("id", kindId)
      .eq("auction_id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete wallet kind" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/[id]/wallet-kinds DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
