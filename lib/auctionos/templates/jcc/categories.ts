// Categories are no longer a code constant — since the DB-backed catalog
// rewrite, JCC's default categories live as `template_categories` rows
// (seeded in supabase/add_auctionos.sql, copied into `auction_categories`
// per-auction at creation time). This file is intentionally left with only
// the mapping helper below: JCC's lot-registration roles (app/register/page.tsx
// — batter, bowler, all-rounder, wicketkeeper) don't share spelling with the
// DB category names ("Batters", "Bowlers", ...), so anything that needs to
// go from a registration role string to a category still needs a small
// lookup — this is that lookup, not a category list.

// Registration role (lowercase, singular) → the `auction_categories.name`
// seeded from template_categories for the "jcc" template. Kept here since
// it's the one piece of JCC-specific mapping logic other template modules
// (auctionOrder.ts, the pool builder) still need.
export const JCC_ROLE_TO_CATEGORY_NAME: Record<string, string> = {
  marquee: "Marquee",
  "all-rounder": "All-Rounders",
  batter: "Batters",
  bowler: "Bowlers",
  wicketkeeper: "Wicketkeepers",
};
