"use client";

// Share as a story: a swipeable gallery of 9:16 cards (one, for a single
// story; every card a profile earns, for a player). Each card is drawn on
// demand, the one in view first, then the rest in the background so "Share
// all" can hand the whole set to WhatsApp in one go. Where files can't be
// shared (most desktops) the buttons download instead.
//
// Images are rendered before the share tap, because iOS only opens the share
// sheet from a fresh user gesture.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ClipboardCopy, Download, Images, Loader2, Share2, X } from "lucide-react";
import { renderShareCard, type ShareCardSpec } from "@/lib/share-card";

export type SheetCard = { id: string; label: string; spec: ShareCardSpec; text: string };

type Rendered = { file: File; url: string };

export function ShareSheet({ cards, fileBase, onClose }: { cards: SheetCard[]; fileBase: string; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const [done, setDone] = useState<Record<string, Rendered | "error">>({});
  const [note, setNote] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);

  // Render the card in view first, then the rest in order, one at a time.
  // The card list is fixed for the life of the sheet.
  const order = useRef<string[]>([]);
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    const pending = new Set(cards.map((c) => c.id));
    const next = () => {
      if (!live || !pending.size) return;
      const want = order.current.find((id) => pending.has(id)) ?? [...pending][0];
      pending.delete(want);
      const i = cards.findIndex((c) => c.id === want);
      const c = cards[i];
      renderShareCard(c.spec)
        .then((blob) => {
          if (!live) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          const file = new File([blob], `${fileBase}-${String(i + 1).padStart(2, "0")}-${c.id.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.png`, { type: "image/png" });
          setDone((d) => ({ ...d, [c.id]: { file, url } }));
        })
        .catch(() => live && setDone((d) => ({ ...d, [c.id]: "error" })))
        .finally(() => setTimeout(next, 0));
    };
    next();
    return () => {
      live = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Whatever is in view (and its neighbour) jumps the queue.
  useEffect(() => {
    order.current = [cards[active]?.id, cards[active + 1]?.id].filter(Boolean) as string[];
  }, [active, cards]);

  const go = (i: number) => {
    const el = track.current;
    const j = Math.max(0, Math.min(cards.length - 1, i));
    if (el) el.scrollTo({ left: j * el.clientWidth, behavior: "smooth" });
    setActive(j);
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setActive(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(active + 1);
      else if (e.key === "ArrowLeft") go(active - 1);
      else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => {
    const strip = tabs.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (strip && tab) strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const card = cards[active];
  const state = card ? done[card.id] : undefined;
  const cur = state && state !== "error" ? state : null;
  const ready = cards.map((c) => done[c.id]).filter((x): x is Rendered => !!x && x !== "error");
  const allReady = ready.length === cards.filter((c) => done[c.id] !== "error").length && Object.keys(done).length === cards.length;
  const canShare = (files: File[]) => files.length > 0 && typeof navigator !== "undefined" && !!navigator.canShare?.({ files });
  const shareFiles = !!cur && canShare([cur.file]);

  const download = (items: Rendered[]) => {
    items.forEach((r, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = r.url;
        a.download = r.file.name;
        a.click();
      }, i * 250),
    );
    setNote(items.length > 1 ? `${items.length} images saved` : "Image saved");
  };
  const share = async (items: Rendered[]) => {
    if (!items.length) return;
    const files = items.map((r) => r.file);
    if (!canShare(files)) return download(items);
    try {
      await navigator.share({ files, title: items.length > 1 ? "JCC Stats" : card?.spec.title });
    } catch {
      // Share sheet dismissed.
    }
  };
  const copy = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.text);
      setNote("Text copied");
    } catch {
      setNote("Couldn't copy");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-[#070D18]/92 px-0 py-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Share as a story"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex w-full max-w-3xl items-center gap-2 px-4">
        <p className="min-w-0 flex-1 truncate font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#FCFBF8]/60">
          {cards.length > 1 ? `${active + 1} / ${cards.length} · ${card?.label}` : "Share as a story"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#FCFBF8]/15 bg-[#FCFBF8]/[0.06] text-[#FCFBF8] transition hover:border-[#FCFBF8]/40"
        >
          <X size={16} />
        </button>
      </div>

      {cards.length > 1 && (
        <div ref={tabs} role="tablist" className="flex w-full max-w-3xl gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {cards.map((c, i) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={i === active}
              onClick={() => go(i)}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${i === active ? "border-jcc-accent bg-jcc-accent text-jcc-seam" : "border-[#FCFBF8]/15 bg-[#FCFBF8]/[0.05] text-[#FCFBF8]/70 hover:border-[#FCFBF8]/40"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative w-full">
        <div ref={track} onScroll={onScroll} className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {cards.map((c, i) => {
            const r = done[c.id];
            return (
              <div key={c.id} className="flex w-full shrink-0 snap-center justify-center px-4" aria-hidden={i !== active}>
                <div className="relative aspect-[9/16] h-[min(62vh,calc((100vw-2rem)*16/9))] overflow-hidden rounded-[22px] bg-[#0B1424] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
                  {r && r !== "error" ? (
                    // A blob: URL the optimiser can't fetch; a plain img is right here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.url} alt={`Story card: ${c.spec.title}`} className="h-full w-full animate-[share-in_500ms_cubic-bezier(0.16,1,0.3,1)] object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-[#FCFBF8]/60">
                      {r === "error" ? <p className="px-6 text-center text-sm">Couldn&apos;t draw this card.</p> : <Loader2 className="animate-spin" size={26} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {cards.length > 1 && (
          <>
            <ArrowButton side="left" onClick={() => go(active - 1)} disabled={active === 0} />
            <ArrowButton side="right" onClick={() => go(active + 1)} disabled={active === cards.length - 1} />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-4">
        <button
          type="button"
          onClick={() => cur && share([cur])}
          disabled={!cur}
          className="inline-flex items-center gap-2 rounded-full bg-jcc-accent px-5 py-2.5 text-sm font-semibold text-jcc-seam shadow-[0_8px_24px_-8px_rgba(212,175,55,0.7)] transition hover:brightness-105 disabled:opacity-50"
        >
          {shareFiles || !cur ? <Share2 size={15} /> : <Download size={15} />}
          {shareFiles || !cur ? "Share to story" : "Download image"}
        </button>
        {shareFiles && (
          <SheetButton onClick={() => cur && download([cur])}><Download size={15} /> Save</SheetButton>
        )}
        {cards.length > 1 && (
          <SheetButton onClick={() => share(ready)} disabled={!allReady}>
            {allReady ? <Images size={15} /> : <Loader2 size={15} className="animate-spin" />}
            {allReady ? `All ${ready.length}` : `Preparing ${Object.keys(done).length}/${cards.length}`}
          </SheetButton>
        )}
        <SheetButton onClick={copy}><ClipboardCopy size={15} /> Copy text</SheetButton>
      </div>
      <p className="h-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#FCFBF8]/55" aria-live="polite">
        {note ?? "1080 × 1920 · WhatsApp Status & Instagram Stories"}
      </p>
      <style>{`@keyframes share-in { from { opacity: 0; transform: scale(0.94) translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>,
    document.body,
  );
}

function ArrowButton({ side, onClick, disabled }: { side: "left" | "right"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous card" : "Next card"}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#FCFBF8]/15 bg-[#0B1424]/80 text-[#FCFBF8] backdrop-blur transition hover:border-[#FCFBF8]/40 disabled:opacity-0 sm:grid ${side === "left" ? "left-[max(1rem,calc(50%-14rem))]" : "right-[max(1rem,calc(50%-14rem))]"}`}
    >
      {side === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

function SheetButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-[#FCFBF8]/15 bg-[#FCFBF8]/[0.06] px-4 py-2.5 text-sm font-semibold text-[#FCFBF8] transition hover:border-[#FCFBF8]/40 hover:bg-[#FCFBF8]/[0.1] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
