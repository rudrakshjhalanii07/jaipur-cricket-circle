"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, ShieldAlert, Trash2, Users } from "lucide-react";
import type { StepProps } from "@/components/auctionos/wizard/types";
import type { AuctionLot } from "@/lib/auctionos/core/types";
import { formatLakhs, parseMoneyLakhs } from "@/lib/auctionos/templates/jcc/rules";

// Categories step. Bid increment is real organizer data
// (auction_categories.bid_increment, schema v4 — see
// add_auctionos_wizard.sql §6): a per-category override on top of the
// template's own tier ladder. Left blank, a category falls back to
// whatever the template's BidIncrementConfig computes (see
// lib/auctionos/core/template.ts + lib/auctionos/templates/jcc/rules.ts).
export default function CategoriesStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [walletKindId, setWalletKindId] = useState("");
  const [bidIncrement, setBidIncrement] = useState("");
  const [minRequired, setMinRequired] = useState("");
  const [maxResellRounds, setMaxResellRounds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const walletKindById = useMemo(() => new Map(data.wallet_kinds.map((k) => [k.id, k])), [data.wallet_kinds]);

  const lotsByCategory = useMemo(() => {
    const map = new Map<string, AuctionLot[]>();
    for (const lot of data.lots) {
      if (!lot.category_id) continue;
      const list = map.get(lot.category_id) ?? [];
      list.push(lot);
      map.set(lot.category_id, list);
    }
    return map;
  }, [data.lots]);

  const unassignedLots = useMemo(() => data.lots.filter((l) => !l.category_id), [data.lots]);

  async function handleAdd() {
    const price = parseMoneyLakhs(basePrice);
    if (!name.trim() || price === null) {
      setError("Enter a base price like \"20cr\" or \"20\" (lakhs).");
      return;
    }
    let increment: number | null = null;
    if (bidIncrement.trim()) {
      increment = parseMoneyLakhs(bidIncrement);
      if (increment === null) {
        setError("Enter a bid increment like \"1cr\" or \"20\" (lakhs), or leave blank.");
        return;
      }
    }
    let required = 0;
    if (minRequired.trim()) {
      required = Number(minRequired);
      if (!Number.isInteger(required) || required < 0) {
        setError("Squad quota must be a whole number (0 or more).");
        return;
      }
    }
    let resellCap: number | null = null;
    if (maxResellRounds.trim()) {
      resellCap = Number(maxResellRounds);
      if (!Number.isInteger(resellCap) || resellCap < 0) {
        setError("Max resell rounds must be a whole number (0 or more).");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({
          name: name.trim(),
          base_price: price,
          wallet_kind_id: walletKindId || null,
          bid_increment: increment,
          min_required: required,
          max_resell_rounds: resellCap,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add category");
        setSubmitting(false);
        return;
      }
      setName("");
      setBasePrice("");
      setWalletKindId("");
      setBidIncrement("");
      setMinRequired("");
      setMaxResellRounds("");
      await refetch();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(categoryId: string) {
    setDeletingId(categoryId);
    try {
      await fetch(`/api/auctionos/${auctionId}/categories?category_id=${categoryId}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      await refetch();
    } finally {
      setDeletingId(null);
    }
  }

  async function assignLot(lotId: string, categoryId: string) {
    await fetch(`/api/auctionos/${auctionId}/lots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
      body: JSON.stringify({ lot_ids: [lotId], patch: { category_id: categoryId } }),
    });
    await refetch();
  }

  async function unassignLot(lotId: string) {
    await fetch(`/api/auctionos/${auctionId}/lots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
      body: JSON.stringify({ lot_ids: [lotId], patch: { category_id: null } }),
    });
    await refetch();
  }

  return (
    <div className="flex flex-col gap-6">
      {!readOnly && (
        <div className="premium-card p-6 sm:p-8 flex flex-col gap-5">
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Add Category</h2>

          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Batters"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-36 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Base Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="e.g. 20cr or 20"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-36 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Bid Increment</label>
              <input
                type="text"
                inputMode="decimal"
                value={bidIncrement}
                onChange={(e) => setBidIncrement(e.target.value)}
                placeholder="e.g. 1cr — Template default"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-44 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Linked Wallet</label>
              <select
                value={walletKindId}
                onChange={(e) => setWalletKindId(e.target.value)}
                className="select-field text-xs"
              >
                <option value="">None</option>
                {data.wallet_kinds.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div className="w-36 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Squad Quota</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={minRequired}
                onChange={(e) => setMinRequired(e.target.value)}
                placeholder="e.g. 2 — optional"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-40 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Max Resell Rounds</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={maxResellRounds}
                onChange={(e) => setMaxResellRounds(e.target.value)}
                placeholder="e.g. 2 — optional"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
          </div>
          <p className="text-jcc-text-muted text-[10px] font-bold max-w-2xl">
            Squad Quota is the minimum number of players each team must own in this category (a team&rsquo;s own
            captain, if seated here, counts as one). Leave at 0 for categories with no mandatory minimum (e.g. Guest)
            &mdash; a category with a quota loops its own unsold players until every team meets it, per
            AUCTION_RULES.md&rsquo;s &ldquo;Category quota&rdquo;.
          </p>
          <p className="text-jcc-text-muted text-[10px] font-bold max-w-2xl">
            Max Resell Rounds only matters for a category with no Squad Quota (e.g. Guest): an unsold player is
            re-offered up to this many times, then randomly handed to whichever eligible team currently has the
            smallest overall squad &mdash; a best-effort balance, not a guarantee. Leave blank for the old behavior
            (unsold is final immediately). Per AUCTION_RULES.md&rsquo;s &ldquo;Guest squad rebalancing&rdquo;.
          </p>

          {error && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <button
            onClick={handleAdd}
            disabled={submitting || !name.trim() || !basePrice}
            className="btn-vibrant-blue self-start !px-6 !py-2.5 text-xs disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Category
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {data.categories.map((category) => {
          const players = lotsByCategory.get(category.id) ?? [];
          const kind = category.wallet_kind_id ? walletKindById.get(category.wallet_kind_id) : null;
          return (
            <div key={category.id} className="premium-card p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-jcc-accent-dark" />
                  <h3 className="font-body text-jcc-text-primary text-base font-black">{category.name}</h3>
                  <span className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
                    Base {formatLakhs(category.base_price)} · Increment{" "}
                    {category.bid_increment != null ? formatLakhs(category.bid_increment) : "Template default"} · {players.length}{" "}
                    players{kind ? ` · ${kind.name}` : ""}
                    {category.min_required > 0 ? ` · Quota ${category.min_required}/team` : ""}
                    {category.max_resell_rounds != null ? ` · Resell x${category.max_resell_rounds} then rebalance` : ""}
                  </span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(category.id)}
                    disabled={deletingId === category.id}
                    className="flex items-center gap-1.5 text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
                  >
                    {deletingId === category.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Remove
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {players.map((lot) => (
                  <span
                    key={lot.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-[11px] font-bold"
                  >
                    {lot.display_name}
                    {!readOnly && (
                      <button onClick={() => unassignLot(lot.id)} className="text-jcc-text-muted hover:text-red-500">
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {players.length === 0 && <span className="text-jcc-text-muted text-[11px] font-bold">No players assigned yet.</span>}
              </div>

              {!readOnly && (
                <div className="pt-2 border-t border-jcc-border flex items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) assignLot(e.target.value, category.id);
                    }}
                    className="select-field-sm"
                  >
                    <option value="">+ Assign player…</option>
                    {unassignedLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>{lot.display_name}</option>
                    ))}
                  </select>
                  {unassignedLots.length === 0 && (
                    <span className="text-jcc-text-muted text-[10px] font-bold">No unassigned players left.</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {data.categories.length === 0 && (
          <p className="text-jcc-text-muted text-xs font-bold">No categories added yet.</p>
        )}
      </div>
    </div>
  );
}
