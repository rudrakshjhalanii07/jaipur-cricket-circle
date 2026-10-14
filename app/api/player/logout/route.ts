import { NextResponse } from "next/server";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/member-session";

/** Clears the member pass — signing out of /profile signs out of /stats too. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MEMBER_COOKIE, "", { ...memberCookieOptions, maxAge: 0 });
  return response;
}
