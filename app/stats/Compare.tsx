"use client";

// Head to head: any two players, side by side, metric by metric. A butterfly
// chart — each bar grows outwards from the centre line, scaled to the larger
// of the pair, and the better side of every row is lit in gold. Economy is
// the one row where lower wins. Opens on the Orange Cap against the Purple Cap.

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { f0, f1, f2, leaderboardRows, type BoardRow, type CardData } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar } from "./Avatar";
import { gsap, reduceMotion, useGSAP } from "./motion";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";

type Metric = { label: string; get: (r: BoardRow) => number | null; fmt: (n: number | null) => string; lower?: boolean; min?: (r: BoardRow) => boolean };

const METRICS: Metric[] = [
  { label: "Matches", get: (r) => r.matches, fmt: f0 },
  { label: "Runs", get: (r) => r.runs, fmt: f0 },
  { label: "Strike rate", get: (r) => r.sr, fmt: f1, min: (r) => r.balls >= 15 },
  { label: "Average", get: (r) => r.avg, fmt: f1, min: (r) => r.balls >= 15 },
  { label: "Sixes", get: (r) => r.s6, fmt: f0 },
  { label: "Boundaries", get: (r) => r.bnd, fmt: f0 },
  { label: "Wickets", get: (r) => r.wk, fmt: f0 },
  { label: "Economy", get: (r) => r.econ, fmt: f2, lower: true, min: (r) => r.bowlBalls >= 12 },
  { label: "Dot-ball %", get: (r) => r.dotPct, fmt: f1, min: (r) => r.bowlBalls >= 12 },
  { label: "Death-over wkts", get: (r) => r.death, fmt: f0 },
  { label: "Fielding", get: (r) => r.fielding, fmt: f0 },
  { label: "Player of the Match", get: (r) => r.mom, fmt: f0 },
];

