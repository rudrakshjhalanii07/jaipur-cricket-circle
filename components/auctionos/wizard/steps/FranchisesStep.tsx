"use client";

import { useState } from "react";
import { Info, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import LogoUpload from "@/components/auctionos/wizard/LogoUpload";
import type { StepProps } from "@/components/auctionos/wizard/types";

// Franchises step — "Number of Teams" isn't a separate input, it's just
// however many rows exist below. No "Assign Wallet" control per spec:
// wallets are seeded automatically (server-side, teams/route.ts POST) for
// every existing wallet kind; if none exist yet, we say so rather than
// blocking team creation on step order.
export default function FranchisesStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#12233F");
  const [secondaryColor, setSecondaryColor] = useState("#D4AF37");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({
          name: name.trim(),
          short_name: shortName.trim() || null,
          logo_url: logoUrl,
          tagline: tagline.trim() || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add franchise");
        setSubmitting(false);
        return;
      }
      setName("");
      setShortName("");
      setTagline("");
      setLogoUrl(null);
      await refetch();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(teamId: string) {
    setDeletingId(teamId);
    try {
      await fetch(`/api/auctionos/${auctionId}/teams?team_id=${teamId}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      await refetch();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!readOnly && (
        <div className="premium-card p-6 sm:p-8 flex flex-col gap-5">
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Add Franchise</h2>

          {data.wallet_kinds.length === 0 && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-muted text-xs font-bold">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              No wallet kinds exist yet — wallets will be created automatically for this franchise once you
              add a wallet kind in the next step.
            </div>
          )}

          <div className="flex items-start gap-5 flex-wrap">
            <LogoUpload value={logoUrl} onChange={setLogoUrl} label="Logo" size="sm" />
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amber Warriors"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-28 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Short</label>
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="AW"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
          </div>

          <div className="flex items-end gap-5 flex-wrap">
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Tagline</label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="optional"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Primary</label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-11 rounded-lg border border-jcc-border cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Secondary</label>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-12 h-11 rounded-lg border border-jcc-border cursor-pointer"
              />
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={submitting || !name.trim()}
            className="btn-vibrant-blue self-start !px-6 !py-2.5 text-xs disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Franchise
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.teams.map((team) => (
          <div key={team.id} className="id-card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {team.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.logo_url} alt={team.name} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg"
                  style={{ background: team.primary_color ?? "#12233F" }}
                />
              )}
              <div className="min-w-0">
                <p className="id-card-name text-jcc-text-primary text-sm font-black truncate">{team.name}</p>
                {team.short_name && (
                  <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
                    {team.short_name}
                  </p>
                )}
              </div>
            </div>
            {team.tagline && <p className="text-jcc-text-muted text-xs font-medium italic">{team.tagline}</p>}
            {!readOnly && (
              <button
                onClick={() => handleDelete(team.id)}
                disabled={deletingId === team.id}
                className="self-start flex items-center gap-1.5 text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
              >
                {deletingId === team.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Remove
              </button>
            )}
          </div>
        ))}
        {data.teams.length === 0 && (
          <p className="text-jcc-text-muted text-xs font-bold col-span-full">No franchises added yet.</p>
        )}
      </div>
    </div>
  );
}
