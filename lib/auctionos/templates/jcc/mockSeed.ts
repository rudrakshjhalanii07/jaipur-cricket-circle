// Hardcoded seed for the /auctionos/dev mock auction — same row shapes
// (Auction/AuctionWallet/AuctionLot/AuctionCategory/AuctionCaptain) a real
// auction would get from Supabase, just written by hand instead of read
// from it. Player list, categories, base prices, and step-ups are lifted
// from the "JCC Season 3 — Player Categories & List" graphic: MVP (₹1 Cr
// base / ₹20 L step), Regular (₹50 L base / ₹10 L step), Guest (₹25 L base
// / ₹5 L step). Each category's `bid_increment` is a flat organizer
// override — the graphic's step-up doesn't grow with price the way JCC's
// default tier ladder (rules.ts's BID_INCREMENT_TIERS) does, so this is
// also useful as the harness's one example of that override path.
//
// The graphic's own header claims "56 Players" but its three category
// counts (6 + 20 + 26) only enumerate 52 names — seeded as given rather
// than inventing 4 more to make the header match. MVP/Regular have since
// grown past the graphic's original 2/5 names (see MVP_PLAYERS/
// REGULAR_PLAYERS below) — the quota mechanic (min_required, category
// looping/forced allotment) needs a big enough pool to actually exercise
// its loop/allot/blocked paths, not just the exact minimum.
//
// The hardcoded name lists below are now only the FALLBACK pool. When the
// dev page passes in the club roster (approved `players` rows), seedLots/
// seedCaptains build the auction out of real registered members and their
// real profile photos instead — see rosterLotSeed.
//
// Captains are seeded only into the MVP category (the graphic doesn't
// define a captain module at all — this is an addition to exercise
// mockEngine's captain-valuation recalc), so Regular/Guest sales
// correctly hit the "no captain in this category" no-op path instead of
// every lot needing one.

import { TEAM_ORDER_ALL, TEAMS, type TeamId } from "@/lib/teams";
import { createRosterMatcher, type ClubRosterRow } from "@/lib/club-roster";
import type {
  Auction,
  AuctionWallet,
  AuctionWalletKind,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  AuctionTeam,
} from "@/lib/auctionos/core/types";
import { DEFAULT_PURSE_LAKHS, DEFAULT_GUEST_PURSE_LAKHS } from "./rules";

const now = () => new Date().toISOString();

export const MOCK_AUCTION_ID = "mock-auction";
const MOCK_TEMPLATE_ID = "mock-template";

// Two wallet kinds: Wallet A funds the MVP + Regular categories (the First
// XI's 7 slots), Wallet B funds Guest Players (the other 7) — a team's
// purse for one never bleeds into the other.
export const MOCK_WALLET_KIND_A_ID = "mock-wallet-kind-a";
export const MOCK_WALLET_KIND_B_ID = "mock-wallet-kind-b";

export const MOCK_CATEGORY_MVP_ID = "mock-category-mvp";
export const MOCK_CATEGORY_REGULAR_ID = "mock-category-regular";
export const MOCK_CATEGORY_GUEST_ID = "mock-category-guest";

export function seedWalletKinds(): AuctionWalletKind[] {
  return [
    {
      id: MOCK_WALLET_KIND_A_ID,
      auction_id: MOCK_AUCTION_ID,
      name: "Wallet A",
      initial_balance: DEFAULT_PURSE_LAKHS,
      transfer_enabled: false,
      sort_order: 0,
      created_at: now(),
    },
    {
      id: MOCK_WALLET_KIND_B_ID,
      auction_id: MOCK_AUCTION_ID,
      name: "Wallet B",
      initial_balance: DEFAULT_GUEST_PURSE_LAKHS,
      transfer_enabled: false,
      sort_order: 1,
      created_at: now(),
    },
  ];
}

export function seedAuction(): Auction {
  return {
    id: MOCK_AUCTION_ID,
    template_id: MOCK_TEMPLATE_ID,
    name: "JCC Season 3 — Mock Auction",
    status: "scheduled",
    starts_at: null,
    current_lot_id: null,
    logo_url: null,
    venue: "Local Dev",
    theme_key: "jcc",
    created_at: now(),
    updated_at: now(),
  };
}

