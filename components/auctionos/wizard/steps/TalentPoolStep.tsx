"use client";

import { useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Sheet,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { parseTalentCsv, type ParsedTalentRow, type TalentCsvRowError } from "@/lib/auctionos/wizard/csv";
import type { StepProps } from "@/components/auctionos/wizard/types";
import { formatLakhs, parseMoneyLakhs } from "@/lib/auctionos/templates/jcc/rules";

export default function TalentPoolStep({ auctionId, data, adminPassword, refetch, readOnly }: StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedTalentRow[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<TalentCsvRowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkBasePrice, setBulkBasePrice] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const filteredLots = useMemo(() => {
    return data.lots.filter((lot) => {
      if (search && !lot.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && lot.category_id !== categoryFilter) return false;
      return true;
    });
  }, [data.lots, search, categoryFilter]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      const { rows, errors } = await parseTalentCsv(file, data.categories);
      setPreview(rows);
      setPreviewErrors(errors);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse CSV");
    }
  }

  async function confirmImport() {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ lots: preview }),
      });
      const json = await res.json();
      if (!res.ok) {
        setImportError(json.error ?? "Import failed");
        setImporting(false);
        return;
      }
      setPreview(null);
      setPreviewErrors([]);
      await refetch();
    } catch {
      setImportError("Network error");
    } finally {
      setImporting(false);
    }
  }

  async function handleManualAdd() {
    const price = parseMoneyLakhs(manualPrice);
    if (!manualName.trim() || price === null) {
      setManualError("Enter a base price like \"20cr\" or \"20\" (lakhs).");
      return;
    }
    setManualError(null);
    setAddingManual(true);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({
          display_name: manualName.trim(),
          base_price: price,
          category_id: manualCategoryId || null,
          metadata: manualImageUrl.trim() ? { image_url: manualImageUrl.trim() } : undefined,
        }),
      });
      if (res.ok) {
        setManualName("");
        setManualPrice("");
        setManualCategoryId("");
        setManualImageUrl("");
        await refetch();
      }
    } finally {
      setAddingManual(false);
    }
  }

  async function handleDeleteLot(lotId: string) {
    await fetch(`/api/auctionos/${auctionId}/lots?lot_id=${lotId}`, {
      method: "DELETE",
      headers: { "x-admin-password": adminPassword },
    });
    await refetch();
  }

  function toggleSelect(lotId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  }

  async function applyBulk(patch: Record<string, unknown>) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await fetch(`/api/auctionos/${auctionId}/lots`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ lot_ids: Array.from(selected), patch }),
      });
      setSelected(new Set());
      setBulkCategoryId("");
      setBulkBasePrice("");
      await refetch();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/auctionos/${auctionId}/lots?lot_id=${id}`, {
            method: "DELETE",
            headers: { "x-admin-password": adminPassword },
          })
        )
      );
      setSelected(new Set());
      await refetch();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!readOnly && (
        <div className="premium-card p-6 sm:p-8 flex flex-col gap-5">
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">Import Talent Pool</h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost !px-5 !py-2.5 text-xs"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button disabled className="btn-ghost !px-5 !py-2.5 text-xs opacity-40 cursor-not-allowed">
              <FileSpreadsheet className="w-4 h-4" /> Excel (coming soon)
            </button>
            <button disabled className="btn-ghost !px-5 !py-2.5 text-xs opacity-40 cursor-not-allowed">
              <Sheet className="w-4 h-4" /> Google Sheets (coming soon)
            </button>
          </div>

          {importError && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {importError}
            </p>
          )}

          {preview && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-jcc-text-primary text-xs font-black uppercase tracking-widest">
                  Preview — {preview.length} row{preview.length === 1 ? "" : "s"} ready
                </p>
                <button onClick={() => { setPreview(null); setPreviewErrors([]); }} className="text-jcc-text-muted hover:text-jcc-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {previewErrors.length > 0 && (
                <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  {previewErrors.map((e, i) => (
                    <p key={i} className="text-red-600 text-[11px] font-bold">
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto rounded-xl border border-jcc-border">
                <table className="w-full text-xs">
                  <thead className="bg-jcc-navy-light sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Name</th>
                      <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Base Price</th>
                      <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-jcc-border">
                        <td className="px-3 py-2">
                          {row.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.image_url} alt="" className="w-7 h-7 rounded-full object-cover border border-jcc-border" />
                          ) : (
                            <span className="block w-7 h-7 rounded-full bg-jcc-navy-light border border-jcc-border" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-jcc-text-primary font-bold">{row.display_name}</td>
                        <td className="px-3 py-2 text-jcc-text-muted font-bold">{formatLakhs(row.base_price)}</td>
                        <td className="px-3 py-2 text-jcc-text-muted font-bold">
                          {row.category_id ? categoryById.get(row.category_id)?.name ?? "—" : "Unassigned"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={confirmImport}
                disabled={importing || preview.length === 0}
                className="btn-vibrant-blue self-start !px-6 !py-2.5 text-xs disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Confirm Import
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-jcc-border flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Add Player</label>
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Player name"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-32 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Base Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="e.g. 20cr or 20"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <div className="w-40 flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Category</label>
              <select
                value={manualCategoryId}
                onChange={(e) => setManualCategoryId(e.target.value)}
                className="select-field text-xs"
              >
                <option value="">Unassigned</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                Photo URL (optional)
              </label>
              <input
                value={manualImageUrl}
                onChange={(e) => setManualImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <button
              onClick={handleManualAdd}
              disabled={addingManual || !manualName.trim() || !manualPrice}
              className="btn-ghost !px-5 !py-2.5 text-xs disabled:opacity-50"
            >
              {addingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
          {manualError && (
            <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {manualError}
            </p>
          )}
        </div>
      )}

      <div className="premium-card p-6 sm:p-8 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-body text-jcc-text-primary text-base font-black uppercase tracking-widest">
            Talent Pool ({data.lots.length})
          </h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-jcc-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="pl-8 pr-3 py-2 rounded-lg bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-xs font-bold focus:outline-none focus:border-jcc-accent-dark"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-field-sm"
            >
              <option value="">All categories</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!readOnly && selected.size > 0 && (
          <div className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-accent-dark/30">
            <span className="text-jcc-text-primary text-xs font-black">{selected.size} selected</span>
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="select-field-sm"
            >
              <option value="">Set category…</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              disabled={!bulkCategoryId || bulkBusy}
              onClick={() => applyBulk({ category_id: bulkCategoryId })}
              className="text-jcc-accent-dark text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Apply
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={bulkBasePrice}
              onChange={(e) => setBulkBasePrice(e.target.value)}
              placeholder="e.g. 20cr or 20"
              className="w-32 px-2 py-1.5 rounded-lg bg-jcc-navy border border-jcc-border text-jcc-text-primary text-xs font-bold"
            />
            <button
              disabled={!bulkBasePrice || bulkBusy}
              onClick={() => {
                const parsed = parseMoneyLakhs(bulkBasePrice);
                if (parsed !== null) applyBulk({ base_price: parsed });
              }}
              className="text-jcc-accent-dark text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Apply
            </button>
            <button
              disabled={bulkBusy}
              onClick={bulkDelete}
              className="flex items-center gap-1 text-red-500 text-[10px] font-black uppercase tracking-widest ml-auto"
            >
              <Trash2 className="w-3 h-3" /> Delete Selected
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-jcc-border">
          <table className="w-full text-xs">
            <thead className="bg-jcc-navy-light">
              <tr>
                {!readOnly && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Name</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Base Price</th>
                <th className="text-left px-3 py-2 font-black uppercase tracking-widest text-jcc-text-muted">Category</th>
                {!readOnly && <th className="px-3 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {filteredLots.map((lot) => {
                const imageUrl = typeof lot.metadata?.image_url === "string" ? lot.metadata.image_url : null;
                return (
                <tr key={lot.id} className="border-t border-jcc-border">
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(lot.id)}
                        onChange={() => toggleSelect(lot.id)}
                        className="accent-jcc-accent-dark"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-jcc-border" />
                    ) : (
                      <span className="block w-7 h-7 rounded-full bg-jcc-navy-light border border-jcc-border" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-jcc-text-primary font-bold">{lot.display_name}</td>
                  <td className="px-3 py-2 text-jcc-text-muted font-bold">{formatLakhs(lot.base_price)}</td>
                  <td className="px-3 py-2 text-jcc-text-muted font-bold">
                    {lot.category_id ? categoryById.get(lot.category_id)?.name ?? "—" : "Unassigned"}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <button onClick={() => handleDeleteLot(lot.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
              {filteredLots.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-jcc-text-muted font-bold">
                    No players match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
