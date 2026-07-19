"use client";

import { useEffect, useState, cloneElement, isValidElement, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import type { AuctionExperienceProps } from "@/lib/auctionos/core/template";

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
  // Exactly one <AuctionExperience /> element — cloned below to inject
  // isAdmin, since this is a Client Component and the Server Component that
  // renders it (app/auctionos/hall/page.tsx) can't pass a render-prop
  // function across that boundary.
  children: ReactElement<AuctionExperienceProps>;
}) {
  const router = useRouter();
  // A lazy useState initializer that branches on `typeof window` runs
  // during the client's very first (hydrating) render — with `window`
  // already defined — while the server's render of the same initializer
  // always took the `undefined` branch. That's a real hydration mismatch,
  // not just a lint nit (React would regenerate the whole tree client-side
  // to recover). Same fix DashboardShell.tsx already uses for this exact
  // class of bug: both server and the client's pre-mount render show one
  // fixed placeholder, and the real sessionStorage-derived check only runs
  // inside a mount-only effect, so hydration always reconciles cleanly.
  const [mounted, setMounted] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (!hasAuction) {
      // Nothing to gate — this is the organizer's "prepare an auction"
      // empty state, already protected by its own admin-password prompt.
      setAllowed(true);
      setIsAdmin(true);
      return;
    }
    const verifiedFor = sessionStorage.getItem(CODE_KEY);
    const hasAdmin = !!sessionStorage.getItem(ADMIN_KEY);
    setAllowed(hasAdmin || (!!verifiedFor && verifiedFor === auctionId));
    setIsAdmin(hasAdmin);
  }, [hasAuction, auctionId]);

  useEffect(() => {
    if (mounted && !allowed) router.replace("/auctionos");
  }, [mounted, allowed, router]);

  if (!mounted || !allowed) {
    return (
      <div className="min-h-screen bg-jcc-navy-deep flex items-center justify-center">
        <span className="text-jcc-text-muted text-xs font-black uppercase tracking-widest">
          Verifying access…
        </span>
      </div>
    );
  }

  // A join-code visitor who never verified the admin password (isAdmin
  // false) gets the exact same AuctionExperience tree back, just told to
  // render its mutating controls as non-interactive — see every `isAdmin`
  // check inside that component.
  return isValidElement(children) ? cloneElement(children, { isAdmin }) : children;
}
