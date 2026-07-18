// Shared admin-password + draft-status gate for the AuctionOS dashboard CRUD
// routes (app/api/auctionos/[id]/*). Every wizard-step mutation route reads
// `x-admin-password`, resolves it against THIS specific auction via
// verifyAdminPassword(), and (every route except GET/begin) also requires
// the auction still be `status = 'draft'` — auctionos_begin_auction is the
// one-way lock past that point. Centralized here so the check reads
// identically across teams/wallet-kinds/lots/categories/captains/route.ts
// instead of being re-implemented six times (per the wizard-pass plan's
// "Constraints" section).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "./auth";
import type { Auction } from "./types";

export interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export interface GuardSuccess {
  ok: true;
  auction: Auction;
}

export type GuardResult = GuardSuccess | GuardFailure;

// admin_password_hash is deliberately excluded — never let it leave this
// module, same rule as everywhere else it's touched (see types.ts's comment
// on Auction).
const AUCTION_COLUMNS =
  "id, template_id, name, status, starts_at, current_lot_id, logo_url, venue, theme_key, created_at, updated_at";

async function fetchAuctionRow(auctionId: string): Promise<Auction | null> {
  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select(AUCTION_COLUMNS)
    .eq("id", auctionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Auction;
}

// Password-only gate — used by the dashboard GET (read) and by `begin`
// (which owns its own draft-completeness/status check via the
// auctionos_begin_auction RPC's own exception, so it must not be
// double-gated to 'draft' here too).
export async function guardAdminAccess(auctionId: string, request: Request): Promise<GuardResult> {
  const password = request.headers.get("x-admin-password");
  if (!password || !(await verifyAdminPassword(auctionId, password))) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const auction = await fetchAuctionRow(auctionId);
  if (!auction) {
    return { ok: false, response: NextResponse.json({ error: "Auction not found" }, { status: 404 }) };
  }

  return { ok: true, auction };
}

// Password + draft-status gate — every dashboard CRUD mutation route
// (teams/wallet-kinds/lots/categories/captains, plus [id] PATCH) must be
// both authenticated AND pre-lock.
export async function guardDraftMutation(auctionId: string, request: Request): Promise<GuardResult> {
  const result = await guardAdminAccess(auctionId, request);
  if (!result.ok) return result;

  if (result.auction.status !== "draft") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Auction is no longer in draft status" }, { status: 400 }),
    };
  }

  return result;
}