export function seedCategories(): AuctionCategory[] {
  return [
    {
      id: MOCK_CATEGORY_MVP_ID,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: MOCK_WALLET_KIND_A_ID,
      name: "MVP Players",
      color: null,
      icon: null,
      sort_order: 0,
      base_price: 100, // ₹1 Cr
      floor_price: null,
      min_required: 2, // quota: 2 MVP per team (a Regular-category captain doesn't count here)
      max_allowed: null,
      max_resell_rounds: null, // quota already loops unconditionally — this column is unused here
      bid_increment: 20, // ₹20 L flat step
      created_at: now(),
      updated_at: now(),
    },
    {
      id: MOCK_CATEGORY_REGULAR_ID,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: MOCK_WALLET_KIND_A_ID,
      name: "Regular Players",
      color: null,
      icon: null,
      sort_order: 1,
      base_price: 50, // ₹50 L
      floor_price: null,
      min_required: 5, // quota: 5 Regular per team, captain occupies one of the five
      max_allowed: null,
      max_resell_rounds: null, // quota already loops unconditionally — this column is unused here
      bid_increment: 10, // ₹10 L flat step
      created_at: now(),
      updated_at: now(),
    },
    {
      id: MOCK_CATEGORY_GUEST_ID,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: MOCK_WALLET_KIND_B_ID,
      name: "Guest Players",
      color: null,
      icon: null,
      sort_order: 2,
      base_price: 25, // ₹25 L
      floor_price: null,
      min_required: 0,
      max_allowed: null,
      max_resell_rounds: 2, // resold at most twice, then randomly allotted to the smallest-squad eligible team
      bid_increment: 5, // ₹5 L flat step
      created_at: now(),
      updated_at: now(),
    },
  ];
}

// A real (wizard-backed) auction resolves team identity from `auction_teams`
// rows (see AuctionExperience.tsx's `teams` prop) — this harness has no DB,
// so it synthesizes the equivalent rows from the same lib/teams.ts roster
// the rest of this file already seeds wallets/captains against, `id` set to
// the legacy slug so the generic `auction_team_id ?? team_id` matching in
// AuctionExperience.tsx resolves these exactly like a real auction_teams row.
export function seedTeams(): AuctionTeam[] {
  return TEAM_ORDER_ALL.map((teamId, i) => {
    const team = TEAMS[teamId];
    return {
      id: teamId,
      auction_id: MOCK_AUCTION_ID,
      name: team.name,
      short_name: team.shortName,
      logo_url: team.logo,
      tagline: team.tagline,
      primary_color: team.primary,
      secondary_color: team.secondary,
      sort_order: i,
      created_at: now(),
    };
  });
}

export function seedWallets(): AuctionWallet[] {
  const kinds: Array<{ id: string; budget: number }> = [
    { id: MOCK_WALLET_KIND_A_ID, budget: DEFAULT_PURSE_LAKHS },
    { id: MOCK_WALLET_KIND_B_ID, budget: DEFAULT_GUEST_PURSE_LAKHS },
  ];
  return TEAM_ORDER_ALL.flatMap((teamId) =>
    kinds.map((kind) => ({
      id: `mock-wallet-${teamId}-${kind.id}`,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: kind.id,
      team_id: teamId,
      auction_team_id: null,
      display_name: null,
      budget_total: kind.budget,
      budget_remaining: kind.budget,
      acquired_count: 0,
      metadata: {},
      created_at: now(),
      updated_at: now(),
    }))
  );
}

// Per-team captain category, exactly as specified rather than uniform —
// Outliers/Vikings captains sit in MVP, Mavericks/Neurostrikers in
// Regular, so the harness exercises captain valuations recalculating off
// two different base-price/step tiers, not just one.
const CAPTAIN_CATEGORY_BY_TEAM: Record<TeamId, string> = {
  mavericks: MOCK_CATEGORY_REGULAR_ID,
  neurostrikers: MOCK_CATEGORY_REGULAR_ID,
  outliers: MOCK_CATEGORY_MVP_ID,
  vikings: MOCK_CATEGORY_MVP_ID,
};

