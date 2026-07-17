import type { AuctionOrderConfig } from "@/lib/auctionos/core/template";
import type { AuctionLot, AuctionCategory } from "@/lib/auctionos/core/types";

// Marquee lots first, then the rest grouped by category sort_order;
// sequential within a category (lot_order as authored by whoever built the
// pool). Category is read from the real `category_id` FK on the lot now —
// no more denormalised category id stashed in lot.metadata, since
// auction_categories (and their sort_order) is a real table a template can
// join against by id.
export const jccAuctionOrder: AuctionOrderConfig = {
  mode: "sequential",
  resolve(lots: AuctionLot[], categories: AuctionCategory[]): AuctionLot[] {
    const rank = (lot: AuctionLot): number => {
      const category = categories.find((c) => c.id === lot.category_id);
      return category ? category.sort_order : categories.length;
    };
    return [...lots].sort((a, b) => rank(a) - rank(b) || a.lot_order - b.lot_order);
  },
};