function Picker({ rows, names, value, onChange, align }: { rows: BoardRow[]; names: string[]; value: number; onChange: (p: number) => void; align: "left" | "right" }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => names[a.p].localeCompare(names[b.p])), [rows, names]);
  const row = rows.find((r) => r.p === value);
  const color = teamByName(row?.team)?.primary ?? "#D4AF37";
  return (
    <label className={`group relative flex min-w-0 cursor-pointer items-center gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <Avatar name={names[value]} size={72} ring={color} className="transition-transform duration-500 group-hover:scale-105 md:h-24! md:w-24!" />
      <span className="min-w-0">
        <span className={LABEL}>{row?.team ?? "—"}</span>
        <span className={`mt-1 flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
          <span className="truncate font-heading text-2xl font-bold tracking-[-0.035em] text-white md:text-4xl">{names[value]}</span>
          <ChevronDown size={18} className="shrink-0 text-jcc-text-muted transition-transform group-hover:translate-y-0.5" />
        </span>
      </span>
      <select
        aria-label={align === "left" ? "First player" : "Second player"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {sorted.map((r) => (
          <option key={r.p} value={r.p}>
            {names[r.p]} · {r.team}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Compare({ data, seasons, onOpenPlayer }: { data: CardData; seasons: number[]; onOpenPlayer: (p: number) => void }) {
  const rows = useMemo(() => leaderboardRows(data, seasons).filter((r) => r.matches >= 2), [data, seasons]);
  const names = data.players;
  const defaults = useMemo(() => {
    const bat = [...rows].sort((a, b) => b.runs - a.runs || (b.sr ?? 0) - (a.sr ?? 0))[0];
    const bowl = [...rows].sort((a, b) => b.wk - a.wk || (a.econ ?? 99) - (b.econ ?? 99)).find((r) => r.p !== bat?.p);
    return [bat?.p ?? 0, bowl?.p ?? 0] as const;
  }, [rows]);
  const [pick, setPick] = useState<[number | null, number | null]>([null, null]);
  // A pick from another season may not exist in this one; fall back quietly.
  const has = (p: number | null) => p != null && rows.some((r) => r.p === p);
  const a = has(pick[0]) ? pick[0]! : defaults[0];
  const b = has(pick[1]) ? pick[1]! : defaults[1];
  const A = rows.find((r) => r.p === a);
  const B = rows.find((r) => r.p === b);
  const board = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduceMotion() || !board.current) return;
      const q = gsap.utils.selector(board);
      gsap.fromTo(q("[data-cbar]"), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "expo.out", stagger: 0.03 });
      gsap.fromTo(q("[data-cval]"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.02 });
    },
    { scope: board, dependencies: [a, b, seasons] },
  );

  if (!A || !B) return null;
  let winsA = 0;
  let winsB = 0;
  const lines = METRICS.map((m) => {
    const va = m.min && !m.min(A) ? null : m.get(A);
    const vb = m.min && !m.min(B) ? null : m.get(B);
    const max = Math.max(va ?? 0, vb ?? 0) || 1;
    let win: "a" | "b" | null = null;
    if (va != null && vb != null && va !== vb) win = (m.lower ? va < vb : va > vb) ? "a" : "b";
    else if (va != null && vb == null && va > 0) win = "a";
    else if (vb != null && va == null && vb > 0) win = "b";
    if (win === "a") winsA++;
    if (win === "b") winsB++;
    // Lower-is-better rows draw the better (smaller) value as the longer bar.
    const len = (v: number | null) => (v == null ? 0 : m.lower ? Math.min(...[va, vb].filter((x): x is number => x != null)) / v : v / max);
    return { m, va, vb, win, la: len(va), lb: len(vb) };
  });

  const ca = teamByName(A.team)?.primary ?? "#D4AF37";
  const cb = teamByName(B.team)?.primary ?? "#3B6FC4";

  return (
    <div ref={board}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-y border-jcc-blue/80 py-8 md:gap-8 md:py-10">
        <Picker rows={rows} names={names} value={a} onChange={(p) => setPick([p, b])} align="left" />
        <button
          type="button"
          onClick={() => setPick([b, a])}
          aria-label="Swap players"
          className="grid h-12 w-12 place-items-center rounded-full border border-jcc-blue/15 text-white transition duration-500 hover:rotate-180 hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8] md:h-16 md:w-16"
        >
          <ArrowLeftRight size={20} />
        </button>
        <Picker rows={rows} names={names} value={b} onChange={(p) => setPick([a, p])} align="right" />
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4">
        <div>
          <span className="font-heading text-6xl font-bold leading-none tracking-[-0.06em] tabular-nums md:text-8xl" style={{ color: winsA >= winsB ? undefined : "#667085" }}>
            {winsA}
          </span>
        </div>
        <p className={`${LABEL} pb-2 text-center`}>categories won</p>
        <div className="text-right">
          <span className="font-heading text-6xl font-bold leading-none tracking-[-0.06em] tabular-nums md:text-8xl" style={{ color: winsB >= winsA ? undefined : "#667085" }}>
            {winsB}
          </span>
        </div>
      </div>

      <ul className="mt-8">
        {lines.map(({ m, va, vb, win, la, lb }) => (
          <li key={m.label} className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-3 border-b border-jcc-border py-3.5 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)] md:gap-6">
            <div className="flex items-center gap-3">
              <span data-cval className={`w-14 shrink-0 font-heading text-lg font-bold tabular-nums tracking-tight md:w-16 md:text-2xl ${win === "a" ? "text-white" : "text-jcc-text-muted"}`}>{m.fmt(va)}</span>
              <span className="flex h-2 flex-1 justify-end rounded-full bg-jcc-blue/[0.07]">
                <span data-cbar className="block h-full rounded-full" style={{ width: `${la * 100}%`, transformOrigin: "right center", background: win === "a" ? "linear-gradient(90deg, #A97824, #F3C96A)" : ca, opacity: win === "a" ? 1 : 0.4 }} />
              </span>
            </div>
            <span className="text-center font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-jcc-text-muted md:text-[11px]">
              {m.label}
              {m.lower && <span className="block text-[9px] normal-case tracking-normal opacity-70">lower is better</span>}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex h-2 flex-1 rounded-full bg-jcc-blue/[0.07]">
                <span data-cbar className="block h-full rounded-full" style={{ width: `${lb * 100}%`, transformOrigin: "left center", background: win === "b" ? "linear-gradient(90deg, #F3C96A, #A97824)" : cb, opacity: win === "b" ? 1 : 0.4 }} />
              </span>
              <span data-cval className={`w-14 shrink-0 text-right font-heading text-lg font-bold tabular-nums tracking-tight md:w-16 md:text-2xl ${win === "b" ? "text-white" : "text-jcc-text-muted"}`}>{m.fmt(vb)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          {[a, b].map((p) => (
            <button key={p} type="button" onClick={() => onOpenPlayer(p)} className="rounded-full border border-jcc-blue/15 px-4 py-2 text-[13px] font-semibold tracking-tight text-white transition-colors hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8]">
              {names[p].split(" ")[0]}&apos;s cards →
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-jcc-text-muted">Rates need 15 balls faced or 12 bowled · gold marks the better side of each row</p>
      </div>
    </div>
  );
}
