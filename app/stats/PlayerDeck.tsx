"use client";

import Image from "next/image";
import { Avatar, PhotoContext, usePhoto } from "./Avatar";
import { photoFor } from "@/lib/player-photos";
import { focusOf, focusStyle } from "@/lib/photo-focus";
import { Counter, gsap, reduceMotion, useGSAP } from "./motion";
import { MeetingStrip, TugOfWar, battleStory } from "./KeyBattles";
import { Children, cloneElement, isValidElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import {
  DUCKS,
  KIND_LABEL,
  f0,
  f1,
  f2,
  fmtDate,
  ov,
  plural,
  byScalp,
  playerProfile,
  leagueInsights,
  momAnalytics,
  type AwardType,
  slug,
  type BadgeTone,
  type CardData,
  type Profile,
  type Split,
  type BowlSplit, keyBattles
} from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { ShareSheet } from "./ShareSheet";
import { profileShareCards } from "./share-cards";
import { AchievementStyles, Emblem, TierChip, tierOf } from "./achievements";
import { TypeChip, TYPE_COLOR } from "./MoMSection";

// Chart colours: player series, not-out / secondary series, league reference.
// Checked for colour-blind separation; the grey reference always carries a label.
const MARK = "#12233F";
const MARK_2 = "#D4AF37";
const BAD = "#B0473F";
const SLIDE = "transform .35s cubic-bezier(.2,.8,.2,1)";

const TONE: Record<BadgeTone, string> = {
  crown: "bg-jcc-accent text-jcc-seam border-jcc-accent",
  bat: "bg-[#2B59C3]/10 text-[#1F449A] border-[#2B59C3]/25",
  ball: "bg-emerald-600/10 text-emerald-800 border-emerald-600/25",
  field: "bg-[#176178]/10 text-[#176178] border-[#176178]/25",
  team: "bg-jcc-navy-light text-jcc-blue border-jcc-border",
  warn: "bg-jcc-danger/10 text-jcc-danger border-jcc-danger/25",
};

export function deckHash(name: string, card?: string) {
  return `player-${slug(name)}${card ? `.${card}` : ""}`;
}

// ─── Building blocks ─────────────────────────────────────────────────────────

type Tip = { x: number; y: number; body: ReactNode } | null;
type SetTip = (t: Tip) => void;

const KICK = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]";

