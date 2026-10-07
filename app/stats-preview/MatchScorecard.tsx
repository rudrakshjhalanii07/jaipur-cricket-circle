"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, X } from "lucide-react";
import { f2, fmtDate, manOfTheMatch, matchScorecard, ov, type CardData, type ScorecardInnings } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar } from "./Avatar";
import Jaali from "./Jaali";
import { gsap, reduceMotion, useGSAP, usePill } from "./motion";

const LABEL = "font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const GOLD_TEXT = { backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
const teamColor = (t: string) => teamByName(t)?.primary ?? "#8A94A6";

function Crest({ team, size }: { team: string; size: number }) {
  const t = teamByName(team);
  if (!t) return null;
  return <Image src={t.logo} alt={t.name} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

function NameBtn({ p, name, onOpen, className = "" }: { p: number; name: string; onOpen: (p: number) => void; className?: string }) {
  return (
    <button onClick={() => onOpen(p)} className={`truncate text-left font-semibold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 hover:underline ${className}`}>
      {name}
    </button>
  );
}

function Innings({ inn, onOpen }: { inn: ScorecardInnings; onOpen: (p: number) => void }) {
  const maxRuns = Math.max(1, ...inn.batting.map((b) => b.runs));
  const color = teamColor(inn.team);
  return (
    <div className="space-y-12">
      {/* Batting */}
      <div>
        <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-2">
          <span className={LABEL}>Batting · {inn.team}</span>
          <span className={`${LABEL} hidden sm:block`}>R · balls · 4s · 6s · SR</span>
        </div>
        <ol>
          {inn.batting.map((r, i) => (
            <li key={r.p} data-sc-row className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 border-b border-jcc-border py-3 sm:grid-cols-[minmax(0,1fr)_96px_auto]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-4 font-mono text-[10.5px] text-jcc-text-muted">{i + 1}</span>
                <Avatar name={r.name} size={36} ring={r.out ? color : "#D4AF37"} />
                <div className="min-w-0">
                  <NameBtn p={r.p} name={r.name} onOpen={onOpen} className="block max-w-full" />
                  <div className="truncate font-mono text-[10.5px] text-jcc-text-muted">{r.how}</div>
                </div>
              </div>
              <div className="col-span-2 row-start-2 h-1 rounded-full bg-jcc-navy-light sm:col-span-1 sm:row-start-auto">
                <div className="h-full rounded-full" style={{ width: `${(100 * r.runs) / maxRuns}%`, background: r.out ? "#12233F" : "#D4AF37" }} />
              </div>
              <div className="flex items-baseline justify-end gap-3 text-right">
                <span className={`font-heading text-2xl font-bold tabular-nums tracking-tight ${r.out ? "text-white" : "text-jcc-accent-dark"}`}>
                  {r.runs}
                  {r.out ? "" : "*"}
                </span>
                <span className="w-[160px] whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-jcc-text-muted">
                  {r.balls}b · {r.f4}×4 · {r.s6}×6 · <span className="text-white">SR {r.sr == null ? "–" : r.sr.toFixed(0)}</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-jcc-navy-light px-5 py-4">
          <div>
            <div className={LABEL}>Extras · {inn.extras.total}</div>
            <div className="mt-1 font-mono text-[11px] text-jcc-text-muted">
              wd {inn.extras.wides} · nb {inn.extras.noBalls}
              {inn.extras.other ? ` · b/lb ${inn.extras.other}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="font-heading text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums text-white">
              {inn.runs}/{inn.wickets}
            </div>
            <div className="mt-1 font-mono text-[11px] text-jcc-text-muted">
              {ov(inn.balls)} ov · RR {f2(inn.balls ? (6 * inn.runs) / inn.balls : null)}
            </div>
          </div>
        </div>
      </div>

      {/* Fall of wickets, along the innings */}
      {inn.fow.length > 0 && (
        <div>
          <div className="border-b border-jcc-blue/80 pb-2">
            <span className={LABEL}>Fall of wickets · along the innings, 0 to {inn.runs}</span>
          </div>
          <div className="relative mx-2 mb-2 mt-12 h-14">
            <div className="absolute inset-x-0 top-[26px] h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${color}40, ${color})` }} />
            {inn.fow.map((f, k) => {
              const x = Math.min(100, (100 * f.score) / Math.max(1, inn.runs));
              const up = k % 2 === 0;
              return (
                <button key={f.wicket} onClick={() => onOpen(f.p)} className="group absolute top-0 h-full w-0" style={{ left: `${x}%` }} title={`${f.name}, ${f.over} ov`}>
                  <span className="absolute left-0 top-[22px] h-3 w-3 -translate-x-1/2 rounded-full bg-jcc-navy ring-2 ring-jcc-accent transition-transform group-hover:scale-150" />
                  <span className={`absolute left-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-jcc-text-muted group-hover:text-white ${up ? "-top-5" : "top-10"}`}>
                    <b className="text-white">{f.score}/{f.wicket}</b> {f.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bowling */}
      <div>
        <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-2">
          <span className={LABEL}>Bowling</span>
          <span className={`${LABEL} hidden sm:block`}>O · M · Econ · Dots · Wd · Nb · W/R</span>
        </div>
        <ol>
          {inn.bowling.map((r) => (
            <li key={r.p} data-sc-row className="flex items-center gap-3 border-b border-jcc-border py-3">
              <Avatar name={r.name} size={34} ring={r.wk >= 2 ? "#D4AF37" : "rgba(18,35,63,0.2)"} />
              <NameBtn p={r.p} name={r.name} onOpen={onOpen} className="min-w-0 flex-1" />
              <span className="hidden font-mono text-[11px] tabular-nums text-jcc-text-muted sm:block">
                {ov(r.balls)} · {r.mdn} · {f2(r.econ)} · {r.dots} · {r.wd} · {r.nb}
              </span>
              <span className={`w-16 text-right font-heading text-2xl font-bold tabular-nums tracking-tight ${r.wk ? "text-white" : "text-jcc-text-muted"}`}>
                {r.wk}/{r.runs}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function MatchScorecard({
  data,
  matchId,
  onClose,
  onOpenPlayer,
}: {
  data: CardData;
  matchId: string;
  onClose: () => void;
  onOpenPlayer: (p: number) => void;
}) {
  const sc = useMemo(() => matchScorecard(data, matchId), [data, matchId]);
  const [tab, setTab] = useState(0);
  const { box: tabBox, pill: tabPill } = usePill(tab);
  const overlay = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Entrance: backdrop, sheet, then the contents settle in.
  useGSAP(
    () => {
      if (reduceMotion() || !overlay.current) return;
      const sheet = overlay.current.firstElementChild;
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .from(overlay.current, { autoAlpha: 0, duration: 0.35, ease: "power2.out" })
        .from(sheet, { y: 80, scale: 0.96, autoAlpha: 0, duration: 0.9 }, 0.05)
        .from(gsap.utils.toArray(sheet ? sheet.querySelectorAll("[data-sc-in]") : []), { y: 18, autoAlpha: 0, stagger: 0.06, duration: 0.7 }, 0.3);
    },
    { scope: overlay },
  );
  // Rows deal in whenever the innings changes.
  useGSAP(
    () => {
      if (reduceMotion() || !body.current) return;
      gsap.from(body.current.querySelectorAll("[data-sc-row]"), { autoAlpha: 0, x: -14, stagger: 0.025, duration: 0.5, ease: "expo.out", delay: 0.1 });
    },
    { dependencies: [tab], scope: body },
  );

  if (!sc) return null;
  const { match, innings } = sc;
  const mom = manOfTheMatch(data).get(data.matches.findIndex((x) => x.id === matchId));
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
  const result = match.winner ? `${match.winner} won by ${match.winBy}` : "Match tied";

  const all = innings.flatMap((i) => i.batting.map((b) => ({ ...b, team: i.team })));
  const top = [...all].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  const spells = innings.flatMap((i) => i.bowling.map((b) => ({ ...b, team: innings.find((x) => x.inning !== i.inning)?.team ?? "" })));
  const best = [...spells].sort((a, b) => b.wk - a.wk || a.runs - b.runs)[0];
  const sixes = all.reduce((s, b) => s + b.s6, 0);
  const fours = all.reduce((s, b) => s + b.f4, 0);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#0D1728]/85 px-2 py-4 backdrop-blur-md sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Scorecard: ${match.teamA} v ${match.teamB}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-jcc-navy-deep shadow-2xl">
        {/* ── Broadcast header ── */}
        <div className="theme-static-dark section-bg-royal relative overflow-hidden px-5 pb-8 pt-6 sm:px-10">
          <Jaali />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-[#FCFBF8]/10 text-[#FCFBF8] transition hover:bg-[#FCFBF8]/20">
            <X size={18} />
          </button>
          <p data-sc-in className="relative pr-12 font-mono text-[10.5px] uppercase tracking-[0.18em] text-jcc-accent-highlight">
            Season {match.season} · {fmtDate(match.date)} · {match.venue}
            {match.overs !== 7 ? ` · ${match.overs} overs` : ""}
          </p>
          <div data-sc-in className="relative mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-3xl bg-jcc-blue/85 px-3 py-6 ring-1 ring-[#FCFBF8]/10 sm:gap-8 sm:px-6">
            {innings.map((i, k) => {
              const won = match.winner === i.team;
              return (
                <div key={i.inning} className={`row-start-1 flex min-w-0 flex-col items-center text-center ${k === 1 ? "col-start-3" : "col-start-1"}`}>
                  <Crest team={i.team} size={72} />
                  <span className={`mt-3 max-w-full truncate font-heading text-lg font-bold tracking-tight sm:text-2xl ${won ? "text-[#FCFBF8]" : "text-[#FCFBF8]/75"}`}>{i.team}</span>
                  <span className={`mt-1 font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums sm:text-7xl ${won ? "text-[#FCFBF8]" : "text-[#FCFBF8]/60"}`}>
                    {i.runs}
                    <span className="text-2xl sm:text-4xl">/{i.wickets}</span>
                  </span>
                  <span className="mt-2 font-mono text-[11px] text-[#FCFBF8]/75">
                    {ov(i.balls)} ov · {k === 0 ? "1st inns" : "2nd inns"}
                  </span>
                  <span className={`mt-3 h-[3px] w-16 rounded-full ${won ? "bg-jcc-accent" : "bg-transparent"}`} />
                </div>
              );
            })}
            <span className="col-start-2 row-start-1 font-heading text-xl font-bold text-[#FCFBF8]/60">v</span>
          </div>
          <p data-sc-in className="relative mt-6 text-center font-heading text-xl font-bold tracking-tight text-jcc-accent-highlight sm:text-2xl">{result}</p>
        </div>

        <div className="px-5 pb-8 pt-8 sm:px-10">
          {/* ── Player of the Match ── */}
          {mom && (
            <div data-sc-in className="grid items-center gap-6 border-b border-jcc-blue/80 pb-8 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <button onClick={() => onOpenPlayer(mom.p)} className="relative mx-auto w-fit sm:mx-0">
                <Avatar name={data.players[mom.p]} size={96} ring="#D4AF37" />
                <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-jcc-accent-highlight to-jcc-accent-dark text-jcc-seam ring-4 ring-jcc-navy-deep">
                  <Trophy size={16} />
                </span>
              </button>
              <div className="min-w-0 text-center sm:text-left">
                <p className={LABEL}>Player of the Match</p>
                <button onClick={() => onOpenPlayer(mom.p)} className="mt-1 font-heading text-3xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 hover:underline md:text-4xl">
                  {data.players[mom.p]}
                </button>
                <p className="mt-1 text-[14px] text-jcc-text-muted">
                  {mom.team} · <b className="text-white">{mom.line}</b>
                </p>
                {mom.runnerUp && (
                  <p className="mt-2 font-mono text-[11px] text-jcc-text-muted">
                    Runner-up{" "}
                    <button onClick={() => onOpenPlayer(mom.runnerUp!.p)} className="font-semibold text-white hover:underline">
                      {data.players[mom.runnerUp.p]}
                    </button>{" "}
                    · {mom.runnerUp.line} · {signed(mom.runnerUp.score)}
                  </p>
                )}
              </div>
              <div className="text-center sm:text-right">
                <div className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums" style={GOLD_TEXT}>
                  {signed(mom.score)}
                </div>
                <div className={`${LABEL} mt-2`}>Match impact{mom.winner ? " · ×1.3" : ""}</div>
                <div className="mt-2 flex justify-center gap-3 font-mono text-[10.5px] text-jcc-text-muted sm:justify-end">
                  {mom.impact.bat !== 0 && <span>bat {signed(mom.impact.bat)}</span>}
                  {mom.impact.bowl !== 0 && <span>bowl {signed(mom.impact.bowl)}</span>}
                  {mom.impact.field !== 0 && <span>field {signed(mom.impact.field)}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── Highlights ── */}
          <dl data-sc-in className="grid grid-cols-2 gap-y-6 border-b border-jcc-border py-8 sm:grid-cols-4">
            {top && (
              <button onClick={() => onOpenPlayer(top.p)} className="text-left">
                <dt className={LABEL}>Top score</dt>
                <dd className="mt-2 font-heading text-3xl font-bold tracking-[-0.04em] tabular-nums text-white">
                  {top.runs}
                  {top.out ? "" : "*"} <span className="text-base text-jcc-text-muted">({top.balls})</span>
                </dd>
                <dd className="truncate text-[12.5px] text-jcc-text-muted">{top.name}</dd>
              </button>
            )}
            {best && (
              <button onClick={() => onOpenPlayer(best.p)} className="text-left">
                <dt className={LABEL}>Best bowling</dt>
                <dd className="mt-2 font-heading text-3xl font-bold tracking-[-0.04em] tabular-nums text-white">
                  {best.wk}/{best.runs} <span className="text-base text-jcc-text-muted">({ov(best.balls)})</span>
                </dd>
                <dd className="truncate text-[12.5px] text-jcc-text-muted">{best.name}</dd>
              </button>
            )}
            <div>
              <dt className={LABEL}>Boundaries</dt>
              <dd className="mt-2 font-heading text-3xl font-bold tracking-[-0.04em] tabular-nums text-white">{fours + sixes}</dd>
              <dd className="text-[12.5px] text-jcc-text-muted">
                {fours} fours · {sixes} sixes
              </dd>
            </div>
            <div>
              <dt className={LABEL}>Run rates</dt>
              <dd className="mt-2 font-heading text-3xl font-bold tracking-[-0.04em] tabular-nums text-white">
                {innings.map((i) => f2(i.balls ? (6 * i.runs) / i.balls : null)).join(" · ")}
              </dd>
              <dd className="text-[12.5px] text-jcc-text-muted">1st · 2nd innings</dd>
            </div>
          </dl>

          {/* ── Innings switch ── */}
          <div data-sc-in ref={tabBox} role="tablist" className="relative mt-8 grid grid-cols-2 rounded-full bg-jcc-navy p-1 shadow-[0_10px_30px_-20px_rgba(18,35,63,0.5)]">
            <span ref={tabPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue" style={{ opacity: 0 }} />
            {innings.map((i, k) => (
              <button
                key={i.inning}
                role="tab"
                aria-selected={tab === k}
                data-active={tab === k}
                onClick={() => setTab(k)}
                className={`relative z-10 flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-colors duration-300 ${tab === k ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
              >
                <Crest team={i.team} size={20} />
                <span className="truncate">{i.team}</span>
                <span className="font-mono text-[11px] opacity-70">
                  {i.runs}/{i.wickets}
                </span>
              </button>
            ))}
          </div>

          <div ref={body} className="mt-8">
            {innings[tab] && <Innings inn={innings[tab]} onOpen={onOpenPlayer} />}
          </div>
          <p className="mt-8 font-mono text-[10.5px] leading-relaxed text-jcc-text-muted">
            From the CricHeroes scorecard (match {match.id}). Batters who didn&apos;t bat aren&apos;t in the export. Tap a name for that player&apos;s cards.
          </p>
        </div>
      </div>
    </div>
  );
}
