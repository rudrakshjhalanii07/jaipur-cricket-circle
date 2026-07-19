"use client";

// A rigorous-testing harness for the JCC auction hall UI — same
// AuctionExperience component the real /auctionos/hall renders, wired to
// an in-memory mock engine (lib/auctionos/templates/jcc/mockEngine.ts)
// instead of Supabase/API routes. Nothing here reaches the network: every
// bid/sold/unsold/advance transition runs the exact client-side port of
// the production RPC logic, so paddle animations, the hammer sequence, and
// the bidding flow can be driven start-to-finish without a real auction
// ever being set up. Not linked from anywhere in the product nav — a dev
// tool, reached by typing the URL.

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import AuctionExperience from "@/lib/auctionos/templates/jcc/AuctionExperience";
import { createMockEngine } from "@/lib/auctionos/templates/jcc/mockEngine";
import { seedAuction, seedCategories, seedLots, seedWallets, seedTeams } from "@/lib/auctionos/templates/jcc/mockSeed";

export default function AuctionOSDevPage() {
  // Constructed once per mount, not per render — a fresh mock engine
  // (and its closed-over store) every render would silently discard every
  // bid the moment React re-rendered.
  const [{ engine, reset }] = useState(() => createMockEngine());
  const [resetKey, setResetKey] = useState(0);

  // `key={resetKey}` below remounts AuctionExperience on reset, so these
  // just need to be recomputed each render — cheap plain-object
  // construction, no memoization worth the dependency-array upkeep.
  const initial = {
    auction: seedAuction(),
    wallets: seedWallets(),
    lots: seedLots(),
    categories: seedCategories(),
    teams: seedTeams(),
  };

  function handleReset() {
    reset();
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
        initialLots={initial.lots}
        initialCategories={initial.categories}
        initialTeams={initial.teams}
        engine={engine}
      />
    </div>
  );
}
