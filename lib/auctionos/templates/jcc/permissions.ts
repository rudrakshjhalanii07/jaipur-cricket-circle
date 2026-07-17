import type { PermissionsConfig } from "@/lib/auctionos/core/template";

// One auctioneer runs the podium on auction night; no paddle-relay
// "operator" role exists yet, so proxy-bidding stays off. This matches the
// engine's default today — declared explicitly rather than left to inherit,
// so a future change to JCC's permission needs doesn't silently ride on a
// default that only happens to agree with it right now.
export const jccPermissions: PermissionsConfig = {
  roles: ["auctioneer"],
  canBidOnBehalf: false,
};
