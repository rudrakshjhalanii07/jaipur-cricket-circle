"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// sessionStorage keys — CODE_KEY holds the auction id a code was verified
// against (set by the landing page's code form); ADMIN_KEY is the same key
// AuctionExperience's own admin-password gate already reads/writes, so an
// organizer who has already unlocked admin actions never has to re-enter a
// code to get back into the hall.
const CODE_KEY = "auctionos_code_ok";
const ADMIN_KEY = "jcc_admin_password";

// Client-side gate in front of the hall: nothing here is a real security
// boundary (see AUCTIONOS.md's "Known risk" — auction_wallets/auction_lots/
// auction_categories stay publicly readable by anyone who already has the
// auction id). This only keeps the *product surface* code-gated — the
// landing page never shows an auction exists, and this component stops a
// direct /auctionos/hall visit from skipping that front door.
export default function HallAccessGate({
  hasAuction,
  auctionId,
  children,
}: {
  hasAuction: boolean;
  auctionId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  // Lazy initializer runs during render, not as an effect side-effect — the
  // sessionStorage read only happens once, on mount.
  const [allowed] = useState(() => {
    if (typeof window === "undefined" || !hasAuction) {
      // Nothing to gate — this is the organizer's "prepare an auction"
      // empty state, already protected by its own admin-password prompt.
      return true;
    }
    const verifiedFor = sessionStorage.getItem(CODE_KEY);
    const hasAdmin = !!sessionStorage.getItem(ADMIN_KEY);
    return hasAdmin || (!!verifiedFor && verifiedFor === auctionId);
  });

  useEffect(() => {
    if (!allowed) router.replace("/auctionos");
  }, [allowed, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-jcc-navy-deep flex items-center justify-center">
        <span className="text-jcc-text-muted text-xs font-black uppercase tracking-widest">
          Verifying access…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
