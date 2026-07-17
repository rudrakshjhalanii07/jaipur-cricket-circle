import {
  fetchWallets,
  fetchLots,
  fetchAuctionCategories,
  resolveAuctionTemplate,
} from "@/lib/auctionos/core/data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Auction } from "@/lib/auctionos/core/types";
import "@/lib/auctionos/templates";
import { jccTemplate } from "@/lib/auctionos/templates";
import HallAccessGate from "@/components/auctionos/HallAccessGate";

// Server-side equivalent of the browser's /api/auctionos/current — reads
// via supabaseAdmin (service role) since `auctions` has no public RLS read
// policy after the SaaS pivot (see AUCTIONOS.md's "Landing philosophy").
async function fetchActiveAuctionServer(): Promise<Auction | null> {
  const { data } = await supabaseAdmin
    .from("auctions")
    .select("id, template_id, name, status, starts_at, current_lot_id, created_at, updated_at")
    .in("status", ["scheduled", "live", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Auction) ?? null;
}

export default async function AuctionHallPage() {
  const auction = await fetchActiveAuctionServer();
  const [wallets, lots, categories] = auction
    ? await Promise.all([
        fetchWallets(auction.id),
        fetchLots(auction.id),
        fetchAuctionCategories(auction.id),
      ])
    : [[], [], []];

  // No auction yet — nothing to resolve a template from, so fall back to
  // the site's one built-in template until an auctioneer prepares an
  // auction. Once one exists, template_id is the auction_templates DB uuid,
  // resolved to its module_key before the code registry can look it up.
  const template = auction ? await resolveAuctionTemplate(auction.template_id) : jccTemplate;
  const AuctionExperience = (template ?? jccTemplate).AuctionExperience;

  return (
    <HallAccessGate hasAuction={!!auction} auctionId={auction?.id ?? null}>
      <AuctionExperience
        initialAuction={auction}
        initialWallets={wallets}
        initialLots={lots}
        initialCategories={categories}
      />
    </HallAccessGate>
  );
}
