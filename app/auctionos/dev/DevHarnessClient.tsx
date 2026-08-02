"use client";

// The client half of the /auctionos/dev harness — everything that needs
// browser state (the mock engine's in-memory store, the reset button).
// The roster it builds the auction pool from is fetched server-side by
// page.tsx, since the club roster read is service-role-only.

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import AuctionExperience from "@/lib/auctionos/templates/jcc/AuctionExperience";
import { createMockEngine } from "@/lib/auctionos/templates/jcc/mockEngine";
import { seedAuction, seedCategories, seedWallets } from "@/lib/auctionos/templates/jcc/mockSeed";
import type { ClubRosterRow } from "@/lib/club-roster";

export default function DevHarnessClient({ roster }: { roster: ClubRosterRow[] }) {
  // Constructed once per mount, not per render — a fresh mock engine
  // (and its closed-over store) every render would silently discard every
  // bid the moment React re-rendered.
  const [{ engine, reset, snapshot }] = useState(() => createMockEngine(roster));

  // The lots handed to AuctionExperience have to be the engine's own seeded
  // lots, not a second independently-shuffled seedLots(roster) call — the
  // roster pool is shuffled per seed, so re-seeding here would hand the UI
  // a different draw order (and, after a reset, a different pool) than the
  // engine is actually running.
  const [{ lots, teams }, setSeeded] = useState(() => {
    const snap = snapshot();
    return { lots: snap.lots, teams: snap.teams };
  });
  const [resetKey, setResetKey] = useState(0);

  // `key={resetKey}` below remounts AuctionExperience on reset, so these
  // just need to be recomputed each render — cheap plain-object
  // construction, no memoization worth the dependency-array upkeep.
  const initial = {
    auction: seedAuction(),
    wallets: seedWallets(),
    categories: seedCategories(),
  };

  function handleReset() {
    reset();
    const snap = snapshot();
    setSeeded({ lots: snap.lots, teams: snap.teams });
    setResetKey((k) => k + 1);
  }

  return (
    <div className="relative">
      <button
        onClick={handleReset}
        className="fixed bottom-5 right-5 z-400 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-jcc-navy-deep border border-jcc-border-bright text-jcc-text-primary text-[10px] font-black uppercase tracking-widest shadow-lg hover:border-jcc-accent/50 transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        Reset Mock Auction
      </button>
      <AuctionExperience
        key={resetKey}
        initialAuction={initial.auction}
        initialWallets={initial.wallets}
        initialLots={lots}
        initialCategories={initial.categories}
        initialTeams={teams}
        engine={engine}
      />
    </div>
  );
}
