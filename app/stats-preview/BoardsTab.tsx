"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MIN_BALLS, f0, f1, f2, ov, type BoardRow } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar, Portrait, usePhoto } from "./Avatar";
import { Counter, gsap, reduceMotion, useGSAP, usePill } from "./motion";

type Metric = {
  key: string;
  label: string;
  /** Column shown as the ranking value. */
  value: (r: BoardRow) => number | null;
  fmt: (n: number) => string;
  low?: boolean;
  /** Rate metrics need a minimum sample. */
  qualify?: (r: BoardRow) => boolean;
  extra: (r: BoardRow) => string;
  note?: string;
};

const QB = (r: BoardRow) => r.balls >= MIN_BALLS;
const QW = (r: BoardRow) => r.bowlBalls >= MIN_BALLS;
const int = (n: number) => String(Math.round(n));

const METRICS: Record<"bat" | "bowl" | "field" | "awards", Metric[]> = {
  bat: [
    { key: "runs", label: "Most runs", value: (r) => r.runs, fmt: int, extra: (r) => `SR ${f0(r.sr)} · avg ${f1(r.avg)}` },
    { key: "s6", label: "Most sixes", value: (r) => r.s6, fmt: int, extra: (r) => `${r.runs} runs · a six every ${r.s6 ? f1(r.balls / r.s6) : "–"} balls` },
    { key: "f4", label: "Most fours", value: (r) => r.f4, fmt: int, extra: (r) => `${r.runs} runs` },
    { key: "bnd", label: "Most boundaries", value: (r) => r.bnd, fmt: int, extra: (r) => `${r.f4} fours · ${r.s6} sixes` },
    { key: "sr", label: "Best strike rate", value: (r) => r.sr, fmt: (n) => n.toFixed(1), qualify: QB, extra: (r) => `${r.runs} off ${r.balls}` },
    { key: "avg", label: "Best average", value: (r) => r.avg, fmt: (n) => n.toFixed(1), qualify: QB, extra: (r) => `${r.runs} runs` },
    { key: "bpb", label: "Fewest balls per boundary", value: (r) => r.bpb, fmt: (n) => n.toFixed(2), low: true, qualify: QB, extra: (r) => `${r.bnd} boundaries in ${r.balls} balls` },
    { key: "dotsFaced", label: "Most dot balls faced", value: (r) => r.dotsFaced, fmt: int, extra: (r) => `at least ${f0(r.dotFacedPct)}% of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "dotFacedPct", label: "Highest dot % faced", value: (r) => r.dotFacedPct, fmt: (n) => `${n.toFixed(0)}%`, qualify: QB, extra: (r) => `${r.dotsFaced} of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "dotFacedLow", label: "Lowest dot % faced", value: (r) => r.dotFacedPct, fmt: (n) => `${n.toFixed(0)}%`, low: true, qualify: QB, extra: (r) => `${r.dotsFaced} of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "t30", label: "Most 30+ scores", value: (r) => r.t30, fmt: int, extra: (r) => `${r.runs} runs` },
    { key: "ducks", label: "Most ducks", value: (r) => r.ducks, fmt: int, extra: (r) => `${r.runs} runs` },
  ],
  bowl: [
    { key: "wk", label: "Most wickets", value: (r) => r.wk, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov · econ ${f2(r.econ)}` },
    { key: "econ", label: "Best economy", value: (r) => r.econ, fmt: (n) => n.toFixed(2), low: true, qualify: QW, extra: (r) => `${ov(r.bowlBalls)} ov · ${r.wk} wkts` },
    { key: "dots", label: "Most dot balls bowled", value: (r) => r.dots, fmt: int, extra: (r) => `${f0(r.dotPct)}% of ${r.bowlBalls} balls` },
    { key: "dotPct", label: "Best dot %", value: (r) => r.dotPct, fmt: (n) => `${n.toFixed(0)}%`, qualify: QW, extra: (r) => `${r.dots} dots in ${ov(r.bowlBalls)} ov` },
    { key: "death", label: "Wickets in the last 2 overs", value: (r) => r.death, fmt: int, extra: (r) => `${r.wk} wkts in all`, note: "Phase comes from the over each wicket fell in (fall-of-wicket record)." },
    { key: "powerplay", label: "Wickets in the first 2 overs", value: (r) => r.powerplay, fmt: int, extra: (r) => `${r.wk} wkts in all`, note: "Phase comes from the over each wicket fell in (fall-of-wicket record)." },
    { key: "ducksTaken", label: "Most ducks taken", value: (r) => r.ducksTaken, fmt: int, extra: (r) => `${r.wk} wkts` },
    { key: "hauls2", label: "Most 2+ wicket spells", value: (r) => r.hauls2, fmt: int, extra: (r) => `${r.wk} wkts` },
    { key: "maidens", label: "Most maidens", value: (r) => r.maidens, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov` },
    { key: "wides", label: "Most wides", value: (r) => r.wides, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov · ${r.noBalls} no-balls` },
  ],
  field: [
    { key: "fielding", label: "Most dismissals", value: (r) => r.fielding, fmt: int, extra: (r) => `${r.catches} ct · ${r.runOuts} ro · ${r.stumpings} st` },
    { key: "catches", label: "Most catches", value: (r) => r.catches, fmt: int, extra: (r) => `${r.matches} matches` },
    { key: "runOuts", label: "Most run outs", value: (r) => r.runOuts, fmt: int, extra: (r) => `${r.matches} matches` },
    { key: "stumpings", label: "Most stumpings", value: (r) => r.stumpings, fmt: int, extra: (r) => `${r.matches} matches` },
  ],
  awards: [
    { key: "mom", label: "Most Player of the Match awards", value: (r) => r.mom, fmt: int, extra: (r) => `in ${r.matches} matches · ${r.runs} runs · ${r.wk} wkts`, note: "Player of the Match is decided from the numbers: impact against that match's own scoring rate, with a 1.3× weight on the winning side." },
  ],
};


