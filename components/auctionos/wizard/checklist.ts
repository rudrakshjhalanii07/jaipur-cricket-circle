// Single source of truth for "is this wizard step actually complete" —
// shared by DashboardShell's sidebar checkmarks and ReviewStep's pre-submit
// gate, so the two never drift (previously each read its own ad hoc
// `data.wallet_kinds.length > 0` check, which is exactly how the wallets
// step went cosmetic-only: the sidebar flagged it incomplete but nothing
// actually stopped "Begin Auction"). Mirrors the completeness checks in
// supabase/add_auctionos_wallet_gate.sql's auctionos_begin_auction — the
// server RPC is still the real gate (this file's checks can't be trusted
// blindly, same as any client validation), but surfacing the same
// conditions here means an organizer sees exactly what's missing before
// they click Begin rather than only after the RPC rejects them.

import type { WizardStepId } from "./types";
import type { AuctionTeam, AuctionWalletKind, AuctionWallet, AuctionCategory, AuctionLot } from "@/lib/auctionos/core/types";

export interface ChecklistData {
  teams: AuctionTeam[];
  wallet_kinds: AuctionWalletKind[];
  wallets: AuctionWallet[];
  categories: AuctionCategory[];
  lots: AuctionLot[];
}

export interface ChecklistItem {
  step: WizardStepId;
  label: string;
  ok: boolean;
  detail: string;
}

export function wizardChecklist(data: ChecklistData): ChecklistItem[] {
  // Every (team × wallet kind) pair needs its own wallet row — the wizard's
  // own API routes backfill this automatically the moment either side is
  // created, so a gap here means the Wallets step was skipped entirely (the
  // reported bug) or a kind/team was added before the other existed and the
  // backfill never ran.
  const teamsMissingAWallet = data.teams.filter((t) =>
    data.wallet_kinds.some(
      (wk) => !data.wallets.some((w) => w.auction_team_id === t.id && w.wallet_kind_id === wk.id)
    )
  ).length;

  return [
    {
      step: "franchises",
      label: "Franchises",
      ok: data.teams.length > 0,
      detail: "Add at least one franchise before this auction can begin.",
    },
    {
      step: "wallets",
      label: "Wallets",
      ok: data.wallet_kinds.length > 0 && teamsMissingAWallet === 0,
      detail:
        data.wallet_kinds.length === 0
          ? "Add at least one wallet kind — every team needs a funded purse to bid with."
          : `${teamsMissingAWallet} team${teamsMissingAWallet === 1 ? " is" : "s are"} missing a wallet for one or more wallet kinds.`,
    },
    {
      step: "categories",
      label: "Categories",
      ok: data.categories.length > 0,
      detail: "Add at least one category before this auction can begin.",
    },
    {
      step: "talent",
      label: "Talent Pool",
      ok: data.lots.length > 0,
      detail: "Add at least one player to the talent pool before this auction can begin.",
    },
  ];
}

export function isWizardComplete(data: ChecklistData): boolean {
  return wizardChecklist(data).every((item) => item.ok);
}
