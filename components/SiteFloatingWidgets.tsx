"use client";

// Gates the site-wide floating match/WhatsApp buttons off the AuctionOS
// surface — the immersive hall view already hides the navbar for the same
// reason (see AuctionExperience's view-phase effect): these widgets have no
// business overlapping a live auction's paddle/hammer UI, on any
// /auctionos route, not just the hall.

import { usePathname } from "next/navigation";
import type LazyFloatingMatchButton from "./LazyFloatingMatchButton";
import LazyFloatingWhatsApp from "./LazyFloatingWhatsApp";
import type { ComponentProps } from "react";

export default function SiteFloatingWidgets(
  props: ComponentProps<typeof LazyFloatingMatchButton>
) {
  const pathname = usePathname();
  if (pathname?.startsWith("/auctionos")) return null;

  // The match button's panel is all registration, which is hidden for now (see
  // next.config redirects), so the trophy leads to /stats instead. Swap
  // FloatingStatsButton back for <LazyFloatingMatchButton {...props} /> when
  // /register returns.
  // Stats now has its own gold pill in the navbar, so the floating trophy
  // (FloatingStatsButton) is parked as well.
  void props;
  return <LazyFloatingWhatsApp />;
}
