import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAuctionTemplateRow } from "@/lib/auctionos/core/data";

// Identity-step submit — the wizard's Step 1. No auth gate: nothing exists
// yet for this auction, this call IS the creation of its admin credential
// (see AUCTIONOS.md's wizard-pass plan, "Architecture decisions §3"). Body:
// { name, logo_url?, venue?, starts_at?, theme_key?, template_id }.
// Returns { auction_id, access_code, admin_password } — both secrets are
// one-time-reveal, per auctionos_create_auction_draft's own contract.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, logo_url, venue, starts_at, theme_key, template_id } = body as {
      name?: string;
      logo_url?: string | null;
      venue?: string | null;
      starts_at?: string | null;
      theme_key?: string | null;
      template_id?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!template_id) {
      return NextResponse.json({ error: "template_id is required" }, { status: 400 });
    }

    const template = await fetchAuctionTemplateRow(template_id);
    if (!template) {
      return NextResponse.json({ error: "Unknown template_id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("auctionos_create_auction_draft", {
      payload: {
        name,
        logo_url: logo_url ?? null,
        venue: venue ?? null,
        starts_at: starts_at ?? null,
        theme_key: theme_key ?? null,
        template_id,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create auction draft" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("auctionos/draft error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
