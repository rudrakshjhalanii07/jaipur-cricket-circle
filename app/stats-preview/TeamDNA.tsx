"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { f0, type TeamDna } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import Jaali from "@/components/Jaali";
import { Avatar } from "./Avatar";
import { Counter, gsap, reduceMotion, useGSAP, usePill } from "./motion";

type Metric = { key: string; label: string; axis: string; get: (t: TeamDna) => number; dp: number; unit?: string; low?: boolean };

/** Ten axes of a side's game. `low` = smaller is better (economy, wides). */
const METRICS: Metric[] = [
  { key: "rr", label: "Run rate", axis: "RUN RATE", get: (t) => t.runRate ?? 0, dp: 2 },
  { key: "first", label: "Avg 1st innings", axis: "1ST INNS", get: (t) => t.avgFirst ?? 0, dp: 1 },
  { key: "six", label: "Sixes a match", axis: "SIXES", get: (t) => t.sixesPerMatch, dp: 1 },
  { key: "bnd", label: "Runs in boundaries", axis: "BOUNDARY %", get: (t) => t.boundaryPct ?? 0, dp: 0, unit: "%" },
  { key: "econ", label: "Runs conceded an over", axis: "ECONOMY", get: (t) => t.conceded ?? 0, dp: 2, low: true },
  { key: "dot", label: "Dot balls bowled", axis: "DOT %", get: (t) => t.dotPctBowled ?? 0, dp: 0, unit: "%" },
  { key: "wk", label: "Wickets a match", axis: "WICKETS", get: (t) => t.wicketsPerMatch, dp: 1 },
  { key: "wd", label: "Wides a match", axis: "DISCIPLINE", get: (t) => t.widesPerMatch, dp: 1, low: true },
  { key: "ct", label: "Catches a match", axis: "CATCHES", get: (t) => t.catchesPerMatch, dp: 1 },
  { key: "ro", label: "Run outs a match", axis: "RUN OUTS", get: (t) => t.runOutsPerMatch, dp: 1 },
];

const OUT_COLORS = ["#D4AF37", "#FCFBF8", "#8A94A6", "#A97824"];
const LABEL = "font-mono text-[10px] uppercase tracking-[0.16em] text-[#FCFBF8]/75";

const SIZE = 440;
const C = SIZE / 2;
const RAD = 150;
const angle = (i: number) => (i / METRICS.length) * Math.PI * 2 - Math.PI / 2;
const pt = (i: number, r: number) => [C + Math.cos(angle(i)) * RAD * r, C + Math.sin(angle(i)) * RAD * r] as const;
const points = (rs: number[]) => rs.map((r, i) => pt(i, r).join(",")).join(" ");

