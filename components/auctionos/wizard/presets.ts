// Quick-start presets for /auctionos/new — provisions the wizard's
// Franchises/Wallets/Categories steps in one shot instead of an organizer
// re-entering the exact same JCC data every season. Client-driven (plain
// sequential fetches against the same per-step API routes the wizard steps
// themselves call — teams/route.ts, wallet-kinds/route.ts,
// categories/route.ts) rather than a new bulk-insert RPC, so a preset can
// never diverge from what a human clicking through the wizard by hand would
// have produced, and every backfill (wallet-kind creation seeding a wallet
// per existing team) still runs exactly the same way.
//
// Numbers below are JCC Season 3's official auction-format graphic ("BUILD
// · BID · BALANCE · WIN"): 14-player squad (2 MVP + 5 Regular + 7 Guest),
// Wallet A (MVP+Regular, ₹15 Cr) / Wallet B (Guest, ₹4 Cr, no cross-wallet
// transfers — enforced structurally here by simply being two separate
// wallet kinds, same as every other auction). Guest's own "minimum
// required ₹1.75 Cr" (7 × ₹25L) is the graphic's aspirational total, not a
// literal quota — Guest intentionally keeps min_required = 0 and instead
// uses the softer resell-cap/rebalance mechanic (max_resell_rounds), same
// as lib/auctionos/templates/jcc/mockSeed.ts's dev-harness config and per
// add_auctionos_guest_rebalance.sql's own header comment on why quota and
// rebalance are deliberately different mechanisms.
//
// Applying this preset only fills Franchises/Wallets/Categories — Talent
// Pool (the player list) and Captains still need entering fresh every
// season, which is the whole point: those are the only things that
// actually change season to season.

import { TEAM_ORDER_ALL, TEAMS } from "@/lib/teams";

export const JCC_SEASON_3_LOGO_URL = "/jcc_logo.png";
export const JCC_SEASON_3_DEFAULT_NAME = "JCC Season 3 Auction";

// JCC auctions always run 7 PM local — today's date at that time, formatted
// for a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`, no
// timezone/seconds). Recomputed fresh each time the preset is selected
// (not a module-level constant) so it reflects "today" at click time, not
// whenever the page happened to load.
export function jccSeason3DefaultStartsAt(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T19:00`;
}

interface PresetWalletKind {
  key: "wallet_a" | "wallet_b";
  name: string;
  initial_balance: number; // lakhs — 100 = ₹1 Cr, matches formatLakhs()
}

interface PresetCategory {
  name: string;
  wallet_kind_key: PresetWalletKind["key"];
  base_price: number;
  bid_increment: number;
  min_required: number;
  max_resell_rounds: number | null;
  sort_order: number;
}

const WALLET_KINDS: PresetWalletKind[] = [
  { key: "wallet_a", name: "Wallet A (MVP + Regular)", initial_balance: 1500 }, // ₹15 Cr
  { key: "wallet_b", name: "Wallet B (Guest Players)", initial_balance: 400 }, // ₹4 Cr
];

const CATEGORIES: PresetCategory[] = [
  {
    name: "MVP Players",
    wallet_kind_key: "wallet_a",
    base_price: 100, // ₹1 Cr
    bid_increment: 20, // ₹20 L
    min_required: 2,
    max_resell_rounds: null,
    sort_order: 0,
  },
  {
    name: "Regular Players",
    wallet_kind_key: "wallet_a",
    base_price: 50, // ₹50 L
    bid_increment: 10, // ₹10 L
    min_required: 5,
    max_resell_rounds: null,
    sort_order: 1,
  },
  {
    name: "Guest Players",
    wallet_kind_key: "wallet_b",
    base_price: 25, // ₹25 L
    bid_increment: 5, // ₹5 L
    min_required: 0,
    max_resell_rounds: 2,
    sort_order: 2,
  },
];

export interface PresetStepFailure {
  step: string;
  error: string;
}

export interface PresetResult {
  failures: PresetStepFailure[];
}

async function postJson(
  path: string,
  adminPassword: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; json: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, json, error: json.error ?? `Request to ${path} failed` };
    return { ok: true, json };
  } catch {
    return { ok: false, json: {}, error: `Network error calling ${path}` };
  }
}

// Teams first, then wallet kinds — either order self-heals (each route
// backfills the side that's missing, see teams/route.ts and
// wallet-kinds/route.ts's own header comments), but teams-first means the
// wallet-kind POSTs immediately seed all four teams' wallets in the same
// call rather than relying on the reverse backfill path.
export async function applyJccSeason3Preset(auctionId: string, adminPassword: string): Promise<PresetResult> {
  const failures: PresetStepFailure[] = [];
  const walletKindIdByKey = new Map<PresetWalletKind["key"], string>();

  for (const teamId of TEAM_ORDER_ALL) {
    const team = TEAMS[teamId];
    const res = await postJson(`/api/auctionos/${auctionId}/teams`, adminPassword, {
      name: team.name,
      short_name: team.shortName,
      logo_url: team.logo,
      tagline: team.tagline,
      primary_color: team.primary,
      secondary_color: team.secondary,
    });
    if (!res.ok) failures.push({ step: `Franchise: ${team.name}`, error: res.error ?? "Failed" });
  }

  for (const kind of WALLET_KINDS) {
    const res = await postJson(`/api/auctionos/${auctionId}/wallet-kinds`, adminPassword, {
      name: kind.name,
      initial_balance: kind.initial_balance,
      sort_order: kind.key === "wallet_a" ? 0 : 1,
    });
    if (!res.ok) {
      failures.push({ step: `Wallet: ${kind.name}`, error: res.error ?? "Failed" });
      continue;
    }
    const walletKind = res.json.wallet_kind as { id: string } | undefined;
    if (walletKind?.id) walletKindIdByKey.set(kind.key, walletKind.id);
  }

  for (const category of CATEGORIES) {
    const walletKindId = walletKindIdByKey.get(category.wallet_kind_key);
    if (!walletKindId) {
      // The wallet kind this category needs never got created above —
      // creating the category anyway would silently leave it unfunded
      // (wallet_kind_id NULL), which is worse than surfacing the gap.
      failures.push({ step: `Category: ${category.name}`, error: "Its wallet kind failed to create — skipped" });
      continue;
    }
    const res = await postJson(`/api/auctionos/${auctionId}/categories`, adminPassword, {
      name: category.name,
      wallet_kind_id: walletKindId,
      base_price: category.base_price,
      bid_increment: category.bid_increment,
      min_required: category.min_required,
      max_resell_rounds: category.max_resell_rounds,
      sort_order: category.sort_order,
    });
    if (!res.ok) failures.push({ step: `Category: ${category.name}`, error: res.error ?? "Failed" });
  }

  return { failures };
}
