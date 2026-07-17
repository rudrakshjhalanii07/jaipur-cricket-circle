import { registerTemplate } from "@/lib/auctionos/core/registry";
import { defineTemplate } from "@/lib/auctionos/core/template";
import {
  formatLakhs,
  getNextBidIncrement,
  validateJccBid,
  BID_INCREMENT_TIERS,
} from "./rules";
import { jccAuctionOrder } from "./auctionOrder";
import { computeJccFloorPrice } from "./floorPrice";
import { computeJccCaptainValue } from "./valuation";
import { jccAllocation } from "./allocation";
import { jccPermissions } from "./permissions";
import { jccVisibility } from "./visibility";
import AuctionExperience from "./AuctionExperience";

// Every module here is a JCC value populated into the generic shape
// `defineTemplate` provides defaults for — nothing about "lakhs," a
// "paddle," or a role like "batter" exists anywhere under lib/auctionos/core.
// Categories and starting budget are no longer template code fields — they
// live as `template_categories`/`auction_wallets` DB rows (see
// AUCTIONOS.md's "Template catalog" section).
export const jccTemplate = defineTemplate({
  id: "jcc",
  displayName: "JCC Player Auction",
  AuctionExperience,

  wallet: { formatAmount: formatLakhs },
  auctionOrder: jccAuctionOrder,
  bidIncrements: { tiers: BID_INCREMENT_TIERS, nextIncrement: (currentBid) => getNextBidIncrement(currentBid) },
  validation: { validateBid: validateJccBid },
  floorPrice: { computeFloorPrice: computeJccFloorPrice },
  valuation: { computeCaptainValue: computeJccCaptainValue },
  allocation: jccAllocation,
  permissions: jccPermissions,
  visibility: jccVisibility,
});

registerTemplate(jccTemplate);
