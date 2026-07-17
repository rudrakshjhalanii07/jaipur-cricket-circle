import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAuctionTemplateRow } from "@/lib/auctionos/core/data";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, name, starts_at, settings, categories, team_ids, wallet_kinds, lots } = body as {
      template_id: string;
      name: string;
      starts_at: string | null;
      settings?: Record<string, unknown> | null;
      categories?: unknown[] | null;
      team_ids: string[];
      wallet_kinds?: unknown[] | null;
      lots: unknown[];
    };

    if (!template_id || !name || !Array.isArray(team_ids) || team_ids.length === 0 || !Array.isArray(lots) || lots.length === 0) {
      return NextResponse.json(
        { error: "template_id, name, a non-empty team_ids list, and a non-empty lots list are required" },
        { status: 400 }
      );
    }

    // template_id is now the auction_templates DB uuid — validated against
    // the DB row (not a code-only getTemplate() check), since the catalog
    // itself is the source of truth for which templates exist.
    const templateRow = await fetchAuctionTemplateRow(template_id);
    if (!templateRow) {
      return NextResponse.json({ error: `Unknown template: ${template_id}` }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("auctionos_create_auction", {
      payload: {
        template_id,
        name,
        starts_at,
        settings: settings ?? null,
        categories: categories ?? null,
        team_ids,
        wallet_kinds: wallet_kinds ?? null,
        lots,
      },
    });

    if (error) {
      console.error("auctionos/start error:", error);
      return NextResponse.json({ error: "Failed to start auction" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("auctionos/start error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
