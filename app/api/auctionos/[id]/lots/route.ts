import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

interface LotInput {
  display_name?: string;
  base_price?: number;
  category_id?: string | null;
  external_ref?: string | null;
  metadata?: Record<string, unknown>;
}

function validateLot(lot: LotInput): string | null {
  if (!lot.display_name || !lot.display_name.trim()) return "display_name is required";
  if (typeof lot.base_price !== "number" || Number.isNaN(lot.base_price)) return "base_price is required";
  return null;
}

// Talent Pool step — accepts either a single lot or { lots: [...] } for bulk
// (CSV import and manual add both funnel through here). lot_order
// auto-increments from the auction's current max.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const rawLots: LotInput[] = Array.isArray((body as { lots?: LotInput[] })?.lots)
      ? (body as { lots: LotInput[] }).lots
      : [body as LotInput];

    if (rawLots.length === 0) {
      return NextResponse.json({ error: "No lots provided" }, { status: 400 });
    }

    for (const lot of rawLots) {
      const error = validateLot(lot);
      if (error) return NextResponse.json({ error }, { status: 400 });
    }

    const { data: maxRow } = await supabaseAdmin
      .from("auction_lots")
      .select("lot_order")
      .eq("auction_id", id)
      .order("lot_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextOrder = (maxRow?.lot_order ?? -1) + 1;

    const rows = rawLots.map((lot) => ({
      auction_id: id,
      category_id: lot.category_id ?? null,
      external_ref: lot.external_ref ?? null,
      display_name: lot.display_name,
      base_price: lot.base_price,
      lot_order: nextOrder++,
      status: "upcoming",
      metadata: lot.metadata ?? {},
    }));

    const { data, error } = await supabaseAdmin.from("auction_lots").insert(rows).select("*");

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create lots" }, { status: 400 });
    }

    return NextResponse.json({ lots: data ?? [] });
  } catch (err) {
    console.error("auctionos/[id]/lots POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Bulk edit — body { lot_ids: string[], patch: {...} } applies the same
// partial update to every listed lot (the wizard's "bulk edit" UI).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { lot_ids, patch } = body as { lot_ids?: string[]; patch?: Record<string, unknown> };

    if (!Array.isArray(lot_ids) || lot_ids.length === 0) {
      return NextResponse.json({ error: "lot_ids is required" }, { status: 400 });
    }
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "patch is required" }, { status: 400 });
    }

    // Whitelist editable fields — never let a bulk patch touch lot_order,
    // status, or any of the sold/bid cache columns.
    const allowed = ["display_name", "base_price", "category_id", "external_ref", "metadata"];
    const safePatch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in patch) safePatch[key] = patch[key];
    }
    if (Object.keys(safePatch).length === 0) {
      return NextResponse.json({ error: "patch contains no editable fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auction_lots")
      .update(safePatch)
      .eq("auction_id", id)
      .in("id", lot_ids)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update lots" }, { status: 400 });
    }

    return NextResponse.json({ lots: data ?? [] });
  } catch (err) {
    console.error("auctionos/[id]/lots PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const lotId = url.searchParams.get("lot_id");
    if (!lotId) {
      return NextResponse.json({ error: "lot_id query param is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("auction_lots").delete().eq("id", lotId).eq("auction_id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete lot" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/[id]/lots DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