export default function TeamDNA({ teams, names, onOpenPlayer }: { teams: TeamDna[]; names: string[]; onOpenPlayer: (p: number, card?: string) => void }) {
  const [focus, setFocus] = useState(teams[0]?.team ?? "");
  const [picked, setVersus] = useState<string>("league");
  const [hover, setHover] = useState<number | null>(null);
  const [outHover, setOutHover] = useState<number | null>(null);
  // Comparing a side with itself makes no sense; fall back to the league.
  const versus = picked === focus ? "league" : picked;
  const { box: crestBox, pill: crestPill } = usePill(focus, "line");
  const { box: vsBox, pill: vsPill } = usePill(`${focus}|${versus}`);

  const root = useRef<HTMLDivElement>(null);
  const teamPoly = useRef<SVGPolygonElement>(null);
  const vsPoly = useRef<SVGPolygonElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const shown = useRef<{ a: number[]; b: number[] } | null>(null);

  const t = teams.find((x) => x.team === focus) ?? teams[0];

  // League line = the mean of the sides; ranges set each axis's scale.
  const league = useMemo(() => METRICS.map((m) => teams.reduce((s, x) => s + m.get(x), 0) / Math.max(1, teams.length)), [teams]);
  const range = useMemo(
    () =>
      METRICS.map((m) => {
        const v = teams.map(m.get);
        const lo = Math.min(...v);
        const hi = Math.max(...v);
        const pad = (hi - lo) * 0.35 || Math.abs(hi) * 0.2 || 1;
        return [lo - pad, hi + pad / 3] as const;
      }),
    [teams],
  );
  /** 0.12–1 radius on an axis; flipped for "lower is better" metrics. */
  const norm = (i: number, v: number) => {
    const [lo, hi] = range[i];
    const x = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return 0.12 + 0.88 * (METRICS[i].low ? 1 - x : x);
  };

  const other = versus === "league" ? null : teams.find((x) => x.team === versus) ?? null;
  const aVals = METRICS.map((m) => m.get(t));
  const bVals = other ? METRICS.map((m) => m.get(other)) : league;
  const a = aVals.map((v, i) => norm(i, v));
  const b = bVals.map((v, i) => norm(i, v));
  const color = teamByName(t.team)?.primary ?? "#D4AF37";
  const vsColor = other ? teamByName(other.team)?.primary ?? "#FCFBF8" : "#FCFBF8";

  // Morph the radar between selections; the crest turns over on a team change.
  useGSAP(
    () => {
      const draw = (ra: number[], rb: number[]) => {
        teamPoly.current?.setAttribute("points", points(ra));
        vsPoly.current?.setAttribute("points", points(rb));
        ra.forEach((r, i) => {
          const [x, y] = pt(i, r);
          dots.current[i]?.setAttribute("cx", String(x));
          dots.current[i]?.setAttribute("cy", String(y));
        });
      };
      const from = shown.current ?? { a: a.map(() => 0), b: b.map(() => 0) };
      shown.current = { a, b };
      if (reduceMotion()) return draw(a, b);
      const p = { t: 0 };
      gsap.to(p, {
        t: 1,
        duration: from.a.every((x) => x === 0) ? 1.6 : 0.9,
        ease: "expo.out",
        onUpdate: () => {
          const lerp = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * p.t);
          draw(lerp(from.a, a), lerp(from.b, b));
        },
      });
    },
    { dependencies: [focus, versus], scope: root },
  );

  const lastFocus = useRef(focus);
  useGSAP(
    () => {
      if (reduceMotion()) return;
      const changed = lastFocus.current !== focus;
      lastFocus.current = focus;
      const q = gsap.utils.selector(root);
      gsap.fromTo(q("[data-crest-mark]"), { rotate: -24, scale: 0.8, autoAlpha: 0 }, { rotate: -8, scale: 1, autoAlpha: 0.1, duration: 1.2, ease: "expo.out" });
      gsap.fromTo(q("[data-trait]"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.6, ease: "back.out(2)", delay: changed ? 0.1 : 0.4 });
      gsap.fromTo(q("[data-dna-name]"), { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: "expo.out" });
      gsap.fromTo(q("[data-contrib]"), { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, stagger: 0.05, duration: 0.6, ease: "expo.out", delay: 0.15 });
    },
    { dependencies: [focus], scope: root },
  );

  // Dismissal donut.
  const R = 62;
  const CIRC = 2 * Math.PI * R;
  const arcs = t.howOut.map((h, i) => ({
    ...h,
    i,
    len: (h.pct / 100) * CIRC,
    off: -t.howOut.slice(0, i).reduce((sum, x) => sum + (x.pct / 100) * CIRC, 0),
  }));
  const shownOut = outHover != null ? t.howOut[outHover] : [...t.howOut].sort((x, y) => y.pct - x.pct)[0];
  const maxRuns = t.topRunners[0]?.runs ?? 1;
  const maxWk = t.topWicketTakers[0]?.wk ?? 1;

  return (
    <div ref={root} data-apanel className="print-grain heritage-frame theme-static-dark section-bg-royal relative overflow-hidden rounded-[2rem] px-5 py-10 md:px-12 md:py-14">
      {/* Team-colour glow and turning crest */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full opacity-40 blur-[110px] transition-colors duration-700" style={{ backgroundColor: color }} />
      <Jaali />
      {teamByName(t.team) && (
        <div data-crest-mark aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 w-[26rem] opacity-10">
          <Image src={teamByName(t.team)!.logo} alt="" width={416} height={416} className="h-auto w-full object-contain" />
        </div>
      )}

      <div className="relative">
        {/* Club picker */}
        <div ref={crestBox} role="tablist" aria-label="Club" className="relative flex flex-wrap items-end gap-x-2 gap-y-4 border-b border-[#FCFBF8]/12 pb-4 md:gap-x-6">
          {teams.map((x) => {
            const on = x.team === focus;
            const tm = teamByName(x.team);
            return (
              <button
                key={x.team}
                role="tab"
                aria-selected={on}
                data-active={on}
                onClick={() => setFocus(x.team)}
                className="group flex items-center gap-3 rounded-full px-2 py-1.5 text-left"
              >
                {tm && (
                  <Image
                    src={tm.logo}
                    alt=""
                    width={52}
                    height={52}
                    className={`h-11 w-11 object-contain transition duration-500 md:h-13 md:w-13 ${on ? "scale-110 drop-shadow-[0_8px_18px_rgba(212,175,55,0.35)]" : "opacity-45 grayscale group-hover:opacity-80 group-hover:grayscale-0"}`}
                  />
                )}
                <span className={`hidden font-heading text-lg font-bold tracking-tight transition-colors sm:inline ${on ? "text-[#FCFBF8]" : "text-[#FCFBF8]/70 group-hover:text-[#FCFBF8]/80"}`}>{x.team}</span>
              </button>
            );
          })}
          <span ref={crestPill} aria-hidden className="pointer-events-none absolute -bottom-px left-0 h-[3px] rounded-full bg-jcc-accent" style={{ opacity: 0 }} />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          {/* ── Left: identity + radar ── */}
          <div className="rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10 md:p-8">
            <div className="overflow-hidden pb-1">
              <h3 data-dna-name className="font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-[#FCFBF8] md:text-6xl">{t.team}</h3>
            </div>
            <p className="mt-3 font-mono text-[11px] text-[#FCFBF8]/80">
              {t.won}–{t.lost} · {t.players} players used · chasing {t.chase[0]}–{t.chase[1]} · defending {t.defend[0]}–{t.defend[1]}
            </p>
            <div className="mt-5 flex min-h-[34px] flex-wrap gap-2">
              {t.traits.length ? (
                t.traits.map((tr) => (
                  <span key={`${t.team}-${tr}`} data-trait className="rounded-full border border-jcc-accent/50 bg-jcc-accent/10 px-3 py-1 text-[12.5px] font-semibold text-jcc-accent-highlight">
                    {tr}
                  </span>
                ))
              ) : (
                <span data-trait className="text-sm text-[#FCFBF8]/55">A balanced side: nothing far from the league average.</span>
              )}
            </div>

            <div className="relative mx-auto mt-8 max-w-[460px] rounded-full bg-[radial-gradient(circle,#12233F_55%,rgba(18,35,63,0.85)_70%,transparent_78%)]">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${t.team} compared with ${other ? other.team : "the league average"}`}>
                {[0.25, 0.5, 0.75, 1].map((k) => (
                  <polygon key={k} points={points(METRICS.map(() => k))} fill="none" stroke="rgba(252,251,248,0.09)" strokeWidth="1" />
                ))}
                {METRICS.map((m, i) => {
                  const [x, y] = pt(i, 1);
                  const [lx, ly] = pt(i, 1.17);
                  const on = hover === i;
                  return (
                    <g key={m.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-default">
                      <line x1={C} y1={C} x2={x} y2={y} stroke={on ? "#D4AF37" : "rgba(252,251,248,0.1)"} strokeWidth={on ? 1.5 : 1} />
                      <text
                        x={lx}
                        y={ly}
                        textAnchor={Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end"}
                        dominantBaseline="middle"
                        fontSize="9.5"
                        letterSpacing="1.4"
                        fontFamily="var(--font-mono)"
                        fill={on ? "#F3C96A" : "rgba(252,251,248,0.78)"}
                      >
                        {m.axis}
                      </text>
                    </g>
                  );
                })}
                <polygon ref={vsPoly} points={points(b)} fill="rgba(252,251,248,0.04)" stroke={vsColor} strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 5" style={{ transition: "stroke .6s" }} />
                <polygon
                  ref={teamPoly}
                  points={points(a)}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  style={{ fill: `color-mix(in srgb, ${color} 32%, transparent)`, stroke: color, transition: "fill .6s, stroke .6s" }}
                />
                {METRICS.map((m, i) => {
                  const [x, y] = pt(i, a[i]);
                  return (
                    <circle
                      key={m.key}
                      ref={(el) => {
                        dots.current[i] = el;
                      }}
                      cx={x}
                      cy={y}
                      r={hover === i ? 7 : 4.5}
                      fill={hover === i ? "#D4AF37" : "#FCFBF8"}
                      stroke={color}
                      strokeWidth="2"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      style={{ transition: "r .25s, fill .25s" }}
                    />
                  );
                })}
              </svg>
              {hover != null && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-jcc-blue-deep/90 px-4 py-3 text-center shadow-xl ring-1 ring-[#FCFBF8]/10 backdrop-blur">
                  <div className={LABEL}>{METRICS[hover].label}</div>
                  <div className="mt-1 font-heading text-3xl font-bold tabular-nums text-[#FCFBF8]">
                    {aVals[hover].toFixed(METRICS[hover].dp)}
                    {METRICS[hover].unit}
                  </div>
                  <div className="font-mono text-[10.5px] text-[#FCFBF8]/55">
                    {other ? other.team : "league"} {bVals[hover].toFixed(METRICS[hover].dp)}
                    {METRICS[hover].unit}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className={LABEL}>Compare with</span>
              <div ref={vsBox} className="relative inline-flex flex-wrap rounded-full bg-[#FCFBF8]/[0.06] p-1">
                <span ref={vsPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-[#FCFBF8]" style={{ opacity: 0 }} />
                {["league", ...teams.filter((x) => x.team !== focus).map((x) => x.team)].map((k) => (
                  <button
                    key={k}
                    data-active={versus === k}
                    onClick={() => setVersus(k)}
                    className={`relative z-10 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-300 ${versus === k ? "text-jcc-blue" : "text-[#FCFBF8]/65 hover:text-[#FCFBF8]"}`}
                  >
                    {k === "league" ? "League avg" : k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: the numbers against the comparison ── */}
          <div>
            <div className="flex items-center justify-between border-b border-[#FCFBF8]/12 pb-3">
              <span className={LABEL}>Metric</span>
              <span className={LABEL}>
                {t.team} <span className="text-[#FCFBF8]/35">vs</span> {other ? other.team : "league"}
              </span>
            </div>
            <ol className="overflow-hidden rounded-2xl ring-1 ring-[#FCFBF8]/10">
              {METRICS.map((m, i) => {
                const better = m.low ? aVals[i] < bVals[i] : aVals[i] > bVals[i];
                const d = Math.min(1, Math.abs(a[i] - b[i]) * 1.6);
                const on = hover === i;
                return (
                  <li
                    key={m.key}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    className={`grid grid-cols-[minmax(0,1fr)_120px_76px] items-center gap-4 border-b border-[#FCFBF8]/10 px-4 py-3 transition-colors duration-300 ${on ? "bg-[#1A2E4D]" : "bg-jcc-blue"}`}
                  >
                    <span className={`truncate text-[13.5px] transition-colors ${on ? "text-jcc-accent-highlight" : "text-[#FCFBF8]"}`}>{m.label}</span>
                    <span className="relative h-1.5 rounded-full bg-[#FCFBF8]/10">
                      <span className="absolute -inset-y-1 left-1/2 w-px bg-[#FCFBF8]/35" />
                      <span
                        className={`absolute inset-y-0 rounded-full transition-all duration-700 ease-out ${better ? "left-1/2 bg-jcc-accent" : "right-1/2 bg-[#FCFBF8]/45"}`}
                        style={{ width: `${d * 50}%` }}
                      />
                    </span>
                    <span className="text-right">
                      <span className="block font-heading text-xl font-bold leading-none tabular-nums text-[#FCFBF8]">
                        <Counter value={aVals[i]} decimals={m.dp} />
                        {m.unit}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] tabular-nums text-[#FCFBF8]/70">
                        {bVals[i].toFixed(m.dp)}
                        {m.unit}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 font-mono text-[10.5px] text-[#FCFBF8]/70">Gold to the right = better than the comparison. Economy and wides count lower as better.</p>
          </div>
        </div>

        {/* ── Bottom: how they get out + who carries them ── */}
        <div className="mt-14 grid gap-10 rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] md:p-8">
          <div>
            <div className={LABEL}>How their batters get out</div>
            <div className="relative mx-auto mt-5 w-44">
              <svg viewBox="0 0 160 160" className="h-auto w-full -rotate-90">
                <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(252,251,248,0.08)" strokeWidth="16" />
                {arcs.map((s) => (
                  <circle
                    key={s.label}
                    cx="80"
                    cy="80"
                    r={R}
                    fill="none"
                    stroke={OUT_COLORS[s.i % OUT_COLORS.length]}
                    strokeWidth={outHover === s.i ? 22 : 16}
                    strokeDasharray={`${Math.max(0, s.len - 2)} ${CIRC}`}
                    strokeDashoffset={s.off}
                    onMouseEnter={() => setOutHover(s.i)}
                    onMouseLeave={() => setOutHover(null)}
                    style={{ transition: "stroke-dasharray .9s cubic-bezier(.16,1,.3,1), stroke-dashoffset .9s cubic-bezier(.16,1,.3,1), stroke-width .25s", opacity: outHover == null || outHover === s.i ? 1 : 0.35 }}
                  />
                ))}
              </svg>
              {shownOut && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <div className="font-heading text-3xl font-bold tabular-nums text-[#FCFBF8]">{shownOut.pct}%</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#FCFBF8]/55">{shownOut.label}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-1.5">
              {t.howOut.map((h, i) => (
                <button
                  key={h.label}
                  onMouseEnter={() => setOutHover(i)}
                  onMouseLeave={() => setOutHover(null)}
                  className="flex w-full items-center justify-between text-[12px] text-[#FCFBF8]/70"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: OUT_COLORS[i % OUT_COLORS.length] }} />
                    {h.label}
                  </span>
                  <span className="font-mono tabular-nums">{h.pct}%</span>
                </button>
              ))}
            </div>
          </div>

          {[
            { title: "Run-scorers", share: t.topRunShare, rows: t.topRunners.map((r) => ({ p: r.p, v: r.runs, max: maxRuns, unit: "runs" })) },
            { title: "Wicket-takers", share: t.topWicketShare, rows: t.topWicketTakers.map((r) => ({ p: r.p, v: r.wk, max: maxWk, unit: "wkts" })) },
          ].map((col) => (
            <div key={col.title}>
              <div className={LABEL}>
                Top {col.title.toLowerCase()} · {f0(col.share)}% from #1
              </div>
              <ol className="mt-5 space-y-4">
                {col.rows.map((r, i) => (
                  <li key={`${t.team}-${r.p}`} data-contrib>
                    <button onClick={() => onOpenPlayer(r.p)} className="group flex w-full items-center gap-4 text-left">
                      <Avatar name={names[r.p]} size={i === 0 ? 52 : 40} ring={i === 0 ? "#D4AF37" : color} className="transition-transform duration-500 group-hover:scale-110" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate font-semibold tracking-tight text-[#FCFBF8] decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[r.p]}</span>
                          <span className="font-heading text-xl font-bold tabular-nums text-[#FCFBF8]">
                            {r.v} <span className="font-mono text-[10px] font-normal text-[#FCFBF8]/70">{r.unit}</span>
                          </span>
                        </span>
                        <span className="mt-2 block h-1 rounded-full bg-[#FCFBF8]/10">
                          <span className="block h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${(100 * r.v) / r.max}%`, background: i === 0 ? "#D4AF37" : color }} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
