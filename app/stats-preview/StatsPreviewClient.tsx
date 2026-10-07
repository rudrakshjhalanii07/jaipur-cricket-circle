"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Trophy, Flame, Hand, Zap, Shield } from "lucide-react";
import type {
  BattingRow,
  BowlingRow,
  InningsRecord,
  ScopeKey,
  ScopeStats,
} from "@/lib/scorecard-dashboard/compute";
import { teamByName } from "@/lib/teams";
import { manOfTheMatch, slug, type CardData } from "@/lib/scorecard-dashboard/profile";
import PlayerDeck, { deckHash } from "./PlayerDeck";
import AnalyticsSection from "./AnalyticsSection";
import MatchScorecard from "./MatchScorecard";
import type { PlayerPhotoMap } from "@/lib/player-photos";
import Jaali from "./Jaali";
import { Avatar, PhotoContext, Portrait, usePhoto } from "./Avatar";
import { Counter, ScrollTrigger, afterLoader, gsap, isSeen, reduceMotion, useGSAP, usePill, whenSeen } from "./motion";

// Everything rendered here is either a number or a string formatted on the
// server — no toLocale* calls, so server and client HTML always match.
const dp = (n: number | null, places = 2) => (n === null ? "–" : n.toFixed(places));
const pad = (n: number) => String(n).padStart(2, "0");

const SECTIONS = [
  ["leaders", "Leaders"],
  ["table", "Table"],
  ["leaderboards", "Leaderboards"],
  ["analytics", "Analytics"],
  ["records", "Records"],
  ["results", "Results"],
] as const;
type SectionId = (typeof SECTIONS)[number][0];

const SEASONS: Record<ScopeKey, number[]> = { s2: [2], s3: [3], all: [2, 3] };

const WRAP = "mx-auto w-full max-w-7xl px-5 md:px-10";
/** Small mono caps label — the page's data-label voice. */
const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";

const clipText = (image: string): CSSProperties => ({
  backgroundImage: image,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});
const GOLD = "linear-gradient(135deg, #F3C96A 0%, #D4AF37 45%, #A97824 100%)";
const CAPS = {
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
};

const teamColor = (t?: string) => (t && teamByName(t)?.primary) || "#A97824";

/** Opens a player's flash cards by CricHeroes ID (the merged ID the tables use). */
const OpenPlayer = createContext<(id: string, order?: string[]) => void>(() => {});

// ─── Small pieces ────────────────────────────────────────────────────────────

