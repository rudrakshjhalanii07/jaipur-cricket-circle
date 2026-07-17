// Anon-client read helpers for the generic AuctionOS tables. Writes go
// through /api/auctionos/* route handlers (service-role client). Template-
// specific reads (e.g. JCC's eligible-player pool) live in the template's
// own data module, not here — this file must not know any template exists.

import { supabase } from "@/lib/supabase";
import { getTemplate } from "./registry";
import type {
  Auction,
  AuctionWallet,
  AuctionWalletKind,
  AuctionLot,
  AuctionCategory,
  AuctionSettings,
  AuctionTemplateRow,
} from "./types";
import type { AuctionTemplate } from "./template";

// `auctions` has no public RLS read policy (SaaS pivot — see AUCTIONOS.md's
// "Landing philosophy": the access code is the only front door, so the
// table itself must not be directly listable). This goes through the
// service-role-backed /api/auctionos/current route instead — browser-only;
// a server caller (e.g. the hall page) should query via supabaseAdmin
// directly rather than round-tripping through this app's own API.
// Includes 'completed' so a just-finished auction still renders its recap
// screen instead of falling back to the "no auction yet" hero.
export async function fetchActiveAuction(): Promise<Auction | null> {
  try {
    const res = await fetch("/api/auctionos/current");
    if (!res.ok) return null;
    const { auction } = await res.json();
    return (auction as Auction | null) ?? null;
  } catch {
    return null;
  }
}

export async function fetchWallets(auctionId: string): Promise<AuctionWallet[]> {
  try {
    const { data, error } = await supabase
      .from("auction_wallets")
      .select("*")
      .eq("auction_id", auctionId);

    if (error || !data) return [];
    return data as AuctionWallet[];
  } catch {
    return [];
  }
}

// The shared wallet-kind concept ("Main Purse") an auction_categories row
// points at — one row per kind per auction, NOT one per team (see
// AuctionWalletKind's doc comment in types.ts for why the two are split).
export async function fetchWalletKinds(auctionId: string): Promise<AuctionWalletKind[]> {
  try {
    const { data, error } = await supabase
      .from("auction_wallet_kinds")
      .select("*")
      .eq("auction_id", auctionId)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as AuctionWalletKind[];
  } catch {
    return [];
  }
}

export async function fetchLots(auctionId: string): Promise<AuctionLot[]> {
  try {
    const { data, error } = await supabase
      .from("auction_lots")
      .select("*")
      .eq("auction_id", auctionId)
      .order("lot_order", { ascending: true });

    if (error || !data) return [];
    return data as AuctionLot[];
  } catch {
    return [];
  }
}

export async function fetchAuctionCategories(auctionId: string): Promise<AuctionCategory[]> {
  try {
    const { data, error } = await supabase
      .from("auction_categories")
      .select("*")
      .eq("auction_id", auctionId)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as AuctionCategory[];
  } catch {
    return [];
  }
}

export async function fetchAuctionSettings(auctionId: string): Promise<AuctionSettings | null> {
  try {
    const { data, error } = await supabase
      .from("auction_settings")
      .select("*")
      .eq("auction_id", auctionId)
      .single();

    if (error || !data) return null;
    return data as AuctionSettings;
  } catch {
    return null;
  }
}

// Resolves the latest published version of a template by its `slug` (e.g.
// "jcc") — what a template's own "prepare a new auction" UI needs to learn
// its own `auction_templates.id` before calling auctionos_create_auction,
// since that RPC's payload takes the DB uuid, not the slug. Generic (any
// template can call this for itself), so it lives here rather than in a
// template's own data module.
export async function fetchAuctionTemplateBySlug(slug: string): Promise<AuctionTemplateRow | null> {
  try {
    const { data, error } = await supabase
      .from("auction_templates")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as AuctionTemplateRow;
  } catch {
    return null;
  }
}

export async function fetchAuctionTemplateRow(templateId: string): Promise<AuctionTemplateRow | null> {
  try {
    const { data, error } = await supabase
      .from("auction_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error || !data) return null;
    return data as AuctionTemplateRow;
  } catch {
    return null;
  }
}

// Combines the two DB-backed lookups a caller almost always wants together:
// resolve the `auctions.template_id` uuid to its `auction_templates` row,
// then hand `module_key` to the code registry (registry.ts) to get the
// actual assembled AuctionTemplate. Kept here (not registry.ts) since this
// file already owns every other DB read AuctionOS's generic layer needs —
// registry.ts stays a pure in-memory lookup with no I/O of its own.
export async function resolveAuctionTemplate(templateId: string): Promise<AuctionTemplate | null> {
  const row = await fetchAuctionTemplateRow(templateId);
  if (!row) return null;
  try {
    return getTemplate(row.module_key);
  } catch {
    return null;
  }
}
