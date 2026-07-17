import type { FloorPriceContext } from "@/lib/auctionos/core/template";

// Floor tier per category name, in the same lakhs units as
// BASE_PRICE_TIERS_LAKHS (rules.ts) — marquee lots floor highest,
// wicketkeepers lowest. This is only the CODE-LEVEL fallback: since the
// DB-backed catalog rewrite, `auction_categories.floor_price` (renamed from
// `reserve_price` — see AUCTIONOS.md's Floor Price / Reserve split) is the
// organizer-editable, live source of truth (seeded from
// `template_categories.default_floor_price`, which mirrors this same
// ladder — see supabase/add_auctionos.sql §1). This ladder only kicks in if
// a category somehow has no floor_price set at all.
const CATEGORY_FLOOR_LAKHS: Record<string, number> = {
  Marquee: 100,
  "All-Rounders": 75,
  Batters: 50,
  Bowlers: 30,
  Wicketkeepers: 20,
};

// Floor price resolves purely from the auction's own (organizer-editable)
// `auction_categories` row rather than a JSONB override — that mechanism
// is gone now that floor_price is already a live, per-auction typed column.
export function computeJccFloorPrice({ lot, category }: FloorPriceContext): number {
  if (!category) return lot.base_price;
  if (category.floor_price != null) return category.floor_price;
  return CATEGORY_FLOOR_LAKHS[category.name] ?? lot.base_price;
}
