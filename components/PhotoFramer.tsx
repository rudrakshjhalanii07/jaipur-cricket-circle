"use client";

// "Frame your photo": finds the face automatically, then lets the member drag
// the circle onto it and size it, with live previews of the round avatar and
// a story card. Used at upload (register, profile) and in the admin panel.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, ScanFace } from "lucide-react";
import { detectFocus, loadForDetection } from "@/lib/face-detect";
import { SHARP_WIDTH, focusStyle, withFocus, type PhotoFocus } from "@/lib/photo-focus";
import { renderShareCard } from "@/lib/share-card";

type Status = "loading" | "detecting" | "found" | "missing" | "manual" | "error";

export default function PhotoFramer({
  src,
  name,
  initial,
  onChange,
  compact,
}: {
  /** The photo: an object URL at upload, or the stored URL. */
  src: string;
  name: string;
  /** A saved focus to start from; detection runs when there's none. */
  initial?: PhotoFocus | null;
  onChange: (focus: PhotoFocus | null) => void;
  compact?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [focus, setFocus] = useState<PhotoFocus | null>(initial ?? null);
  const [status, setStatus] = useState<Status>("loading");
  const [card, setCard] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const report = useRef(onChange);
  useEffect(() => { report.current = onChange; });

  // Load, then detect unless we were handed a focus.
  useEffect(() => {
    let live = true;
    loadForDetection(src)
      .then(async (im) => {
        if (!live) return;
        setImg(im);
        if (initial) {
          setStatus(initial.by === "manual" ? "manual" : "found");
          return;
        }
        setStatus("detecting");
        const f = await detectFocus(im);
        if (!live) return;
        const next = f ?? { x: 0.5, y: 0.3, s: 0.22, a: im.naturalWidth / im.naturalHeight, w: im.naturalWidth, by: "manual" as const };
        setFocus(next);
        setStatus(f ? "found" : "missing");
        report.current(next);
      })
      .catch(() => live && setStatus("error"));
    return () => { live = false; };
    // A new photo is a new framer; `initial` only seeds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Story-card preview, debounced while dragging.
  useEffect(() => {
    if (!img || !focus) return;
    let live = true;
    let url: string | null = null;
    const t = setTimeout(() => {
      renderShareCard({
        kicker: "Preview",
        title: name || "Your name",
        hero: { value: "#1", unit: "your story card", colors: ["#F3C96A", "#A97824"] },
        person: { name: name || "You", photo: withFocus(src, focus) },
        footer: window.location.host,
      })
        .then((b) => {
          if (!live) return;
          url = URL.createObjectURL(b);
          setCard((old) => { if (old) URL.revokeObjectURL(old); return url; });
        })
        .catch(() => {});
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [img, focus, src, name]);
  useEffect(() => () => { if (card) URL.revokeObjectURL(card); }, [card]);

  const update = (patch: Partial<PhotoFocus>) => {
    if (!focus) return;
    const next = { ...focus, ...patch, by: "manual" as const };
    setFocus(next);
    setStatus("manual");
    report.current(next);
  };
  const moveTo = (clientX: number, clientY: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    update({ x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) });
  };

  const soft = img && img.naturalWidth < SHARP_WIDTH;
  const ring = focus ? focus.s * 1.45 : 0; // circle diameter, as a share of the image height

  return (
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <div>
        <div
          ref={box}
          className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-2xl bg-black/20"
          onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e.clientX, e.clientY); }}
          onPointerMove={(e) => { if (drag.current) moveTo(e.clientX, e.clientY); }}
          onPointerUp={() => { drag.current = false; }}
          onPointerCancel={() => { drag.current = false; }}
        >
          {/* An object URL or a member photo straight from storage. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src.split("#")[0]} alt="" draggable={false} className={`block w-auto ${compact ? "max-h-56" : "max-h-80"}`} />
          {focus && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-full border-[3px] border-[#D4AF37] shadow-[0_0_0_9999px_rgba(7,13,24,0.45)]"
              style={{
                left: `${focus.x * 100}%`,
                top: `${focus.y * 100}%`,
                height: `${ring * 100}%`,
                aspectRatio: "1",
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
          {(status === "loading" || status === "detecting") && (
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-semibold text-white">
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {status === "loading" ? "Loading photo…" : "Finding your face…"}</span>
            </span>
          )}
        </div>
        {focus && (
          <label className="mx-auto mt-3 flex max-w-sm items-center gap-3 text-xs font-semibold text-jcc-text-muted">
            Face size
            <input
              type="range"
              min={0.06}
              max={0.7}
              step={0.005}
              value={focus.s}
              onChange={(e) => update({ s: Number(e.target.value) })}
              className="flex-1 accent-[#D4AF37]"
            />
          </label>
        )}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-jcc-text-muted">
          {status === "found" && <><ScanFace size={14} className="text-jcc-accent-dark" /> Face found. Drag the circle if it&apos;s off.</>}
          {status === "manual" && <><Check size={14} className="text-jcc-accent-dark" /> Framed by hand.</>}
          {status === "missing" && <><AlertTriangle size={14} className="text-amber-500" /> Couldn&apos;t find a face. Tap your face to place the circle.</>}
          {status === "error" && <><AlertTriangle size={14} className="text-amber-500" /> Couldn&apos;t load this photo.</>}
        </p>
        {soft && (
          <p className="mx-auto mt-2 max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed text-amber-600">
            This photo is only {img!.naturalWidth}px wide, so it will look soft on story cards. Upload a sharper photo (1080px or more) for a crisp card.
          </p>
        )}
      </div>

      {focus && (
        <div className={`flex items-start justify-center gap-4 ${compact ? "" : "sm:flex-col sm:items-center"}`}>
          <figure className="text-center">
            <span className="relative mx-auto block h-20 w-20 overflow-hidden rounded-full ring-2 ring-[#D4AF37]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src.split("#")[0]} alt="" className="h-full w-full object-cover" style={focusStyle(focus)} />
            </span>
            <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">Avatar</figcaption>
          </figure>
          <figure className="text-center">
            <span className="mx-auto block aspect-[9/16] w-28 overflow-hidden rounded-xl bg-[#0B1424] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {card ? <img src={card} alt="Story card preview" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Loader2 size={16} className="animate-spin text-white/60" /></span>}
            </span>
            <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">Story card</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