export function seedCaptains(roster?: ClubRosterRow[]): AuctionCaptain[] {
  const match = roster?.length ? createRosterMatcher(roster) : null;
  return TEAM_ORDER_ALL.map((teamId) => {
    const captainName = TEAMS[teamId].captain;
    // A captain who is also a registered member gets their real profile
    // photo and roster id, same as any lot built from the roster below.
    const member = match?.find(captainName) ?? null;
    return {
      id: `mock-captain-${teamId}`,
      auction_id: MOCK_AUCTION_ID,
      team_id: teamId,
      auction_team_id: null,
      category_id: CAPTAIN_CATEGORY_BY_TEAM[teamId],
      external_ref: member?.id ?? null,
      display_name: captainName,
      metadata: member?.image_url ? { image: member.image_url } : {},
      created_at: now(),
    };
  });
}

// 4 teams x min_required 2 = 8 MVP slots, 5 x 4 = 20 Regular slots (see
// seedCategories' min_required — the quota this harness needs to actually
// exercise auctionos_mark_unsold's loop/allot/blocked paths). A couple of
// names beyond the exact minimum so a normal auction still has real
// bidding competition and the occasional genuine unsold before the pool
// narrows to the quota-triggering "last player" case; the graphic's
// original 2/5-name lists were sized for the pre-quota harness only.
const MVP_PLAYERS = [
  "Mahesh Kumar",
  "Sagar",
  "Devendra",
  "Kunal",
  "Parth",
  "Rohan",
  "Siddharth",
  "Tanay",
  "Utkarsh",
  "Vansh",
];

const REGULAR_PLAYERS = [
  "Abhijeet Shekhawat",
  "Nitin",
  "Opal",
  "Harnoor Singh",
  "Lakshya",
  "Arjun",
  "Bhavya",
  "Chirag",
  "Dhruv",
  "Eshan",
  "Farhan",
  "Girish",
  "Harsh",
  "Ishaan",
  "Jatin",
  "Kabir",
  "Lokesh",
  "Manan",
  "Naveen",
  "Om",
  "Pranav",
  "Qasim",
];

const GUEST_PLAYERS = [
  "Imran",
  "Aditya Maroo",
  "Ankit (Gurgaon)",
  "Devam Shah",
  "Jaivardhan",
  "Karandeep Singh Kamboj",
  "Prateek",
  "Madhav Sharma",
  "Naman Mittal",
  "Raghav Patodia",
  "Raghav",
  "Rahul Krishnani",
  "Rishab",
  "Rudra",
  "Shrikant",
  "Sonu Khan",
  "Yash",
  "Yuvraj Pareek",
  "Sameer Saifi",
  "Gaurang",
  "Yash Rathi",
  "Mohit",
  "Madhav",
  "Krishna",
  "Vikas",
  "Vaibhav",
];

// Fisher-Yates — used to randomize draw order *within* each category on
// every seed/reset, mirroring what auctionos_begin_auction does for a real
// (Postgres-backed) auction: categories still run in a fixed sequence
// (MVP first, then Regular, then Guest), but which specific player comes
// up next inside a category is never the same twice and never derivable
// from this file's list order.
function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface LotSeed {
  name: string;
  role: string;
  categoryId: string;
  basePrice: number;
  /** Real member photo — null falls back to the DiceBear illustration in the UI. */
  image: string | null;
  /** `players.id` when this lot is a registered member, else null. */
  memberId: string | null;
}

const CATEGORY_SEED = {
  mvp: { role: "MVP Player", categoryId: MOCK_CATEGORY_MVP_ID, basePrice: 100 },
  regular: { role: "Regular Player", categoryId: MOCK_CATEGORY_REGULAR_ID, basePrice: 50 },
  guest: { role: "Guest Player", categoryId: MOCK_CATEGORY_GUEST_ID, basePrice: 25 },
} as const;

