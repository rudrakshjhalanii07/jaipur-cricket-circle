import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardAdminAccess, guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

// Full dashboard bootstrap payload — everything the wizard/dashboard shell
// needs in one round trip, all scoped to auction_id = params.id. Gated by
// x-admin-password (see dashboard-guard.ts). admin_password_hash and every
// captain's access_key_hash are never selected here — see the guard's own
// AUCTION_COLUMNS list and the explicit column list on auction_captains
// below.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardAdminAccess(id, request);
    if (!guard.ok) return guard.response;

    const [settings, teams, walletKinds, wallets, categories, lots, captains] = await Promise.all([
      supabaseAdmin.from("auction_settings").select("*").eq("auction_id", id).maybeSingle(),
      supabaseAdmin.from("auction_teams").select("*").eq("auction_id", id).order("sort_order", { ascending: true }),
      supabaseAdmin.from("auction_wallet_kinds").select("*").eq("auction_id", id).order("sort_order", { ascending: true }),
      supabaseAdmin.from("auction_wallets").select("*").eq("auction_id", id),
      supabaseAdmin.from("auction_categories").select("*").eq("auction_id", id).order("sort_order", { ascending: true }),
      supabaseAdmin.from("auction_lots").select("*").eq("auction_id", id).order("lot_order", { ascending: true }),
      supabaseAdmin
        .from("auction_captains")
        .select("id, auction_id, team_id, auction_team_id, category_id, external_ref, display_name, metadata, created_at")
        .eq("auction_id", id),
    ]);

    return NextResponse.json({
      auction: guard.auction,
      settings: settings.data ?? null,
      teams: teams.data ?? [],
      wallet_kinds: walletKinds.data ?? [],
      wallets: wallets.data ?? [],
      categories: categories.data ?? [],
      lots: lots.data ?? [],
      captains: captains.data ?? [],
    });
  } catch (err) {
    console.error("auctionos/[id] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Identity-step edits — name/logo_url/venue/starts_at/theme_key only.
// Rejects (400) once the auction has left draft status; see dashboard-
// guard.ts's guardDraftMutation.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { name, logo_url, venue, starts_at, theme_key } = body as {
      name?: string;
      logo_url?: string | null;
      venue?: string | null;
      starts_at?: string | null;
      theme_key?: string | null;
    };

    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
      patch.name = name;
    }
    if (logo_url !== undefined) patch.logo_url = logo_url;
    if (venue !== undefined) patch.venue = venue;
    if (starts_at !== undefined) patch.starts_at = starts_at;
    if (theme_key !== undefined) patch.theme_key = theme_key;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auctions")
      .update(patch)
      .eq("id", id)
      .select("id, template_id, name, status, starts_at, current_lot_id, logo_url, venue, theme_key, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update auction" }, { status: 400 });
    }

    return NextResponse.json({ auction: data });
  } catch (err) {
    console.error("auctionos/[id] PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
