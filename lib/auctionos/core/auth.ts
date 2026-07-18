// Per-auction credential verification — server-only (imports supabaseAdmin,
// the service-role client). Starts filling the `permissions.ts`-shaped gap
// AUCTIONOS.md's Phase 2 design left open (§8/§9): every AuctionOS mutation
// route used to check a single shared `process.env.ADMIN_PASSWORD`; this
// file replaces that with a per-auction secret model — see the wizard-pass
// plan's "Per-auction credentials" section for the full design.
//
// Hashing happens SERVER-SIDE here, never trusting a client-supplied hash —
// a route receives the plaintext password/key from the request body and
// calls hashSecret() itself before comparing against the DB column.
//
// This is a clean replace, not a migration: legacy auctions created before
// the wizard-pass schema delta (supabase/add_auctionos_wizard.sql) have
// `admin_password_hash IS NULL` and simply have no admin access from here
// on — there is deliberately no env-var fallback (per the approved plan;
// this hasn't been exercised against real production data yet).

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

// SHA-256, hex-encoded — must match the Postgres side exactly:
// `encode(digest(secret, 'sha256'), 'hex')` (supabase/add_auctionos_wizard.sql).
// Direct equality against this hash is appropriate here because every
// secret it's used for (admin password, captain access key) is server-
// generated and high-entropy, not a user-chosen password that needs
// slow/salted hashing to resist guessing.
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

// Looks up auctions.admin_password_hash for this auction and compares.
// Returns false (never throws) if the auction doesn't exist or has no hash
// set yet — both cases mean "no admin access," not a server error.
export async function verifyAdminPassword(auctionId: string, password: string): Promise<boolean> {
  if (!auctionId || !password) return false;

  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("admin_password_hash")
    .eq("id", auctionId)
    .maybeSingle();

  if (error || !data || !data.admin_password_hash) return false;

  return hashSecret(password) === data.admin_password_hash;
}

export interface CaptainIdentity {
  auctionId: string;
  captainId: string;
  teamId: string | null;
  auctionTeamId: string | null;
}

// Resolves a captain's identity from the auction's join code + their own
// per-captain access key. `code` is uppercase-normalized the same way
// /api/auctionos/resolve-code does (case-insensitive match via `ilike`,
// not an explicit .toUpperCase() — see app/api/auctionos/resolve-code/route.ts)
// so a captain typing their code in any case still resolves.
export async function verifyCaptainKey(
  code: string,
  accessKey: string
): Promise<CaptainIdentity | null> {
  if (!code || !accessKey) return null;

  const { data: auction, error: auctionError } = await supabaseAdmin
    .from("auctions")
    .select("id")
    .ilike("access_code", code)
    .maybeSingle();

  if (auctionError || !auction) return null;

  const keyHash = hashSecret(accessKey);

  const { data: captain, error: captainError } = await supabaseAdmin
    .from("auction_captains")
    .select("id, team_id, auction_team_id")
    .eq("auction_id", auction.id)
    .eq("access_key_hash", keyHash)
    .maybeSingle();

  if (captainError || !captain) return null;

  return {
    auctionId: auction.id,
    captainId: captain.id,
    teamId: captain.team_id,
    auctionTeamId: captain.auction_team_id,
  };
}

// Discovers an auction FROM its admin password — the reverse direction of
// verifyAdminPassword() above, which checks a *known* auction's hash. The
// admin password alone identifies and authenticates the auction (per the
// wizard-pass plan's "Per-auction credentials" design), so this is a
// different query shape, not a reuse of verifyAdminPassword with the
// arguments flipped: there is no auctionId yet, hence the hash lookup drives
// which auction gets returned.
export async function resolveAuctionByAdminPassword(password: string): Promise<string | null> {
  if (!password) return null;

  const hash = hashSecret(password);

  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("id")
    .eq("admin_password_hash", hash)
    .maybeSingle();

  if (error || !data) return null;

  return data.id as string;
}
