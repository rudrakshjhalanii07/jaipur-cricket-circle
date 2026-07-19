# JCC Auction Rules

All template-specific logic for the JCC Player Auction (`lib/auctionos/templates/jcc/`).
Nothing here applies to other AuctionOS templates — the generic engine
(`lib/auctionos/core`, `supabase/add_auctionos.sql`) never sees a lakh, a
captain, or a role name. See `AUCTIONOS.md` at the repo root for the
platform-wide architecture; this file is scoped to JCC's rules only.

## Currency

Money is stored and passed as an integer number of **lakhs** (IPL-style),
e.g. `2000` = ₹20 Cr, `50` = ₹50 L. (`rules.ts`)

- `formatLakhs()` renders a raw lakh integer for display: ≥100 shows as
  `₹X.XX Cr` (or `₹X Cr` if whole), below 100 shows as `₹X L`.
- `parseMoneyLakhs()` is the inverse, for every organizer-facing money
  input (wallet balances, base prices, bid increments, CSV import).
  Accepts `20cr` / `20 Cr` / `20crore` → `2000`; `50l` / `50L` / `50lakh(s)`
  → `50`; a bare number is already lakhs. Strips commas/₹/$. Returns `null`
  for anything unparseable (treated as a validation error, never silently
  coerced to 0/NaN).

## Purses (default wallets)

- Wallet A (MVP + Regular categories): **₹14 Cr** (1400 lakhs) per team.
- Wallet B (Guest Players): **₹5 Cr** (500 lakhs) per team.

## Base price tiers

`BASE_PRICE_TIERS_LAKHS = [20, 30, 50, 75, 100]` — the base-price ladder
organizers pick from when building the lot pool.

## Bid increments

Increments are a **flat, per-category value** — `auction_categories.bid_increment`,
organizer-editable (`add_auctionos_wizard.sql` §6). Every category actually
seeded today has one set explicitly, e.g. (mock seed values): Marquee-tier
+₹20 L, mid-tier (All-Rounders/Batters) +₹10 L, base-tier
(Bowlers/Wicketkeepers) +₹5 L.

`BID_INCREMENT_TIERS` in `rules.ts` is a graduated step-up ladder (smaller
increments early, larger as price climbs — < ₹1 Cr: +₹5 L, ₹1–2 Cr: +₹10 L,
≥ ₹2 Cr: +₹20 L) that only fires as a **fallback** when a category's
`bid_increment` is `NULL` (`index.ts`: `category?.bid_increment ?? getNextBidIncrement(currentBid)`).
Since every current category has an explicit flat override, this ladder is
not presently the operative rule for any real category — it exists so
older/future categories without an override keep working, not because any
live category actually graduates its increment as price climbs.

## Bid validation

`validateJccBid()` — a bid is rejected only if the team's
`wallet.budget_remaining` is less than the proposed amount ("Team cannot
afford this bid"). No other validation exists at the template level.

## Floor price

`computeJccFloorPrice()` resolution order:

1. `auction_categories.floor_price` if the organizer has set one — this is
   the live, per-auction, organizer-editable source of truth.
2. Otherwise, the code-level fallback ladder by category name:

   | Category | Floor |
   |---|---|
   | Marquee | ₹1 Cr (100L) |
   | All-Rounders | ₹75 L |
   | Batters | ₹50 L |
   | Bowlers | ₹30 L |
   | Wicketkeepers | ₹20 L |

3. If the lot has no category at all, falls back to `lot.base_price`.

Floor Price (this) is distinct from "Reserve" — the live, wallet-level
required-holdback number the generic engine derives from
`category.min_required` × current base prices. Reserve is generic engine
logic, not a JCC rule.

## Minimum wallet threshold (Reserve)

A team can never bid its wallet down below what it needs to still complete
its squad. This is **generic engine logic** (`lib/auctionos/core/reserve.ts`),
not JCC-specific code, but JCC categories' `min_required`/`base_price` are
what drive it, so the rule is:

> reserve = Σ over the wallet's own categories of
> `max(0, category.min_required − players_already_acquired_in_category) × category.base_price`

A bid is rejected if `wallet.budget_remaining − proposedAmount` would drop
below the reserve required for every *other* mandatory slot (the lot being
bid on counts as filling one slot of its own category first, so a team is
never blocked from bidding on a lot that itself satisfies a requirement).

A team's **captain occupies one slot of their own category** for this
calculation, with no purchase behind it — `players_already_acquired_in_category`
above is really "purchases + 1 if this wallet's team captains this
category" (`withCaptainBonus()`, `lib/auctionos/core/reserve.ts`; mirrored
in SQL by `_auctionos_acquired_count()`, `add_auctionos_quota.sql`). This is
distinct from — and doesn't touch — the *money* a captain costs (see
"Captain valuation" below): a captain fills a squad slot from the moment
they're assigned, but their `captain_charge` wallet deduction only starts
once the team's first qualifying purchase happens.

