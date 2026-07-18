import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

// Captains step. Calls auctionos_assign_captain (extended this pass with a
// p_auction_team_id parameter — see supabase/add_auctionos_wizard.sql §4 and
// this pass's report for why: a wizard-created auction's franchises live in
// auction_teams, not the global teams table, so the original RPC could
// never assign a captain to one). Auto-enables auction_settings.
// captain_module_enabled the first time a captain is assigned for this
// auction, rather than making the organizer flip a hidden setting first —
// the wizard implies captains are always available as a step.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { team_id, auction_team_id, category_id, external_ref, display_name, metadata } = body as {
      team_id?: string | null;
      auction_team_id?: string | null;
      category_id?: string;
      external_ref?: string | null;
      display_name?: string;
      metadata?: Record<string, unknown>;
    };

    if (!category_id) {
      return NextResponse.json({ error: "category_id is required" }, { status: 400 });
    }
    if (!display_name || !display_name.trim()) {
      return NextResponse.json({ error: "display_name is required" }, { status: 400 });
    }
    if (!team_id && !auction_team_id) {
      return NextResponse.json({ error: "team_id or auction_team_id is required" }, { status: 400 });
    }
    if (team_id && auction_team_id) {
      return NextResponse.json({ error: "provide only one of team_id or auction_team_id" }, { status: 400 });
    }

    if (external_ref) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("auction_captains")
        .select("id")
        .eq("auction_id", id)
        .eq("external_ref", external_ref)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json({ error: existingError.message || "Failed to check for duplicate captain" }, { status: 400 });
      }
      if (existing) {
        return NextResponse.json({ error: "This player is already assigned as a captain" }, { status: 400 });
      }
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("auction_settings")
      .select("captain_module_enabled")
      .eq("auction_id", id)
      .maybeSingle();

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message || "Failed to load auction settings" }, { status: 400 });
    }

    if (!settings?.captain_module_enabled) {
      const { error: enableError } = await supabaseAdmin
        .from("auction_settings")
        .update({ captain_module_enabled: true })
        .eq("auction_id", id);

      if (enableError) {
        return NextResponse.json({ error: enableError.message || "Failed to enable captain module" }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin.rpc("auctionos_assign_captain", {
      p_auction_id: id,
      p_team_id: team_id ?? null,
      p_category_id: category_id,
      p_external_ref: external_ref ?? null,
      p_display_name: display_name,
      p_metadata: metadata ?? {},
      p_auction_team_id: auction_team_id ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to assign captain" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("auctionos/[id]/captains POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const captainId = url.searchParams.get("captain_id");
    if (!captainId) {
      return NextResponse.json({ error: "captain_id query param is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("auction_captains")
      .delete()
      .eq("id", captainId)
      .eq("auction_id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete captain" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/[id]/captains DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
