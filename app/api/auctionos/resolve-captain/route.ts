import { NextResponse } from "next/server";
import { verifyCaptainKey } from "@/lib/auctionos/core/auth";

// Join code + per-captain access key -> captain identity. Body:
// { code, access_key }. Returns { auction_id, captain_id, team_id } or 401.
// team_id is the resolved captain's identifying team — may be a global
// public.teams id (legacy JCC path) or an auction_teams id (wizard path);
// see verifyCaptainKey's CaptainIdentity for both team_id/auction_team_id.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, access_key } = body as { code?: string; access_key?: string };

    if (!code || !access_key) {
      return NextResponse.json({ error: "code and access_key are required" }, { status: 400 });
    }

    const identity = await verifyCaptainKey(code, access_key);
    if (!identity) {
      return NextResponse.json({ error: "Invalid code or access key" }, { status: 401 });
    }

    return NextResponse.json({
      auction_id: identity.auctionId,
      captain_id: identity.captainId,
      team_id: identity.teamId ?? identity.auctionTeamId,
    });
  } catch (err) {
    console.error("auctionos/resolve-captain error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
