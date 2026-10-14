"use client";

// Admin → Stats Access. Every member's 14-day window on /stats and profile
// stats (lib/stats-access.ts): who has started, how long is left, who has run
// out — and buttons to renew, extend, end or clear a window.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Crown, Infinity as InfinityIcon, Loader2, RefreshCw, Search, TimerOff, UserX } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { getDiceBearUrl } from "@/lib/avatar";

type Access =
  | { kind: "permanent" }
  | { kind: "trial"; startedAt: string; endsAt: string; daysLeft: number }
  | { kind: "expired"; startedAt: string; endsAt: string }
  | { kind: "untracked" };

interface Row {
  id: string;
  name: string;
  image_url: string | null;
  team: string | null;
  startedAt: string | null;
  access: Access;
}

type Filter = "all" | "trial" | "expired" | "untracked" | "permanent";
type Action = "renew" | "extend" | "end" | "clear";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const STATUS: Record<Access["kind"], { label: string; cls: string }> = {
  permanent: { label: "Permanent", cls: "bg-jcc-accent/15 text-jcc-accent-dark border-jcc-accent/30" },
  trial: { label: "Active", cls: "bg-jcc-green/10 text-jcc-green border-jcc-green/25" },
  expired: { label: "Ended", cls: "bg-jcc-danger/10 text-jcc-danger border-jcc-danger/25" },
  untracked: { label: "Not started", cls: "bg-jcc-blue/5 text-jcc-blue/75 border-jcc-blue/15" },
};

export default function StatsAccessControl({ adminPassword }: { adminPassword: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [extendDays, setExtendDays] = useState(7);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/stats-access", { headers: { "x-admin-password": adminPassword } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.members);
      setTrialDays(json.trialDays);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [adminPassword]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (row: Row, action: Action) => {
    if (action === "end" && !confirm(`End ${row.name}'s stats access now?`)) return;
    if (action === "clear" && !confirm(`Clear ${row.name}'s start date? His ${trialDays} days will start again at his next login.`)) return;
    setBusy(`${row.id}:${action}`);
    setError("");
    try {
      const res = await fetch("/api/admin/stats-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ playerId: row.id, action, days: extendDays }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, startedAt: json.startedAt, access: json.access } : r)) ?? rs);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => {
    const c = { permanent: 0, trial: 0, expired: 0, untracked: 0 };
    for (const r of rows ?? []) c[r.access.kind]++;
    return c;
  }, [rows]);

  const shown = (rows ?? []).filter(
    (r) => (filter === "all" || r.access.kind === filter) && (!query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Stats Access"
        subtitle={`${trialDays}-day member window · seven permanent accounts`}
        toolbar={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-jcc-blue/15 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-jcc-blue/75 hover:border-jcc-accent/50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Active" value={counts.trial} icon={Clock} />
        <AdminStatCard label="Ended" value={counts.expired} icon={TimerOff} />
        <AdminStatCard label="Not started" value={counts.untracked} icon={UserX} />
        <AdminStatCard label="Permanent" value={counts.permanent} icon={Crown} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-jcc-blue/10 bg-jcc-navy p-3 lg:flex-row lg:items-center">
        <label className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-jcc-blue/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full rounded-xl bg-jcc-navy-light py-2.5 pl-9 pr-3 text-sm text-jcc-blue placeholder:text-jcc-blue/50 focus:outline-none focus:ring-2 focus:ring-jcc-accent/40"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {(["all", "trial", "expired", "untracked", "permanent"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                filter === f ? "bg-jcc-blue text-[#FFFFFF]" : "text-jcc-blue/75 hover:bg-jcc-navy-light"
              }`}
            >
              {f === "all" ? "All" : STATUS[f].label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-jcc-blue/75">
          Extend by
          <select
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value))}
            className="rounded-lg border border-jcc-blue/15 bg-jcc-navy px-2 py-1.5 text-xs font-bold text-jcc-blue"
          >
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="rounded-xl border border-jcc-danger/25 bg-jcc-danger/10 px-4 py-3 text-xs font-bold text-jcc-danger">{error}</p>}

      {!rows ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-jcc-blue/75">
          <Loader2 className="h-4 w-4 animate-spin text-jcc-accent" /> Loading members…
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-jcc-blue/10 bg-jcc-navy">
          {shown.length === 0 && <p className="py-12 text-center text-sm font-bold text-jcc-blue/75">No members match.</p>}
          {shown.map((r) => {
            const a = r.access;
            const status = STATUS[a.kind];
            const pct = a.kind === "trial" ? Math.max(4, Math.round((a.daysLeft / trialDays) * 100)) : a.kind === "expired" ? 0 : 100;
            const working = busy?.startsWith(`${r.id}:`);
            return (
              <div key={r.id} className="grid grid-cols-1 items-center gap-4 border-b border-jcc-blue/10 px-4 py-4 last:border-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url || getDiceBearUrl(r.name, r.team ?? undefined)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-jcc-blue">{r.name}</p>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${status.cls}`}>
                      {a.kind === "permanent" && <InfinityIcon className="h-3 w-3" />}
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 text-xs">
                  {a.kind === "permanent" ? (
                    <p className="font-bold text-jcc-blue/75">All-time access — set in code by player id.</p>
                  ) : a.kind === "untracked" ? (
                    <p className="font-bold text-jcc-blue/75">Clock starts at his next login.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 font-bold text-jcc-blue">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-jcc-accent-dark" />
                          {fmt(a.startedAt)} → {fmt(a.endsAt)}
                        </span>
                        <span className={a.kind === "expired" ? "text-jcc-danger" : "text-jcc-green"}>
                          {a.kind === "expired" ? "Ended" : `${a.daysLeft}d left`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-jcc-blue/10">
                        <div
                          className={`h-full rounded-full ${a.kind === "expired" ? "bg-jcc-danger" : pct < 30 ? "bg-jcc-accent" : "bg-jcc-green"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {a.kind === "permanent" ? (
                  <span />
                ) : (
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    {(
                      [
                        ["renew", `Renew ${trialDays}d`],
                        ["extend", `+${extendDays}d`],
                        ["end", "End now"],
                        ["clear", "Clear"],
                      ] as [Action, string][]
                    )
                      .filter(([key]) => !(key === "end" && a.kind !== "trial") && !(key === "clear" && a.kind === "untracked") && !(key === "extend" && a.kind === "untracked"))
                      .map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={!!working}
                          onClick={() => void act(r, key)}
                          className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 ${
                            key === "end"
                              ? "border-jcc-danger/30 text-jcc-danger hover:bg-jcc-danger/10"
                              : key === "renew"
                                ? "border-jcc-blue bg-jcc-blue text-[#FFFFFF] hover:opacity-90"
                                : "border-jcc-blue/15 text-jcc-blue/75 hover:border-jcc-accent/50 hover:text-jcc-blue"
                          }`}
                        >
                          {busy === `${r.id}:${key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
