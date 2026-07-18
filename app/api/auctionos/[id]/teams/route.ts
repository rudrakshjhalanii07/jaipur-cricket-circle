import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

// Franchises step — auction-scoped teams (public.auction_teams), never the
// global public.teams table (see AUCTIONOS.md's wizard-pass plan,
// "Architecture decisions §1"). Creating a team also backfills one
// auction_wallets row per existing auction_wallet_kind, mirroring the
// wallet-per-team-per-kind loop auctionos_create_auction used to run inline
// (supabase/add_auctionos.sql, ~:776-788) — budget_total/budget_remaining
// seeded from the kind's initial_balance, acquired_count = 0.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { name, short_name, logo_url, tagline, primary_color, secondary_color } = body as {
      name?: string;
      short_name?: string | null;
      logo_url?: string | null;
      tagline?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from("auction_teams")
      .insert({
        auction_id: id,
        name,
        short_name: short_name ?? null,
        logo_url: logo_url ?? null,
        tagline: tagline ?? null,
        primary_color: primary_color ?? null,
        secondary_color: secondary_color ?? null,
      })
      .select("*")
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: teamError?.message || "Failed to create team" }, { status: 400 });
    }

    const { data: kinds, error: kindsError } = await supabaseAdmin
      .from("auction_wallet_kinds")
      .select("id, initial_balance")
      .eq("auction_id", id);

    if (kindsError) {
      return NextResponse.json({ error: kindsError.message || "Failed to load wallet kinds" }, { status: 400 });
    }

    let wallets: unknown[] = [];
    if (kinds && kinds.length > 0) {
      const rows = kinds.map((kind) => ({
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

    return NextResponse.json({ team, wallets });
  } catch (err) {
    console.error("auctionos/[id]/teams POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const teamId = url.searchParams.get("team_id");
    if (!teamId) {
      return NextResponse.json({ error: "team_id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const { name, short_name, logo_url, tagline, primary_color, secondary_color, sort_order } = body as {
      name?: string;
      short_name?: string | null;
      logo_url?: string | null;
      tagline?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
      sort_order?: number;
    };

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (short_name !== undefined) patch.short_name = short_name;
    if (logo_url !== undefined) patch.logo_url = logo_url;
    if (tagline !== undefined) patch.tagline = tagline;
    if (primary_color !== undefined) patch.primary_color = primary_color;
    if (secondary_color !== undefined) patch.secondary_color = secondary_color;
    if (sort_order !== undefined) patch.sort_order = sort_order;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auction_teams")
      .update(patch)
      .eq("id", teamId)
      .eq("auction_id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update team" }, { status: 400 });
    }

    return NextResponse.json({ team: data });
  } catch (err) {
    console.error("auctionos/[id]/teams PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const teamId = url.searchParams.get("team_id");
    if (!teamId) {
      return NextResponse.json({ error: "team_id query param is required" }, { status: 400 });
    }

    // FK ON DELETE CASCADE on auction_wallets.auction_team_id takes care of
    // that team's wallet rows.
    const { error } = await supabaseAdmin.from("auction_teams").delete().eq("id", teamId).eq("auction_id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete team" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/[id]/teams DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
