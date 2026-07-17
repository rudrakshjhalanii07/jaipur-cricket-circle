import type { AllocationModule } from "@/lib/auctionos/core/template";

// The engine's auctionos_mark_sold / auctionos_mark_unsold RPCs already do
// everything JCC's auction night needs (budget deduction, acquired_count).
// No template-specific side effect exists yet — kept as an explicit no-op
// rather than omitted, so the assembled template records that this module
// was considered, not forgotten. A future need (e.g. writing a roster
// record into a JCC-owned table on sale) plugs in here.
export const jccAllocation: AllocationModule = {
  onLotSold: () => {},
  onLotUnsold: () => {},
};