Enforced twice, same defense-in-depth as the budget check: the
`/api/auctionos/bid` route (client-facing 400) and `auctionos_raise_bid`
(the real gate, since the RPC could otherwise be called directly). The mock
engine mirrors both.

## Category quota

Any category with `min_required > 0` (JCC sets MVP to 2, Regular to 5 — a
team's captain, if seated in that category, counts as one of them; Guest
stays at 0) gets two additional, fully generic mechanics on top of ordinary
bidding — neither is JCC-specific code, both live in
`supabase/add_auctionos_quota.sql` and are mirrored by `mockEngine.ts`:

1. **Loop.** If a quota category's lot goes unsold (`auctionos_mark_unsold`)
   and other `upcoming` lots remain in that category, it's requeued to the
   back of the category's own block rather than resolved — the category
   cannot finish while any of its own lots are unresolved. Never crosses
   into the next category's block (lots after it shift `lot_order` up by
   one to make room; `auction_lots`'s `(auction_id, lot_order)` uniqueness
   is `DEFERRABLE INITIALLY DEFERRED` so this batch shift can't spuriously
   collide mid-statement).

2. **The actual quota gate — `auctionos_advance_lot`, not `mark_unsold`.**
   Every time the auctioneer calls the next player, before opening a quota
   category's lot the function checks whether it's the **last** `upcoming`
   lot left in that category. If so, the decision runs *before* the lot
   ever reaches `on_block`:
   - exactly one team is still short of `min_required` and can afford
     `category.base_price` → **allotted** straight to them, no bidding
     round, no chance for a richer team to simply outbid the team it's
     meant to protect;
   - zero teams are short → ordinary bidding (nobody needs it, nothing to
     force — it can still end up plain unsold, and that's fine);
   - **2+ teams tied short, or the one short team can't afford
     `base_price`** → the lot goes to a new `'blocked'` status instead.
     `auctionos_advance_lot` refuses to run at all while any lot is
     `'blocked'` — the auctioneer is stuck until an organizer manually
     resolves it via `auctionos_resolve_blocked_lot(lot_id, wallet_id)`
     (`wallet_id` null gives up, finalizing it as terminally unsold).
     **Deliberately no automatic tie-break** — confirmed explicitly rather
     than guessed: this is a genuinely reachable case in ordinary
     competitive bidding (two teams can easily end up equally short when
     two others pull ahead), not a contrived edge case, but who wins the
     one remaining slot is a judgment call for a human, not a formula.
     `AuctionExperience.tsx`'s `BlockedLotPanel` is that judgment-call UI —
     shown in place of the ordinary on-block screen, listing every eligible
     team with their current count and whether they can afford it.

   This can't live in `mark_unsold` alone — an earlier version of this
   migration tried exactly that and a scripted simulation against
   `mockEngine.ts` immediately caught the hole: if money simply keeps
   landing on 1-2 rich teams every round, a whole category can sell out via
   ordinary bid-won sales without a single lot ever going unsold, and a
   reactive-to-unsold check never gets a turn to run. `mark_unsold`'s own
   last-lot branch is kept anyway, as defense-in-depth (same posture as the
   budget/reserve checks elsewhere in this schema) rather than because it's
   expected to fire in the common case.

   A **pool-exhaustion caveat, confirmed by the same simulation**: this
   mechanism rescues a team that's short by exactly one slot when a
   category's pool runs dry. If a team falls behind by *more* than one slot
   before the pool is exhausted, no algorithm can close that gap — there
   simply aren't enough players left. That's not a bug to fix; it's the
   same constraint any real auction has (an organizer must seed enough
   players for every team's minimum, with a buffer for uneven bidding), and
   the mechanism above still does the right thing with it: either it
   rescues the one short team it can, or it correctly surfaces the
   unsatisfiable case as `'blocked'` for a human rather than silently
   completing the auction with a team short.

Forced allotments reuse the ordinary `'sold'` lot status (not a new one) —
`auctionos_undo_sale`, `TeamSheet`, `CompletedRecap`, and every other
"what's this team's roster" read already treat any sold lot uniformly.
`player_purchases.metadata.allotted` and the `lot_sold` event's
`payload.allotted` are the only markers distinguishing an allotment from a
bid-won sale, and they're audit-only — nothing in quota/reserve math reads
them. `AuctionExperience.tsx` still tells them apart for the room: its
`HammerOverlay` shows "Allotted" instead of "Sold" for one (inferred from
the resolved lot's status after `handleUnsold`/`handleResolveBlockedLot`
runs — neither the RPC nor the engine interface returns this directly), and
a lightweight, non-blocking `LoopedToast` announces a loop without the full
hammer-overlay ceremony (a category can loop the same handful of players
several times in a row; a heavy modal every time would be exhausting rather
than informative).

## Guest squad rebalancing

A second, separate mechanic from Category quota above — also fully
generic, driven by `auction_categories.max_resell_rounds` (JCC sets it to
`2` for Guest, leaves it `NULL` for MVP/Regular, where quota's
unconditional loop already applies instead). Lives alongside quota's own
functions in `auctionos_mark_unsold`
(`supabase/add_auctionos_guest_rebalance.sql`, mirrored by `mockEngine.ts`).

The goal is different from quota's: Guest has no mandatory minimum
(`min_required = 0`) — nobody is *required* to own Guest players — the goal
is just that **every team's overall squad ends up roughly the same size**.
So the mechanism doesn't touch bidding at all (no `advance_lot` gate, no
"is this the last lot" check) — it only decides what happens after one
specific player has genuinely failed to sell more than once:

- An unsold Guest lot is resold (requeued to the back of its own
  category's block, same technique as quota's loop) up to
  `max_resell_rounds` times — tracked per-lot in `lot.metadata.resell_rounds`,
  not a separate column.
- Once it's been resold that many times and is *still* unsold, instead of
  going terminally unsold immediately, it's **randomly allotted** (at
  `category.base_price`) to whichever eligible team can afford it and
  currently has the **smallest total squad** — summed across *every*
  wallet that team holds in the auction (both MVP/Regular's Wallet A and
  Guest's own Wallet B), not just Guest purchases, since the target is
  overall squad balance, not a Guest-specific count. Ties broken randomly.
  If literally nobody eligible can afford `base_price`, it goes plain
  terminal unsold — this is a best-effort balance, not a guarantee the way
  quota's allotment is.

Verified by a scripted worst-case simulation (every single Guest lot
forced unsold on every attempt, exercising the resell-cap-then-rebalance
path for the entire category): the cap held at exactly 2 for every lot, no
lot was left stuck, and the four teams' final overall squad sizes came out
within 1 player of each other.

`player_purchases.metadata.allotted` / `lot_sold`'s `payload.allotted` mark
a rebalance allotment the same way a quota allotment is marked (see above)
— an additional `lot_rebalanced` event (`{category_id, wallet_id,
squad_size_before}`) is what actually distinguishes "resold out of
players, going to whoever's smallest" from "resold out of patience, going
to the one team that specifically needed it."

## Registration role → category name

Lot-registration roles (`app/register/page.tsx`: `batter`, `bowler`,
`all-rounder`, `wicketkeeper`, `marquee`) don't share spelling with the DB
category names. `JCC_ROLE_TO_CATEGORY_NAME` (`categories.ts`) maps:

| Role | Category name |
|---|---|
| marquee | Marquee |
| all-rounder | All-Rounders |
| batter | Batters |
| bowler | Bowlers |
| wicketkeeper | Wicketkeepers |

## Auction order

`jccAuctionOrder` — sequential mode. Lots are sorted by category
`sort_order` first (Marquee first, then the rest in authored order), then
by `lot_order` within a category. Category is read from the lot's real
`category_id` FK.

Note: `jccAuctionOrder.resolve()` itself is currently dead code — nothing
calls it. The real, enforced ordering comes from `auction_lots.lot_order`,
which `auctionos_begin_auction` (`add_auctionos_wizard.sql`) assigns once
via `ORDER BY category.sort_order, random()` (category blocks fixed, draw
order randomized only within a category), and `auctionos_advance_lot`
(`add_auctionos.sql`/`add_auctionos_quota.sql`) walks `status = 'upcoming'`
lots in that order. No route ever lets `lot_order` be edited after creation
(`[id]/lots/route.ts` explicitly excludes it from bulk patch), so an
auction **cannot** interleave categories or run one out of block order —
this is a structural guarantee, not something the UI needs to additionally
enforce. `auction_settings.unsold_round_enabled` is a stored setting with
no implementation of its own (a dead toggle) — the real, category-scoped
requeue mechanism is the "Category quota" section below, which has nothing
to do with that setting.

`AuctionExperience.tsx` surfaces this block structure two ways: the
category-progress chip row is animated/highlighted for whichever category is
currently on the block or up next (`activeCategory`), and a full-screen
`CategoryAnnouncementOverlay` ("Now Entering: <Category>") plays once per
category transition — including the very first category of a fresh auction,
guarded against replay-on-reload the same way `AuctionFinaleOverlay` is
(`lastAnnouncedCategoryIdRef`/`hasPlayedFinaleRef`, both seeded from the
initial server snapshot rather than starting at a value that would
misfire).

## Captain valuation

One captain per team, occupying exactly one category slot
(`UNIQUE(auction_id, team_id)` on `auction_captains`). The rule now
**branches by category name** — categories have no separate "kind" field,
so the match is by name (`ILIKE '%regular%'` in SQL, `/regular/i` in JS);
anything not matching "Regular" (including MVP) falls back to the MVP
formula:

- **MVP captains** (or any non-Regular category): value = **50%** of the
  highest unreversed `player_purchases.price` made by the captain's own
  team inside the captain's own category ("highest qualifying purchase").
  `null` if the team has no qualifying purchase yet.
- **Regular captains**: value is **hard-coded at 100** (₹1 Cr), regardless
  of what the team has spent. Not derived from purchases at all.

Deterministic, not advisory — `captainValue` IS the captain's price, not a
suggestion. Not derived from player stats (strike rate/economy), unlike an
earlier draft of this logic.

Implemented in three places kept in sync (`AUCTIONOS.md` §14 has the full
cross-reference):

- `valuation.ts` — `computeJccCaptainValue()`, the template-registered
  version used wherever the generic `ValuationEngine` contract is read.
- `supabase/add_auctionos.sql` — `_auctionos_recalc_captain_valuation`,
  the real write path; invoked from `auctionos_mark_sold`/
  `auctionos_undo_sale`, logs a new `captain_valuations` row every time.
- `mockEngine.ts` — `recalcCaptainValuation`, a line-by-line mirror of the
  SQL RPC for the no-network `/auctionos/dev` harness.

## Allocation

`jccAllocation` — explicit no-op (`onLotSold`/`onLotUnsold`). The engine's
own RPCs already handle everything JCC's auction night needs (budget
deduction, `acquired_count`). Declared explicitly rather than omitted, as a
marker that this hook was considered, not forgotten.

## Permissions

`jccPermissions` — one role only: `auctioneer`. No proxy-bidding /
paddle-relay "operator" role exists. `canBidOnBehalf: false`.

## Visibility

`jccVisibility`:

- `showFloorPriceToSpectators: true` — the floor is part of the show.
- `showWalletsToSpectators: true` — team purses are part of the show.
- `showValuationToOperators: true` — captain desks see their live
  valuation; spectators don't (it's a strategic number for a bidder, not
  something to broadcast to the room).