function TeamLogo({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const team = teamByName(name);
  if (!team) return null;
  return (
    <Image
      src={team.logo}
      alt={team.name}
      title={team.name}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function Logos({ teams, size }: { teams: string[]; size: number }) {
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {teams.map((t) => (
        <TeamLogo key={t} name={t} size={size} />
      ))}
    </div>
  );
}

function SectionHead({
  id,
  n,
  kicker,
  title,
  note,
  dark,
  className = "pt-28 pb-12 md:pt-36 md:pb-16",
}: {
  id: SectionId;
  n: string;
  kicker: string;
  title: string;
  note?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <header id={id} data-head className={`grid scroll-mt-20 items-end gap-x-10 gap-y-4 md:grid-cols-[auto_minmax(0,1fr)_auto] ${className}`}>
      <div className="overflow-hidden">
        <span
          data-head-num
          className={`text-outline block font-heading text-7xl font-bold leading-[0.8] tracking-[-0.04em] md:text-[8.5rem] ${dark ? "text-jcc-accent" : "text-jcc-accent-dark"}`}
        >
          {n}
        </span>
      </div>
      <div className="min-w-0">
        <p data-head-fade className={LABEL}>
          {kicker}
        </p>
        <div className="mt-3 overflow-hidden pb-1">
          <h2 data-head-line className="font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-white md:text-7xl">
            {title}
          </h2>
        </div>
      </div>
      {note && (
        <p data-head-fade className="max-w-xs text-sm leading-snug text-jcc-text-muted md:pb-2 md:text-right">
          {note}
        </p>
      )}
    </header>
  );
}

/** The ranking stat, with a hairline bar scaled to the leader. */
function BarStat({ value, max, lead }: { value: number; max: number; lead?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-4">
      <div className="hidden h-[3px] w-24 overflow-hidden rounded-full bg-jcc-border sm:block">
        <div
          data-bar
          className={`h-full rounded-full transition-[width] duration-700 ${lead ? "bg-gradient-to-r from-jcc-accent-dark to-jcc-accent" : "bg-jcc-blue"}`}
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-10 text-right font-heading text-xl font-bold tracking-tight text-white">{value}</span>
    </div>
  );
}

type Col = { head: string; align?: "left" | "right"; className?: string };

function DataTable({ cols, rows }: { cols: Col[]; rows: { key: string; cells: ReactNode[]; onClick?: () => void }[] }) {
  return (
    <div className="no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-jcc-blue/80">
            {cols.map((c) => (
              <th
                key={c.head}
                className={`px-3 pb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-jcc-text-muted first:pl-0 last:pr-0 ${c.align === "left" ? "text-left" : "text-right"} ${c.className ?? ""}`}
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              data-row
              onClick={r.onClick}
              onKeyDown={r.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.onClick!(); } } : undefined}
              tabIndex={r.onClick ? 0 : undefined}
              className={`group border-b border-jcc-border transition-colors duration-300 hover:bg-jcc-navy-light focus-visible:bg-jcc-navy-light focus-visible:outline-none ${r.onClick ? "cursor-pointer" : ""}`}
            >
              {r.cells.map((c, i) => (
                <td
                  key={i}
                  className={`whitespace-nowrap px-3 py-4 tabular-nums text-jcc-text-muted first:pl-0 last:pr-0 ${cols[i].align === "left" ? "text-left" : "text-right"} ${cols[i].className ?? ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return <span className={`font-mono text-xs font-semibold ${n <= 3 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{pad(n)}</span>;
}

function PlayerName({ name, teams }: { name: string; teams: string[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative">
        <Avatar name={name} size={34} ring={teamColor(teams[0])} />
        {teams[0] && (
          <span className="absolute -bottom-1 -right-1.5 rounded-full bg-jcc-navy p-px">
            <TeamLogo name={teams[0]} size={15} />
          </span>
        )}
      </span>
      <span className="font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1">{name}</span>
    </div>
  );
}

function ShowAll({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="group mt-8 inline-flex items-center gap-3 text-sm font-semibold tracking-tight text-white">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-jcc-blue/20 transition duration-300 group-hover:border-jcc-blue group-hover:bg-jcc-blue group-hover:text-[#FCFBF8]">
        <ArrowDown size={16} className={`transition-transform duration-500 ${open ? "rotate-180" : ""}`} />
      </span>
      {open ? "Show top 10" : `Show all ${total}`}
    </button>
  );
}

// ─── Field drawings (band backgrounds) ───────────────────────────────────────

/**
 * One end of the pitch from above, to Law 7 proportions (1 unit = 1 inch):
 * bowling crease 8ft 8in through the stumps, popping crease 4ft in front,
 * return creases 8ft back from it. Drawn in on scroll.
 */
function CreaseMarks({ className = "" }: { className?: string }) {
  const line = { stroke: "currentColor", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const, fill: "none" };
  return (
    <svg aria-hidden viewBox="-200 -40 400 160" className={`pointer-events-none ${className}`}>
      <path data-draw d="M -190 48 H 190" {...line} />
      <path data-draw d="M -52 0 H 52" {...line} />
      <path data-draw d="M -52 -36 V 104" {...line} />
      <path data-draw d="M 52 -36 V 104" {...line} />
      <path data-draw d="M -60 -36 H 60" {...line} strokeDasharray="2 6" />
      {[-4.5, 0, 4.5].map((x) => (
        <circle key={x} cx={x} cy={0} r={1.6} fill="currentColor" />
      ))}
      <text x={-188} y={40} fill="currentColor" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="1.5">POPPING CREASE</text>
      <text x={58} y={-6} fill="currentColor" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="1.5">BOWLING CREASE</text>
      <text x={-48} y={100} fill="currentColor" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="1.5" transform="rotate(-90 -48 100)">RETURN</text>
    </svg>
  );
}

/** The ground from above: boundary rope, 30-yard circle, square and pitch. */
function FieldPlan({ className = "" }: { className?: string }) {
  const line = { stroke: "currentColor", strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" as const, fill: "none" };
  return (
    <svg aria-hidden viewBox="0 0 1000 1000" className={`pointer-events-none ${className}`}>
      <ellipse data-draw cx="500" cy="500" rx="480" ry="455" {...line} />
      <ellipse data-draw cx="500" cy="500" rx="290" ry="270" {...line} strokeDasharray="5 9" />
      <rect data-draw x="440" y="400" width="120" height="200" {...line} strokeDasharray="2 6" />
      <rect data-draw x="488" y="430" width="24" height="140" {...line} />
      <path data-draw d="M 478 446 H 522 M 478 554 H 522" {...line} />
      <path data-draw d="M 500 45 V 70 M 500 930 V 955 M 20 500 H 45 M 955 500 H 980" {...line} />
      <text x="510" y="235" fill="currentColor" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="2.5">30 YD</text>
      <text x="520" y="40" fill="currentColor" fontSize="11" fontFamily="var(--font-mono)" letterSpacing="2.5">BOUNDARY</text>
    </svg>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

/** A cricket ball's seam, drawn in on load and turned by the scroll. */
function Seam() {
  const left = "M 128 70 C 250 210, 250 390, 128 530";
  const right = "M 472 70 C 350 210, 350 390, 472 530";
  return (
    <svg
      data-seam
      viewBox="0 0 600 600"
      aria-hidden
      className="pointer-events-none absolute -right-[30%] top-28 w-[110vw] max-w-[860px] opacity-35 md:opacity-70 sm:-right-[12%] md:-right-[6%] md:top-14 md:w-[62vw]"
      fill="none"
    >
      <circle cx="300" cy="300" r="282" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
      <circle cx="300" cy="300" r="230" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      {[left, right].map((d) => (
        <g key={d}>
          <path data-seam-draw d={d} stroke="#D4AF37" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path data-seam-stitch d={d} stroke="#F3C96A" strokeOpacity="0.35" strokeWidth="16" strokeDasharray="2 13" />
        </g>
      ))}
    </svg>
  );
}

function SeasonSwitch({ scopes, value, onChange }: { scopes: ScopeStats[]; value: ScopeKey; onChange: (k: ScopeKey) => void }) {
  const { box, pill } = usePill(value);
  return (
    <div ref={box} role="tablist" aria-label="Season" className="relative inline-flex rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur-md">
      <span ref={pill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-accent shadow-[0_8px_24px_-8px_rgba(212,175,55,0.7)]" style={{ opacity: 0 }} />
      {scopes.map((sc) => (
        <button
          key={sc.key}
          role="tab"
          aria-selected={sc.key === value}
          data-active={sc.key === value}
          onClick={() => onChange(sc.key)}
          className={`relative z-10 rounded-full px-4 py-2.5 text-[13px] font-semibold tracking-tight transition-colors duration-300 md:px-6 ${
            sc.key === value ? "text-jcc-seam" : "text-white/70 hover:text-white"
          }`}
        >
          {sc.label}
        </button>
      ))}
    </div>
  );
}

// ─── Leaders spotlight ───────────────────────────────────────────────────────

function CapBlock({
  id,
  cap,
  title,
  name,
  teams,
  value,
  unit,
  detail,
  className = "",
}: {
  id: string;
  cap: keyof typeof CAPS;
  title: string;
  name: string;
  teams: string[];
  value: number;
  unit: string;
  detail: string;
  className?: string;
}) {
  const open = useContext(OpenPlayer);
  const logo = teamByName(teams[0] ?? "")?.logo;
  const hasPhoto = Boolean(usePhoto(name));
  return (
    <button data-reveal data-swap type="button" onClick={() => open(id)} className={`group relative overflow-hidden py-12 text-left lg:py-16 ${className}`}>
      {hasPhoto && <Portrait name={name} className="absolute inset-y-0 right-0 w-[52%] md:w-[46%]" />}
      {!hasPhoto && logo && (
        <div className="pointer-events-none absolute -bottom-10 right-0 w-56 md:w-72" data-parallax>
          <Image src={logo} alt="" width={288} height={288} className="h-auto w-full -rotate-6 object-contain opacity-[0.07] transition duration-700 group-hover:rotate-0 group-hover:scale-105 group-hover:opacity-[0.12]" />
        </div>
      )}
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={{ background: CAPS[cap] }} />
          <span className={LABEL}>{title}</span>
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full border border-jcc-blue/15 transition duration-300 group-hover:border-jcc-blue group-hover:bg-jcc-blue group-hover:text-[#FCFBF8]">
          <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:rotate-45" />
        </span>
      </div>
      <div className="relative mt-10 flex items-end gap-3">
        <span className="font-heading text-[6.5rem] font-bold leading-[0.78] tracking-[-0.06em] tabular-nums md:text-[11rem]" style={clipText(CAPS[cap])}>
          <Counter value={value} />
        </span>
        <span className={`${LABEL} pb-2 md:pb-4`}>{unit}</span>
      </div>
      <div className="relative mt-10 flex items-center gap-3">
        {hasPhoto ? <Logos teams={teams} size={30} /> : <Avatar name={name} size={40} ring={teamColor(teams[0])} />}
        <span className="truncate font-heading text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">{name}</span>
      </div>
      <p className="relative mt-2 font-mono text-xs text-jcc-text-muted">{detail}</p>
    </button>
  );
}

function MinorLeader({
  id,
  icon,
  title,
  name,
  teams,
  value,
  decimals,
  unit,
  detail,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  name: string;
  teams: string[];
  value: number;
  decimals?: number;
  unit: string;
  detail: string;
}) {
  const open = useContext(OpenPlayer);
  return (
    <button data-reveal data-swap type="button" onClick={() => open(id)} className="group border-b border-jcc-border py-8 text-left lg:py-10">
      <span className="inline-flex items-center gap-2 text-jcc-accent-dark">
        {icon}
        <span className={LABEL}>{title}</span>
      </span>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] text-white tabular-nums md:text-6xl">
          <Counter value={value} decimals={decimals} />
        </span>
        <span className={LABEL}>{unit}</span>
      </div>
      <div className="mt-5 flex items-center gap-2.5">
        <Avatar name={name} size={30} ring={teamColor(teams[0])} />
        <span className="truncate font-semibold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{name}</span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-jcc-text-muted">{detail}</p>
    </button>
  );
}

function Spotlight({ s }: { s: ScopeStats }) {
  const runs = s.batting[0];
  const wkts = s.bowling[0];
  const sixes = [...s.batting].sort((a, b) => b.sixes - a.sixes || b.strikeRate - a.strikeRate)[0];
  const fielder = s.fielding[0];
  const fielderTeams = s.batting.find((b) => b.id === fielder?.id)?.teams ?? s.bowling.find((b) => b.id === fielder?.id)?.teams ?? [];
  // Rate leaders need a floor so a 2-ball cameo doesn't top the list.
  const minBalls = s.key === "all" ? 120 : 60;
  const minOvers = s.key === "all" ? 15 : 8;
  const sr = [...s.batting].filter((b) => b.balls >= minBalls).sort((a, b) => b.strikeRate - a.strikeRate)[0];
  const econ = [...s.bowling].filter((b) => b.balls >= minOvers * 6).sort((a, b) => a.economy - b.economy)[0];

  return (
    <>
      <div className="grid border-y border-jcc-blue/80 lg:grid-cols-2">
        {runs && (
          <CapBlock id={runs.id} cap="orange" title="Orange Cap" name={runs.name} teams={runs.teams} value={runs.runs} unit="runs" detail={`${runs.innings} inns · SR ${runs.strikeRate.toFixed(1)} · HS ${runs.highest}`} className="lg:pr-14" />
        )}
        {wkts && (
          <CapBlock id={wkts.id} cap="purple" title="Purple Cap" name={wkts.name} teams={wkts.teams} value={wkts.wickets} unit="wickets" detail={`${wkts.overs} ov · econ ${wkts.economy.toFixed(2)} · best ${wkts.best}`} className="border-t border-jcc-border lg:border-l lg:border-t-0 lg:pl-14" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 lg:grid-cols-4 lg:gap-x-12">
        {sixes && <MinorLeader id={sixes.id} icon={<Flame size={13} />} title="Most sixes" name={sixes.name} teams={sixes.teams} value={sixes.sixes} unit="sixes" detail={`${sixes.fours} fours · ${sixes.runs} runs`} />}
        {sr && <MinorLeader id={sr.id} icon={<Zap size={13} />} title="Strike rate" name={sr.name} teams={sr.teams} value={sr.strikeRate} decimals={1} unit="SR" detail={`${sr.runs} off ${sr.balls} · min ${minBalls} balls`} />}
        {econ && <MinorLeader id={econ.id} icon={<Shield size={13} />} title="Economy" name={econ.name} teams={econ.teams} value={econ.economy} decimals={2} unit="RPO" detail={`${econ.overs} ov · ${econ.wickets} wkts · min ${minOvers} ov`} />}
        {fielder && <MinorLeader id={fielder.id} icon={<Hand size={13} />} title="Fielding" name={fielder.name} teams={fielderTeams} value={fielder.total} unit="dismissals" detail={`${fielder.catches} ct · ${fielder.stumpings} st · ${fielder.runOuts} ro`} />}
      </div>
    </>
  );
}

// ─── Points table ────────────────────────────────────────────────────────────

function Standings({ s }: { s: ScopeStats }) {
  const maxNrr = Math.max(0.001, ...s.standings.map((t) => Math.abs(t.nrr)));
  const grid = "grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[96px_minmax(0,1fr)_repeat(3,44px)_112px_150px_96px] md:gap-x-6";
  return (
    <div data-swap>
      <div className={`${grid} hidden pb-4 md:grid`}>
        {["Pos", "Club", "P", "W", "L", "Form", "NRR", "Pts"].map((h, i) => (
          <span key={h} className={`${LABEL} ${[2, 3, 4, 7].includes(i) ? "text-right" : i === 6 ? "text-center" : ""}`}>{h}</span>
        ))}
      </div>
      <ol>
        {s.standings.map((t, i) => {
          const color = teamByName(t.team)?.primary ?? "#3B6FC4";
          const nrr = `${t.nrr > 0 ? "+" : ""}${t.nrr.toFixed(3)}`;
          return (
            <li key={t.team} data-row className={`${grid} group relative border-t border-white/10 bg-jcc-blue py-6 md:py-8`}>
              <span
                data-wash
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${color} 40%, transparent) 0%, transparent 62%)` }}
              />
              <span className={`relative font-heading text-5xl font-bold leading-none tracking-[-0.04em] md:text-7xl ${i === 0 ? "text-jcc-accent" : "text-outline text-white/50"}`}>{i + 1}</span>
              <div className="relative flex min-w-0 items-center gap-3 md:gap-5">
                <TeamLogo name={t.team} size={52} className="transition-transform duration-500 group-hover:scale-110" />
                <div className="min-w-0">
                  <div className="truncate font-heading text-2xl font-bold tracking-[-0.03em] text-white md:text-4xl">{t.team}</div>
                  <div className="mt-1 font-mono text-[11px] text-white/60 md:hidden">
                    P{t.played} W{t.won} L{t.lost}{t.tied ? ` T${t.tied}` : ""} · NRR {nrr}
                  </div>
                  {t.tied > 0 && <div className="mt-1 hidden font-mono text-[11px] text-white/60 md:block">{t.tied} tied</div>}
                </div>
              </div>
              {[t.played, t.won, t.lost].map((v, k) => (
                <span key={k} className="relative hidden text-right font-mono text-base tabular-nums text-white/80 md:block">{v}</span>
              ))}
              <div className="relative hidden items-center gap-1.5 md:flex" title="Last 5 results, oldest → newest">
                {t.form.slice(-5).map((r, k) => (
                  <span
                    key={k}
                    title={r}
                    className={`h-3 w-3 rounded-full ${r === "W" ? "bg-jcc-accent shadow-[0_0_12px_rgba(212,175,55,0.6)]" : r === "L" ? "bg-white/20" : "border border-white/60"}`}
                  />
                ))}
              </div>
              <div className="relative hidden md:block">
                <div className="relative h-1.5 rounded-full bg-white/10">
                  <span className="absolute -inset-y-1 left-1/2 w-px bg-white/30" />
                  <span
                    data-bar
                    data-origin={t.nrr >= 0 ? "left" : "right"}
                    className={`absolute inset-y-0 rounded-full ${t.nrr >= 0 ? "left-1/2 bg-jcc-accent" : "right-1/2 bg-white/45"}`}
                    style={{ width: `${(Math.abs(t.nrr) / maxNrr) * 50}%` }}
                  />
                </div>
                <div className={`mt-2 text-center font-mono text-xs tabular-nums ${t.nrr >= 0 ? "text-jcc-accent-highlight" : "text-white/60"}`}>{nrr}</div>
              </div>
              <div className="relative text-right">
                <div className="font-heading text-5xl font-bold leading-none tracking-[-0.04em] text-white tabular-nums md:text-6xl">
                  <Counter value={t.points} />
                </div>
                <div className="mt-1.5 font-mono text-[10.5px] text-white/75">{t.pct.toFixed(1)}%</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Leaderboards ────────────────────────────────────────────────────────────

type Disc = "bat" | "bowl" | "field";
const DISCS: [Disc, string][] = [
  ["bat", "Batting"],
  ["bowl", "Bowling"],
  ["field", "Fielding"],
];
const DISC_NOTE: Record<Disc, string> = {
  bat: "Most runs · ties: strike rate, then average",
  bowl: "Most wickets · ties: economy, then runs conceded",
  field: "From dismissal text · every fielder named in a run-out is credited",
};

type Pod = { id: string; name: string; teams: string[]; value: number; unit: string; sub: string };

/** Top three on plinths: #2, #1, #3 left to right. Keyed by place so the numbers tween between disciplines. */
function Podium({ items, order }: { items: Pod[]; order: string[] }) {
  const open = useContext(OpenPlayer);
  const heights = ["h-36 md:h-56", "h-24 md:h-40", "h-20 md:h-32"];
  return (
    <div className="grid grid-cols-3 items-end gap-2 md:gap-5">
      {[1, 0, 2].map((r) => {
        const it = items[r];
        if (!it) return <div key={r} />;
        const first = r === 0;
        const canOpen = !it.id.startsWith("name:");
        return (
          <button key={r} data-swap type="button" disabled={!canOpen} onClick={() => open(it.id, order)} className="group flex min-w-0 flex-col text-left">
            <div className="min-w-0 px-1 pb-5 md:px-2">
              <div className="flex items-end gap-2">
                <Avatar name={it.name} size={first ? 76 : 56} ring={first ? "#D4AF37" : "rgba(18,35,63,0.18)"} className="transition-transform duration-500 group-hover:-translate-y-1" />
                <Logos teams={it.teams} size={first ? 24 : 20} />
              </div>
              <div className={`mt-3 truncate font-heading font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline ${first ? "text-lg md:text-3xl" : "text-base md:text-2xl"}`}>
                {it.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={`font-heading font-bold leading-none tracking-[-0.05em] tabular-nums ${first ? "text-5xl md:text-8xl" : "text-4xl text-white md:text-6xl"}`}
                  style={first ? clipText(GOLD) : undefined}
                >
                  <Counter value={it.value} />
                </span>
                <span className={`${LABEL} hidden sm:inline`}>{it.unit}</span>
              </div>
              <p className="mt-2 hidden truncate font-mono text-[11px] text-jcc-text-muted md:block">{it.sub}</p>
            </div>
            <div data-plinth className={`relative w-full overflow-hidden rounded-t-2xl ${heights[r]} ${first ? "bg-jcc-blue" : r === 1 ? "bg-jcc-blue/85" : "bg-jcc-blue/70"}`}>
              {first && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-jcc-accent-highlight via-jcc-accent to-jcc-accent-dark" />}
              <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
              <span className={`text-outline absolute bottom-1 left-3 font-heading text-6xl font-bold leading-none md:bottom-2 md:left-5 md:text-8xl ${first ? "text-jcc-accent" : "text-[#FCFBF8]/45"}`}>{r + 1}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Leaderboards({ s }: { s: ScopeStats }) {
  const [disc, setDisc] = useState<Disc>("bat");
  const [open, setOpen] = useState(false);
  const openPlayer = useContext(OpenPlayer);
  const { box, pill } = usePill(disc);
  const boardRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (reduceMotion()) return;
      const q = gsap.utils.selector(boardRef);
      gsap.from(q("[data-plinth]"), { scaleY: 0, transformOrigin: "bottom center", duration: 1.1, ease: "expo.out", stagger: 0.08 });
      gsap.from(q("[data-row]"), { autoAlpha: 0, y: 14, duration: 0.7, ease: "expo.out", stagger: 0.03 });
    },
    { dependencies: [disc], scope: boardRef },
  );

  const teamsOf = (id: string) => s.batting.find((b) => b.id === id)?.teams ?? s.bowling.find((b) => b.id === id)?.teams ?? [];
  let pods: Pod[];
  let ids: string[];
  let cols: Col[];
  let rows: { key: string; cells: ReactNode[]; onClick?: () => void }[];

  if (disc === "bat") {
    const all: BattingRow[] = s.batting;
    const max = all[0]?.runs ?? 0;
    ids = all.map((r) => r.id);
    pods = all.slice(0, 3).map((p) => ({ id: p.id, name: p.name, teams: p.teams, value: p.runs, unit: "runs", sub: `SR ${p.strikeRate.toFixed(1)} · avg ${dp(p.average, 1)} · HS ${p.highest}` }));
    cols = [{ head: "#", align: "left", className: "w-12" }, { head: "Player", align: "left" }, { head: "Runs" }, { head: "M" }, { head: "Inn" }, { head: "NO" }, { head: "HS" }, { head: "Avg" }, { head: "SR" }, { head: "30s" }, { head: "50s" }, { head: "4s" }, { head: "6s" }];
    rows = (open ? all : all.slice(0, 10)).map((p, i) => ({
      key: p.id,
      onClick: () => openPlayer(p.id, ids),
      cells: [<Rank key="r" n={i + 1} />, <PlayerName key="p" name={p.name} teams={p.teams} />, <BarStat key="b" value={p.runs} max={max} lead={i === 0} />, p.matches, p.innings, p.notOuts, p.highest, dp(p.average), p.strikeRate.toFixed(2), p.thirties, p.fifties, p.fours, p.sixes],
    }));
  } else if (disc === "bowl") {
    const all: BowlingRow[] = s.bowling;
    const max = all[0]?.wickets ?? 0;
    ids = all.map((r) => r.id);
    pods = all.slice(0, 3).map((p) => ({ id: p.id, name: p.name, teams: p.teams, value: p.wickets, unit: "wkts", sub: `econ ${p.economy.toFixed(2)} · ${p.overs} ov · best ${p.best}` }));
    cols = [{ head: "#", align: "left", className: "w-12" }, { head: "Player", align: "left" }, { head: "Wkts" }, { head: "M" }, { head: "Overs" }, { head: "Runs" }, { head: "Best" }, { head: "Econ" }, { head: "Avg" }, { head: "Dot %" }, { head: "Mdn" }, { head: "Wd" }, { head: "Nb" }];
    rows = (open ? all : all.slice(0, 10)).map((p, i) => ({
      key: p.id,
      onClick: () => openPlayer(p.id, ids),
      cells: [<Rank key="r" n={i + 1} />, <PlayerName key="p" name={p.name} teams={p.teams} />, <BarStat key="b" value={p.wickets} max={max} lead={i === 0} />, p.matches, p.overs, p.runs, p.best, p.economy.toFixed(2), dp(p.average), p.dotPct.toFixed(1), p.maidens, p.wides, p.noBalls],
    }));
  } else {
    const all = s.fielding;
    const max = all[0]?.total ?? 0;
    ids = all.map((r) => r.id);
    pods = all.slice(0, 3).map((f) => ({ id: f.id, name: f.name, teams: teamsOf(f.id), value: f.total, unit: "dismissals", sub: `${f.catches} ct · ${f.stumpings} st · ${f.runOuts} ro` }));
    cols = [{ head: "#", align: "left", className: "w-12" }, { head: "Player", align: "left" }, { head: "Total" }, { head: "Catches" }, { head: "Stumpings" }, { head: "Run-outs" }];
    rows = (open ? all : all.slice(0, 10)).map((f, i) => ({
      key: f.id,
      onClick: f.id.startsWith("name:") ? undefined : () => openPlayer(f.id, ids),
      cells: [<Rank key="r" n={i + 1} />, <PlayerName key="p" name={f.name} teams={teamsOf(f.id)} />, <BarStat key="b" value={f.total} max={max} lead={i === 0} />, f.catches, f.stumpings, f.runOuts],
    }));
  }
  const total = disc === "bat" ? s.batting.length : disc === "bowl" ? s.bowling.length : s.fielding.length;

  return (
    <div ref={boardRef}>
      <div className="mb-14 flex flex-wrap items-center justify-between gap-4">
        <div ref={box} role="tablist" aria-label="Discipline" className="relative inline-flex rounded-full bg-jcc-navy-light p-1">
          <span ref={pill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue shadow-[0_10px_24px_-10px_rgba(18,35,63,0.6)]" style={{ opacity: 0 }} />
          {DISCS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={disc === k}
              data-active={disc === k}
              onClick={() => { setDisc(k); setOpen(false); }}
              className={`relative z-10 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-colors duration-300 md:px-8 ${disc === k ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-jcc-text-muted">{DISC_NOTE[disc]} · tap a player for their cards</p>
      </div>
      <Podium items={pods} order={ids} />
      <div className="mt-16">
        <DataTable cols={cols} rows={rows} />
      </div>
      {total > 10 && <ShowAll total={total} open={open} onToggle={() => setOpen((v) => !v)} />}
    </div>
  );
}

// ─── Records ─────────────────────────────────────────────────────────────────

function TenOver() {
  return <span className="ml-1.5 rounded-full bg-jcc-accent px-1.5 py-px font-mono text-[9px] font-semibold uppercase text-jcc-seam">10 ov</span>;
}

function RecordColumn({ title, items, teamFromLabel }: { title: string; items: InningsRecord[]; teamFromLabel?: boolean }) {
  const [first, ...more] = items;
  const rest = more.slice(0, 4);
  return (
    <div data-reveal className="mr-4 flex w-[80vw] shrink-0 snap-start flex-col rounded-3xl bg-jcc-blue p-6 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.6)] ring-1 ring-white/10 sm:w-[340px] md:mr-5 md:w-[380px] md:p-8">
      <h3 className={LABEL}>{title}</h3>
      {first && (
        <>
          <div className="mt-8 font-heading text-6xl font-bold leading-none tracking-[-0.05em] md:text-7xl" style={clipText(GOLD)}>
            {first.value}
          </div>
          <div className="mt-5 flex items-center gap-2.5">
            {teamFromLabel ? <TeamLogo name={first.label} size={28} /> : <Avatar name={first.label} size={36} ring="#D4AF37" />}
            <span className="truncate text-xl font-semibold tracking-tight text-white">{first.label}</span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-white/75">
            {first.sub} · {first.date}
            {first.tenOver && <TenOver />}
          </p>
        </>
      )}
      <ol className="mt-8 border-t border-white/10">
        {rest.map((r, i) => (
          <li key={`${r.matchId}-${r.label}-${i}`} className="flex items-center gap-3 border-b border-white/10 py-3.5">
            <span className="w-5 shrink-0 font-mono text-[11px] text-white/65">{pad(i + 2)}</span>
            {teamFromLabel && <TeamLogo name={r.label} size={20} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-white">{r.label}</div>
              <div className="truncate font-mono text-[10.5px] text-white/70">
                {r.sub} · {r.date}
                {r.tenOver && <TenOver />}
              </div>
            </div>
            <span className="shrink-0 font-heading text-xl font-bold tabular-nums tracking-tight text-white">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function Results({ s, onOpen, mom }: { s: ScopeStats; onOpen: (matchId: string) => void; mom: Map<string, { name: string; team: string }> }) {
  return (
    <div>
      {s.matchdays.map((d) => {
        const [weekday, ...rest] = d.label.split(", ");
        return (
          <div key={d.date} className="grid gap-4 border-t border-jcc-blue/80 py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:py-12">
            <div data-reveal className="self-start lg:sticky lg:top-28">
              <p className={LABEL}>{rest.length ? weekday : "Matchday"}</p>
              <p className="mt-1 font-heading text-4xl font-bold tracking-[-0.045em] text-white md:text-5xl">{rest.length ? rest.join(", ") : d.label}</p>
              <p className="mt-2 font-mono text-[11px] text-jcc-text-muted">
                {d.matches.length} {d.matches.length === 1 ? "match" : "matches"} · {d.matches[0].venue}
              </p>
            </div>
            <ul className="divide-y divide-jcc-border">
              {d.matches.map((m) => {
                const runs = m.lines.map((l) => parseInt(l.score, 10) || 0);
                const sum = runs.reduce((a, b) => a + b, 0) || 1;
                const pom = mom.get(m.matchId);
                return (
                  <li key={m.matchId} data-row>
                    <button
                      type="button"
                      onClick={() => onOpen(m.matchId)}
                      aria-label={`Full scorecard: ${m.lines.map((l) => l.team).join(" v ")}`}
                      className="group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 py-6 text-left md:grid-cols-[minmax(0,1fr)_minmax(0,240px)_auto] md:gap-x-10"
                    >
                      <span aria-hidden className="pointer-events-none absolute -inset-x-4 inset-y-1 rounded-2xl bg-jcc-navy-light opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <div className="relative space-y-2.5">
                        {m.lines.map((l) => (
                          <div key={l.team} className="flex items-center gap-3">
                            <TeamLogo name={l.team} size={28} />
                            <span className={`flex-1 truncate text-base md:text-lg ${l.won ? "font-semibold text-white" : "text-jcc-text-muted"}`}>{l.team}</span>
                            <span className={`font-heading text-xl tabular-nums tracking-tight md:text-2xl ${l.won ? "font-bold text-white" : "font-medium text-jcc-text-muted"}`}>{l.score}</span>
                          </div>
                        ))}
                      </div>
                      <div className="relative col-span-2 md:col-span-1">
                        <div className="flex h-1.5 gap-1">
                          {m.lines.map((l, k) => (
                            <span
                              key={l.team}
                              data-bar
                              className="h-full rounded-full"
                              style={{ width: `${(runs[k] / sum) * 100}%`, background: teamByName(l.team)?.primary ?? "#667085", opacity: l.won ? 1 : 0.3 }}
                            />
                          ))}
                        </div>
                        <p className="mt-3 text-[13px] font-semibold text-white">
                          {m.result}
                          {m.overs !== 7 && <span className="ml-2 rounded-full bg-jcc-accent px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase text-jcc-seam">{m.overs} ov</span>}
                        </p>
                        {pom && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-jcc-text-muted">
                            <Trophy size={12} className="shrink-0 text-jcc-accent-dark" />
                            <Avatar name={pom.name} size={18} />
                            <span className="truncate">{pom.name}</span>
                          </p>
                        )}
                      </div>
                      <span className="relative col-start-2 row-start-1 grid h-11 w-11 place-items-center rounded-full border border-jcc-blue/15 transition duration-300 group-hover:border-jcc-blue group-hover:bg-jcc-blue group-hover:text-[#FCFBF8] md:col-start-3">
                        <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:rotate-45" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Highlights the nav item for whichever section is under the reading line. */
function useActiveSection() {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const pick = () => {
      const line = window.innerHeight * 0.35;
      let current: SectionId | null = null;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id as SectionId;
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, []);
  return active;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatsPreviewClient({ scopes, cardData, photos }: { scopes: ScopeStats[]; cardData: CardData; photos: PlayerPhotoMap }) {
  const [key, setKey] = useState<ScopeKey>("s3");
  const s = scopes.find((x) => x.key === key)!;
  const seasons = SEASONS[key];
  const active = useActiveSection();
  const { box: navBox, pill: navPill } = usePill(active);
  const root = useRef<HTMLElement>(null);

  // Player flash cards. The URL hash (#player-<name>.<card>) makes a deck shareable.
  const [deck, setDeck] = useState<{ p: number; card?: string; order: number[] } | null>(null);
  const [matchOpen, setMatchOpen] = useState<string | null>(null);
  const closeMatch = () => setMatchOpen(null);
  const momById = useMemo(() => {
    const out = new Map<string, { name: string; team: string }>();
    for (const [m, x] of manOfTheMatch(cardData)) out.set(cardData.matches[m].id, { name: cardData.players[x.p], team: x.team });
    return out;
  }, [cardData]);
  const indexOfId = useMemo(() => new Map(cardData.playerIds.map((id, i) => [id, i])), [cardData]);
  const setHash = (h: string | null) => {
    window.history.replaceState(null, "", h ? `#${h}` : window.location.pathname + window.location.search);
  };
  const openIndex = useCallback(
    (p: number, card?: string, order?: number[]) => {
      setDeck((d) => ({ p, card, order: order ?? d?.order ?? [p] }));
      setHash(deckHash(cardData.players[p], card));
    },
    [cardData],
  );
  const openById = useCallback(
    (id: string, order?: string[]) => {
      const p = indexOfId.get(id);
      if (p == null) return;
      openIndex(p, undefined, order?.map((x) => indexOfId.get(x)).filter((x): x is number => x != null));
    },
    [indexOfId, openIndex],
  );
  useEffect(() => {
    // Opens the deck named in the hash: on arrival from a shared link, and on back/forward.
    const fromHash = () => {
      const m = window.location.hash.match(/^#player-([a-z0-9-]+)(?:\.([a-z-]+))?$/);
      const p = m ? cardData.players.findIndex((n) => slug(n) === m[1]) : -1;
      if (!m || p < 0) return setDeck(null);
      setKey("all");
      setDeck((d) => ({ p, card: m[2], order: d?.order.includes(p) ? d.order : [p] }));
    };
    const frame = requestAnimationFrame(fromHash);
    window.addEventListener("hashchange", fromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [cardData]);

  // ── Motion: intro, scroll reveals, parallax, marquee, horizontal records ──
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);

      // Content grows (show all, tabs, season switch): keep trigger positions honest.
      let pending: gsap.core.Tween | undefined;
      const ro = new ResizeObserver(() => {
        pending?.kill();
        pending = gsap.delayedCall(0.25, () => ScrollTrigger.refresh());
      });
      if (root.current) ro.observe(root.current);
      if (reduceMotion()) return () => ro.disconnect();

      // Hero intro.
      q("[data-seam-draw]").forEach((p) => {
        const len = (p as unknown as SVGPathElement).getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: 0 });
      });
      const intro = gsap
        .timeline({ paused: true, defaults: { ease: "expo.out", duration: 1.1 } })
        .from(q("[data-hero=kicker]"), { y: 14, autoAlpha: 0, stagger: 0.08, duration: 0.8 })
        .from(q("[data-hero=line]"), { yPercent: 115, stagger: 0.12, duration: 1.4 }, 0.15)
        .from(q("[data-seam-draw]"), { strokeDashoffset: (_i: number, el: SVGPathElement) => el.getTotalLength(), duration: 2.4, ease: "power2.inOut", stagger: 0.15 }, 0.2)
        .from(q("[data-seam-stitch]"), { autoAlpha: 0, duration: 1.4, stagger: 0.15 }, 1.1)
        .from(q("[data-hero=fade]"), { y: 24, autoAlpha: 0, stagger: 0.1 }, 0.55)
        .from(q("[data-hero=rule]"), { scaleX: 0, transformOrigin: "left center", duration: 1.6 }, 0.7)
        .from(q("[data-hero=kpi]"), { y: 30, autoAlpha: 0, stagger: 0.06 }, 0.8)
        .from(q("[data-hero=bar]"), { scaleX: 0, transformOrigin: "left center", stagger: 0.1, duration: 1.4 }, 1.1);
      const cancelIntro = afterLoader(() => intro.play());

      // Hero depth on scroll.
      const hero = q("[data-hero-root]")[0];
      const heroScroll = { trigger: hero, start: "top top", end: "bottom top", scrub: true };
      gsap.to(q("[data-seam]"), { rotate: 55, yPercent: 18, ease: "none", scrollTrigger: heroScroll });
      gsap.to(q("[data-hero=content]"), { yPercent: -10, autoAlpha: 0.2, ease: "none", scrollTrigger: { ...heroScroll, start: "25% top" } });
      gsap.to(q("[data-glow]"), { xPercent: -18, yPercent: 14, scale: 1.2, duration: 10, ease: "sine.inOut", yoyo: true, repeat: -1 });

      // Leaders ticker: a steady loop that surges with scroll speed.
      const track = q("[data-marquee]")[0];
      if (track) {
        const loop = gsap.to(track, { xPercent: -50, duration: 45, ease: "none", repeat: -1 });
        ScrollTrigger.create({
          onUpdate: (self) => {
            const boost = Math.min(Math.abs(self.getVelocity()) / 300, 5);
            gsap.to(loop, { timeScale: 1 + boost, duration: 0.2, overwrite: true, onComplete: () => void gsap.to(loop, { timeScale: 1, duration: 1.2 }) });
          },
        });
      }

      // Reading progress along the bottom of the section capsule.
      gsap.fromTo(
        q("[data-progress]"),
        { scaleX: 0 },
        { scaleX: 1, ease: "none", scrollTrigger: { trigger: q("[data-content]")[0], start: "top 60%", end: "bottom bottom", scrub: 0.3 } },
      );

      // Section heads: the index numeral rises, the title wipes up out of a mask.
      q("[data-head]").forEach((h) => {
        if (isSeen(h)) return;
        const num = h.querySelector("[data-head-num]");
        const line = h.querySelector("[data-head-line]");
        const fades = h.querySelectorAll("[data-head-fade]");
        gsap.set(num, { yPercent: 100 });
        gsap.set(line, { yPercent: 110 });
        gsap.set(fades, { autoAlpha: 0, y: 12 });
        whenSeen(
          h,
          () =>
            void gsap
              .timeline({ defaults: { ease: "expo.out" } })
              .to(num, { yPercent: 0, duration: 1.4 })
              .to(line, { yPercent: 0, duration: 1.2 }, 0.08)
              .to(fades, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.9 }, 0.25),
          0.88,
        );
      });

      // Batched reveals for everything below the fold.
      const batch = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars, start = "top 90%") => {
        const els = q(sel).filter((el) => !isSeen(el));
        if (!els.length) return;
        gsap.set(els, from);
        ScrollTrigger.batch(els, { start, once: true, onEnter: (b) => void gsap.to(b, { ...to, overwrite: true }) });
      };
      batch("[data-reveal]", { autoAlpha: 0, y: 56 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.09 });
      batch("[data-row]", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.045 });
      batch("[data-wash]", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 1.8, ease: "expo.out", stagger: 0.1, delay: 0.1 });
      batch("[data-plinth]", { scaleY: 0, transformOrigin: "bottom center" }, { scaleY: 1, duration: 1.4, ease: "expo.out", stagger: 0.12, delay: 0.15 }, "top 95%");
      q("[data-bar]").forEach((el) => gsap.set(el, { transformOrigin: el.dataset.origin === "right" ? "right center" : "left center" }));
      batch("[data-bar]", { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "expo.out", stagger: 0.03, delay: 0.2 }, "top 95%");

      // Field drawings trace themselves in when their band arrives.
      const draws = q("[data-draw]") as unknown as SVGGeometryElement[];
      draws.forEach((d) => {
        const len = d.getTotalLength();
        const dashed = d.getAttribute("stroke-dasharray");
        if (dashed) {
          gsap.set(d, { autoAlpha: 0 });
          whenSeen(d.ownerSVGElement ?? d, () => void gsap.to(d, { autoAlpha: 1, duration: 1.6, delay: 0.6, ease: "power2.out" }), 0.85);
          return;
        }
        gsap.set(d, { strokeDasharray: len, strokeDashoffset: len });
        whenSeen(d.ownerSVGElement ?? d, () => void gsap.to(d, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", delay: Math.random() * 0.4 }), 0.85);
      });

      // Team crests drift against the scroll.
      q("[data-parallax]").forEach((el) =>
        gsap.fromTo(el, { yPercent: 18 }, { yPercent: -18, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } }),
      );

      // Records: vertical scroll drives a sideways pan on wide screens.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const sec = q("[data-hscroll]")[0];
        const rail = q("[data-track]")[0];
        if (!sec || !rail) return;
        gsap.to(rail, {
          x: () => Math.min(0, window.innerWidth - rail.scrollWidth),
          ease: "none",
          scrollTrigger: { trigger: sec, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
        });
      });

      return () => {
        cancelIntro();
        ro.disconnect();
        mm.revert();
      };
    },
    { scope: root },
  );

  // Season switch: re-deal whatever is on screen while the numbers tween.
  const firstSwap = useRef(true);
  useGSAP(
    () => {
      if (firstSwap.current) {
        firstSwap.current = false;
        return;
      }
      ScrollTrigger.refresh();
      if (reduceMotion()) return;
      const onScreen = gsap.utils.toArray<HTMLElement>("[data-swap]", root.current).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && getComputedStyle(el).opacity === "1";
      });
      gsap.fromTo(onScreen, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: "expo.out", overwrite: true });
    },
    { dependencies: [key], scope: root },
  );

  const { summary } = s;
  const heroStats: [string, number, number, boolean][] = [
    ["Matches", summary.matches, 0, false],
    ["Runs", summary.runs, 0, true],
    ["Wickets", summary.wickets, 0, false],
    ["Sixes", summary.sixes, 0, false],
    ["Fours", summary.fours, 0, false],
    ["Avg 1st inns", summary.avgFirstInnings, 1, false],
  ];
  const totalWins = summary.defendsWon + summary.chasesWon;
  const chasePct = totalWins ? Math.round((summary.chasesWon / totalWins) * 100) : 0;
  const ticker = [
    s.batting[0] && { k: "Orange Cap", v: s.batting[0].name, d: `${s.batting[0].runs} runs`, player: true },
    s.bowling[0] && { k: "Purple Cap", v: s.bowling[0].name, d: `${s.bowling[0].wickets} wkts`, player: true },
    s.topScores[0] && { k: "Top score", v: s.topScores[0].label, d: s.topScores[0].value, player: true },
    s.bestSpells[0] && { k: "Best spell", v: s.bestSpells[0].label, d: s.bestSpells[0].value, player: true },
    s.biggestWins[0] && { k: "Biggest win", v: s.biggestWins[0].label, d: s.biggestWins[0].value, player: false },
    s.highestTotals[0] && { k: "Highest total", v: s.highestTotals[0].label, d: s.highestTotals[0].value, player: false },
  ].filter((x): x is { k: string; v: string; d: string; player: boolean } => Boolean(x));

  return (
    <PhotoContext.Provider value={photos}>
    <OpenPlayer.Provider value={openById}>
    <main ref={root}>
      {/* ── Hero ── */}
      <section data-hero-root className="print-grain theme-static-dark section-bg-royal relative overflow-hidden pt-36 md:pt-44">
        <Jaali />
        <div data-glow className="pointer-events-none absolute -right-40 -top-40 h-136 w-136 rounded-full bg-jcc-accent/15 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 h-120 w-120 rounded-full bg-[#3B6FC4]/30 blur-[120px]" />
        <Seam />

        <div data-hero="content" className={`${WRAP} relative`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span data-hero="kicker" className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/75">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jcc-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-jcc-accent" />
              </span>
              JCC Data · Seasons 2–3
            </span>
            <span data-hero="kicker" className="rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
              Preview · unlisted
            </span>
          </div>

          <h1 className="mt-12 font-heading text-[clamp(3.6rem,11.5vw,11rem)] font-bold leading-[0.86] tracking-[-0.055em] text-white">
            <span className="-mb-[0.1em] block overflow-hidden pb-[0.16em]">
              <span data-hero="line" className="block">Every ball,</span>
            </span>
            <span className="-mb-[0.1em] block overflow-hidden pb-[0.16em]">
              <span data-hero="line" className="block">
                <span className="text-white/40">counted</span>
                <span className="text-jcc-accent">.</span>
              </span>
            </span>
          </h1>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
            <p data-hero="fade" className="max-w-md text-base leading-relaxed text-white/65 md:text-lg">
              Every scorecard from Seasons 2 and 3 — 58 matches, 14 Jun to 2 Oct 2026 — pulled from CricHeroes and ranked the IPL way.
            </p>
            <div data-hero="fade">
              <SeasonSwitch scopes={scopes} value={key} onChange={setKey} />
            </div>
          </div>

          <dl className="relative mt-16 grid grid-cols-3 md:grid-cols-6">
            <span data-hero="rule" aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/20" />
            {heroStats.map(([label, value, decimals, comma]) => (
              <div key={label} data-hero="kpi" className="py-6 pr-3 md:py-8">
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/50">{label}</dt>
                <dd className="mt-3 font-heading text-[2rem] font-bold leading-none tracking-[-0.05em] tabular-nums text-white sm:text-5xl lg:text-6xl">
                  <Counter value={value} decimals={decimals} comma={comma} delay={0.9} intro />
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 max-w-xl">
            <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/60">
              <span><b className="font-semibold text-white">{summary.defendsWon}</b> won batting first</span>
              <span><b className="font-semibold text-white">{summary.chasesWon}</b> won chasing</span>
            </div>
            <div className="mt-2.5 flex h-1.5 gap-1">
              <div data-hero="bar" className="rounded-full bg-jcc-accent transition-[width] duration-700" style={{ width: `${100 - chasePct}%` }} />
              <div data-hero="bar" className="rounded-full bg-white/35 transition-[width] duration-700" style={{ width: `${chasePct}%` }} />
            </div>
          </div>
        </div>

        <div data-hero="fade" className="relative mt-16 border-y border-white/10 py-5 md:py-7">
          <div className="edge-fade overflow-hidden">
            <div data-marquee className="flex w-max items-center">
              {[0, 1].map((dup) => (
                <div key={dup} aria-hidden={dup === 1} className="flex items-center">
                  {ticker.map((t) => (
                    <span key={t.k} className="flex items-center gap-4 whitespace-nowrap px-6 md:gap-5 md:px-10">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-jcc-accent">{t.k}</span>
                      {t.player ? <Avatar name={t.v} size={40} ring="rgba(212,175,55,0.7)" /> : <TeamLogo name={t.v} size={36} />}
                      <span className="font-heading text-2xl font-bold tracking-[-0.03em] text-white md:text-4xl">{t.v}</span>
                      <span className="text-outline font-heading text-2xl font-bold tracking-[-0.03em] text-white/60 md:text-4xl">{t.d}</span>
                      <span className="pl-4 text-jcc-accent/60 md:pl-6">✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-16" />
      </section>

      {/* ── Floating section capsule ── */}
      <nav aria-label="Sections" className="pointer-events-none sticky top-4 z-30 -mt-8 flex justify-center px-4">
        <div className="pointer-events-auto relative max-w-full overflow-hidden rounded-full border border-jcc-border bg-jcc-navy/85 shadow-[0_24px_48px_-24px_rgba(18,35,63,0.5)] backdrop-blur-xl">
          <div ref={navBox} className="no-scrollbar relative flex items-center gap-0.5 overflow-x-auto p-1.5">
            <span ref={navPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue" style={{ opacity: 0 }} />
            {SECTIONS.map(([id, label], i) => (
              <a
                key={id}
                href={`#${id}`}
                data-active={active === id}
                aria-current={active === id ? "true" : undefined}
                className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300 ${
                  active === id ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"
                }`}
              >
                <span className={`font-mono text-[10px] ${active === id ? "text-jcc-accent" : "opacity-50"}`}>{pad(i + 1)}</span>
                {label}
              </a>
            ))}
            <span className="relative z-10 ml-1 hidden whitespace-nowrap rounded-full bg-jcc-accent/15 px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-jcc-accent-dark lg:block">
              {s.label}
            </span>
          </div>
          <span
            data-progress
            aria-hidden
            className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-jcc-accent-dark to-jcc-accent"
            style={{ transform: "scaleX(0)", transformOrigin: "left center" }}
          />
        </div>
      </nav>

      <div data-content>
        {/* ── 01 Leaders ── */}
        <section className={WRAP}>
          <SectionHead id="leaders" n="01" kicker={`Leaders · ${s.label}`} title="Top of the charts" note="The season's headline acts. Tap any of them for their cards." />
          <Spotlight s={s} />
        </section>

        {/* ── 02 Points table ── */}
        <section className="print-grain theme-static-dark section-bg-royal relative mt-28 overflow-hidden pb-24 md:mt-36 md:pb-32">
          <Jaali />
          <CreaseMarks className="absolute -right-24 -top-24 w-[560px] text-white/25 md:-right-6 md:-top-16 md:w-[680px]" />
          <div className={`${WRAP} relative`}>
            <SectionHead
              id="table"
              n="02"
              dark
              kicker="Standings"
              title="Points table"
              note={`${key === "all" ? "Both seasons combined · " : ""}Win 2 · Tie 1 · ranked by points %, then NRR`}
            />
            <Standings s={s} />
          </div>
        </section>

        {/* ── 03 Leaderboards ── */}
        <section className={WRAP}>
          <SectionHead id="leaderboards" n="03" kicker="Orange & Purple Cap race" title="Leaderboards" />
          <Leaderboards s={s} />
        </section>

        {/* ── 04 Analytics ── */}
        <section className="mt-28 bg-jcc-navy-light/70 pb-28 md:mt-36">
          <div className={WRAP}>
            <SectionHead id="analytics" n="04" kicker="Deep dive" title="Analytics" note="Leaderboards, death overs, team DNA, player labels, attendance" />
            <AnalyticsSection data={cardData} seasons={seasons} onOpenPlayer={(p, card) => openIndex(p, card, [p])} onOpenMatch={setMatchOpen} />
          </div>
        </section>

        {/* ── 05 Records — pans sideways on wide screens ── */}
        <section data-hscroll className="theme-static-dark section-bg-royal relative motion-safe:lg:h-[280vh]">
          <div className="print-grain relative overflow-hidden pb-24 motion-safe:lg:sticky motion-safe:lg:top-0 motion-safe:lg:flex motion-safe:lg:h-screen motion-safe:lg:flex-col motion-safe:lg:justify-center motion-safe:lg:pb-0 motion-safe:lg:pt-20">
            <Jaali />
            <FieldPlan className="absolute -bottom-[30%] -right-[18%] w-[900px] text-white/20 md:w-[1100px]" />
            <div className={`${WRAP} relative`}>
              <SectionHead id="records" n="05" dark kicker="Hall of fame" title="Records" note="10 ov = one of the three 10-over matches on 26 Jun" className="pt-28 pb-10 motion-safe:lg:pt-0" />
            </div>
            <div className="no-scrollbar relative snap-x snap-mandatory overflow-x-auto motion-safe:lg:overflow-visible">
              <div data-track className="flex w-max pl-5 pr-5 md:pl-10 lg:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] lg:pr-[12vw]">
                <RecordColumn title="Top individual scores" items={s.topScores} />
                <RecordColumn title="Best bowling figures" items={s.bestSpells} />
                <RecordColumn title="Biggest wins" items={s.biggestWins} teamFromLabel />
                <RecordColumn title="Highest team totals" items={s.highestTotals} teamFromLabel />
                <RecordColumn title="Lowest totals (batting first)" items={s.lowestTotals} teamFromLabel />
              </div>
            </div>
          </div>
        </section>

        {/* ── 06 Results ── */}
        <section className={`${WRAP} pb-28`}>
          <SectionHead id="results" n="06" kicker="Match by match" title="Results" note="Newest first · tap a match for the full scorecard" />
          <Results s={s} onOpen={setMatchOpen} mom={momById} />
          <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-jcc-blue/80 pt-6">
            <p className={LABEL}>JCC Data · Source: CricHeroes</p>
            <p className="text-xs text-jcc-text-muted">Retired-hurt innings are counted as retired out. Guests count for the side they played for that day.</p>
          </div>
        </section>
      </div>

      {matchOpen && (
        <MatchScorecard
          data={cardData}
          matchId={matchOpen}
          onClose={closeMatch}
          onOpenPlayer={(p) => { setMatchOpen(null); openIndex(p, undefined, [p]); }}
        />
      )}
      {deck && (
        <PlayerDeck
          data={cardData}
          seasons={seasons}
          scopeLabel={s.label}
          player={deck.p}
          card={deck.card}
          order={deck.order}
          onNavigate={(p, card) => openIndex(p, card)}
          onOpenMatch={(id) => { setDeck(null); setHash(null); setMatchOpen(id); }}
          onClose={() => { setDeck(null); setHash(null); }}
        />
      )}
    </main>
    </OpenPlayer.Provider>
    </PhotoContext.Provider>
  );
}
