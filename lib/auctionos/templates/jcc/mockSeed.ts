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
// than inventing 4 more to make the header match.
//
// Captains are seeded only into the MVP category (the graphic doesn't
// define a captain module at all — this is an addition to exercise
// mockEngine's captain-valuation recalc), so Regular/Guest sales
// correctly hit the "no captain in this category" no-op path instead of
// every lot needing one.

import { TEAM_ORDER_ALL, TEAMS, type TeamId } from "@/lib/teams";
import type {
  Auction,
  AuctionWallet,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
} from "@/lib/auctionos/core/types";
import { DEFAULT_PURSE_LAKHS } from "./rules";

const now = () => new Date().toISOString();

export const MOCK_AUCTION_ID = "mock-auction";
const MOCK_TEMPLATE_ID = "mock-template";
const MOCK_WALLET_KIND_ID = "mock-wallet-kind-main";

export const MOCK_CATEGORY_MVP_ID = "mock-category-mvp";
export const MOCK_CATEGORY_REGULAR_ID = "mock-category-regular";
export const MOCK_CATEGORY_GUEST_ID = "mock-category-guest";

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
      wallet_kind_id: MOCK_WALLET_KIND_ID,
      name: "MVP Players",
      color: null,
      icon: null,
      sort_order: 0,
      base_price: 100, // ₹1 Cr
      floor_price: null,
      min_required: 0,
      max_allowed: null,
      bid_increment: 20, // ₹20 L flat step
      created_at: now(),
      updated_at: now(),
    },
    {
      id: MOCK_CATEGORY_REGULAR_ID,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: MOCK_WALLET_KIND_ID,
      name: "Regular Players",
      color: null,
      icon: null,
      sort_order: 1,
      base_price: 50, // ₹50 L
      floor_price: null,
      min_required: 0,
      max_allowed: null,
      bid_increment: 10, // ₹10 L flat step
      created_at: now(),
      updated_at: now(),
    },
    {
      id: MOCK_CATEGORY_GUEST_ID,
      auction_id: MOCK_AUCTION_ID,
      wallet_kind_id: MOCK_WALLET_KIND_ID,
      name: "Guest Players",
      color: null,
      icon: null,
      sort_order: 2,
      base_price: 25, // ₹25 L
      floor_price: null,
      min_required: 0,
      max_allowed: null,
      bid_increment: 5, // ₹5 L flat step
      created_at: now(),
      updated_at: now(),
    },
  ];
}

export function seedWallets(): AuctionWallet[] {
  return TEAM_ORDER_ALL.map((teamId) => ({
    id: `mock-wallet-${teamId}`,
    auction_id: MOCK_AUCTION_ID,
    wallet_kind_id: MOCK_WALLET_KIND_ID,
    team_id: teamId,
    auction_team_id: null,
    display_name: null,
    budget_total: DEFAULT_PURSE_LAKHS,
    budget_remaining: DEFAULT_PURSE_LAKHS,
    acquired_count: 0,
    metadata: {},
    created_at: now(),
    updated_at: now(),
  }));
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

export function seedCaptains(): AuctionCaptain[] {
  return TEAM_ORDER_ALL.map((teamId) => ({
    id: `mock-captain-${teamId}`,
    auction_id: MOCK_AUCTION_ID,
    team_id: teamId,
    auction_team_id: null,
    category_id: CAPTAIN_CATEGORY_BY_TEAM[teamId],
    external_ref: null,
    display_name: TEAMS[teamId].captain,
    metadata: {},
    created_at: now(),
  }));
}

const MVP_PLAYERS = [
  "Mahesh Kumar",
  "Sagar",
  "Anil Rawat",
  "Rahul Rathore",
  "Siddharth Rao",
  "Harish Jangid",
];

const REGULAR_PLAYERS = [
  "Abhijeet Shekhawat",
  "Nitin",
  "Opal",
  "Harnoor Singh",
  "Lakshya",
  "Prashant",
  "Rudraksh Jhalani",
  "Sanjeev Meena",
  "Adhip",
  "Akshat Pandey",
  "Anagh",
  "Ankit Jain",
  "Dhruv Paliwal",
  "Gaurav",
  "Khushal Jain",
  "Navin",
  "Nimish Rajoria",
  "Nishant Gupta",
  "Rahul Kasliwal",
  "Satvik Todwal",
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

function buildLotSeed(): Array<{ name: string; role: string; categoryId: string; basePrice: number }> {
  return [
    ...shuffled(MVP_PLAYERS).map((name) => ({ name, role: "MVP Player", categoryId: MOCK_CATEGORY_MVP_ID, basePrice: 100 })),
    ...shuffled(REGULAR_PLAYERS).map((name) => ({ name, role: "Regular Player", categoryId: MOCK_CATEGORY_REGULAR_ID, basePrice: 50 })),
    ...shuffled(GUEST_PLAYERS).map((name) => ({ name, role: "Guest Player", categoryId: MOCK_CATEGORY_GUEST_ID, basePrice: 25 })),
  ];
}

export function seedLots(): AuctionLot[] {
  return buildLotSeed().map((p, i) => ({
    id: `mock-lot-${i + 1}`,
    auction_id: MOCK_AUCTION_ID,
    category_id: p.categoryId,
    external_ref: null,
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
    metadata: { role: p.role },
    created_at: now(),
    updated_at: now(),
  }));
}
