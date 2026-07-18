import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { guardDraftMutation } from "@/lib/auctionos/core/dashboard-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const {
      name,
      wallet_kind_id,
      base_price,
      floor_price,
      min_required,
      max_allowed,
      color,
      icon,
      sort_order,
      bid_increment,
    } = body as {
      name?: string;
      wallet_kind_id?: string | null;
      base_price?: number;
      floor_price?: number | null;
      min_required?: number;
      max_allowed?: number | null;
      color?: string | null;
      icon?: string | null;
      sort_order?: number;
      bid_increment?: number | null;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (bid_increment !== undefined && bid_increment !== null && (typeof bid_increment !== "number" || bid_increment <= 0)) {
      return NextResponse.json({ error: "bid_increment must be a positive number" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auction_categories")
      .insert({
        auction_id: id,
        name,
        wallet_kind_id: wallet_kind_id ?? null,
        base_price: base_price ?? 0,
        floor_price: floor_price ?? null,
        min_required: min_required ?? 0,
        max_allowed: max_allowed ?? null,
        color: color ?? null,
        icon: icon ?? null,
        sort_order: sort_order ?? 0,
        bid_increment: bid_increment ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to create category" }, { status: 400 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error("auctionos/[id]/categories POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category_id");
    if (!categoryId) {
      return NextResponse.json({ error: "category_id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      wallet_kind_id,
      base_price,
      floor_price,
      min_required,
      max_allowed,
      color,
      icon,
      sort_order,
      bid_increment,
    } = body as {
      name?: string;
      wallet_kind_id?: string | null;
      base_price?: number;
      floor_price?: number | null;
      min_required?: number;
      max_allowed?: number | null;
      color?: string | null;
      icon?: string | null;
      sort_order?: number;
      bid_increment?: number | null;
    };

    if (bid_increment !== undefined && bid_increment !== null && (typeof bid_increment !== "number" || bid_increment <= 0)) {
      return NextResponse.json({ error: "bid_increment must be a positive number" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (wallet_kind_id !== undefined) patch.wallet_kind_id = wallet_kind_id;
    if (base_price !== undefined) patch.base_price = base_price;
    if (floor_price !== undefined) patch.floor_price = floor_price;
    if (min_required !== undefined) patch.min_required = min_required;
    if (max_allowed !== undefined) patch.max_allowed = max_allowed;
    if (color !== undefined) patch.color = color;
    if (icon !== undefined) patch.icon = icon;
    if (sort_order !== undefined) patch.sort_order = sort_order;
    if (bid_increment !== undefined) patch.bid_increment = bid_increment;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("auction_categories")
      .update(patch)
      .eq("id", categoryId)
      .eq("auction_id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 400 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    console.error("auctionos/[id]/categories PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const guard = await guardDraftMutation(id, request);
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category_id");
    if (!categoryId) {
      return NextResponse.json({ error: "category_id query param is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("auction_categories")
      .delete()
      .eq("id", categoryId)
      .eq("auction_id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to delete category" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("auctionos/[id]/categories DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
