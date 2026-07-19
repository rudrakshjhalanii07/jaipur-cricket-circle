"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Crown, Gavel, Loader2, ShieldAlert, Sparkles, Users, Wallet } from "lucide-react";
import type { StepProps, WizardStepId } from "@/components/auctionos/wizard/types";
import { wizardChecklist } from "@/components/auctionos/wizard/checklist";

export default function ReviewStep({
  auctionId,
  data,
  adminPassword,
  refetch,
  readOnly,
  onJumpToStep,
}: StepProps & { onJumpToStep?: (step: WizardStepId) => void }) {
  const [beginning, setBeginning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [begun, setBegun] = useState(data.auction.status !== "draft");

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  // Same checklist the sidebar checkmarks use (components/auctionos/wizard/
  // checklist.ts) — this is what actually blocks the Begin button below,
  // not just a cosmetic summary, closing the gap where every step's
  // "complete" flag used to be decorative and only the server RPC's own
  // (separate, easy-to-drift) checks were real.
  const checklist = useMemo(() => wizardChecklist(data), [data]);
  const incomplete = checklist.filter((item) => !item.ok);

  const playerCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const lot of data.lots) {
      if (!lot.category_id) continue;
      map.set(lot.category_id, (map.get(lot.category_id) ?? 0) + 1);
    }
    return map;
  }, [data.lots]);

  async function handleBegin() {
    if (incomplete.length > 0) return; // button is disabled for this case too — belt and suspenders
    setBeginning(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/begin`, {
        method: "POST",
        headers: { "x-admin-password": adminPassword },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to begin auction");
        setBeginning(false);
        return;
      }
      setBegun(true);
      await refetch();
    } catch {
      setError("Network error");
    } finally {
      setBeginning(false);
    }
  }

  if (begun) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="premium-card p-8 flex flex-col items-center gap-4 text-center"
      >
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-accent-dark">
          <Check className="w-6 h-6" />
        </span>
        <h2 className="text-jcc-text-primary text-lg font-black uppercase tracking-widest">Auction Prepared</h2>
        <p className="text-jcc-text-muted text-xs font-bold max-w-md leading-relaxed">
          Your auction is locked and ready. Head into the Hall when you&apos;re ready to open the block — your
          admin password is already in this browser&apos;s session, no re-entry needed.
        </p>
        <Link href="/auctionos/hall" className="btn-vibrant-blue !px-6 !py-2.5 text-xs">
          <Gavel className="w-4 h-4" /> Go to Auction Hall
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="premium-card p-6 sm:p-8 flex flex-col gap-6">
        <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Review</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <SummaryTile icon={<Users className="w-4 h-4" />} label="Franchises" value={data.teams.length} />
          <SummaryTile icon={<Wallet className="w-4 h-4" />} label="Wallet Kinds" value={data.wallet_kinds.length} />
          <SummaryTile icon={<Gavel className="w-4 h-4" />} label="Lots" value={data.lots.length} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-body text-jcc-text-muted text-xs font-black uppercase tracking-[0.15em]">Categories</h3>
          {data.categories.length === 0 ? (
            <p className="text-jcc-text-muted text-xs font-bold">None added.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.categories.map((c) => (
                <span
                  key={c.id}
                  className="px-3 py-1.5 rounded-lg bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-[11px] font-bold"
                >
                  {c.name} · {playerCountByCategory.get(c.id) ?? 0} players
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-body text-jcc-text-muted text-xs font-black uppercase tracking-[0.15em]">Franchises</h3>
          {data.teams.length === 0 ? (
            <p className="text-jcc-text-muted text-xs font-bold">None added.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.teams.map((t) => (
                <span
                  key={t.id}
                  className="px-3 py-1.5 rounded-lg bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-[11px] font-bold"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-body text-jcc-text-muted text-xs font-black uppercase tracking-[0.15em] flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" /> Captains
          </h3>
          {data.captains.length === 0 ? (
            <p className="text-jcc-text-muted text-xs font-bold">None assigned (optional).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.captains.map((c) => (
                <span
                  key={c.id}
                  className="px-3 py-1.5 rounded-lg bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-[11px] font-bold"
                >
                  {c.display_name} · {categoryById.get(c.category_id)?.name ?? "—"}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="premium-card p-6 sm:p-8 flex flex-col gap-4 border-jcc-accent-dark/40">
          {incomplete.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 text-jcc-text-primary text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                Still needed before this auction can begin:
              </div>
              <div className="flex flex-col gap-2">
                {incomplete.map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl bg-jcc-navy-light border border-red-500/30"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-jcc-text-primary text-xs font-black uppercase tracking-widest">{item.label}</p>
                      <p className="text-jcc-text-muted text-[11px] font-bold mt-0.5">{item.detail}</p>
                    </div>
                    {onJumpToStep && (
                      <button
                        onClick={() => onJumpToStep(item.step)}
                        className="btn-ghost px-3! py-1.5! text-[10px] shrink-0"
                      >
                        Fix
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-jcc-text-primary text-xs font-bold">
              <ShieldAlert className="w-4 h-4 text-jcc-accent-dark shrink-0 mt-0.5" />
              Beginning the auction locks every step above — franchises, wallets, categories, and the talent pool
              can no longer be edited once this is confirmed.
            </div>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button
            onClick={handleBegin}
            disabled={beginning || incomplete.length > 0}
            title={incomplete.length > 0 ? "Finish every step above before beginning the auction" : undefined}
            className="btn-vibrant-blue self-start !px-8 !py-3 text-xs disabled:opacity-50"
          >
            {beginning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Begin Auction
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border">
      <span className="text-jcc-accent-dark">{icon}</span>
      <div>
        <p className="text-jcc-text-primary text-lg font-black leading-none">{value}</p>
        <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}
