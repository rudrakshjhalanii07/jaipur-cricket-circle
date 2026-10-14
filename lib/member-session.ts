// The member pass: who is signed in, for pages the server renders.
//
// The profile login has always kept its session in localStorage, which only the
// browser can see. /stats is members-only and rendered on the server, so a
// verified login also gets this pass — an httpOnly cookie the server can read.
//
// The pass is encrypted with the same key as the profile-edit session token
// but deliberately has a different shape ({ mid, exp } rather than
// { playerId, expiresAt }): it lasts 30 days, and must never be accepted where
// the 1-hour edit token is required.

import { cookies } from "next/headers";
import { decrypt, encrypt } from "@/lib/auth-crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const MEMBER_COOKIE = "jcc_member";
const PASS_DAYS = 30;

export const memberCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PASS_DAYS * 24 * 60 * 60,
};

export function issueMemberPass(playerId: string): string {
  return encrypt(JSON.stringify({ mid: playerId, exp: Date.now() + PASS_DAYS * 24 * 60 * 60 * 1000 }));
}

/** The player id a pass belongs to, or null if it's forged, malformed or expired. */
export function readMemberPass(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const p = JSON.parse(decrypt(token)) as { mid?: unknown; exp?: unknown };
    if (typeof p.mid !== "string" || typeof p.exp !== "number" || Date.now() > p.exp) return null;
    return p.mid;
  } catch {
    return null;
  }
}

export interface SignedInMember {
  id: string;
  name: string;
  image_url: string | null;
  team: string | null;
}

/**
 * The member behind this request's pass — re-checked against the players table
 * every time, so a member removed or un-approved since signing in loses access
 * straight away rather than when the cookie runs out.
 */
export async function getSignedInMember(): Promise<SignedInMember | null> {
  const id = readMemberPass((await cookies()).get(MEMBER_COOKIE)?.value);
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from("players")
    .select("id, name, image_url, team, approval_status, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.approval_status !== "approved" || data.is_active === false) return null;
  return { id: data.id, name: data.name, image_url: data.image_url, team: data.team };
}