/** "#8 of 54" → a "Top 15%" chip with a bar; anything else is a plain note. */
function RankNote({ sub, lead }: { sub: ReactNode; lead?: boolean }) {
  const m = typeof sub === "string" ? sub.match(/^#(\d+) of (\d+)$/) : null;
  if (!m) return <div className={`mt-2 text-[11.5px] leading-snug ${lead ? "text-[rgba(255,255,255,0.62)]" : "text-jcc-text-muted"}`}>{sub}</div>;
  const rank = +m[1], of = +m[2];
  const top = Math.max(1, Math.ceil((100 * rank) / of));
  const strong = top <= 25;
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
        <span className={`rounded-full px-1.5 py-px font-semibold ${strong ? "bg-jcc-accent text-[#0B1424]" : lead ? "bg-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.75)]" : "bg-jcc-blue/[0.07] text-jcc-blue/75"}`}>Top {top}%</span>
        <span className={lead ? "text-[rgba(255,255,255,0.45)]" : "text-jcc-text-muted"}>#{rank}/{of}</span>
      </div>
      <div className={`mt-1.5 h-1 overflow-hidden rounded-full ${lead ? "bg-[rgba(255,255,255,0.1)]" : "bg-jcc-blue/[0.08]"}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, 100 - top)}%`, background: strong ? "linear-gradient(90deg,#A97824,#F3C96A)" : lead ? "rgba(255,255,255,0.55)" : "#12233F" }} />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, lead }: { label: string; value: ReactNode; sub?: ReactNode; lead?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-4 py-3.5 transition-transform duration-300 hover:-translate-y-0.5 ${
        lead ? "bg-[#0B1424] shadow-[0_18px_40px_-24px_rgba(11,20,36,0.9)]" : "bg-jcc-navy-light"
      }`}
    >
      {lead && <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-jcc-accent/20 blur-2xl" />}
      <div className={`relative ${KICK} ${lead ? "text-jcc-accent" : "text-jcc-text-muted"}`}>{label}</div>
      <div
        className={`relative mt-1.5 font-heading text-[1.8rem] font-extrabold leading-none tracking-[-0.04em] tabular-nums ${lead ? "" : "text-jcc-blue"}`}
        style={lead ? { backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 50%,#B98A2C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}
      >
        {value}
      </div>
      {sub != null && sub !== "" && <div className="relative"><RankNote sub={sub} lead={lead} /></div>}
    </div>
  );
}
/** A row of stat tiles; the first is the lead, set dark with a gold figure. */
function Kpis({ children }: { children: ReactNode }) {
  const arr = Children.toArray(children);
  const leadAt = arr.findIndex((c) => isValidElement(c));
  const items = arr.map((c, i) => (i === leadAt && isValidElement(c) ? cloneElement(c as React.ReactElement<{ lead?: boolean }>, { lead: true }) : c));
  return <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{items}</div>;
}
function Sec({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h3 className={`mb-3 flex items-center gap-3 ${KICK} text-jcc-accent-dark`}>
        {title}
        <span aria-hidden className="h-px flex-1 bg-jcc-border" />
      </h3>
      {children}
      {note && <p className="mt-2.5 text-xs leading-relaxed text-jcc-text-muted">{note}</p>}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-jcc-blue/15 bg-jcc-navy-light/50 px-4 py-10 text-center text-sm text-jcc-text-muted">{children}</div>;
}
function Legend({ items }: { items: [string, string, "box" | "line" | "dot"][] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map(([label, color, shape]) => (
        <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-jcc-navy-light px-2.5 py-1 font-mono text-[10.5px] text-jcc-blue/75">
          <span
            className={shape === "line" ? "h-3 w-[3px] rounded-sm" : shape === "dot" ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function Table({ head, rows, left = 1 }: { head: string[]; rows: ReactNode[][]; left?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-jcc-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-jcc-navy-light font-mono text-[10px] uppercase tracking-[0.12em] text-jcc-text-muted">
            {head.map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-3 py-2 font-semibold ${i < left ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="border-t border-jcc-border transition-colors hover:bg-jcc-navy-light/60">
              {r.map((c, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 tabular-nums ${i < left ? "text-left" : "text-right"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Splits as rows rather than a table: the strike rate is the bar, scaled to
 * the best split, and the best split is lit gold. Innings, runs and average
 * sit beside it.
 */
function SplitTable({ rows }: { rows: Split[] }) {
  const shown = rows.filter((r) => r.inns);
  if (!shown.length) return null;
  const maxSr = Math.max(1, ...shown.map((r) => r.sr ?? 0));
  const best = shown.reduce((a, b) => ((b.sr ?? 0) > (a.sr ?? 0) && b.balls >= 10 ? b : a), shown[0]);
  return (
    <div className="overflow-hidden rounded-2xl border border-jcc-border">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_56px_56px_64px] gap-4 bg-jcc-navy-light px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-jcc-text-muted sm:grid">
        <span>Split</span><span>Strike rate</span><span className="text-right">Inns</span><span className="text-right">Runs</span><span className="text-right">Avg</span>
      </div>
      {shown.map((r) => {
        const top = r === best && shown.length > 1;
        return (
          <div key={r.label} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-jcc-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_56px_56px_64px] sm:first:border-t ${top ? "bg-jcc-accent/[0.07]" : ""}`}>
            <span className="truncate text-[13px] font-semibold text-jcc-blue">
              {r.label}
              {top && <span className="ml-2 rounded-full bg-jcc-accent px-1.5 py-px font-mono text-[9px] font-semibold uppercase text-[#0B1424]">best</span>}
            </span>
            <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-jcc-blue/[0.06]">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, ((r.sr ?? 0) / maxSr) * 100)}%`, background: top ? "linear-gradient(90deg,#A97824,#F3C96A)" : "#12233F" }} />
              </span>
              <b className="w-10 text-right font-heading text-[15px] tabular-nums text-jcc-blue">{f0(r.sr)}</b>
            </span>
            <span className="hidden text-right font-mono text-[12px] tabular-nums text-jcc-text-muted sm:block">{r.inns}</span>
            <span className="text-right font-mono text-[12px] tabular-nums text-jcc-blue sm:text-jcc-text-muted">
              <span className="sm:hidden">{r.inns} inns · </span>{r.runs}<span className="sm:hidden"> runs · avg {f1(r.avg)}</span>
            </span>
            <span className="hidden text-right font-mono text-[12px] tabular-nums text-jcc-text-muted sm:block">{f1(r.avg)}</span>
          </div>
        );
      })}
    </div>
  );
}
/** Bowling splits: economy is the bar (shorter is better), best split gold. */
function BowlSplitTable({ rows }: { rows: BowlSplit[] }) {
  const shown = rows.filter((r) => r.spells);
  if (!shown.length) return null;
  const maxE = Math.max(1, ...shown.map((r) => r.econ ?? 0));
  const best = shown.reduce((a, b) => ((b.econ ?? 99) < (a.econ ?? 99) && b.balls >= 12 ? b : a), shown[0]);
  return (
    <div className="overflow-hidden rounded-2xl border border-jcc-border">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_56px_56px_64px] gap-4 bg-jcc-navy-light px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-jcc-text-muted sm:grid">
        <span>Split</span><span>Economy</span><span className="text-right">Overs</span><span className="text-right">Wkts</span><span className="text-right">Dots</span>
      </div>
      {shown.map((r) => {
        const top = r === best && shown.length > 1;
        return (
          <div key={r.label} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-jcc-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_56px_56px_64px] sm:first:border-t ${top ? "bg-jcc-accent/[0.07]" : ""}`}>
            <span className="truncate text-[13px] font-semibold text-jcc-blue">
              {r.label}
              {top && <span className="ml-2 rounded-full bg-jcc-accent px-1.5 py-px font-mono text-[9px] font-semibold uppercase text-[#0B1424]">tightest</span>}
            </span>
            <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-jcc-blue/[0.06]">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, ((r.econ ?? 0) / maxE) * 100)}%`, background: top ? "linear-gradient(90deg,#A97824,#F3C96A)" : "#12233F" }} />
              </span>
              <b className="w-10 text-right font-heading text-[15px] tabular-nums text-jcc-blue">{f2(r.econ)}</b>
            </span>
            <span className="hidden text-right font-mono text-[12px] tabular-nums text-jcc-text-muted sm:block">{ov(r.balls)}</span>
            <span className="text-right font-mono text-[12px] tabular-nums text-jcc-blue sm:text-jcc-text-muted">
              <span className="sm:hidden">{ov(r.balls)} ov · </span>{r.wk}<span className="sm:hidden"> wkts</span>
            </span>
            <span className="hidden text-right font-mono text-[12px] tabular-nums text-jcc-text-muted sm:block">{f0(r.dotPct)}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** A ranked list of people with a count bar — "dismissed by", "caught by". */
function PeopleList({ rows, unit }: { rows: { name: string; n: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="grid gap-1.5">
      {rows.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[22px_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-jcc-navy-light">
          <span className={`font-mono text-[11px] ${i === 0 ? "font-semibold text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
          <Avatar name={r.name} size={28} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-jcc-blue">{r.name}</span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-jcc-blue/[0.06]"><span className="block h-full rounded-full bg-jcc-blue" style={{ width: `${(r.n / max) * 100}%` }} /></span>
          </span>
          <span className="font-heading text-lg font-bold tabular-nums text-jcc-blue">{r.n}<span className="ml-1 font-mono text-[10px] font-normal text-jcc-text-muted">{unit}</span></span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Your value against the league's on one scale: a navy bar for you, a gold
 * marker for the league, and the gap written out — green when it's the good
 * side of the league, red when not, plain when neither is better.
 */
function Meter({ label, hint, v, lg, fmt, better }: { label: string; hint: string; v: number | null; lg: number | null; fmt: (n: number | null) => string; better: "high" | "low" | null }) {
  if (v == null) return null;
  const max = Math.max(v, lg ?? 0) * 1.15 || 1;
  const x = (n: number) => (n / max) * 100;
  const good = lg == null || better == null ? null : better === "high" ? v >= lg : v <= lg;
  const diff = lg == null ? null : v - lg;
  const pctOff = lg ? Math.round((100 * Math.abs(v - lg)) / Math.abs(lg)) : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 border-b border-jcc-border py-3.5 last:border-0 sm:grid-cols-[170px_minmax(0,1fr)_132px]">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold tracking-tight text-jcc-blue">{label}</div>
        <div className="text-[11px] text-jcc-text-muted">{hint}</div>
      </div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" role="img" aria-label={`${label}: ${fmt(v)}, league ${fmt(lg)}`}>
        <div className="relative h-7">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-jcc-blue/[0.06]" />
          <div
            className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
            style={{ width: `${x(v)}%`, background: good == null ? "#3B6FC4" : "#12233F" }}
          />
          <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${x(v)}%`, background: good == null ? "#3B6FC4" : good ? "#2E8B57" : BAD }} />
          {lg != null && (
            <div className="absolute inset-y-0 -translate-x-1/2" style={{ left: `${x(lg)}%` }}>
              <div className="mx-auto h-full w-[2px] rounded-full bg-jcc-accent" />
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-jcc-accent-dark">lg</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-heading text-xl font-bold leading-none tabular-nums tracking-tight text-jcc-blue">{fmt(v)}</div>
        {diff != null && (
          <>
            <div className={`mt-1 whitespace-nowrap font-mono text-[10.5px] font-semibold ${good == null ? "text-jcc-text-muted" : good ? "text-emerald-700" : "text-jcc-danger"}`}>
              {good == null ? "" : good ? "▲ " : "▼ "}
              {pctOff === 0 ? "level with league" : `${pctOff}% ${diff > 0 ? "above" : "below"}`}
            </div>
            <div className="whitespace-nowrap font-mono text-[10px] text-jcc-text-muted">league {fmt(lg)}</div>
          </>
        )}
      </div>
    </div>
  );
}

/** Your share against the league's, per category. */
function PairBars({ rows, who }: { rows: { label: string; pct: number; n: number; league: number }[]; who: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.pct, r.league]));
  return (
    <div>
      <Legend items={[[who, "#12233F", "box"], ["League", "#D4AF37", "line"]]} />
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[120px_minmax(0,1fr)_76px] items-center gap-3">
            <span className="text-[13px] font-semibold text-jcc-blue">{r.label}</span>
            <div className="relative h-6">
              <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-jcc-blue/[0.05]" />
              <div className="absolute inset-y-1 left-0 rounded-full bg-jcc-blue" style={{ width: `${Math.max(1.5, (r.pct / max) * 100)}%` }} />
              <div className="absolute inset-y-0 w-[2px] rounded-full bg-jcc-accent" style={{ left: `${(r.league / max) * 100}%` }} title={`League ${Math.round(r.league)}%`} />
            </div>
            <span className="text-right">
              <b className="font-heading text-[15px] tabular-nums text-jcc-blue">{Math.round(r.pct)}%</b>
              <span className="block font-mono text-[10px] text-jcc-text-muted">{r.n} · lg {Math.round(r.league)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type BarItem = { v: number; color: string; label?: string; top?: string; marks?: number; tip: ReactNode };
/**
 * One bar per innings / spell / dismissal, in order. A dashed gold line marks
 * the average; the bar under the pointer lifts and the rest dim.
 */
function BarChart({ items, min = 10, aria, setTip, avgLabel = "avg" }: { items: BarItem[]; min?: number; aria: string; setTip: SetTip; avgLabel?: string }) {
  const [hot, setHot] = useState<number | null>(null);
  if (!items.length) return null;
  const W = Math.max(560, items.length * 24), H = 220, L = 30, B = 22, T = 26;
  const max = Math.max(min, ...items.map((i) => i.v));
  const step = max > 60 ? 20 : max > 30 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - 4) / items.length;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  const avg = items.reduce((a, i) => a + i.v, 0) / items.length;
  const show = (e: React.PointerEvent, i: number, body: ReactNode) => {
    setHot(i);
    setTip({ x: e.clientX, y: e.clientY, body });
  };
  return (
    <div className="overflow-x-auto rounded-2xl bg-jcc-navy-light/60 p-3 [scrollbar-width:thin]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ minWidth: Math.min(W, 560) }} role="img" aria-label={aria} onPointerLeave={() => { setHot(null); setTip(null); }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(18,35,63,.06)" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#98A2B3">{t}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const x = L + i * bw + 2, w = Math.max(3, bw - 5), h = Math.max(it.v > 0 ? 2 : 0, y(0) - y(it.v));
          const dim = hot != null && hot !== i;
          return (
            <g key={i} style={{ opacity: dim ? 0.35 : 1, transition: "opacity .2s" }}>
              <rect x={x} y={y(0) - h} width={w} height={h} rx={Math.min(5, w / 2)} fill={it.color} />
              {it.top && <text x={x + w / 2} y={y(0) - h - 5} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--font-heading)" fill="#12233F">{it.top}</text>}
              {Array.from({ length: it.marks ?? 0 }, (_, k) => (
                <circle key={k} cx={x + w / 2} cy={y(0) - h - 8 - k * 9} r="3.6" fill={BAD} stroke="#fff" strokeWidth="1.5" />
              ))}
              {it.label && <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#98A2B3">{it.label}</text>}
              <rect
                x={L + i * bw} y={T - 16} width={bw} height={H - T - B + 16} fill="transparent"
                onPointerMove={(e) => show(e, i, it.tip)} onPointerDown={(e) => show(e, i, it.tip)}
              />
            </g>
          );
        })}
        <line x1={L} x2={W} y1={y(avg)} y2={y(avg)} stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="5 5" />
        <rect x={W - 74} y={y(avg) - 17} width="72" height="14" rx="7" fill="#0B1424" />
        <text x={W - 38} y={y(avg) - 7} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)" fill="#F3C96A">{avgLabel} {avg.toFixed(1)}</text>
      </svg>
    </div>
  );
}

function Percentile({ label, value, pct, hint }: { label: string; value: string; pct: number; hint: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-jcc-border py-2 last:border-0">
      <div>
        <span className="text-[13px] font-semibold text-white">{label}</span>
        <span className="ml-2 text-[11px] text-jcc-text-muted">{hint}</span>
      </div>
      <span className="text-[12px] tabular-nums text-jcc-text-muted">
        {value} · <b className="font-heading text-jcc-blue">{pct}</b>
        <span className="font-mono text-[10px]"> pct</span>
        <span className={`ml-2 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] ${pct >= 80 ? "bg-jcc-accent text-[#0B1424]" : pct >= 60 ? "bg-jcc-accent/15 text-jcc-accent-dark" : pct <= 30 ? "bg-jcc-danger/10 text-jcc-danger" : "bg-jcc-blue/[0.07] text-jcc-text-muted"}`}>
          {pct >= 80 ? "Elite" : pct >= 60 ? "Strong" : pct <= 30 ? "Weak spot" : "Average"}
        </span>
      </span>
      <div className="relative col-span-2 h-2.5 overflow-hidden rounded-full bg-jcc-blue/[0.07]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: pct >= 60 ? "linear-gradient(90deg,#A97824,#F3C96A)" : pct <= 30 ? BAD : "#12233F" }} />
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-jcc-blue/30" />
      </div>
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-jcc-navy-light p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${v === value ? "bg-[#0B1424] text-[#FFFFFF] shadow" : "text-jcc-blue/65 hover:text-jcc-blue"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const PHASE_STYLE: Record<string, { label: string; cls: string }> = {
  powerplay: { label: "Overs 1–2", cls: "bg-[#3B6FC4]/12 text-[#2B59C3]" },
  middle: { label: "Middle", cls: "bg-jcc-blue/[0.07] text-jcc-blue/70" },
  death: { label: "Last 2", cls: "bg-jcc-accent/20 text-jcc-accent-dark" },
};

// ─── Cards ───────────────────────────────────────────────────────────────────

type Card = { id: string; tab: string; kicker: string; title: string; body: ReactNode };

function Badges({ pr, all }: { pr: Profile; all?: boolean }) {
  const list = all ? pr.badges : pr.badges.slice(0, 8);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((b) => (
        <span key={b.label} title={b.why} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold ${TONE[b.tone]}`}>
          <span aria-hidden>{b.tone === "crown" ? "★" : b.tone === "warn" ? "⚠" : "●"}</span>
          {b.label}
        </span>
      ))}
      {!all && pr.badges.length > 8 && <span className="px-1 py-1.5 font-mono text-[11px] font-semibold text-jcc-text-muted">+{pr.badges.length - 8} more on Achievements</span>}
    </div>
  );
}

/** One opponent in a matchup list: who, how often they met, and the result. */
function MatchRow({ name, inns, wk, wkLabel, main, mainLabel, sub, bar, barGood }: { name: string; inns: number; wk: number; wkLabel: string; main: string; mainLabel: string; sub: string; bar: number; barGood: boolean }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-jcc-navy-light">
      <Avatar name={name} size={36} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-jcc-blue">{name}</span>
          {wk > 0 && <span className="shrink-0 rounded-full bg-jcc-danger/10 px-2 py-px font-mono text-[10px] font-semibold text-jcc-danger">{wkLabel} ×{wk}</span>}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-jcc-blue/[0.06] sm:w-40">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, bar))}%`, background: barGood ? "#2E8B57" : BAD }} />
          </span>
          <span className="truncate font-mono text-[10.5px] text-jcc-text-muted">{inns} inns · {sub}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="block font-heading text-lg font-bold leading-none tabular-nums text-jcc-blue">{main}</span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-jcc-text-muted">{mainLabel}</span>
      </span>
    </li>
  );
}

// Head to head, only what the scorecards prove: who dismissed whom, and how
// often they met. Runs, strike rates and economies in those innings cover the
// whole innings or spell, not the duel, so they stay out.
function MatchupsBatter({ pr }: { pr: Profile }) {
  const [by, setBy] = useState<"wk" | "met" | "never">("wk");
  const rows = [...pr.batting.matchups]
    .filter((e) => (by === "never" ? e.wk === 0 : true))
    .sort(by === "wk" ? (a, b) => b.wk - a.wk || b.wk / b.inns - a.wk / a.inns : (a, b) => b.inns - a.inns || a.wk - b.wk);
  return (
    <>
      <Toggle value={by} onChange={setBy} options={[["wk", "Got you most"], ["met", "Faced most"], ["never", "Never got you"]]} />
      <ol className="grid gap-1">
        {rows.map((e) => (
          <MatchRow
            key={e.p}
            name={pr.nameOf(e.p)}
            inns={e.inns}
            wk={e.wk}
            wkLabel="got you"
            main={`${Math.round((100 * e.wk) / e.inns)}%`}
            mainLabel="out to them"
            sub={e.wk ? `out ${e.wk} of ${e.inns}` : "never out to them"}
            bar={(100 * e.wk) / e.inns}
            barGood={e.wk === 0}
          />
        ))}
      </ol>
    </>
  );
}
function MatchupsBowler({ pr }: { pr: Profile }) {
  const [by, setBy] = useState<"wk" | "met" | "ducks">("wk");
  const rows = [...pr.bowling.matchups]
    .filter((e) => (by === "ducks" ? e.ducks > 0 : true))
    .sort(by === "met" ? (a, b) => b.inns - a.inns || b.wk - a.wk : by === "ducks" ? (a, b) => b.ducks - a.ducks || b.wk - a.wk : byScalp);
  return (
    <>
      <Toggle value={by} onChange={setBy} options={[["wk", "You got most"], ["met", "Bowled at most"], ["ducks", "Sent back for ducks"]]} />
      <ol className="grid gap-1">
        {rows.map((e) => (
          <MatchRow
            key={e.p}
            name={pr.nameOf(e.p)}
            inns={e.inns}
            wk={e.wk}
            wkLabel="you got"
            main={`${Math.round((100 * e.wk) / e.inns)}%`}
            mainLabel="you got them"
            sub={`${e.wk ? `got them ${e.wk} of ${e.inns}` : "not dismissed yet"}${e.ducks ? ` · ${e.ducks} duck${e.ducks > 1 ? "s" : ""}` : ""}`}
            bar={(100 * e.wk) / e.inns}
            barGood={e.wk > 0}
          />
        ))}
      </ol>
    </>
  );
}

function TipList({ tips }: { tips: Profile["tips"]["batting"] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {tips.map((t, i) => (
        <li key={t.title} className="relative overflow-hidden rounded-[22px] border border-jcc-border bg-jcc-navy p-5 transition-shadow hover:shadow-[0_20px_40px_-28px_rgba(18,35,63,0.5)]">
          <span aria-hidden className="pointer-events-none absolute -right-2 -top-5 font-heading text-[5.5rem] font-extrabold leading-none text-jcc-blue/[0.05]">{i + 1}</span>
          <div className="relative flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0B1424] font-heading text-sm font-bold text-jcc-accent">{i + 1}</span>
            <h4 className="font-heading text-lg font-bold leading-tight tracking-[-0.02em] text-jcc-blue">{t.title}</h4>
          </div>
          <dl className="relative mt-4 space-y-2.5 text-[13px] leading-relaxed">
            <div>
              <dt className={`${KICK} text-jcc-text-muted`}>Why</dt>
              <dd className="text-jcc-blue/80">{t.why}</dd>
            </div>
            <div className="rounded-xl bg-jcc-accent/10 px-3 py-2.5">
              <dt className={`${KICK} text-jcc-accent-dark`}>Next step</dt>
              <dd className="font-medium text-jcc-blue">{t.next}</dd>
            </div>
          </dl>
          {t.target && <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#0B1424] px-3 py-1 font-mono text-[10.5px] font-semibold text-jcc-accent">🎯 Target: {t.target}</p>}
        </li>
      ))}
    </ol>
  );
}

type MoMView = ReturnType<typeof momAnalytics>;
type Battles = ReturnType<typeof keyBattles>;

function buildCards(pr: Profile, scopeLabel: string, setTip: SetTip, holders: Map<string, number>, momA: MoMView, onOpenMatch: (id: string) => void, battles: Battles, names: string[]): Card[] {
  const b = pr.B, w = pr.W, LB = pr.league.LB, LW = pr.league.LW;
  const rk = (r: { rank: number; of: number } | null) => (r ? `#${r.rank} of ${r.of}` : undefined);
  const cards: Card[] = [];
  const color = teamByName(pr.team)?.primary ?? "#12233F";

  cards.push({
    id: "overview", tab: "Overview", kicker: `${scopeLabel} · Overview`, title: "Your game at a glance",
    body: (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-jcc-border bg-jcc-navy px-3 py-1.5 font-semibold text-jcc-blue">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {pr.teams.join(" · ")}
          </span>
          <span className="rounded-full border border-jcc-border px-3 py-1.5 text-jcc-blue/80">{pr.role}</span>
          <span className="rounded-full border border-jcc-border px-3 py-1.5 text-jcc-blue/80">{plural(pr.matches, "match", "matches")}</span>
          {pr.mom.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-jcc-accent px-3 py-1.5 font-bold text-[#0B1424]" title={pr.mom.map((x) => `${fmtDate(x.date)} v ${x.opp}: ${x.line}`).join("\n")}>
              🏆 {pr.mom.length}× Player of the Match
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-jcc-border px-3 py-1.5 text-jcc-blue/80" title={`Played ${pr.attendance.present} of your team's ${pr.attendance.teamMatches} matches`}>
            Attendance
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-jcc-blue/10"><span className="block h-full rounded-full bg-jcc-blue" style={{ width: `${pr.attendance.pct}%` }} /></span>
            <b className="font-heading text-jcc-blue">{pr.attendance.pct}%</b>
          </span>
        </div>
        <div className="mb-4"><Badges pr={pr} /></div>
        {b.inns > 0 && (
          <Kpis>
            <Kpi label="Runs" value={b.runs} sub={rk(pr.ranks.runs)} />
            <Kpi label="Strike rate" value={f1(b.sr)} sub={rk(pr.ranks.sr) ?? "under 30 balls"} />
            <Kpi label="Average" value={f1(b.avg)} sub={`${b.inns} inns · ${b.no} not out`} />
            <Kpi label="Highest" value={b.hs} sub={`${b.f4} fours · ${b.s6} sixes`} />
          </Kpis>
        )}
        {w.spells > 0 && (
          <Kpis>
            <Kpi label="Wickets" value={w.wk} sub={rk(pr.ranks.wk)} />
            <Kpi label="Economy" value={f2(w.econ)} sub={rk(pr.ranks.econ) ?? "under 30 balls"} />
            <Kpi label="Dot balls" value={w.dots} sub={`${f0(w.dotPct)}% of balls`} />
            <Kpi label="Best" value={w.best} sub={`${ov(w.balls)} overs`} />
          </Kpis>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {([
            ["good", "Strengths", pr.insights.good, [{ title: "Too early to call", body: "Not enough balls yet to name a strength." }]],
            ["bad", "Work-ons", pr.insights.bad, [{ title: "Nothing stands out", body: "No clear weakness in the numbers yet." }]],
          ] as const).map(([k, label, list, fallback]) => {
            const good = k === "good";
            const rows = list.length ? list : fallback;
            return (
              <section key={k} className={`rounded-[22px] border p-5 ${good ? "border-emerald-600/15 bg-emerald-600/[0.04]" : "border-jcc-danger/15 bg-jcc-danger/[0.035]"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-heading text-lg font-bold tracking-[-0.02em] ${good ? "text-emerald-800" : "text-jcc-danger"}`}>{label}</h3>
                  <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 font-mono text-[11px] font-semibold ${good ? "bg-emerald-600/15 text-emerald-800" : "bg-jcc-danger/10 text-jcc-danger"}`}>{list.length}</span>
                </div>
                <ul className="mt-3 divide-y divide-jcc-blue/[0.06]">
                  {rows.map((n) => (
                    <li key={n.title} className="flex gap-3 py-3 first:pt-1 last:pb-0">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-[#FFFFFF] ${good ? "bg-emerald-600" : "bg-jcc-danger"}`}>{good ? "✓" : "!"}</span>
                      <span className="text-[13px] leading-relaxed text-jcc-text-muted">
                        <b className="block font-semibold text-jcc-blue">{n.title}</b>
                        {n.body}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        {pr.insights.info.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {pr.insights.info.map((n) => (
              <li key={n.title} className="rounded-2xl bg-jcc-navy-light px-4 py-3 text-[13px] text-jcc-text-muted"><b className="text-jcc-blue">{n.title}.</b> {n.body}</li>
            ))}
          </ul>
        )}
      </>
    ),
  });

  cards.push({
    id: "next", tab: "Next steps", kicker: "Coaching", title: "How to improve next season",
    body: (
      <>
        {pr.tips.batting.length > 0 && <Sec title="Batting"><TipList tips={pr.tips.batting} /></Sec>}
        {pr.tips.bowling.length > 0 && <Sec title="Bowling"><TipList tips={pr.tips.bowling} /></Sec>}
        {!pr.tips.batting.length && !pr.tips.bowling.length && <Empty>No batting or bowling yet in {scopeLabel}.</Empty>}
        <p className="mt-4 text-xs text-jcc-text-muted">Suggestions come from the scorecard numbers only. A coach watching the player will see things the scorecard can&apos;t.</p>
      </>
    ),
  });

  cards.push({
    id: "labels", tab: "Achievements", kicker: pr.dna.tags.length ? `Player type · ${pr.dna.tags.join(" · ")}` : "Player type", title: `${plural(pr.badges.length, "achievement")} unlocked`,
    body: (
      <>
        <Sec title="Badges">
          <AchievementStyles />
          {pr.badges.length ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#0B1424] px-3 py-1.5 font-mono text-[11px] font-semibold text-jcc-accent">{pr.badges.length} unlocked</span>
                {pr.badges.some((bd) => (holders.get(bd.label) ?? 1) <= 2) && (
                  <span className="rounded-full bg-jcc-accent/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-jcc-accent-dark">
                    {pr.badges.filter((bd) => (holders.get(bd.label) ?? 1) <= 2).length} rare · held by 2 or fewer
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...pr.badges]
                  .sort((a, b) => (holders.get(a.label) ?? 1) - (holders.get(b.label) ?? 1))
                  .map((bd, i) => {
                    const n = holders.get(bd.label) ?? 1;
                    const tier = tierOf(bd.tone, n);
                    const rare = n <= 2;
                    return (
                      <div
                        key={bd.label}
                        className={`ach-tile relative flex flex-col items-center overflow-hidden rounded-[22px] p-4 text-center transition-transform duration-300 hover:-translate-y-1 ${rare ? "bg-[#0B1424] shadow-[0_20px_40px_-24px_rgba(11,20,36,0.9)]" : "border border-jcc-border bg-jcc-navy-light/60"}`}
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        {rare && <div aria-hidden className="pointer-events-none absolute -top-10 h-28 w-28 rounded-full bg-jcc-accent/25 blur-2xl" />}
                        <div className="relative"><Emblem label={bd.label} tone={bd.tone} tier={tier} size={68} /></div>
                        <div className="relative mt-2"><TierChip tier={tier} /></div>
                        <div className={`relative mt-2 font-heading text-[15px] font-bold leading-tight ${rare ? "text-[#FFFFFF]" : "text-jcc-blue"}`}>{bd.label}</div>
                        <div className={`relative mt-1 text-[11.5px] leading-snug ${rare ? "text-[rgba(255,255,255,0.62)]" : "text-jcc-text-muted"}`}>{bd.why}</div>
                        <div className={`relative mt-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${rare ? "bg-jcc-accent text-[#0B1424]" : "bg-jcc-blue/[0.06] text-jcc-blue/70"}`}>
                          {n === 1 ? "Only you" : `${n} players hold this`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : <Empty>No achievements yet. They unlock with more balls faced or bowled.</Empty>}
        </Sec>
        {pr.dna.batting.length > 0 && (
          <Sec title="Batting DNA" note="Percentile among players with 30+ balls faced. 100 is the best in the league; the centre line is the median.">
            <div className="rounded-2xl border border-jcc-border px-4 py-1">{pr.dna.batting.map((a) => <Percentile key={a.label} {...a} />)}</div>
          </Sec>
        )}
        {pr.dna.bowling.length > 0 && (
          <Sec title="Bowling DNA" note="Percentile among players with 30+ balls bowled. 100 is the best in the league; the centre line is the median.">
            <div className="rounded-2xl border border-jcc-border px-4 py-1">{pr.dna.bowling.map((a) => <Percentile key={a.label} {...a} />)}</div>
          </Sec>
        )}
      </>
    ),
  });

  if (b.inns) {
    cards.push({
      id: "scoring", tab: "Scoring", kicker: "Batting · Aggression", title: "How you score",
      body: (
        <>
          <Kpis>
            <Kpi label="Fours" value={b.f4} />
            <Kpi label="Sixes" value={b.s6} sub={rk(pr.ranks.six)} />
            <Kpi label="20+ / 30+ / 50+" value={`${b.t20}/${b.t30}/${b.t50}`} />
            <Kpi label="Dot balls faced (min)" value={b.dots} sub={`${f0(b.dotPct)}% of balls`} />
          </Kpis>
          <Sec title="Against the league" note="Scorecards don't record batters' dot balls. The minimum counts every non-boundary run as a single, so the real figure is this or higher.">
            <Meter label="Strike rate" hint="Runs per 100 balls" v={b.sr} lg={LB.sr} fmt={f1} better="high" />
            <Meter label="Balls per boundary" hint="Lower means more often" v={b.bpb} lg={LB.bpb} fmt={f2} better="low" />
            <Meter label="Sixes per 100 balls" hint="Power" v={b.six100} lg={LB.six100} fmt={f1} better="high" />
            <Meter label="Runs from boundaries" hint="Share of your runs" v={b.bndPct} lg={LB.bndPct} fmt={(n) => `${f0(n)}%`} better={null} />
            <Meter label="SR without boundaries" hint="Singles and twos" v={b.nbSR} lg={LB.nbSR} fmt={f1} better="high" />
            <Meter label="Dot balls faced (min)" hint="Lower is better" v={b.dotPct} lg={LB.dotPct} fmt={(n) => `${f0(n)}%`} better="low" />
            <Meter label="Batting average" hint="Runs per dismissal" v={b.avg} lg={LB.avg} fmt={f1} better="high" />
          </Sec>
        </>
      ),
    });

    const bt = pr.batting;
    cards.push({
      id: "dismissals", tab: "Dismissals", kicker: "Batting · Dismissals", title: "How you get out",
      body: bt.outs ? (
        <>
          <Kpis>
            <Kpi label="Dismissals" value={bt.outs} sub={`${b.no} not outs`} />
            <Kpi label="Out in ≤6 balls" value={bt.quick} sub={`${f0((100 * bt.quick) / bt.outs)}% of dismissals`} />
            <Kpi label="First wicket to fall" value={bt.firstWicket} sub={`of ${bt.outs}`} />
            <Kpi label="Keeper involved" value={bt.keeper} sub="caught behind or stumped" />
          </Kpis>
          <Sec title="Dismissal types"><PairBars rows={bt.kinds} who="You" /></Sec>
          <Sec title="Balls faced when out" note={`Each bar is one dismissal, shortest first. ${bt.inFirstTwoOvers} came in the first 2 overs of the innings.`}>
            <BarChart setTip={setTip} aria="Balls faced in each dismissal" items={bt.ballsWhenOut.map((v) => ({ v, color: MARK, tip: `Out after ${plural(v, "ball")}` }))} />
          </Sec>
          <div className="grid gap-4 md:grid-cols-2">
            <Sec title="Dismissed by">
              {bt.dismissedBy.length ? <PeopleList unit="×" rows={bt.dismissedBy.map((e) => ({ name: pr.nameOf(e.p), n: e.n }))} /> : <Empty>No bowler credited.</Empty>}
            </Sec>
            <Sec title="Caught or stumped by">
              {bt.caughtBy.length ? <PeopleList unit="×" rows={bt.caughtBy.map((e) => ({ name: pr.nameOf(e.p), n: e.n }))} /> : <Empty>Never caught.</Empty>}
            </Sec>
          </div>
        </>
      ) : <Empty>Never dismissed in {scopeLabel}.</Empty>,
    });

    cards.push({
      id: "ducks", tab: "Ducks", kicker: "Batting · Ducks",
      title: b.ducks ? `${plural(b.ducks, "duck")} in ${b.inns} innings` : `No ducks in ${b.inns} innings`,
      body: (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {DUCKS.map((t) => {
              const n = bt.duckCounts[t.key];
              return (
                <div key={t.key} className={`relative overflow-hidden rounded-2xl p-4 ${n ? "bg-[#0B1424]" : "bg-jcc-navy-light"}`}>
                  <span aria-hidden className={`absolute -right-3 -top-3 text-6xl ${n ? "opacity-20" : "opacity-[0.06]"}`}>🦆</span>
                  <div className={`relative font-heading text-4xl font-extrabold leading-none tracking-[-0.04em] ${n ? "text-jcc-accent" : "text-jcc-blue/30"}`}>{n}</div>
                  <div className={`relative mt-2 text-[13px] font-bold ${n ? "text-[#FFFFFF]" : "text-jcc-blue"}`}>{t.label}</div>
                  <div className={`relative text-[11.5px] ${n ? "text-[rgba(255,255,255,0.62)]" : "text-jcc-text-muted"}`}>{t.rule}</div>
                  <div className={`relative mt-1.5 font-mono text-[10px] ${n ? "text-[rgba(255,255,255,0.45)]" : "text-jcc-text-muted"}`}>League: {pr.league.ld[t.key] ?? 0}</div>
                </div>
              );
            })}
          </div>
          {bt.duckList.length > 0 && (
            <Sec title="Every duck">
              <Table left={3} head={["Date", "Type", "Against", "Balls", "How out"]} rows={bt.duckList.map((r) => [`${fmtDate(r.date)} · S${r.season}`, DUCKS.find((t) => t.key === r.type)!.label, r.opp, r.balls, r.how])} />
            </Sec>
          )}
          <p className="mt-3 text-xs text-jcc-text-muted">Platinum is read from the fall-of-wicket record (out to ball 0.1). Retired-out zeros don&apos;t count.</p>
        </>
      ),
    });

    cards.push({
      id: "innings", tab: "Innings", kicker: "Batting · Every innings", title: "Innings by innings",
      body: (
        <>
          <Kpis>
            <Kpi label="Innings" value={b.inns} sub={`${b.no} not out`} />
            <Kpi label="Highest" value={b.hs} sub={`${b.t20} scores of 20+`} />
            <Kpi label="Per innings" value={f1(b.inns ? b.runs / b.inns : null)} sub="runs" />
            <Kpi label="Balls per innings" value={f1(b.inns ? b.balls / b.inns : null)} sub="faced" />
          </Kpis>
          {bt.log.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className={`${KICK} mr-1 text-jcc-text-muted`}>Last {Math.min(6, bt.log.length)}</span>
              {bt.log.slice(-6).map((r, i) => (
                <span
                  key={i}
                  title={`${fmtDate(r.date)} vs ${r.opp}: ${r.runs}${r.out ? "" : "*"} (${r.balls})`}
                  className={`grid h-10 min-w-10 place-items-center rounded-xl px-2 font-heading text-sm font-bold tabular-nums ${r.runs >= 20 ? "bg-jcc-accent text-[#0B1424]" : r.runs >= 10 ? "bg-[#0B1424] text-[#FFFFFF]" : "bg-jcc-navy-light text-jcc-blue/70"}`}
                >
                  {r.runs}{r.out ? "" : "*"}
                </span>
              ))}
              <span className="font-mono text-[10px] text-jcc-text-muted">oldest → newest</span>
            </div>
          )}
          <Legend items={[["Out", MARK, "box"], ["Not out", MARK_2, "box"], ["Average", "#D4AF37", "line"]]} />
          <BarChart
            setTip={setTip} min={20} aria="Runs in each innings, in date order"
            items={bt.log.map((r) => ({
              v: r.runs, color: r.out ? MARK : MARK_2, label: fmtDate(r.date).split(" ")[0],
              top: r.runs >= 25 ? `${r.runs}${r.out ? "" : "*"}` : undefined,
              tip: (
                <>
                  <b>{r.runs}{r.out ? "" : "*"} ({r.balls})</b> · {r.f4}×4 {r.s6}×6<br />
                  {fmtDate(r.date)} · S{r.season} · vs {r.opp}<br />
                  {r.how}<br />
                  {r.chasing ? "Chasing" : "Batting first"} · #{r.pos} · {r.won ? "Won" : "Lost"}
                </>
              ),
            }))}
          />
          <p className="mb-4 text-xs text-jcc-text-muted">Hover or tap a bar for the scorecard line.</p>
          <Sec title="The first 10 balls"><SplitTable rows={bt.first10} /></Sec>
        </>
      ),
    });

    cards.push({
      id: "splits", tab: "Splits", kicker: "Batting · Splits", title: "Where and when you score",
      body: (
        <>
          <Sec title="Situation"><SplitTable rows={bt.situation} /></Sec>
          {bt.seasons.length > 0 && <Sec title="Season"><SplitTable rows={bt.seasons} /></Sec>}
          <Sec title="Opponent"><SplitTable rows={bt.opponents} /></Sec>
          <Sec title="Batting position" note={`You made ${f0(bt.teamShare)}% of your team's runs in the innings you batted.`}><SplitTable rows={bt.positions} /></Sec>
        </>
      ),
    });

    cards.push({
      id: "vs-bowlers", tab: "Vs bowlers", kicker: "Batting · Matchups", title: "Bowlers against you",
      body: bt.matchups.length ? (
        <>
          <MatchupsBatter pr={pr} />
          <p className="mt-2 text-xs leading-relaxed text-jcc-text-muted">A meeting is an innings where they bowled while you batted. Only dismissals are counted: the scorecards don&apos;t record which bowler each run came off. Listed: bowled in 2+ of your innings, or dismissed you.</p>
        </>
      ) : <Empty>Not enough innings to compare bowlers yet.</Empty>,
    });
  }

  if (w.spells) {
    const bw = pr.bowling;
    cards.push({
      id: "bowling", tab: "Bowling", kicker: "Bowling · Overview", title: "With the ball",
      body: (
        <>
          <Kpis>
            <Kpi label="Overs" value={ov(w.balls)} sub={plural(w.spells, "spell")} />
            <Kpi label="Wickets" value={w.wk} sub={rk(pr.ranks.wk)} />
            <Kpi label="Economy" value={f2(w.econ)} sub={rk(pr.ranks.econ) ?? "under 30 balls"} />
            <Kpi label="Dot balls" value={w.dots} sub={`${f0(w.dotPct)}% · ${rk(pr.ranks.dot) ?? ""}`} />
            <Kpi label="Average" value={f1(w.avg)} />
            <Kpi label="Strike rate" value={f1(w.sr)} sub="balls per wicket" />
            <Kpi label="Best" value={w.best} sub={`${w.hauls2} spells of 2+ wkts`} />
            <Kpi label="Extras" value={`${w.wd} wd · ${w.nb} nb`} sub={plural(w.mdn, "maiden")} />
          </Kpis>
          <Sec title="Against the league">
            <Meter label="Economy" hint="Runs per over, lower is better" v={w.econ} lg={LW.econ} fmt={f2} better="low" />
            <Meter label="Strike rate" hint="Balls per wicket, lower is better" v={w.sr} lg={LW.sr} fmt={f1} better="low" />
            <Meter label="Dot balls" hint="Share of balls" v={w.dotPct} lg={LW.dotPct} fmt={(n) => `${f0(n)}%`} better="high" />
            <Meter label="Wides per over" hint="Lower is better" v={w.wdo} lg={LW.wdo} fmt={f2} better="low" />
          </Sec>
          <Sec title="Every spell">
            <Legend items={[["Runs conceded", MARK, "box"], ["Wicket", BAD, "dot"]]} />
            <BarChart
              setTip={setTip} min={20} aria="Runs conceded in each spell"
              items={bw.spells.map((r) => ({
                v: r.runs, color: MARK, marks: r.wk, label: fmtDate(r.date).split(" ")[0],
                tip: (
                  <>
                    <b>{ov(r.balls)}-{r.mdn}-{r.runs}-{r.wk}</b><br />
                    {fmtDate(r.date)} · S{r.season} · vs {r.opp}<br />
                    {r.dots} dots · {r.wd} wides · {r.nb} no-balls<br />
                    Economy {f2(r.balls ? (6 * r.runs) / r.balls : null)} · {r.won ? "Won" : "Lost"}
                  </>
                ),
              }))}
            />
          </Sec>
          <Sec title="By opponent"><BowlSplitTable rows={bw.opponents} /></Sec>
          {bw.seasons.length > 0 && <Sec title="By season"><BowlSplitTable rows={bw.seasons} /></Sec>}
        </>
      ),
    });

    cards.push({
      id: "wickets", tab: "Wickets", kicker: "Bowling · Wickets", title: w.wk ? `Every wicket (${bw.wickets.length})` : "Wickets",
      body: (
        <>
          {bw.wickets.length ? (
            <>
              <Kpis>
                <Kpi label="First 2 overs" value={pr.phase.powerplay} sub={rk(pr.ranks.pp) ?? "wickets"} />
                <Kpi label="Middle overs" value={pr.phase.middle} sub="wickets" />
                <Kpi label="Last 2 overs" value={pr.phase.death} sub={rk(pr.ranks.death) ?? "wickets"} />
                <Kpi label="Ducks taken" value={bw.ducksTaken} />
              </Kpis>
              <Sec title="Wicket by wicket">
                <ol className="relative ml-3 border-l-2 border-jcc-border">
                  {bw.wickets.map((r, i) => {
                    const ph = r.phase ? PHASE_STYLE[r.phase] : null;
                    return (
                      <li key={i} className="relative pb-4 pl-6 last:pb-0">
                        <span className="absolute -left-[9px] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-jcc-danger shadow" />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Avatar name={r.batter} size={22} />
                          <b className="text-[13.5px] text-jcc-blue">{r.batter}</b>
                          <span className="text-[12px] text-jcc-text-muted">{r.batterTeam}</span>
                          <span className="font-heading text-[13px] font-bold tabular-nums text-jcc-blue">{r.score}</span>
                          {ph && <span className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${ph.cls}`}>{ph.label}</span>}
                          {r.duck && <span className="rounded-full bg-jcc-accent px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-[#0B1424]">{DUCKS.find((t) => t.key === r.duck)!.label} duck</span>}
                        </div>
                        <p className="mt-1 text-[12px] text-jcc-text-muted">
                          {r.how} · <span className="font-mono text-[11px]">{fmtDate(r.date)} · S{r.season}{r.fow ? ` · ${r.fow}` : ""}</span>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </Sec>
              <Sec title="How your wickets fall"><PairBars rows={bw.victimKinds} who="You" /></Sec>
            </>
          ) : <Empty>No wickets yet in {scopeLabel}.</Empty>}
          {bw.matchups.length > 0 && (
            <Sec title="Batters against you" note="A meeting is an innings where you bowled while they batted. Only dismissals are counted: the scorecards don't record which bowler each run came off.">
              <MatchupsBowler pr={pr} />
            </Sec>
          )}
        </>
      ),
    });
  }

  if (pr.F.total) {
    cards.push({
      id: "fielding", tab: "Fielding", kicker: "Fielding", title: "In the field",
      body: (
        <>
          <Kpis>
            <Kpi label="Dismissals" value={pr.F.total} sub={rk(pr.ranks.field)} />
            <Kpi label="Catches" value={pr.F.c} sub={pr.F.kc ? `${pr.F.kc} as keeper` : undefined} />
            <Kpi label="Run outs" value={pr.F.ro} sub="involved in" />
            <Kpi label="Stumpings" value={pr.F.st} />
          </Kpis>
          <Sec title="Every dismissal you were part of">
            <ol className="grid gap-1.5">
              {pr.fielding.map((r, i) => (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-jcc-navy-light">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl font-mono text-[10px] font-semibold uppercase ${r.kind === "ro" ? "bg-[#2E8B57]/12 text-[#24774A]" : r.kind === "st" ? "bg-jcc-accent/20 text-jcc-accent-dark" : "bg-[#0B1424] text-jcc-accent"}`}>
                    {r.kind === "ro" ? "RO" : r.kind === "st" ? "ST" : "CT"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-jcc-blue">{r.batter}</span>
                    <span className="block truncate text-[12px] text-jcc-text-muted">{KIND_LABEL[r.kind]}{r.keeper ? " (keeper)" : ""} · {r.how}</span>
                  </span>
                  <span className="font-mono text-[11px] text-jcc-text-muted">{fmtDate(r.date)}</span>
                </li>
              ))}
            </ol>
          </Sec>
        </>
      ),
    });
  }

  const myAwards = momA.awards.filter((a) => a.p === pr.p);
  const myRunnerUps = momA.awards.filter((a) => a.runnerUp?.p === pr.p);
  if (myAwards.length || myRunnerUps.length) {
    const row = momA.leaderboard.find((r) => r.p === pr.p);
    const rank = row ? momA.leaderboard.findIndex((r) => r.p === pr.p) + 1 : null;
    const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
    cards.push({
      id: "awards", tab: "Awards", kicker: "Player of the Match",
      title: myAwards.length ? `${plural(myAwards.length, "award")}${rank ? ` · #${rank} in the league` : ""}` : "Still chasing a first award",
      body: (
        <>
          <Kpis>
            <Kpi label="Awards" value={myAwards.length} sub={rank ? `#${rank} of ${momA.leaderboard.length} winners` : "none yet"} />
            <Kpi label="Award rate" value={row ? `${Math.round(row.rate)}%` : "0%"} sub={`of your ${pr.matches} matches`} />
            <Kpi label="Runner-up" value={myRunnerUps.length} sub="times second-best" />
            <Kpi label="Best streak" value={row?.streak ?? 0} sub="awards in a row" />
          </Kpis>
          {row && (
            <Sec title="What won them">
              <div className="flex h-4 gap-[3px] overflow-hidden rounded-full">
                {(Object.keys(row.types) as AwardType[]).filter((t) => row.types[t]).map((t) => <div key={t} style={{ flexGrow: row.types[t], background: TYPE_COLOR[t] }} />)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(row.types) as AwardType[]).filter((t) => row.types[t]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-2 rounded-full bg-jcc-navy-light py-1 pl-1 pr-3"><TypeChip type={t} /><b className="font-heading text-[14px] text-jcc-blue">{row.types[t]}</b></span>
                ))}
              </div>
            </Sec>
          )}
          {myAwards.length > 0 && (
            <Sec title="Every award" note="Tap a row for the full scorecard.">
              <div className="grid gap-2">
                {myAwards.map((a) => (
                  <button key={a.m} onClick={() => onOpenMatch(a.matchId)} className="group flex items-start gap-4 rounded-[20px] bg-[#0B1424] p-4 text-left shadow-[0_18px_40px_-26px_rgba(11,20,36,0.9)] transition hover:-translate-y-0.5 [&_b]:!text-[#FFFFFF] [&_.text-jcc-text-muted]:!text-[rgba(255,255,255,0.6)]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-jcc-accent-highlight to-jcc-accent-dark text-lg">🏆</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <b className="text-white">{a.line}</b>
                        <TypeChip type={a.type} />
                        {!a.winner && <span className="rounded-full bg-jcc-danger/10 px-2 py-0.5 text-[10.5px] font-bold text-jcc-danger">losing side</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-jcc-text-muted">
                        v {a.opp} · {fmtDate(a.date)} S{a.season} · {a.result}
                        {a.runnerUp && <> · beat {pr.nameOf(a.runnerUp.p)} by {a.margin.toFixed(1)}</>}
                      </div>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-heading text-xl font-bold tabular-nums text-jcc-accent">{sgn(a.score)}</span>
                      <span className="font-mono text-[9.5px] uppercase text-[rgba(255,255,255,0.5)]">impact</span>
                    </span>
                  </button>
                ))}
              </div>
            </Sec>
          )}
          {myRunnerUps.length > 0 && (
            <Sec title="So close" note="Matches where you finished second.">
              <Table
                left={3}
                head={["Date", "Against", "Award went to", "Your line", "Gap"]}
                rows={myRunnerUps.map((a) => [
                  `${fmtDate(a.date)} · S${a.season}`,
                  a.team === pr.team ? a.opp : a.team,
                  <button key="w" onClick={() => onOpenMatch(a.matchId)} className="font-semibold text-white hover:text-jcc-accent-dark">{pr.nameOf(a.p)}</button>,
                  a.runnerUp!.line,
                  a.margin.toFixed(1),
                ])}
              />
            </Sec>
          )}
        </>
      ),
    });
  }

  const mine = battles.filter((x) => x.batter === pr.p || x.bowler === pr.p);
  if (mine.length) {
    cards.push({
      id: "battles", tab: "Battles", kicker: "Key battles", title: `${plural(mine.length, "hot battle")}`,
      body: (
        <>
          <ol className="grid gap-4">
            {mine.map((x) => {
              const batting = x.batter === pr.p;
              const opp = batting ? x.bowler : x.batter;
              const story = battleStory(x, names);
              return (
                <li key={`${x.batter}-${x.bowler}`} className="rounded-[22px] border border-jcc-border bg-jcc-navy-light/50 p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={names[opp]} size={44} ring={teamByName(batting ? x.bowlTeam : x.batTeam)?.primary ?? "#A97824"} />
                    <div className="min-w-0 flex-1">
                      <div className={`${KICK} ${batting ? "text-[#2B59C3]" : "text-[#7A4FB8]"}`}>{batting ? "You bat · they bowl" : "You bowl · they bat"}</div>
                      <div className="truncate font-heading text-lg font-bold tracking-[-0.02em] text-jcc-blue">{names[opp]}</div>
                      <div className="text-[12.5px] text-jcc-text-muted">{story.headline} · {x.meetings.length} meetings since {story.since}</div>
                    </div>
                  </div>
                  <div className="mt-3"><TugOfWar b={x} names={names} /></div>
                  <div className="mt-3"><MeetingStrip b={x} size={18} /></div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-jcc-text-muted">
            One rope segment per meeting: team colour when the batter survived the bowler, gold when the bowler struck; the knot sits where they meet. Runs shown are the whole innings.
          </p>
        </>
      ),
    });
  }

  cards.push({
    id: "chances", tab: "Opportunity", kicker: "Opportunity", title: "How many chances you get",
    body: (
      <>
        <Kpis>
          <Kpi label="Attendance" value={`${pr.attendance.present}/${pr.attendance.teamMatches}`} sub={`${pr.attendance.pct}% of your team's matches${pr.attendance.guest ? ` · +${pr.attendance.guest} as guest` : ""}`} />
          <Kpi label="Batted in" value={pr.chances.battedIn} sub={`avg position ${f1(pr.chances.avgPos)}`} />
          <Kpi label="Balls faced / match" value={f1(pr.chances.ballsPerMatch)} sub={`team avg ${f1(pr.chances.teamBallsPerMatch)}`} />
          <Kpi label="Bowled in" value={`${f0(pr.chances.bowlShare)}%`} sub={`${f1(pr.chances.oversPerMatch)} overs / match`} />
        </Kpis>
        <Sec title="Your share of the action">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Balls faced a match", you: pr.chances.ballsPerMatch, team: pr.chances.teamBallsPerMatch, fmt: f1 },
              { label: "Matches you bowl in", you: pr.chances.bowlShare, team: 100, fmt: (n: number | null) => `${f0(n)}%` },
            ].map((m) => {
              const max = Math.max(m.you, m.team, 0.001);
              return (
                <div key={m.label} className="rounded-2xl border border-jcc-border p-4">
                  <p className={`${KICK} text-jcc-text-muted`}>{m.label}</p>
                  {[["You", m.you, "#12233F"], [m.team === 100 ? "Every match" : "Team average", m.team, "#D4AF37"]].map(([who, v, c]) => (
                    <div key={who as string} className="mt-3 grid grid-cols-[92px_minmax(0,1fr)_52px] items-center gap-3">
                      <span className="text-[12.5px] font-semibold text-jcc-blue">{who}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-jcc-blue/[0.06]">
                        <span className="block h-full rounded-full" style={{ width: `${((v as number) / max) * 100}%`, background: c as string }} />
                      </span>
                      <span className="text-right font-heading text-[15px] font-bold tabular-nums text-jcc-blue">{m.fmt(v as number)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Sec>
        {(pr.chances.underusedBat || pr.chances.underusedBowl) ? (
          <div className="mt-5 flex gap-4 rounded-[22px] bg-[#0B1424] p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-jcc-accent text-lg">💎</span>
            <p className="text-[13.5px] leading-relaxed text-[rgba(255,255,255,0.75)]">
              <b className="block font-heading text-lg text-jcc-accent">You deserve more chances.</b>
              {pr.chances.underusedBat && `You strike at ${f0(pr.B.sr)} (league ${f0(LB.sr)}) but face fewer balls than your teammates. `}
              {pr.chances.underusedBowl && `Your economy is ${f2(pr.W.econ)} (league ${f2(LW.econ)}) but you bowl in only ${f0(pr.chances.bowlShare)}% of matches.`}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-jcc-navy-light px-4 py-3 text-[13px] text-jcc-text-muted">Your share of the batting and bowling matches your numbers.</p>
        )}
        <p className="mt-3 text-xs text-jcc-text-muted">Attendance counts a match when you batted, bowled or took a fielding dismissal. CricHeroes doesn&apos;t list players who did none of those, so true attendance may be a little higher.</p>
      </>
    ),
  });

  return cards;
}

// ─── Hero ────────────────────────────────────────────────────────────────────

const CAP = {
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
  green: "linear-gradient(135deg, #6EE7B7 0%, #2E8B57 100%)",
};
const fill = (g: string) => ({ backgroundImage: g, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;

/**
 * The player's DNA as a radar: every batting and bowling axis on one shape,
 * percentile against qualified players, with the league median (50) dashed.
 * Batting vertices orange, bowling purple.
 */
function Radar({ pr }: { pr: Profile }) {
  const ref = useRef<SVGGElement>(null);
  const axes = [...pr.dna.batting.map((a) => ({ ...a, bat: true })), ...pr.dna.bowling.map((a) => ({ ...a, bat: false }))];
  useGSAP(
    () => {
      if (!ref.current || reduceMotion()) return;
      gsap.fromTo(ref.current, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: "expo.out", transformOrigin: "50% 50%" });
    },
    { dependencies: [pr.p, pr.dna.batting.length, pr.dna.bowling.length] },
  );
  if (axes.length < 3) return null;
  const C = 120, R = 78;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
  };
  const ring = (f: number) => axes.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const shape = axes.map((a, i) => pt(i, R * Math.max(0.06, a.pct / 100)).join(",")).join(" ");
  return (
    <svg viewBox="-34 -6 308 252" className="mx-auto block w-full max-w-[270px]" role="img" aria-label={`Skill profile: ${axes.map((a) => `${a.label} ${a.pct}th percentile`).join(", ")}`}>
      {[0.25, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />)}
      <polygon points={ring(0.5)} fill="none" stroke="rgba(243,201,106,0.45)" strokeWidth="1" strokeDasharray="3 4" />
      {axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />; })}
      <g ref={ref}>
        <polygon points={shape} fill="rgba(212,175,55,0.22)" stroke="#F3C96A" strokeWidth="1.8" strokeLinejoin="round" />
        {axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.06, a.pct / 100)); return <circle key={a.label} cx={x} cy={y} r="3.6" fill={a.bat ? "#F59E0B" : "#A78BFA"} stroke="#0B1424" strokeWidth="1.5" />; })}
      </g>
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 18);
        const anchor = Math.abs(x - C) < 8 ? "middle" : x > C ? "start" : "end";
        return (
          <text key={a.label} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="8.5" fontFamily="var(--font-mono)" fill="rgba(255,255,255,0.72)">
            {a.label.replace("Strike rotation", "Rotation").replace("Wicket threat", "Threat")}
            <tspan fill={a.pct >= 60 ? "#F3C96A" : "rgba(255,255,255,0.45)"} fontWeight="600"> {a.pct}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

function HeroStat({ label, value, grad, rank }: { label: string; value: number; grad: string; rank: { rank: number; of: number } | null }) {
  return (
    <div className="min-w-0">
      <p className={`${KICK} text-white/50`}>{label}</p>
      <p className="mt-1 font-heading text-[2.15rem] font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums" style={fill(grad)}>
        <Counter value={value} />
      </p>
      {rank && (
        <p className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold ${rank.rank <= 3 ? "bg-jcc-accent text-[#0B1424]" : "bg-white/10 text-white/70"}`}>
          #{rank.rank}/{rank.of}
        </p>
      )}
    </div>
  );
}

/** The player, always in view beside the cards (a compact strip on phones). */
function Hero({ pr, scopeLabel }: { pr: Profile; scopeLabel: string }) {
  const team = teamByName(pr.team);
  const photo = usePhoto(pr.name);
  return (
    <aside className="theme-static-dark print-grain relative overflow-hidden rounded-[28px] bg-[#0B1424] text-white lg:h-full lg:overflow-y-auto [scrollbar-width:none]">
      <div aria-hidden className="pitch-grid absolute inset-0" />
      {team && (
        <Image src={team.logo} alt="" width={260} height={260} className="pointer-events-none absolute -right-14 -top-10 w-56 rotate-[-8deg] object-contain opacity-[0.09]" />
      )}
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-[90px]" style={{ background: `${team?.primary ?? "#D4AF37"}40` }} />

      <div className="relative p-5 lg:p-6">
        <div className="flex items-center gap-4 lg:block">
          <div className="relative shrink-0">
            {photo ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl ring-2 ring-jcc-accent/70 lg:h-44 lg:w-full lg:rounded-[22px]">
                <Image src={photo} alt={pr.name} fill unoptimized className="object-cover object-top" style={focusStyle(focusOf(photo), 0.5, 1.5)} />
                <div className="absolute inset-0 hidden bg-linear-to-t from-[#0B1424] via-transparent to-transparent lg:block" />
              </div>
            ) : (
              <Avatar name={pr.name} size={80} ring={team?.primary ?? "#D4AF37"} />
            )}
          </div>
          <div className="relative z-10 min-w-0 lg:mt-4 lg:px-1">
            <p className={`${KICK} text-jcc-accent`}>{scopeLabel} · {pr.role}</p>
            <h2 className="mt-1.5 font-heading text-2xl font-extrabold leading-[0.95] tracking-[-0.04em] text-white lg:text-[2.1rem]">{pr.name}</h2>
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-white/65">
              {team && <Image src={team.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />}
              {pr.teams.join(" · ")} · {plural(pr.matches, "match", "matches")}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
          <HeroStat label="Runs" value={pr.B.runs} grad={CAP.orange} rank={pr.ranks.runs} />
          <HeroStat label="Wickets" value={pr.W.wk} grad={CAP.purple} rank={pr.ranks.wk} />
          <HeroStat label="Fielding" value={pr.F.total} grad={CAP.green} rank={pr.ranks.field} />
        </div>

        <div className="hidden lg:block">
          {(pr.dna.batting.length + pr.dna.bowling.length >= 3) && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className={`${KICK} mb-2 flex items-center justify-between text-white/50`}>
                Skill profile <span className="normal-case tracking-normal text-white/40">dashed = league median</span>
              </p>
              <Radar pr={pr} />
            </div>
          )}
          {pr.dna.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {pr.dna.tags.map((t) => (
                <span key={t} className="rounded-full border border-jcc-accent/40 bg-jcc-accent/10 px-2.5 py-1 text-[11.5px] font-semibold text-jcc-accent-highlight">{t}</span>
              ))}
            </div>
          )}
          <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 text-center">
            {[
              ["Awards", String(pr.mom.length)],
              ["Win %", `${Math.round(pr.winPct)}%`],
              ["Present", `${pr.attendance.pct}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/[0.05] py-2.5">
                <dt className={`${KICK} text-[9px] text-white/45`}>{k}</dt>
                <dd className="mt-1 font-heading text-lg font-bold tabular-nums text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </aside>
  );
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export default function PlayerDeck({
  data,
  seasons,
  scopeLabel,
  player,
  card,
  onNavigate,
  onClose,
  onOpenMatch,
}: {
  data: CardData;
  seasons: number[];
  scopeLabel: string;
  player: number;
  card?: string;
  onNavigate: (player: number, card?: string) => void;
  onClose: () => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [sharing, setSharing] = useState(false);
  const photos = useContext(PhotoContext);
  const pr = useMemo(() => playerProfile(data, seasons, player), [data, seasons, player]);
  const holders = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of leagueInsights(data, seasons).badges) for (const b of r.badges) m.set(b.label, (m.get(b.label) ?? 0) + 1);
    return m;
  }, [data, seasons]);
  const momA = useMemo(() => momAnalytics(data, seasons), [data, seasons]);
  const battles = useMemo(() => keyBattles(data, seasons), [data, seasons]);
  const cards = useMemo(() => (pr ? buildCards(pr, scopeLabel, setTip, holders, momA, onOpenMatch, battles, data.players) : []), [pr, scopeLabel, holders, momA, onOpenMatch, battles, data.players]);
  const idx = Math.max(0, cards.findIndex((c) => c.id === card));
  const go = (i: number) => {
    const c = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (c) onNavigate(player, c.id);
  };
  const tabsRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; dx: number } | null>(null);
  // Drag offsets are written straight to the strip, not through state, so a
  // swipe doesn't re-render every card on each pointer move.
  const strip = useRef<HTMLDivElement>(null);
  const slide = (dx: number) => {
    const el = strip.current;
    if (!el) return;
    el.style.transition = dx ? "none" : SLIDE;
    el.style.transform = `translateX(calc(${-100 * idx}% + ${dx}px))`;
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    // Scroll only the tab strip; scrollIntoView would also pan the page on phones.
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (strip && tab) strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [idx, player]);

  // Each card deals its contents in: header first, then sections in turn.
  useGSAP(
    () => {
      if (reduceMotion()) return;
      const body = document.querySelector(`[data-card="${idx}"] [data-card-body]`);
      if (!body) return;
      gsap.fromTo(body.children, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "expo.out", stagger: 0.06, clearProps: "transform,opacity,visibility" });
    },
    { dependencies: [idx, player] },
  );

  if (!pr) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#070D18]/95 px-2 pb-3 pt-3 backdrop-blur-md sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${pr.name} player cards`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-auto mb-3 flex w-full max-w-6xl items-center gap-2 text-[#FCFBF8]">
        <span className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#FCFBF8]/60">
          <span aria-hidden>🔒</span> Your player card · only you can see this
        </span>
        <DeckButton onClick={() => setSharing(true)} label="Share as story"><Share2 size={15} /><span className="hidden sm:inline">Share card</span></DeckButton>
        {sharing && (
          <ShareSheet
            cards={profileShareCards({ pr, scopeLabel, battles, holders, photoOf: (n) => photoFor(photos, n), origin: window.location.origin, host: window.location.host })}
            fileBase={`jcc-${slug(pr.name)}`}
            onClose={() => setSharing(false)}
          />
        )}
        <DeckButton onClick={onClose} label="Close"><X size={16} /></DeckButton>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-4">
        <Hero pr={pr} scopeLabel={scopeLabel} />

        <div className="flex min-h-0 flex-col">
          <div ref={tabsRef} role="tablist" className="relative mb-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {cards.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === idx}
                onClick={() => go(i)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${i === idx ? "border-jcc-accent bg-jcc-accent text-jcc-seam shadow-[0_6px_18px_-6px_rgba(212,175,55,0.7)]" : "border-[#FCFBF8]/15 bg-[#FCFBF8]/[0.05] text-[#FCFBF8]/75 hover:border-[#FCFBF8]/40 hover:bg-[#FCFBF8]/[0.1] hover:text-[#FCFBF8]"}`}
              >
                <span className={`mr-1.5 font-mono text-[10px] ${i === idx ? "opacity-70" : "opacity-40"}`}>{String(i + 1).padStart(2, "0")}</span>
                {c.tab}
              </button>
            ))}
          </div>

          <div
            className="relative min-h-0 flex-1 touch-pan-y overflow-hidden rounded-[28px]"
            onPointerDown={(e) => { if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, dx: 0 }; }}
            onPointerMove={(e) => {
              const sw = swipe.current;
              if (!sw) return;
              sw.dx = e.clientX - sw.x;
              if (Math.abs(sw.dx) > Math.abs(e.clientY - sw.y) && Math.abs(sw.dx) > 8) slide(sw.dx);
            }}
            onPointerUp={() => {
              const sw = swipe.current;
              swipe.current = null;
              slide(0);
              if (sw && sw.dx < -50) go(idx + 1);
              else if (sw && sw.dx > 50) go(idx - 1);
            }}
            onPointerCancel={() => { swipe.current = null; slide(0); }}
          >
            <div ref={strip} className="flex h-full" style={{ transform: `translateX(${-100 * idx}%)`, transition: SLIDE }}>
              {cards.map((c, i) => (
                <article
                  key={c.id}
                  data-card={i}
                  aria-hidden={i !== idx}
                  className="h-full w-full shrink-0 overflow-y-auto rounded-[28px] bg-jcc-navy p-5 text-white shadow-2xl sm:p-8"
                >
                  <header className="mb-6 flex items-end justify-between gap-4 border-b border-jcc-border pb-4">
                    <div className="min-w-0">
                      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-accent-dark">{c.kicker}</p>
                      <h2 className="mt-2 font-heading text-3xl font-extrabold leading-[0.95] tracking-[-0.04em] text-jcc-blue sm:text-[2.6rem]">{c.title}</h2>
                    </div>
                    <span className="shrink-0 font-heading text-4xl font-extrabold leading-none tracking-[-0.05em] text-jcc-blue/10 sm:text-6xl">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </header>
                  {Math.abs(i - idx) <= 1 ? <div data-card-body>{c.body}</div> : null}
                </article>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <DeckButton onClick={() => go(idx - 1)} disabled={idx === 0} label="Previous card"><ChevronLeft size={16} /><span className="hidden sm:inline">{cards[idx - 1]?.tab ?? ""}</span></DeckButton>
            <div className="flex flex-wrap justify-center gap-1.5">
              {cards.map((c, i) => (
                <button key={c.id} aria-label={c.tab} onClick={() => go(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-jcc-accent" : "w-1.5 bg-[#FCFBF8]/30 hover:bg-[#FCFBF8]/70"}`} />
              ))}
            </div>
            <DeckButton onClick={() => go(idx + 1)} disabled={idx === cards.length - 1} label="Next card"><span className="hidden sm:inline">{cards[idx + 1]?.tab ?? ""}</span><ChevronRight size={16} /></DeckButton>
          </div>
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-[70] max-w-[260px] rounded-xl bg-jcc-blue px-3 py-2 text-xs leading-snug text-[#FCFBF8] shadow-xl"
          style={{ left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270), top: Math.max(8, tip.y - 90) }}
        >
          {tip.body}
        </div>
      )}
    </div>
  );
}

function DeckButton({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border border-[#FCFBF8]/25 bg-[#FCFBF8]/[0.08] px-3 text-[13px] font-semibold text-[#FCFBF8] transition hover:border-[#FCFBF8]/50 hover:bg-[#FCFBF8]/15 disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}
