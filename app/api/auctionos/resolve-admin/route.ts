import { NextResponse } from "next/server";
import { resolveAuctionByAdminPassword } from "@/lib/auctionos/core/auth";

// The password alone identifies and authenticates the auction — this is
// the reverse lookup direction from verifyAdminPassword (which checks a
// *known* auction's hash); here the auction id isn't known yet. Body:
// { password }. Returns { auction_id } or 401.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password) {
      return NextResponse.json({ error: "password is required" }, { status: 400 });
    }

    const auctionId = await resolveAuctionByAdminPassword(password);
    if (!auctionId) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({ auction_id: auctionId });
  } catch (err) {
    console.error("auctionos/resolve-admin error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