type Disc = keyof typeof METRICS;
const DISC_LABEL: Record<Disc, string> = { bat: "Batting", bowl: "Bowling", field: "Fielding", awards: "Awards" };
const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const teamColor = (t: string) => teamByName(t)?.primary ?? "#8A94A6";

/** Decimal places and unit a metric prints with, read off its own formatter. */
function shape(m: Metric) {
  const sample = m.fmt(1.23456);
  const unit = sample.endsWith("%") ? "%" : "";
  const dp = sample.replace("%", "").split(".")[1]?.length ?? 0;
  return { dp, unit };
}

const AV = 38; // face size in the field
const STEP = AV + 6; // vertical pitch of a stack
const COL = AV + 14; // narrowest column

type Bucket = { lo: number; hi: number; label: string; to?: string; players: BoardRow[] };

/**
 * Every qualifying player as a face, stacked into evenly spaced columns, one
 * per value (or per value range when there are too many to fit), worst on
 * the left and best on the right. Keyed by player, so a metric switch glides
 * every face to its new column.
 */
function Field({ all, board, value, metric, names, onOpen }: { all: BoardRow[]; board: BoardRow[]; value: (r: BoardRow) => number; metric: Metric; names: string[]; onOpen: (p: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const better = (a: number, b: number) => (metric.low ? b - a : a - b); // >0 when a is better
    const vals = [...new Set(board.map(value))].sort(better); // worst → best
    // Ranges need room for a two-line label, so binned columns are wider.
    const maxCols = Math.max(4, Math.floor(w / COL));
    const binCols = Math.max(4, Math.floor(w / 64));
    let buckets: Bucket[];
    if (vals.length <= maxCols && !(vals.length > binCols && metric.fmt(1.5) !== metric.fmt(2))) {
      buckets = vals.map((v) => ({ lo: v, hi: v, label: metric.fmt(v), players: [] }));
    } else {
      // Equal-width ranges across the spread; empty ranges are dropped.
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const n = binCols;
      const width = (hi - lo) / n || 1;
      const raw = Array.from({ length: n }, (_, i) => ({ lo: lo + i * width, hi: i === n - 1 ? hi : lo + (i + 1) * width, label: "", players: [] as BoardRow[] }));
      if (metric.low) raw.reverse();
      buckets = raw;
    }
    const find = (v: number) =>
      buckets.length === vals.length
        ? buckets.find((b) => b.lo === v)!
        : buckets.find((b) => v >= Math.min(b.lo, b.hi) - 1e-9 && v <= Math.max(b.lo, b.hi) + 1e-9) ?? buckets[buckets.length - 1];
    for (const r of [...board].sort((a, b) => b.matches - a.matches)) find(value(r)).players.push(r);
    buckets = buckets.filter((b) => b.players.length);
    if (buckets.length && buckets.some((b) => b.lo !== b.hi)) for (const b of buckets) {
      const vs = b.players.map(value);
      const a = Math.min(...vs);
      const z = Math.max(...vs);
      b.label = metric.fmt(metric.low ? z : a);
      if (a !== z) b.to = metric.fmt(metric.low ? a : z);
    }
    const tallest = Math.max(1, ...buckets.map((b) => b.players.length));
    const height = tallest * STEP;
    const colW = w / Math.max(1, buckets.length);
    const at = new Map<number, { x: number; y: number }>();
    buckets.forEach((b, c) => b.players.forEach((r, k) => at.set(r.p, { x: (c + 0.5) * colW, y: height - (k + 0.5) * STEP })));
    const sorted = board.map(value).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const medianCol = buckets.findIndex((b) => b.players.some((r) => value(r) === median));
    return { buckets, at, height, colW, medianCol, median };
  }, [board, value, metric, w]);

  const inBoard = new Set(board.map((r) => r.p));
  const leader = board[0]?.p;

  return (
    <div>
      <div ref={box} className="relative transition-[height] duration-700 ease-out" style={{ height: layout.height + 78 }}>
        {/* column backdrops: a faint well under each stack */}
        {layout.buckets.map((b, c) => (
          <span
            key={`${b.label}-${c}`}
            className={`absolute bottom-[78px] rounded-t-2xl transition-all duration-700 ease-out ${c === layout.buckets.length - 1 ? "bg-jcc-accent/12" : c === layout.medianCol ? "bg-jcc-blue/[0.06]" : "bg-jcc-blue/[0.03]"}`}
            style={{ left: c * layout.colW + 3, width: layout.colW - 6, height: b.players.length * STEP + 6 }}
          />
        ))}
        {/* baseline + labels */}
        <span className="absolute inset-x-0 h-px bg-jcc-blue/40" style={{ top: layout.height + 2 }} />
        {layout.buckets.map((b, c) => (
          <span
            key={`l-${b.label}-${c}`}
            className="absolute flex -translate-x-1/2 flex-col items-center text-center transition-all duration-700 ease-out"
            style={{ left: (c + 0.5) * layout.colW, top: layout.height + 10, width: layout.colW }}
          >
            <span className={`whitespace-nowrap font-heading text-[13px] font-bold leading-tight tabular-nums ${c === layout.buckets.length - 1 ? "text-jcc-accent-dark" : "text-white"}`}>{b.label}</span>
            {b.to && <span className="whitespace-nowrap font-mono text-[9.5px] leading-tight tabular-nums text-jcc-text-muted">to {b.to}</span>}
            <span className="font-mono text-[9.5px] text-jcc-text-muted">×{b.players.length}</span>
            {c === layout.medianCol && <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-jcc-accent-dark">median</span>}
          </span>
        ))}
        {all.map((r) => {
          const on = inBoard.has(r.p);
          const spot = layout.at.get(r.p);
          const hovered = hover === r.p;
          const isTop = on && r.p === leader;
          return (
            <button
              key={r.p}
              onClick={() => on && onOpen(r.p)}
              onMouseEnter={() => setHover(r.p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.p)}
              onBlur={() => setHover(null)}
              tabIndex={on ? 0 : -1}
              aria-hidden={!on}
              aria-label={on ? `${names[r.p]} ${metric.fmt(value(r))}` : undefined}
              className="absolute rounded-full"
              style={{
                left: spot?.x ?? w / 2,
                top: spot?.y ?? layout.height,
                opacity: on ? 1 : 0,
                transform: `translate(-50%, -50%) scale(${on ? (hovered ? 1.3 : 1) : 0.3})`,
                zIndex: hovered ? 20 : isTop ? 10 : 1,
                pointerEvents: on ? "auto" : "none",
                transition: "left .9s cubic-bezier(.16,1,.3,1), top .9s cubic-bezier(.16,1,.3,1), opacity .5s, transform .35s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <Avatar name={names[r.p]} size={AV} ring={isTop ? "#D4AF37" : teamColor(r.team)} />
              {on && (hovered || isTop) && (
                <span className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg ${isTop && !hovered ? "bg-jcc-accent text-jcc-seam" : "bg-jcc-blue text-[#FCFBF8]"}`}>
                  {names[r.p]} · {metric.fmt(value(r))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">
        <span>← trailing</span>
        <span>leading →</span>
      </div>
    </div>
  );
}

/**
 * The analytics leaderboard: a metric browser, the leader spread, Nos. 2–5,
 * the whole field on a number line, then everyone else.
 */
export default function BoardsTab({ rows, names, onOpenPlayer }: { rows: BoardRow[]; names: string[]; onOpenPlayer: (p: number, card?: string) => void; seasons: number[] }) {
  const [disc, setDisc] = useState<Disc>("bat");
  const [metricKey, setMetricKey] = useState("s6");
  const { box: discBox, pill: discPill } = usePill(disc);
  const { box: chipBox, pill: chipPill } = usePill(`${disc}|${metricKey}`);
  const root = useRef<HTMLDivElement>(null);

  const list = METRICS[disc];
  const idx = Math.max(0, list.findIndex((m) => m.key === metricKey));
  const metric = list[idx];
  const { dp, unit } = shape(metric);
  const value = useMemo(() => (r: BoardRow) => metric.value(r) ?? 0, [metric]);
  const board = useMemo(
    () =>
      rows
        .filter((r) => (metric.qualify ? metric.qualify(r) : true) && metric.value(r) != null && (metric.low || (metric.value(r) ?? 0) > 0))
        .sort((a, b) => (metric.low ? metric.value(a)! - metric.value(b)! : metric.value(b)! - metric.value(a)!) || b.matches - a.matches),
    [rows, metric],
  );
  const lead = board[0];
  const leadHasPhoto = Boolean(usePhoto(lead ? names[lead.p] : null));

  const step = (d: number) => setMetricKey(list[(idx + d + list.length) % list.length].key);
  const pickDisc = (d: Disc) => {
    setDisc(d);
    setMetricKey(METRICS[d][0].key);
  };

  // The title and leader re-enter on every metric change.
  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.fromTo(q("[data-title]"), { yPercent: 105 }, { yPercent: 0, duration: 0.8, ease: "expo.out" });
      gsap.fromTo(q("[data-lead]"), { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: "expo.out", delay: 0.05 });
      gsap.fromTo(q("[data-chaser]"), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.06, ease: "expo.out", delay: 0.1 });
      gsap.fromTo(q("[data-rest]"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.015, ease: "expo.out", delay: 0.2 });
    },
    { dependencies: [disc, metricKey], scope: root },
  );

  return (
    <div
      ref={root}
      data-apanel
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      className="outline-none"
    >
      {/* ── Browser ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div ref={discBox} role="tablist" aria-label="Discipline" className="relative inline-flex rounded-full bg-jcc-navy p-1 shadow-[0_10px_30px_-20px_rgba(18,35,63,0.5)]">
          <span ref={discPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue" style={{ opacity: 0 }} />
          {(Object.keys(METRICS) as Disc[]).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={disc === d}
              data-active={disc === d}
              onClick={() => pickDisc(d)}
              className={`relative z-10 rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300 ${disc === d ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
            >
              {DISC_LABEL[d]}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-jcc-text-muted">
          {idx + 1} / {list.length} · use ← → to browse
        </span>
      </div>

      <div className="mt-10 flex items-end justify-between gap-6 border-b border-jcc-blue/80 pb-6">
        <div className="min-w-0">
          <p className={LABEL}>{DISC_LABEL[disc]} · leaderboard</p>
          <div className="mt-2 overflow-hidden pb-1">
            <h3 data-title className="font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-white md:text-7xl">
              {metric.label}
            </h3>
          </div>
          <p className="mt-3 max-w-prose text-[13px] leading-snug text-jcc-text-muted">
            {[metric.qualify ? `Minimum ${MIN_BALLS} balls ${disc === "bowl" ? "bowled" : "faced"}.` : "", metric.note ?? "", `${board.length} players qualify. Tap any of them for their cards.`].filter(Boolean).join(" ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {[-1, 1].map((d) => (
            <button
              key={d}
              onClick={() => step(d)}
              aria-label={d < 0 ? "Previous metric" : "Next metric"}
              className="grid h-12 w-12 place-items-center rounded-full border border-jcc-blue/20 text-white transition duration-300 hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8]"
            >
              {d < 0 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          ))}
        </div>
      </div>

      <div ref={chipBox} className="no-scrollbar relative mt-4 flex gap-1 overflow-x-auto pb-1">
        <span ref={chipPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-accent/20 ring-1 ring-jcc-accent/60" style={{ opacity: 0 }} />
        {list.map((m) => (
          <button
            key={m.key}
            data-active={m.key === metric.key}
            onClick={() => setMetricKey(m.key)}
            className={`relative z-10 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold tracking-tight transition-colors duration-300 ${m.key === metric.key ? "text-white" : "text-jcc-text-muted hover:text-white"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {board.length === 0 ? (
        <p className="mt-12 text-sm text-jcc-text-muted">No one qualifies in this season yet.</p>
      ) : (
        <>
          {/* ── Leader + chasers ── */}
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <button data-lead onClick={() => onOpenPlayer(lead.p)} className="group relative min-h-[300px] overflow-hidden text-left">
              {leadHasPhoto && <Portrait name={names[lead.p]} className="absolute inset-y-0 right-0 w-[55%]" />}
              <div className="relative py-4">
                <p className={LABEL}>No. 1</p>
                <div className="mt-6 flex items-end gap-2">
                  <span
                    className="font-heading text-[6.5rem] font-bold leading-[0.8] tracking-[-0.06em] tabular-nums md:text-[8.5rem]"
                    style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                  >
                    <Counter value={value(lead)} decimals={dp} />
                  </span>
                  <span className="pb-3 font-heading text-4xl font-bold text-jcc-accent-dark">{unit}</span>
                </div>
                <div className="mt-8 flex items-center gap-3">
                  {!leadHasPhoto && <Avatar name={names[lead.p]} size={48} ring="#D4AF37" />}
                  <span className="font-heading text-3xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline md:text-4xl">{names[lead.p]}</span>
                </div>
                <p className="mt-2 font-mono text-xs text-jcc-text-muted">{metric.extra(lead)}</p>
              </div>
            </button>

            <ol className="self-center">
              {board.slice(1, 5).map((r, i) => (
                <li key={r.p} data-chaser>
                  <button onClick={() => onOpenPlayer(r.p)} className="group grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 border-b border-jcc-border py-4 text-left">
                    <span className="text-outline font-heading text-4xl font-bold leading-none text-jcc-accent-dark">{i + 2}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={names[r.p]} size={48} ring={teamColor(r.team)} className="transition-transform duration-500 group-hover:scale-110" />
                      <span className="min-w-0">
                        <span className="block truncate text-lg font-semibold tracking-tight text-white">{names[r.p]}</span>
                        <span className="block truncate font-mono text-[10.5px] text-jcc-text-muted">{metric.extra(r)}</span>
                      </span>
                    </span>
                    <span className="font-heading text-4xl font-bold tabular-nums tracking-[-0.04em] text-white">
                      <Counter value={value(r)} decimals={dp} />
                      <span className="text-xl text-jcc-text-muted">{unit}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {/* ── The field ── */}
          <div className="mt-16 border-t border-jcc-blue/80 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h4 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">The whole field</h4>
              <span className={LABEL}>Players stacked by value · hover a face to read it</span>
            </div>
            <div className="mt-16">
              <Field all={rows} board={board} value={value} metric={metric} names={names} onOpen={(p) => onOpenPlayer(p)} />
            </div>
          </div>

          {/* ── Everyone else: reads down each column ── */}
          {board.length > 5 && (
            <div className="mt-14">
              <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-2">
                <span className={LABEL}>
                  The chasing pack · Nos. 6–{board.length}
                </span>
                <span className={LABEL}>{metric.label}</span>
              </div>
              <ol className="mt-2 gap-x-10 sm:columns-2 lg:columns-3">
                {board.slice(5).map((r) => {
                  const v = value(r);
                  // Sports-table ties: everyone on the same figure shares the first rank, marked "=".
                  const rank = board.findIndex((x) => value(x) === v) + 1;
                  const tied = board.filter((x) => value(x) === v).length > 1;
                  const top = value(board[0]);
                  const w = metric.low ? (v ? (top / v) * 100 : 0) : top ? (v / top) * 100 : 0;
                  return (
                    <li key={r.p} data-rest className="break-inside-avoid">
                      <button onClick={() => onOpenPlayer(r.p)} className="group relative flex w-full items-center gap-3 border-b border-jcc-border py-3 text-left">
                        <span aria-hidden className="pointer-events-none absolute -inset-x-2 inset-y-0.5 rounded-xl bg-jcc-navy opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative w-7 text-right font-mono text-[11px] tabular-nums text-jcc-text-muted">{tied ? `=${rank}` : String(rank).padStart(2, "0")}</span>
                        <Avatar name={names[r.p]} size={32} ring={teamColor(r.team)} className="relative" />
                        <span className="relative min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-0.5">{names[r.p]}</span>
                          <span className="mt-1.5 block h-[3px] rounded-full bg-jcc-navy-light">
                            <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(3, w))}%`, background: teamColor(r.team) }} />
                          </span>
                        </span>
                        <span className="relative w-14 text-right font-heading text-lg font-bold tabular-nums text-white">{metric.fmt(v)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
