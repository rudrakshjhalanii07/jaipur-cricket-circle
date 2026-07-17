import type { VisibilityDefaults } from "@/lib/auctionos/core/template";

// The floor price and each team's purse are part of the show — the crowd
// is meant to see them. Captain desks see the captain's live value;
// spectators don't (it's a strategic number for a bidder, not something to
// broadcast to the room).
export const jccVisibility: VisibilityDefaults = {
  showFloorPriceToSpectators: true,
  showValuationToOperators: true,
  showWalletsToSpectators: true,
};
