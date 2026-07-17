import { registerTemplate } from "@/lib/auctionos/core/registry";
import { defineTemplate } from "@/lib/auctionos/core/template";
import AuctionExperience from "./AuctionExperience";

// The template with nothing to say: every module falls back to the
// engine's neutral default (see defineTemplate in core/template.ts) — no
// currency, no categories, no bid-increment ladder, no reserve/valuation
// logic, a single "auctioneer" role. Useful both as a working
// start-from-nothing format and as the reference example for what a new
// template minimally has to supply: an id, a displayName, and a UI.
export const blankTemplate = defineTemplate({
  id: "blank",
  displayName: "Blank Auction",
  AuctionExperience,
});

registerTemplate(blankTemplate);
