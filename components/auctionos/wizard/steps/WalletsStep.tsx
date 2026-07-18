"use client";

import { useState } from "react";
import { Loader2, Plus, ShieldAlert, Trash2, Wallet } from "lucide-react";
import type { StepProps } from "@/components/auctionos/wizard/types";
import { formatLakhs, parseMoneyLakhs } from "@/lib/auctionos/templates/jcc/rules";

export default function WalletsStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const balance = parseMoneyLakhs(initialBalance);
    if (!name.trim() || balance === null) {
      setError("Enter an amount like \"20cr\" or \"2000\" (lakhs).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/wallet-kinds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ name: name.trim(), initial_balance: balance }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to create wallet kind");
        setSubmitting(false);
        return;
      }
      setName("");
      setInitialBalance("");
      await refetch();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(kindId: string) {
    setDeletingId(kindId);
    try {
      await fetch(`/api/auctionos/${auctionId}/wallet-kinds?wallet_kind_id=${kindId}`, {
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
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Create Wallet Kind</h2>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Purse"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-40 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                Initial Balance
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="e.g. 20cr or 2000"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
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
            disabled={submitting || !name.trim() || !initialBalance}
            className="btn-vibrant-blue self-start !px-6 !py-2.5 text-xs disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Wallet Kind
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.wallet_kinds.map((kind) => (
          <div key={kind.id} className="premium-card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-jcc-accent-dark" />
              <p className="text-jcc-text-primary text-sm font-black">{kind.name}</p>
            </div>
            <p className="text-jcc-text-muted text-xs font-bold">Initial balance: {formatLakhs(kind.initial_balance)}</p>
            {!readOnly && (
              <button
                onClick={() => handleDelete(kind.id)}
                disabled={deletingId === kind.id}
                className="self-start flex items-center gap-1.5 text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest mt-1"
              >
                {deletingId === kind.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Remove
              </button>
            )}
          </div>
        ))}
        {data.wallet_kinds.length === 0 && (
          <p className="text-jcc-text-muted text-xs font-bold col-span-full">No wallet kinds created yet.</p>
        )}
      </div>
    </div>
  );
}
