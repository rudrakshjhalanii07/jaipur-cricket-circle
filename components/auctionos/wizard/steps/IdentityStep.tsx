"use client";

import { useState } from "react";
import { Calendar, Check, Loader2, MapPin, Pencil, ShieldAlert } from "lucide-react";
import LogoUpload from "@/components/auctionos/wizard/LogoUpload";
import type { StepProps } from "@/components/auctionos/wizard/types";

// Step 1's fields, redisplayed here for editing after the draft exists.
// Read-only display with an edit affordance (PATCH) while still in draft.
export default function IdentityStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const { auction } = data;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(auction.name);
  const [venue, setVenue] = useState(auction.venue ?? "");
  const [startsAt, setStartsAt] = useState(auction.starts_at ? auction.starts_at.slice(0, 16) : "");
  const [logoUrl, setLogoUrl] = useState(auction.logo_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({
          name: name.trim(),
          venue: venue.trim() || null,
          starts_at: startsAt || null,
          logo_url: logoUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to update");
        setSaving(false);
        return;
      }
      await refetch();
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="premium-card p-6 sm:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Identity</h2>
        {!readOnly && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-jcc-text-muted hover:text-jcc-accent-dark text-[11px] font-black uppercase tracking-widest"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-5">
            <LogoUpload value={logoUrl} onChange={setLogoUrl} label="Logo" />
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Venue</label>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Date</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-vibrant-blue !px-6 !py-2.5 text-xs">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost !px-6 !py-2.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          {auction.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auction.logo_url} alt={auction.name} className="w-20 h-20 rounded-xl object-cover border border-jcc-border" />
          ) : (
            <div className="w-20 h-20 rounded-xl border border-jcc-border bg-jcc-navy-light" />
          )}
          <div className="flex flex-col gap-1.5">
            <h3 className="text-jcc-text-primary text-lg font-black">{auction.name}</h3>
            <div className="flex flex-wrap gap-4 text-jcc-text-muted text-xs font-bold">
              {auction.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {auction.venue}
                </span>
              )}
              {auction.starts_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {new Date(auction.starts_at).toLocaleString()}
                </span>
              )}
              <span className="uppercase tracking-widest">Theme: {auction.theme_key}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
