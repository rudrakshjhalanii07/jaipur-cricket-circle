// Shared types for the dashboard shell + wizard steps — the bootstrap
// payload shape returned by GET /api/auctionos/[id] (see that route) plus
// the step-id vocabulary used by the progress sidebar.

import type {
  Auction,
  AuctionSettings,
  AuctionTeam,
  AuctionWalletKind,
  AuctionWallet,
  AuctionCategory,
  AuctionLot,
  AuctionCaptain,
} from "@/lib/auctionos/core/types";

export interface BootstrapData {
  auction: Auction;
  settings: AuctionSettings | null;
  teams: AuctionTeam[];
  wallet_kinds: AuctionWalletKind[];
  wallets: AuctionWallet[];
  categories: AuctionCategory[];
  lots: AuctionLot[];
  captains: AuctionCaptain[];
}

export type WizardStepId =
  | "identity"
  | "franchises"
  | "wallets"
  | "categories"
  | "talent"
  | "captains"
  | "review"
  | "begin";

// Categories now precede Talent Pool — the CSV importer resolves each
// row's category by name against the categories that already exist, so
// they need to be created first. See CategoriesStep/TalentPoolStep and
// lib/auctionos/wizard/csv.ts's category-matching logic.
export const WIZARD_STEPS: { id: WizardStepId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "franchises", label: "Franchises" },
  { id: "wallets", label: "Wallets" },
  { id: "categories", label: "Categories" },
  { id: "talent", label: "Talent Pool" },
  { id: "captains", label: "Captains" },
  { id: "review", label: "Review" },
  { id: "begin", label: "Begin Auction" },
];

// Common props every step component receives.
export interface StepProps {
  auctionId: string;
  data: BootstrapData;
  adminPassword: string;
  refetch: () => Promise<void>;
  readOnly: boolean;
}
