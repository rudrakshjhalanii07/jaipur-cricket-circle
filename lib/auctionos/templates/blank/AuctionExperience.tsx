"use client";

// Reference AuctionExperience for the Blank template — plain, unbranded,
// no format assumptions. It proves the plug-in point works (any template
// can supply its own screen behind the same prop contract) without trying
// to be a polished product surface; a real second format would replace
// this entirely, same as JCC's own bespoke auction hall does.

import { useCallback, useEffect, useState } from "react";
import type { AuctionExperienceProps } from "@/lib/auctionos/core/template";
import type { Auction, AuctionWallet, AuctionLot } from "@/lib/auctionos/core/types";
import { fetchActiveAuction, fetchWallets, fetchLots } from "@/lib/auctionos/core/data";

const POLL_INTERVAL_MS = 4000;
const TEMPLATE_ID = "blank";
const ADMIN_PASSWORD_KEY = "jcc_admin_password"; // shared with the JCC template's session gate

function getCachedAdminPassword(): string | null {
  return typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_PASSWORD_KEY) : null;
}

async function ensureAdminPassword(): Promise<string | null> {
  const cached = getCachedAdminPassword();
  if (cached) return cached;

  const entered = typeof window !== "undefined" ? window.prompt("Admin password") : null;
  if (!entered) return null;

  const res = await fetch("/api/admin/verify-password", {
    method: "POST",
    headers: { "x-admin-password": entered },
  });
  if (!res.ok) return null;

  sessionStorage.setItem(ADMIN_PASSWORD_KEY, entered);
  return entered;
}

export default function AuctionExperience({
  initialAuction,
  initialWallets,
  initialLots,
}: AuctionExperienceProps) {
  const [season, setSeason] = useState<Auction | null>(initialAuction);
  const [participants, setParticipants] = useState<AuctionWallet[]>(initialWallets);
  const [lots, setLots] = useState<AuctionLot[]>(initialLots);

  const refresh = useCallback(async () => {
    const s = await fetchActiveAuction();
    setSeason(s);
    if (s) {
      const [p, l] = await Promise.all([fetchWallets(s.id), fetchLots(s.id)]);
      setParticipants(p);
      setLots(l);
    } else {
      setParticipants([]);
      setLots([]);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function callAdminRoute(path: string, body: Record<string, unknown>) {
    const password = await ensureAdminPassword();
    if (!password) return;
    await fetch(`/api/auctionos/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  if (!season) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold mb-2">No auction running</h1>
          <p className="text-sm opacity-70">
            This is the Blank AuctionOS template. Start a season via{" "}
            <code>POST /api/auctionos/start</code> with{" "}
            <code>&quot;template_id&quot;: &quot;{TEMPLATE_ID}&quot;</code> to see it render here.
          </p>
        </div>
      </div>
    );
  }

  const onBlockLot = lots.find((l) => l.status === "on_block") ?? null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">{season.name}</h1>
        <p className="text-sm opacity-70 capitalize">{season.status}</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Participants</h2>
        <ul className="space-y-1 text-sm">
          {participants.map((p) => (
            <li key={p.id} className="flex justify-between border-b border-white/10 py-1">
              <span>{p.display_name}</span>
              <span>
                {p.budget_remaining} / {p.budget_total} · {p.acquired_count} acquired
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">On the block</h2>
        {onBlockLot ? (
          <div className="border border-white/10 rounded-lg p-4 space-y-2">
            <p className="font-medium">{onBlockLot.display_name}</p>
            <p className="text-sm opacity-70">
              Current bid: {onBlockLot.current_bid ?? onBlockLot.base_price}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => callAdminRoute("bid", { lot_id: onBlockLot.id, wallet_id: p.id })}
                  className="px-3 py-1.5 rounded border border-white/20 text-xs hover:bg-white/10"
                >
                  Bid: {p.display_name}
                </button>
              ))}
              <button
                onClick={() => callAdminRoute("sold", { lot_id: onBlockLot.id })}
                className="px-3 py-1.5 rounded bg-green-600 text-white text-xs"
              >
                Sold
              </button>
              <button
                onClick={() => callAdminRoute("unsold", { lot_id: onBlockLot.id })}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-xs"
              >
                Unsold
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => callAdminRoute("advance", { auction_id: season.id })}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
          >
            Advance to next lot
          </button>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Lots ({lots.length})</h2>
        <ul className="space-y-1 text-sm">
          {lots.map((l) => (
            <li key={l.id} className="flex justify-between border-b border-white/10 py-1">
              <span>{l.display_name}</span>
              <span className="opacity-70 capitalize">{l.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
