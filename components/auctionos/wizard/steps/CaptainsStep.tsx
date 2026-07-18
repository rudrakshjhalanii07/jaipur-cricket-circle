"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Crown, Layers, Loader2, ShieldAlert, Trash2, Users } from "lucide-react";
import type { StepProps } from "@/components/auctionos/wizard/types";

interface CaptainReveal {
  captainId: string;
  displayName: string;
  accessKey: string;
}

export default function CaptainsStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const [lotId, setLotId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<CaptainReveal | null>(null);
  const [copied, setCopied] = useState(false);

  const captainedExternalRefs = useMemo(
    () => new Set(data.captains.map((c) => c.external_ref).filter(Boolean)),
    [data.captains]
  );
  const eligibleLots = useMemo(
    () => data.lots.filter((lot) => !lot.external_ref || !captainedExternalRefs.has(lot.external_ref)),
    [data.lots, captainedExternalRefs]
  );

  // Every franchise gets at most one captain (auction_captains_auction_auction_team_uniq),
  // so once a team has one assigned it drops out of the picker instead of erroring on submit.
  const captainedTeamIds = useMemo(
    () => new Set(data.captains.map((c) => c.auction_team_id).filter(Boolean)),
    [data.captains]
  );
  const eligibleTeams = useMemo(
    () => data.teams.filter((t) => !captainedTeamIds.has(t.id)),
    [data.teams, captainedTeamIds]
  );

  const teamById = useMemo(() => new Map(data.teams.map((t) => [t.id, t])), [data.teams]);
  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  async function handleAssign() {
    const lot = data.lots.find((l) => l.id === lotId);
    if (!lot || !teamId || !categoryId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/captains`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({
          auction_team_id: teamId,
          category_id: categoryId,
          external_ref: lot.external_ref ?? null,
          display_name: lot.display_name,
          metadata: {},
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to assign captain");
        setSubmitting(false);
        return;
      }
      setReveal({ captainId: json.captain_id, displayName: lot.display_name, accessKey: json.access_key });
      setLotId("");
      setTeamId("");
      setCategoryId("");
      await refetch();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(captainId: string) {
    setDeletingId(captainId);
    try {
      await fetch(`/api/auctionos/${auctionId}/captains?captain_id=${captainId}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      await refetch();
    } finally {
      setDeletingId(null);
    }
  }

  async function copyKey() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.accessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {reveal && (
        <div className="premium-card p-6 flex flex-col items-center gap-3 border-jcc-accent-dark/40 text-center">
          <Crown className="w-5 h-5 text-jcc-accent-dark" />
          <p className="text-jcc-text-primary text-sm font-black">
            {reveal.displayName}&apos;s Access Key
          </p>
          <button
            onClick={copyKey}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-text-primary text-base font-black uppercase tracking-[0.25em] hover:border-jcc-accent-dark transition-colors"
          >
            {reveal.accessKey}
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <p className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold">
            <ShieldAlert className="w-3.5 h-3.5" /> Save this now — it will not be shown again.
          </p>
          <button onClick={() => setReveal(null)} className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
            Dismiss
          </button>
        </div>
      )}

      {!readOnly && (
        <div className="premium-card p-6 sm:p-8 flex flex-col gap-5">
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Assign Captain</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-4">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <Crown className="w-3 h-3 text-jcc-accent-dark" /> From Talent Pool
              </label>
              <select
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="select-field text-xs"
              >
                <option value="">Select player…</option>
                {eligibleLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>{lot.display_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <Users className="w-3 h-3 text-jcc-accent-dark" /> Franchise
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="select-field text-xs"
                disabled={eligibleTeams.length === 0}
              >
                <option value="">{eligibleTeams.length === 0 ? "All franchises captained" : "Select…"}</option>
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <Layers className="w-3 h-3 text-jcc-accent-dark" /> Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="select-field text-xs"
              >
                <option value="">Select…</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <button
            onClick={handleAssign}
            disabled={submitting || !lotId || !teamId || !categoryId}
            className="btn-vibrant-blue self-start !px-6 !py-2.5 text-xs disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            Assign Captain
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data.captains.map((captain) => {
          const team = captain.auction_team_id ? teamById.get(captain.auction_team_id) : null;
          const category = categoryById.get(captain.category_id);
          return (
            <div key={captain.id} className="id-card id-card--captain p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Crown className="w-4 h-4 text-jcc-accent-dark shrink-0" />
                <div>
                  <p className="id-card-name text-jcc-text-primary text-sm font-black">{captain.display_name}</p>
                  <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
                    {team?.name ?? "—"} · {category?.name ?? "—"}
                  </p>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(captain.id)}
                  disabled={deletingId === captain.id}
                  className="text-red-500 hover:text-red-600"
                >
                  {deletingId === captain.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          );
        })}
        {data.captains.length === 0 && (
          <p className="text-jcc-text-muted text-xs font-bold">No captains assigned yet — this step is optional.</p>
        )}
      </div>
    </div>
  );
}
