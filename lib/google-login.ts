// Member login: registered phone number first, then Google.
//
//   1. /api/player/google/start     the member enters their phone number. If it
//                                   belongs to an approved member, we remember
//                                   who (in an encrypted, short-lived cookie)
//                                   and send them to Google.
//   2. /api/player/google/callback  Google sends them back. The first sign-in
//                                   links that Google account to the player
//                                   (player_google_links); after that only the
//                                   linked account gets in with that number.
//                                   On success the member pass is set and a
//                                   one-time handoff cookie is left for step 3.
//   3. /api/player/google/complete  the profile page trades the handoff cookie
//                                   for the 1-hour profile-edit session token,
//                                   which it keeps in localStorage as before.
//
// Plain OAuth 2.0 authorization-code flow against Google, no SDK. The ID token
// comes straight from Google's token endpoint over TLS, so its claims can be
// read without checking the signature (OpenID Connect Core §3.1.3.7).

import crypto from "crypto";
import { decrypt, encrypt } from "@/lib/auth-crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

/** Holds { state, playerId } between start and callback. */
export const OAUTH_COOKIE = "jcc_google_oauth";
/** Holds { pid } between callback and complete. */
export const HANDOFF_COOKIE = "jcc_google_login";

const COOKIE_PATH = "/api/player/google";
const OAUTH_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 2 * 60 * 1000;

export const googleConfigured = () => !!CLIENT_ID && !!CLIENT_SECRET;

export const shortCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: COOKIE_PATH,
  maxAge: Math.floor(maxAgeMs / 1000),
});
export const OAUTH_COOKIE_OPTIONS = shortCookieOptions(OAUTH_TTL_MS);
export const HANDOFF_COOKIE_OPTIONS = shortCookieOptions(HANDOFF_TTL_MS);
export const CLEAR_COOKIE_OPTIONS = shortCookieOptions(0);

/** Must match an "Authorized redirect URI" on the Google OAuth client exactly. */
export const redirectUri = (request: Request) => new URL("/api/player/google/callback", request.url).toString();

export function newOAuthState(playerId: string): { state: string; cookie: string } {
  const state = crypto.randomBytes(24).toString("base64url");
  return { state, cookie: encrypt(JSON.stringify({ state, playerId, exp: Date.now() + OAUTH_TTL_MS })) };
}

/** The player the sign-in was started for, if the cookie is genuine, current and matches `state`. */
export function readOAuthState(cookie: string | undefined, state: string | null): string | null {
  if (!cookie || !state) return null;
  try {
    const p = JSON.parse(decrypt(cookie)) as { state?: unknown; playerId?: unknown; exp?: unknown };
    if (typeof p.state !== "string" || typeof p.playerId !== "string" || typeof p.exp !== "number") return null;
    if (Date.now() > p.exp) return null;
    const a = Buffer.from(p.state);
    const b = Buffer.from(state);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return p.playerId;
  } catch {
    return null;
  }
}

export const issueHandoff = (playerId: string) =>
  encrypt(JSON.stringify({ pid: playerId, exp: Date.now() + HANDOFF_TTL_MS }));

export function readHandoff(cookie: string | undefined): string | null {
  if (!cookie) return null;
  try {
    const p = JSON.parse(decrypt(cookie)) as { pid?: unknown; exp?: unknown };
    if (typeof p.pid !== "string" || typeof p.exp !== "number" || Date.now() > p.exp) return null;
    return p.pid;
  } catch {
    return null;
  }
}

export function googleAuthUrl(request: Request, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Always show the account chooser, so a member on a shared phone or with
    // several accounts picks deliberately rather than being signed in silently.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export interface GoogleIdentity {
  sub: string;
  email: string | null;
}

/** Trades the callback's code for the Google account behind it, or null if anything is off. */
export async function exchangeCode(request: Request, code: string): Promise<GoogleIdentity | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Google token exchange failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  const payload = id_token?.split(".")[1];
  if (!payload) return null;

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    exp?: number;
  };
  if (claims.aud !== CLIENT_ID) return null;
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
  if (!claims.sub || !claims.exp || claims.exp * 1000 < Date.now()) return null;
  return { sub: claims.sub, email: claims.email_verified ? claims.email ?? null : null };
}
