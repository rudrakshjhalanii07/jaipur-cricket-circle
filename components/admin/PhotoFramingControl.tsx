"use client";

// Photo framing: finds the face in every member photo (in this browser, with
// lib/face-detect.ts) and saves it to players.image_focus, so avatars and
// story cards centre on faces. "Auto-frame" runs over everything not yet
// framed; any photo can be opened and framed by hand. Photos too small for a
// full-bleed story card are flagged so the member can be asked for a better one.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw, ScanFace, Search, Wand2, X } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import PhotoFramer from "@/components/PhotoFramer";
import { detectFocus, loadForDetection } from "@/lib/face-detect";
import { SHARP_WIDTH, focusStyle, type PhotoFocus } from "@/lib/photo-focus";

type Row = { id: string; name: string; team: string | null; approved: boolean; image_url: string; focus: PhotoFocus | null };
/** What this session learned about a photo that isn't saved: its width, or that no face was found. */
type Probe = { width: number; missing?: boolean; failed?: boolean };
type Filter = "all" | "unframed" | "manual" | "soft";

export default function PhotoFramingControl({ adminPassword }: { adminPassword: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [probe, setProbe] = useState<Record<string, Probe>>({});
  const [error, setError] = useState("");
  const [running, setRunning] = useState<{ done: number; of: number } | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [draft, setDraft] = useState<PhotoFocus | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(
    () =>
      fetch("/api/admin/photo-focus", { headers: { "x-admin-password": adminPassword } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Failed to load");
          setError("");
          setRows(json.members);
        })
        .catch((e) => setError(String(e instanceof Error ? e.message : e))),
    [adminPassword],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (row: Row, focus: PhotoFocus | null) => {
    const res = await fetch("/api/admin/photo-focus", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
      body: JSON.stringify({ playerId: row.id, focus }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to save");
    setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, focus: json.focus } : r)) ?? rs);
  };

  const width = (r: Row) => r.focus?.w ?? probe[r.id]?.width ?? null;
  const soft = (r: Row) => { const w = width(r); return w != null && w < SHARP_WIDTH; };

  /** Detect and save every photo that has no framing yet, one at a time. */
  const autoFrame = async () => {
    const todo = (rows ?? []).filter((r) => !r.focus);
    if (!todo.length) return;
    setError("");
    setRunning({ done: 0, of: todo.length });
    for (const [i, r] of todo.entries()) {
      try {
        const img = await loadForDetection(r.image_url);
        const f = await detectFocus(img);
        setProbe((p) => ({ ...p, [r.id]: { width: img.naturalWidth, missing: !f } }));
        if (f) await save(r, f);
      } catch (e) {
        setProbe((p) => ({ ...p, [r.id]: { width: 0, failed: true } }));
        if (e instanceof Error && /add_player_image_focus/.test(e.message)) {
          setError(e.message);
          break;
        }
      }
      setRunning({ done: i + 1, of: todo.length });
    }
    setRunning(null);
  };

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      framed: all.filter((r) => r.focus).length,
      unframed: all.filter((r) => !r.focus).length,
      manual: all.filter((r) => r.focus?.by === "manual").length,
      soft: all.filter(soft).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, probe]);

  const shown = (rows ?? []).filter((r) => {
    if (query.trim() && !r.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === "unframed") return !r.focus;
    if (filter === "manual") return r.focus?.by === "manual";
    if (filter === "soft") return soft(r);
    return true;
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Photo Framing"
        subtitle="Where each member's face is, for avatars and story cards"
        toolbar={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void autoFrame()}
              disabled={!!running || !counts.unframed}
              className="inline-flex items-center gap-2 rounded-xl bg-jcc-accent px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-jcc-seam disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {running ? `Framing ${running.done}/${running.of}` : `Auto-frame ${counts.unframed}`}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-jcc-blue/15 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-jcc-blue/75 hover:border-jcc-accent/50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Framed" value={counts.framed} icon={ScanFace} />
        <AdminStatCard label="Not framed" value={counts.unframed} icon={AlertTriangle} />
        <AdminStatCard label="Framed by hand" value={counts.manual} icon={Check} />
        <AdminStatCard label="Too small" value={counts.soft} icon={AlertTriangle} />
      </div>

      {error && <p className="rounded-xl border border-jcc-danger/30 bg-jcc-danger/10 px-4 py-3 text-sm font-semibold text-jcc-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "unframed", "manual", "soft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest ${filter === f ? "border-jcc-accent bg-jcc-accent text-jcc-seam" : "border-jcc-blue/15 text-jcc-blue/70"}`}
          >
            {{ all: "All", unframed: "Not framed", manual: "By hand", soft: "Too small" }[f]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-xl border border-jcc-blue/15 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-jcc-blue/50" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-40 bg-transparent text-sm text-jcc-blue outline-none" />
        </label>
      </div>

      {!rows ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-jcc-accent-dark" /></div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((r) => {
            const p = probe[r.id];
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { setOpen(r); setDraft(r.focus); }}
                  className="group w-full rounded-2xl border border-jcc-blue/10 bg-jcc-navy p-3 text-left transition hover:border-jcc-accent/50"
                >
                  <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full ring-2 ring-jcc-accent/60">
                    {/* Member photos straight from storage. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover" style={focusStyle(r.focus)} />
                  </span>
                  <span className="mt-3 block truncate text-sm font-bold text-jcc-blue">{r.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.focus ? (
                      <Chip tone="ok">{r.focus.by === "manual" ? "By hand" : "Auto"}</Chip>
                    ) : p?.missing ? (
                      <Chip tone="warn">No face found</Chip>
                    ) : p?.failed ? (
                      <Chip tone="warn">Couldn&apos;t load</Chip>
                    ) : (
                      <Chip>Not framed</Chip>
                    )}
                    {soft(r) && <Chip tone="warn">{width(r)}px</Chip>}
                    {!r.approved && <Chip>Pending</Chip>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-jcc-navy p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-bold text-jcc-blue">{open.name}</h3>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-jcc-blue/15 text-jcc-blue">
                <X className="h-4 w-4" />
              </button>
            </div>
            <PhotoFramer key={open.id} src={open.image_url} name={open.name} initial={open.focus} onChange={setDraft} />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {open.focus && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try { await save(open, null); setOpen(null); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setSaving(false); }
                  }}
                  className="rounded-xl border border-jcc-blue/15 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-jcc-blue/75"
                >
                  Clear framing
                </button>
              )}
              <button
                type="button"
                disabled={saving || !draft}
                onClick={async () => {
                  if (!draft) return;
                  setSaving(true);
                  try { await save(open, draft); setOpen(null); } catch (e) { setError(String(e instanceof Error ? e.message : e)); } finally { setSaving(false); }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-jcc-accent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-jcc-seam disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save framing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  const c = tone === "ok" ? "bg-emerald-500/15 text-emerald-600" : tone === "warn" ? "bg-amber-500/15 text-amber-600" : "bg-jcc-blue/10 text-jcc-blue/70";
  return <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${c}`}>{children}</span>;
}
