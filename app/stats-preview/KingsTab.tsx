"use client";

import { useRef } from "react";
import { MIN_BALLS, f0, f2, ov, type BoardRow } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar } from "./Avatar";
import { gsap, reduceMotion, useGSAP, whenSeen } from "./motion";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const QW = (r: BoardRow) => r.bowlBalls >= MIN_BALLS;
const ring = (team: string) => teamByName(team)?.primary ?? "#A97824";

type Open = (p: number, card?: string) => void;

/** Leaders for one phase: the top man large, the chasing pack beneath. */
function PhaseLeaders({ rows, value, unit, names, onOpen, card }: { rows: BoardRow[]; value: (r: BoardRow) => number; unit: string; names: string[]; onOpen: Open; card: string }) {
  const [first, ...rest] = rows.slice(0, 6);
  if (!first) return <p className="text-sm text-jcc-text-muted">No wickets in this phase yet.</p>;
  return (
    <div>
      <button onClick={() => onOpen(first.p, card)} className="group flex items-center gap-4 text-left">
        <Avatar name={names[first.p]} size={64} ring="#D4AF37" className="transition-transform duration-500 group-hover:scale-105" />
        <span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">{value(first)}</span>
            <span className={LABEL}>{unit}</span>
          </span>
          <span className="mt-1 block font-semibold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[first.p]}</span>
          <span className="block font-mono text-[10.5px] text-jcc-text-muted">{first.wk} wkts in all · econ {f2(first.econ)}</span>
        </span>
      </button>
      <ol className="mt-5 border-t border-jcc-border">
        {rest.map((r, i) => (
          <li key={r.p}>
            <button onClick={() => onOpen(r.p, card)} className="group flex w-full items-center gap-3 border-b border-jcc-border py-2.5 text-left">
              <span className="w-4 font-mono text-[11px] text-jcc-text-muted">{i + 2}</span>
              <Avatar name={names[r.p]} size={28} ring={ring(r.team)} />
              <span className="flex-1 truncate text-[13.5px] font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1">{names[r.p]}</span>
              <span className="font-heading text-lg font-bold tabular-nums text-white">{value(r)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Death overs and dot balls. The top of the tab is a 7-over innings drawn
 * over by over, with the new-ball and death phases marked and their wicket
 * leaders set under them; below, dot balls drawn as dots.
 */
export default function KingsTab({ rows, names, onOpenPlayer }: { rows: BoardRow[]; names: string[]; onOpenPlayer: Open }) {
  const root = useRef<HTMLDivElement>(null);
  const by = (f: (r: BoardRow) => number, filter: (r: BoardRow) => boolean = () => true) =>
    [...rows].filter((r) => filter(r) && f(r) > 0).sort((a, b) => f(b) - f(a));

  const newBall = by((r) => r.powerplay);
  const death = by((r) => r.death);
  const dots = by((r) => r.dots).slice(0, 6);
  const squeeze = by((r) => r.dotPct ?? 0, QW).slice(0, 6);
  const faced = by((r) => r.dotsFaced).slice(0, 8);

  const allWk = rows.reduce((s, r) => s + r.wk, 0) || 1;
  const ppWk = rows.reduce((s, r) => s + r.powerplay, 0);
  const deathWk = rows.reduce((s, r) => s + r.death, 0);
  const midWk = Math.max(0, allWk - ppWk - deathWk);
  const maxDots = dots[0]?.dots ?? 1;

  useGSAP(
    () => {
      if (reduceMotion() || !root.current) return;
      const q = gsap.utils.selector(root);
      const overs = q("[data-over]");
      gsap.set(overs, { scaleY: 0, transformOrigin: "bottom center" });
      gsap.set(q("[data-phase]"), { autoAlpha: 0, y: 10 });
      whenSeen(root.current, () =>
        void gsap
          .timeline()
          .to(overs, { scaleY: 1, stagger: 0.09, duration: 0.8, ease: "expo.out" })
          .to(q("[data-phase]"), { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.6, ease: "expo.out" }, 0.4),
      );
      q("[data-dotrow]").forEach((row) => {
        const d = row.querySelectorAll("[data-dot]");
        gsap.set(d, { scale: 0 });
        whenSeen(row, () => void gsap.to(d, { scale: 1, stagger: { each: 0.008 }, duration: 0.35, ease: "back.out(3)" }));
      });
      q("[data-ring]").forEach((c) => {
        const full = Number(c.getAttribute("data-ring"));
        gsap.set(c, { attr: { "stroke-dasharray": `0 200` } });
        whenSeen(c, () => void gsap.to(c, { attr: { "stroke-dasharray": `${full} 200` }, duration: 1.4, ease: "expo.out" }));
      });
    },
    { scope: root, dependencies: [rows] },
  );

  const phase = (o: number) => (o <= 2 ? "new" : o >= 6 ? "death" : "mid");

  return (
    <div ref={root} data-apanel>
      {/* ── The innings, over by over ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={LABEL}>A 7-over innings</p>
          <h3 className="mt-2 font-heading text-4xl font-bold tracking-[-0.04em] text-white md:text-5xl">Where the wickets fall</h3>
        </div>
        <p className="max-w-sm text-[13px] text-jcc-text-muted">Phase comes from the over each wicket fell in (the fall-of-wickets record).</p>
      </div>

      <div className="mt-10 grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((o) => {
          const ph = phase(o);
          return (
            <div key={o} className="flex flex-col items-stretch">
              <div
                data-over
                className={`flex h-20 items-end rounded-t-xl px-2 pb-2 md:h-28 md:px-3 ${
                  ph === "new" ? "bg-gradient-to-t from-jcc-accent-dark to-jcc-accent text-jcc-seam" : ph === "death" ? "bg-gradient-to-t from-jcc-blue-deep to-jcc-blue text-[#FCFBF8]" : "bg-jcc-navy-light text-jcc-text-muted"
                }`}
              >
                <span className="font-heading text-2xl font-bold leading-none md:text-4xl">{o}</span>
              </div>
              <span className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-jcc-text-muted">over</span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-12 md:grid-cols-7 md:gap-1.5">
        <div data-phase className="md:col-span-2 md:pr-6">
          <div className="mb-5 flex items-baseline justify-between border-t-2 border-jcc-accent pt-3">
            <span className="font-heading text-2xl font-bold tracking-tight text-white">New ball</span>
            <span className={LABEL}>overs 1–2 · {Math.round((100 * ppWk) / allWk)}%</span>
          </div>
          <PhaseLeaders rows={newBall} value={(r) => r.powerplay} unit="wkts" names={names} onOpen={onOpenPlayer} card="wickets" />
        </div>

        <div data-phase className="md:col-span-3 md:px-6">
          <div className="mb-5 flex items-baseline justify-between border-t-2 border-jcc-border pt-3">
            <span className="font-heading text-2xl font-bold tracking-tight text-white">The squeeze</span>
            <span className={LABEL}>overs 3–5 · {Math.round((100 * midWk) / allWk)}%</span>
          </div>
          <p className="text-[13px] text-jcc-text-muted">The middle overs are won with dots, not wickets. Best dot-ball percentage, min {MIN_BALLS} balls bowled:</p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            {squeeze.map((r) => {
              const C = 2 * Math.PI * 18;
              return (
                <button key={r.p} onClick={() => onOpenPlayer(r.p, "bowling")} className="group flex items-center gap-3 text-left">
                  <span className="relative grid h-14 w-14 shrink-0 place-items-center">
                    <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-jcc-navy-light)" strokeWidth="4" />
                      <circle data-ring={((C * (r.dotPct ?? 0)) / 100).toFixed(1)} cx="22" cy="22" r="18" fill="none" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${((C * (r.dotPct ?? 0)) / 100).toFixed(1)} 200`} />
                    </svg>
                    <span className="font-heading text-sm font-bold tabular-nums text-white">{f0(r.dotPct)}%</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold tracking-tight text-white group-hover:underline">{names[r.p]}</span>
                    <span className="block font-mono text-[10px] text-jcc-text-muted">econ {f2(r.econ)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div data-phase className="md:col-span-2 md:pl-6">
          <div className="mb-5 flex items-baseline justify-between border-t-2 border-jcc-blue pt-3">
            <span className="font-heading text-2xl font-bold tracking-tight text-white">Death</span>
            <span className={LABEL}>overs 6–7 · {Math.round((100 * deathWk) / allWk)}%</span>
          </div>
          <PhaseLeaders rows={death} value={(r) => r.death} unit="wkts" names={names} onOpen={onOpenPlayer} card="wickets" />
        </div>
      </div>

      {/* ── Dot balls, as dots ── */}
      <div className="mt-24 flex flex-wrap items-end justify-between gap-4 border-t border-jcc-blue/80 pt-5">
        <div>
          <p className={LABEL}>Every dot is a dot ball</p>
          <h3 className="mt-2 font-heading text-4xl font-bold tracking-[-0.04em] text-white md:text-5xl">Dot-ball monsters</h3>
        </div>
        <span className={LABEL}>Most dot balls bowled</span>
      </div>
      <ol className="mt-8">
        {dots.map((r, i) => (
          <li key={r.p} data-dotrow className="grid gap-3 border-b border-jcc-border py-5 md:grid-cols-[240px_minmax(0,1fr)_80px] md:items-center md:gap-8">
            <button onClick={() => onOpenPlayer(r.p, "bowling")} className="group flex items-center gap-3 text-left">
              <Avatar name={names[r.p]} size={i === 0 ? 48 : 38} ring={i === 0 ? "#D4AF37" : ring(r.team)} />
              <span className="min-w-0">
                <span className="block truncate font-semibold tracking-tight text-white group-hover:underline">{names[r.p]}</span>
                <span className="block font-mono text-[10.5px] text-jcc-text-muted">
                  {f0(r.dotPct)}% of {ov(r.bowlBalls)} ov
                </span>
              </span>
            </button>
            <div className="flex flex-wrap gap-[3px]" style={{ maxWidth: `${Math.max(30, (100 * r.dots) / maxDots)}%` }} aria-label={`${r.dots} dot balls`}>
              {Array.from({ length: Math.min(r.dots, 160) }, (_, k) => (
                <span key={k} data-dot className={`h-[7px] w-[7px] rounded-full ${i === 0 ? "bg-jcc-accent" : "bg-jcc-blue/80"}`} />
              ))}
            </div>
            <span className="font-heading text-3xl font-bold tabular-nums tracking-tight text-white md:text-right">{r.dots}</span>
          </li>
        ))}
      </ol>

      {/* ── The other side: dots faced ── */}
      <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-end justify-between gap-4 border-t border-jcc-blue/80 pt-5">
            <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">Dot balls faced</h3>
            <span className={LABEL}>a minimum</span>
          </div>
          <p className="mt-2 text-[13px] text-jcc-text-muted">Batters who faced the most dot balls. Every non-boundary run is counted as a single, so these are floors.</p>
          <ol className="mt-5">
            {faced.map((r, i) => (
              <li key={r.p}>
                <button onClick={() => onOpenPlayer(r.p, "scoring")} className="group grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-jcc-border py-3 text-left">
                  <span className="font-mono text-[11px] text-jcc-text-muted">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={names[r.p]} size={32} ring={ring(r.team)} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1">{names[r.p]}</span>
                      <span className="block font-mono text-[10.5px] text-jcc-text-muted">at least {f0(r.dotFacedPct)}% of {r.balls} balls</span>
                    </span>
                  </span>
                  <span className="font-heading text-2xl font-bold tabular-nums text-white">{r.dotsFaced}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <aside className="self-start border-l-2 border-jcc-accent pl-6 lg:mt-14">
          <p className={LABEL}>Still to come</p>
          <h4 className="mt-2 font-heading text-2xl font-bold tracking-tight text-white">Four dots in a row</h4>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
            Spotting a streak of consecutive dot balls needs every ball in order. The CricHeroes export has scorecard totals only, so this can&apos;t be worked out yet.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-jcc-text-muted">
            With CricHeroes&apos; ball-by-ball commentary we could add dot-ball streaks, true death-over runs and economy, and exact bowler-against-batter head-to-heads.
          </p>
        </aside>
      </div>
    </div>
  );
}
