// A rigorous-testing harness for the JCC auction hall UI — same
// AuctionExperience component the real /auctionos/hall renders, wired to
// an in-memory mock engine (lib/auctionos/templates/jcc/mockEngine.ts)
// instead of Supabase/API routes. Nothing in the browser reaches the
// network: every bid/sold/unsold/advance transition runs the exact
// client-side port of the production RPC logic, so paddle animations, the
// hammer sequence, and the bidding flow can be driven start-to-finish
// without a real auction ever being set up. Not linked from anywhere in
// the product nav — a dev tool, reached by typing the URL.
//
// The one server-side read is the club roster (approved `players` rows —
// the same faces /members shows), so the mock auction runs on real
// registered members with their real profile photos rather than invented
// names with DiceBear illustrations. It's read here rather than in the
// client because fetchClubRoster uses the service-role key. If the read
// comes back empty the seed falls back to its hardcoded name list, so the
// harness still works with no database configured.

import { fetchClubRoster } from "@/lib/club-roster.server";
import DevHarnessClient from "./DevHarnessClient";

export const dynamic = "force-dynamic";

export default async function AuctionOSDevPage() {
  const roster = await fetchClubRoster();
  return <DevHarnessClient roster={roster} />;
}
