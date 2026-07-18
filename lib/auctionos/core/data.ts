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
  AuctionTeam,
  AuctionCaptain,
  CaptainValuation,
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

// Auction-scoped franchises created by the wizard (schema v4 — see
// add_auctionos_wizard.sql §2). NOT the global `teams` table — a wallet
// resolves its display info from here when `auction_team_id` is set (see
// resolveWalletTeamInfo() below), falling back to the global `teams` join
// when it's `team_id` instead. Public read, same shape as fetchLots/
// fetchAuctionCategories.
export async function fetchAuctionTeams(auctionId: string): Promise<AuctionTeam[]> {
  try {
    const { data, error } = await supabase
      .from("auction_teams")
      .select("*")
      .eq("auction_id", auctionId)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as AuctionTeam[];
  } catch {
    return [];
  }
}

// Generic display info for a wallet, resolved from whichever side of the
// team_id/auction_team_id pair is actually set (schema v4 — see
// add_auctionos_wizard.sql §3 and AuctionWallet's doc comment in
// types.ts). Template UI (e.g. JCC's AuctionExperience.tsx) that resolves a
// wallet's name/logo/colors from the global `teams` table via `lib/teams.ts`
// should check `wallet.auction_team_id` FIRST and use this (or an
// equivalent `auction_teams` lookup) before falling back to its existing
// `teams` join — that fallback path is unchanged for backward
// compatibility. This helper only covers the generic engine's own view;
// JCC's `AuctionExperience.tsx` still resolves display info its own way
// (via `lib/teams.ts`'s `TEAMS` map keyed by `team_id`) and has NOT been
// wired to call this yet — see this pass's report for the exact follow-up
// needed there.
export interface WalletTeamInfo {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export async function resolveWalletTeamInfo(
  wallet: Pick<AuctionWallet, "auction_id" | "team_id" | "auction_team_id">
): Promise<WalletTeamInfo | null> {
  if (wallet.auction_team_id) {
    const { data, error } = await supabase
      .from("auction_teams")
      .select("*")
      .eq("id", wallet.auction_team_id)
      .maybeSingle();
    if (error || !data) return null;
    const team = data as AuctionTeam;
    return {
      name: team.name,
      shortName: team.short_name,
      logoUrl: team.logo_url,
      primaryColor: team.primary_color,
      secondaryColor: team.secondary_color,
    };
  }

  if (wallet.team_id) {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", wallet.team_id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      name: data.name as string,
      shortName: data.short_name as string,
      logoUrl: data.logo as string,
      primaryColor: data.primary_color as string,
      secondaryColor: data.secondary_color as string,
    };
  }

  return null;
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

export async function fetchAuctionCaptains(auctionId: string): Promise<AuctionCaptain[]> {
  try {
    const { data, error } = await supabase
      .from("auction_captains")
      .select("*")
      .eq("auction_id", auctionId);

    if (error || !data) return [];
    return data as AuctionCaptain[];
  } catch {
    return [];
  }
}

// Append-only snapshot log — the "current" value for a captain is just the
// latest row here (see AUCTIONOS.md's CaptainValuation section). Returns
// every row for the auction (small volume: one row per recalculation, not
// per poll) so callers can reduce to latest-per-captain themselves.
export async function fetchCaptainValuations(auctionId: string): Promise<CaptainValuation[]> {
  try {
    const { data, error } = await supabase
      .from("captain_valuations")
      .select("*")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as CaptainValuation[];
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