// Category sizes when the pool comes from the real club roster. The two
// mandatory tiers have to clear their own quota (4 teams x min_required:
// 8 MVP, 20 Regular) or the auction can never fill a squad — MVP is given
// two spare so there's still real competition before the quota's forced-
// allotment path kicks in, and whatever is left over becomes the Guest
// pool. Below the sum of the mandatory tiers the roster simply isn't a
// usable pool, and seedLots falls back to the hardcoded names.
const ROSTER_MVP_COUNT = 10;
const ROSTER_REGULAR_COUNT = 20;
const ROSTER_MIN_POOL = ROSTER_MVP_COUNT + ROSTER_REGULAR_COUNT;

function hardcodedLotSeed(): LotSeed[] {
  const build = (names: string[], tier: keyof typeof CATEGORY_SEED) =>
    shuffled(names).map((name) => ({ name, image: null, memberId: null, ...CATEGORY_SEED[tier] }));
  return [
    ...build(MVP_PLAYERS, "mvp"),
    ...build(REGULAR_PLAYERS, "regular"),
    ...build(GUEST_PLAYERS, "guest"),
  ];
}

// The club roster (approved `players` rows — the same faces /members shows)
// as an auction pool, so the harness runs on real names and real profile
// photos instead of invented names with DiceBear illustrations.
//
// The four team captains are removed first: a captain occupies a squad slot
// with no purchase behind it (see seedCaptains), so leaving them in the pool
// would put a player up for sale who is already on a team sheet.
//
// Tiering has no roster field behind it — nothing in `players` says "MVP" —
// so founding members/captains-by-role seed the MVP tier (the closest thing
// the roster has to a marquee signal) and the rest is shuffled into Regular
// and then Guest.
function rosterLotSeed(roster: ClubRosterRow[]): LotSeed[] | null {
  const match = createRosterMatcher(roster);
  const captainIds = new Set(
    TEAM_ORDER_ALL.map((teamId) => match.find(TEAMS[teamId].captain)?.id).filter((id): id is string => !!id)
  );
  const available = roster.filter((r) => !captainIds.has(r.id));
  if (available.length < ROSTER_MIN_POOL) return null;

  const isMarquee = (r: ClubRosterRow) => /found|captain/i.test(r.role ?? "");
  const ordered = [
    ...shuffled(available.filter(isMarquee)),
    ...shuffled(available.filter((r) => !isMarquee(r))),
  ];

  const tierOf = (i: number): keyof typeof CATEGORY_SEED =>
    i < ROSTER_MVP_COUNT ? "mvp" : i < ROSTER_MIN_POOL ? "regular" : "guest";

  // Re-shuffled per tier so draw order inside a category isn't the marquee
  // ordering above — same guarantee shuffled() gives the hardcoded pool.
  return (["mvp", "regular", "guest"] as const).flatMap((tier) =>
    shuffled(ordered.filter((_, i) => tierOf(i) === tier)).map((r) => ({
      name: r.name,
      image: r.image_url,
      memberId: r.id,
      ...CATEGORY_SEED[tier],
    }))
  );
}

function buildLotSeed(roster?: ClubRosterRow[]): LotSeed[] {
  return (roster?.length ? rosterLotSeed(roster) : null) ?? hardcodedLotSeed();
}

export function seedLots(roster?: ClubRosterRow[]): AuctionLot[] {
  return buildLotSeed(roster).map((p, i) => ({
    id: `mock-lot-${i + 1}`,
    auction_id: MOCK_AUCTION_ID,
    category_id: p.categoryId,
    external_ref: p.memberId,
    display_name: p.name,
    lot_order: i + 1,
    base_price: p.basePrice,
    status: "upcoming",
    current_bid: null,
    current_bid_wallet_id: null,
    sold_price: null,
    sold_wallet_id: null,
    sold_at: null,
    version: 0,
    metadata: { role: p.role, image: p.image },
    created_at: now(),
    updated_at: now(),
  }));
}
