"use client";

// The story half of My Stats on the Profile tab: one long scroll, built to
// stop the thumb. A player level and XP up top; best moments as flip cards;
// rankings as a ladder to climb; strengths as unlocked perks; head-to-heads
// with a boss to beat; a form meter; and quests (the next milestone on each
// ladder, plus coaching tips as bonus quests). A sticky tracker follows the
// chapter in view and jumps on tap. Every chapter that's good news can be
// shared as a story card, and "Share my story" bundles them all.
//
// Figures come from /api/player/me/stats, built from the same profile as the
// member's card on /stats. Share cards follow app/stats/share-cards.ts: good
// news only, ranks only in the top quarter, and head-to-heads in meetings and
// wickets (scorecards don't record runs off a particular bowler).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeftRight, ArrowUpRight, Award, BarChart3, ChevronDown, Crown, Flame, Gauge, HandHeart, Lightbulb,
  Share2, Sparkles, Swords, TrendingUp, Trophy, Zap,
} from "lucide-react";
import { Counter } from "@/app/stats/motion";
import { AchievementStyles, Emblem, burstFor, emblemImage, tierColor, tierOf, type Tier } from "@/app/stats/achievements";
import type { BadgeTone } from "@/lib/scorecard-dashboard/profile";
import { GOLD, GREEN, ORANGE, PURPLE, listCard, statCard } from "@/app/stats/SectionShare";
import { ShareSheet, type SheetCard } from "@/app/stats/ShareSheet";
import { potmFigures } from "@/app/stats/share-cards";
import type { CardRow } from "@/lib/share-card";
import { focusOf, focusStyle } from "@/lib/photo-focus";
import { teamByName } from "@/lib/teams";

type Rank = { rank: number; of: number } | null;
type Note = { title: string; body: string };
type Tip = { title: string; why: string; next: string; target?: string };
type Axis = { label: string; value: string; pct: number; hint: string };

export type StoryData = {
  label: string;
  matches?: number;
  ranks?: Record<"runs" | "sr" | "six" | "wk" | "econ" | "dot" | "field" | "death" | "pp", Rank>;
  mom?: { date: string; opp: string; line: string }[];
  highlights?: {
    bestInnings: { runs: number; balls: number; notOut: boolean; opp: string; date: string; won: boolean } | null;
    bestSpell: { wk: number; runs: number; balls: number; opp: string; date: string; won: boolean } | null;
    mostSixes: { s6: number; runs: number; opp: string; date: string } | null;
    boundaries: number;
    scores20: number;
  };
  contribution?: {
    attendance: { team: string; present: number; teamMatches: number; pct: number; guest: number; guestTeams: string[]; matchdays: number; ofMatchdays: number };
    winsPlayed: number;
    runsInWins: number;
    wicketsInWins: number;
    battedIn: number;
    bowledIn: number;
    ballsPerMatch: number | null;
    oversPerMatch: number | null;
  };
  battles?: {
    bunnies: { name: string; photo?: string | null; wk: number; meetings: number; ducks: number }[];
    dominated: { name: string; photo?: string | null; meetings: number }[];
    nemesis: { name: string; photo?: string | null; wk: number; meetings: number }[];
    rivalries: { opponent: string; photo?: string | null; batting: boolean; meetings: number; mine: number; theirs: number; runs: number; balls: number }[];
  };
  form?: {
    allround?: { date: string; opp: string; won: boolean; bat: { runs: number; balls: number; out: boolean } | null; bowl: { wk: number; runs: number; balls: number } | null }[];
    innings: { runs: number; balls: number; out: boolean; opp: string; date: string; won: boolean }[];
    spells: { wk: number; runs: number; balls: number; opp: string; date: string }[];
  };
  strengths?: Note[];
  tips?: Tip[];
  league?: LeagueRow[];
  captaincy?: {
    matches: number; w: number; l: number; t: number; streak: number; teams: string[];
    first: { w: number; l: number; t: number }; chase: { w: number; l: number; t: number };
    toss: { won: number; lost: number; bat: number; bowl: number; wonThenWon: number; lostThenWon: number };
    recent: { date: string; opp: string; res: "W" | "L" | "T"; toss: "won" | "lost" | null; decision: "bat" | "bowl" | null; winBy: string }[];
    awards?: { label: string; tone: "crown" | "team" | "warn"; value: string; unit: string; why: string }[];
  } | null;
};

/** One number from "Your numbers", as a story card. */
export type NumberStat = {
  id: string;
  label: string;
  value: string;
  unit: string;
  kind: "bat" | "bowl" | "field" | "dna";
  rank?: { rank: number; of: number } | null;
  note?: string;
};

/** Who the cards are about. */
export type Me = { name: string; photo: string | null; team: string | null | undefined };

const KICK = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]";
const EASE = [0.16, 1, 0.3, 1] as const;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const overs = (balls: number) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const topPct = (r: { rank: number; of: number }) => Math.max(1, Math.round((r.rank / r.of) * 100));

// ── Shared derivations (screen and share cards read the same lists) ──────────

const RANK_LABEL: Record<string, string> = {
  runs: "Runs", sr: "Strike rate", six: "Sixes", wk: "Wickets", econ: "Economy",
  dot: "Dot-ball %", field: "Fielding dismissals", death: "Death-over wickets", pp: "Powerplay wickets",
};

function rankRows(s: StoryData) {
  return Object.entries(s.ranks ?? {})
    .filter((e): e is [string, { rank: number; of: number }] => !!e[1] && e[1].of > 1)
    .map(([k, r]) => ({ k, label: RANK_LABEL[k] ?? k, ...r, top: topPct(r) }))
    .filter((r) => r.top <= 50)
    .sort((a, b) => a.top - b.top)
    .slice(0, 6);
}

/** Profile notes count as standouts (80); league bars carry their own percentile. */
type Perk = Note & { pct: number; value?: string; measure?: string };

function strengthList(s: StoryData, axes: Axis[]): Perk[] {
  const fromAxes = axes
    .filter((a) => a.pct >= 60)
    .sort((a, b) => b.pct - a.pct)
    .map((a) => ({
      pct: a.pct,
      value: a.value,
      measure: a.hint.replace(", lower is better", ""),
      title: a.label,
      body: `${a.hint.replace(", lower is better", "")}: ${a.value}. ${a.pct >= 80 ? "Elite" : "Strong"} in the club, better than ${Math.round(a.pct)}% of qualified players.`,
    }));
  return [...(s.strengths ?? []).map((n) => ({ ...n, pct: 80 })), ...fromAxes].slice(0, 6);
}

// ── Chapter bodies ───────────────────────────────────────────────────────────

function Big({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return <span className={`font-heading font-extrabold leading-none tracking-[-0.05em] tabular-nums ${gold ? "text-jcc-accent-dark" : "text-jcc-blue"}`}>{children}</span>;
}

// ── Game layer: XP, levels, milestones ───────────────────────────────────────

/** Career totals the XP and the quests are built from. */
export type Totals = { runs: number; wickets: number; sixes: number; fielding: number; matches: number; mom: number };

const XP_RULE = { run: 1, wicket: 20, fielding: 10, mom: 50, match: 5 };
const TITLES = ["Net Bowler", "Squad Player", "Regular", "Impact Player", "Match Winner", "Star", "Franchise Player", "Icon", "Legend", "Hall of Famer"];
/** XP needed to reach level L: 0, 100, 300, 600, 1000, 1500… */
const levelFloor = (L: number) => 50 * L * (L - 1);

function xpOf(t: Totals) {
  const parts = [
    { label: "Runs", xp: t.runs * XP_RULE.run, rule: "1 per run" },
    { label: "Wickets", xp: t.wickets * XP_RULE.wicket, rule: "20 per wicket" },
    { label: "Fielding", xp: t.fielding * XP_RULE.fielding, rule: "10 per catch, stumping or run out" },
    { label: "Awards", xp: t.mom * XP_RULE.mom, rule: "50 per Player of the Match" },
    { label: "Turning up", xp: t.matches * XP_RULE.match, rule: "5 per match" },
  ];
  const xp = parts.reduce((s, p) => s + p.xp, 0);
  let level = 1;
  while (levelFloor(level + 1) <= xp) level++;
  const lo = levelFloor(level), hi = levelFloor(level + 1);
  return { xp, parts, level, title: TITLES[Math.min(level, TITLES.length) - 1], into: xp - lo, span: hi - lo, toNext: hi - xp };
}

const LADDERS: { key: keyof Totals; unit: string; steps: number[]; per: number }[] = [
  { key: "runs", unit: "runs", steps: [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000], per: XP_RULE.run },
  { key: "wickets", unit: "wickets", steps: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100], per: XP_RULE.wicket },
  { key: "sixes", unit: "sixes", steps: [5, 10, 20, 30, 50, 75, 100], per: 0 },
  { key: "fielding", unit: "fielding dismissals", steps: [5, 10, 15, 20, 30, 50], per: XP_RULE.fielding },
  { key: "matches", unit: "matches", steps: [10, 25, 50, 75, 100, 150], per: XP_RULE.match },
];

function milestones(t: Totals) {
  return LADDERS.map((l) => {
    const v = t[l.key];
    const next = l.steps.find((x) => x > v);
    if (!next) return null;
    const prev = [...l.steps].reverse().find((x) => x <= v) ?? 0;
    return { key: l.key, unit: l.unit, value: v, next, left: next - v, pct: Math.round((100 * (v - prev)) / (next - prev)), xp: (next - v) * l.per };
  })
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => b.pct - a.pct);
}

function LevelCard({ totals }: { totals: Totals }) {
  const L = xpOf(totals);
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-static-dark relative overflow-hidden rounded-[28px] bg-[#0F1C33] p-6 text-white ring-1 ring-white/10 md:p-9">
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-jcc-accent/20 blur-[90px]" />
      <div className="relative grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
        {/* Level emblem */}
        <motion.div
          initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
          whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 160, damping: 14 }}
          className="relative mx-auto grid h-36 w-36 place-items-center"
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="lvl-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F3C96A" /><stop offset="100%" stopColor="#A97824" /></linearGradient>
            </defs>
            <polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill="none" stroke="url(#lvl-gold)" strokeWidth="3" />
            <polygon points="50,12 83,31 83,69 50,88 17,69 17,31" fill="rgba(212,175,55,0.08)" />
          </svg>
          <div className="relative text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-jcc-accent">Level</p>
            <p className="font-heading text-6xl font-extrabold leading-none tracking-[-0.05em] tabular-nums text-white">{L.level}</p>
          </div>
        </motion.div>

        <div className="min-w-0">
          <p className={`${KICK} text-jcc-accent`}>Your player level</p>
          <p className="mt-2 font-heading text-4xl font-extrabold tracking-[-0.04em] text-white md:text-5xl">{L.title}</p>
          <div className="mt-5 flex items-baseline justify-between font-mono text-[11px] text-white/70">
            <span><b className="font-heading text-lg text-white"><Counter value={L.xp} /></b> XP</span>
            <span>{L.toNext} XP to Level {L.level + 1}</span>
          </div>
          <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundImage: "linear-gradient(90deg,#F3C96A,#D4AF37,#A97824)" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(3, (100 * L.into) / L.span)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
            />
            <motion.span
              aria-hidden
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              initial={{ left: "-10%" }}
              animate={{ left: "110%" }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
            />
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-jcc-accent hover:underline">
            {open ? "Hide" : "How XP is earned"}
          </button>
          <AnimatePresence>
            {open && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                {L.parts.map((p) => (
                  <li key={p.label} className="mt-2 flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-white/80">{p.label} <span className="font-mono text-[10.5px] text-white/50">· {p.rule}</span></span>
                    <span className="font-heading font-bold tabular-nums text-white">{p.xp} XP</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** A card that flips over on tap to tell the story behind the number. */
function FlipCard({ front, back, dark }: { front: React.ReactNode; back: React.ReactNode; dark?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const face = `absolute inset-0 rounded-3xl p-6 [backface-visibility:hidden] ${dark ? "theme-static-dark bg-[#0B1424] text-white" : "border border-jcc-blue/10 bg-jcc-navy"}`;
  return (
    <button type="button" onClick={() => setFlipped((f) => !f)} className="group relative h-56 w-full text-left [perspective:1200px]" aria-pressed={flipped}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <div className={face}>
          {front}
          <span className={`absolute bottom-5 right-5 font-mono text-[9.5px] uppercase tracking-[0.16em] transition-opacity group-hover:opacity-100 ${dark ? "text-white/45" : "text-jcc-text-muted"} opacity-70`}>Tap to flip ↻</span>
        </div>
        <div className={`${face} [transform:rotateY(180deg)]`}>{back}</div>
      </motion.div>
    </button>
  );
}

function Moments({ s }: { s: StoryData }) {
  const h = s.highlights!;
  const b = h.bestInnings && h.bestInnings.runs > 0 ? h.bestInnings : null;
  const w = h.bestSpell;
  const momN = s.mom?.length ?? 0;
  const lastMom = momN ? s.mom![momN - 1] : null;
  const grad = (c: string) => ({ backgroundImage: c, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;
  const label = (t: string, dark?: boolean) => <p className={`${KICK} ${dark ? "text-jcc-accent" : "text-jcc-text-muted"}`}>{t}</p>;
  const backLine = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-current/10 py-2 text-[13px]"><span className="opacity-60">{k}</span><span className="font-semibold">{v}</span></div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {b && (
        <FlipCard
          dark
          front={<>{label("Top score", true)}<p className="mt-5 font-heading text-[5.5rem] font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums" style={grad("linear-gradient(135deg,#F59E0B,#EA580C)")}><Counter value={b.runs} />{b.notOut && "*"}</p><p className="mt-4 text-[13px] text-white/70">off {b.balls} balls</p></>}
          back={<>{label("The knock", true)}<div className="mt-4">{backLine("Against", b.opp)}{backLine("Date", day(b.date))}{backLine("Strike rate", Math.round((100 * b.runs) / Math.max(1, b.balls)))}{backLine("Result", b.won ? "Won 🏆" : "Lost")}</div></>}
        />
      )}
      {w && (
        <FlipCard
          front={<>{label("Best spell")}<p className="mt-5 font-heading text-[4.5rem] font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums" style={grad("linear-gradient(135deg,#A78BFA,#7C3AED)")}>{w.wk}/{w.runs}</p><p className="mt-4 text-[13px] text-jcc-text-muted">in {overs(w.balls)} overs</p></>}
          back={<>{label("The spell")}<div className="mt-4 text-jcc-blue">{backLine("Against", w.opp)}{backLine("Date", day(w.date))}{backLine("Economy", ((6 * w.runs) / Math.max(1, w.balls)).toFixed(1))}{backLine("Result", w.won ? "Won 🏆" : "Lost")}</div></>}
        />
      )}
      <FlipCard
        front={<>{label("Boundaries")}<p className="mt-5 font-heading text-[4.5rem] font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums text-jcc-blue"><Counter value={h.boundaries} /></p><p className="mt-4 text-[13px] text-jcc-text-muted">fours and sixes</p></>}
        back={<>{label("Power")}<div className="mt-4 text-jcc-blue">{backLine("20+ scores", h.scores20)}{h.mostSixes ? backLine("Most sixes in a knock", `${h.mostSixes.s6} v ${h.mostSixes.opp}`) : backLine("Sixes", "none yet")}</div></>}
      />
      <FlipCard
        front={<>{label("Player of the Match")}<p className="mt-5 font-heading text-[4.5rem] font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums" style={grad("linear-gradient(135deg,#F3C96A,#A97824)")}><Counter value={momN} /></p><p className="mt-4 text-[13px] text-jcc-text-muted">{momN === 1 ? "award" : "awards"}</p></>}
        back={<>{label("Latest award")}{lastMom ? <div className="mt-4 text-jcc-blue">{backLine("Against", lastMom.opp)}{backLine("Date", day(lastMom.date))}<p className="mt-3 font-mono text-[11px] text-jcc-text-muted">{lastMom.line}</p></div> : <p className="mt-4 text-[13px] text-jcc-text-muted">Your first one is a match away.</p>}</>}
      />
    </div>
  );
}

function Ranks({ s, onShare }: { s: StoryData; onShare: (key: string) => void }) {
  const rows = rankRows(s);
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {rows.map((r, i) => {
        const pos = r.of <= 1 ? 100 : 100 * (1 - (r.rank - 1) / (r.of - 1));
        const climb = r.rank - 1;
        return (
          <motion.li
            key={r.k}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }}
            className="group rounded-2xl border border-jcc-blue/10 p-5 transition-colors hover:border-jcc-accent/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tracking-tight text-jcc-blue">{r.label}</p>
                <p className="mt-0.5 font-mono text-[11px] text-jcc-text-muted">{climb === 0 ? "You're #1. Defend it." : `${plural(climb, "place")} to #1`}</p>
              </div>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] ${r.top <= 10 ? "bg-jcc-accent text-[#0B1424]" : "bg-jcc-blue/[0.06] text-jcc-blue"}`}>Top {r.top}%</span>
                <button
                  type="button"
                  onClick={() => onShare(r.k)}
                  aria-label={`Share my ${r.label.toLowerCase()} ranking`}
                  className="grid h-8 w-8 place-items-center rounded-full text-jcc-blue/70 ring-1 ring-jcc-blue/15 transition-colors hover:bg-jcc-blue hover:text-[var(--story-on-ink,#FFFFFF)]"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            {/* The ladder: last place on the left, #1 on the right, you on it */}
            <div className="relative mt-6 h-10">
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-jcc-blue/[0.07]" />
              <motion.div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                style={{ backgroundImage: "linear-gradient(90deg,#3B6FC4,#D4AF37)" }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pos}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.06, duration: 1.1, ease: EASE }}
              />
              <motion.span
                className={`absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-heading text-[13px] font-extrabold tabular-nums shadow-lg ring-4 ring-jcc-navy ${r.rank <= 3 ? "bg-jcc-accent text-[#0B1424]" : "bg-jcc-blue text-[var(--story-on-ink,#FFFFFF)]"}`}
                initial={{ left: "0%" }}
                whileInView={{ left: `${pos}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.06, duration: 1.1, ease: EASE }}
              >
                #{r.rank}
              </motion.span>
              <Crown className="absolute -right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-jcc-accent-dark opacity-60" />
            </div>
            <p className="mt-1 flex justify-between font-mono text-[10px] text-jcc-text-muted"><span>#{r.of}</span><span>#1</span></p>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Strengths as unlocked perks, with a rarity from how strong they are. */
function Strengths({ list, onShare }: { list: Perk[]; onShare: (title: string) => void }) {
  const rarity = (i: number, n: Note & { pct?: number }) =>
    (n.pct ?? (i < 2 ? 85 : 65)) >= 80
      ? { name: "Legendary", ring: "ring-jcc-accent/70", chip: "bg-jcc-accent text-[#0B1424]", glow: "from-jcc-accent/20" }
      : { name: "Rare", ring: "ring-[#3B6FC4]/40", chip: "bg-[#3B6FC4] text-[#FFFFFF]", glow: "from-[#3B6FC4]/15" };
  return (
    <ol className={`grid gap-4 sm:grid-cols-2 ${list.length % 3 === 0 || list.length === 5 ? "lg:grid-cols-3" : ""}`}>
      {list.map((n, i) => {
        const r = rarity(i, n);
        return (
          <motion.li
            key={n.title}
            initial={{ opacity: 0, scale: 0.92, rotateX: 20 }}
            whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
            className={`relative overflow-hidden rounded-2xl bg-jcc-navy p-5 ring-1 ${r.ring}`}
          >
            <div aria-hidden className={`absolute inset-0 bg-gradient-to-br ${r.glow} to-transparent`} />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-jcc-text-muted">Perk unlocked</span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] ${r.chip}`}>{r.name}</span>
                  <button
                    type="button"
                    onClick={() => onShare(n.title)}
                    aria-label={`Share ${n.title}`}
                    className="grid h-7 w-7 place-items-center rounded-full text-jcc-blue/70 ring-1 ring-jcc-blue/15 transition-colors hover:bg-jcc-blue hover:text-[var(--story-on-ink,#FFFFFF)]"
                  >
                    <Share2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
              <p className="mt-3 font-heading text-xl font-bold tracking-[-0.02em] text-jcc-blue">{n.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-jcc-text-muted">{n.body}</p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** A player's face, framed on the face when the photo carries a focus; initials otherwise. */
function Face({ name, photo, size = 56, ring = "ring-jcc-accent/60" }: { name: string; photo?: string | null; size?: number; ring?: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-jcc-accent/15 ring-2 ${ring}`} style={{ width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.split("#")[0]} alt="" className="h-full w-full object-cover" style={focusStyle(focusOf(photo), 0.6)} />
      ) : (
        <span className="font-heading font-bold text-jcc-accent-dark" style={{ fontSize: size * 0.32 }}>{initials}</span>
      )}
    </span>
  );
}

type BattleTab = "rivalries" | "bunnies" | "dominated";

/** One dot per meeting: filled where you won it. */
function MeetingDots({ won, of, tone }: { won: number; of: number; tone: string }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {Array.from({ length: Math.min(of, 12) }, (_, k) => (
        <motion.span
          key={k}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 + k * 0.06, type: "spring", stiffness: 300, damping: 18 }}
          className={`h-2.5 w-2.5 rounded-full ${k < won ? "" : "border border-jcc-blue/25"}`}
          style={k < won ? { background: tone } : undefined}
        />
      ))}
    </span>
  );
}

function Battles({ s, me }: { s: StoryData; me: Me }) {
  const b = s.battles!;
  const tabs = ([
    ["bunnies", "Your bunnies", b.bunnies.length],
    ["dominated", "Never got you out", b.dominated.length],
    ["rivalries", "Rivalries", b.rivalries.length],
  ] as [BattleTab, string, number][]).filter(([, , n]) => n > 0);
  const [tab, setTab] = useState<BattleTab>(tabs[0]?.[0] ?? "bunnies");
  const active = tabs.some(([k]) => k === tab) ? tab : tabs[0]?.[0];
  if (!active) return null;
  const card = "group relative overflow-hidden rounded-3xl border border-jcc-blue/10 bg-jcc-navy p-5 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-jcc-accent/60";

  return (
    <div>
      {/* Scrolls sideways on phones */}
      <div role="tablist" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {tabs.map(([k, label, n]) => (
          <button
            key={k}
            role="tab"
            aria-selected={active === k}
            type="button"
            onClick={() => setTab(k)}
            className={`relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${active === k ? "text-[var(--story-on-ink,#FFFFFF)]" : "text-jcc-blue/70 ring-1 ring-jcc-blue/15 hover:ring-jcc-blue/40"}`}
          >
            {active === k && <motion.span layoutId="battle-tab" className="absolute inset-0 rounded-full bg-jcc-blue" transition={{ duration: 0.35, ease: EASE }} />}
            <span className="relative">{label} <span className="opacity-60">{n}</span></span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: EASE }} className="mt-6">
          {active === "bunnies" && (() => {
            const [fav, ...rest] = b.bunnies;
            return (
              <div className="space-y-4">
                {/* The favourite victim: a full-width banner, everything on one line */}
                <div className={`${card} flex flex-wrap items-center gap-x-8 gap-y-5`}>
                  <Face name={fav.name} photo={fav.photo} size={92} />
                  <div className="min-w-0">
                    <span className="rounded-full bg-jcc-accent px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#0B1424]">Favourite victim</span>
                    <p className="mt-2 truncate font-heading text-3xl font-bold tracking-[-0.02em] text-jcc-blue">{fav.name}</p>
                  </div>
                  <p className="flex items-baseline gap-2 sm:ml-auto">
                    <span className="font-heading text-7xl font-extrabold leading-none tracking-[-0.05em] tabular-nums text-jcc-accent-dark">{fav.wk}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-jcc-text-muted">{fav.wk === 1 ? "wicket" : "wickets"}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    <MeetingDots won={fav.wk} of={fav.meetings} tone="#D4AF37" />
                    <span className="font-mono text-[10.5px] text-jcc-text-muted">
                      {fav.wk} of {plural(fav.meetings, "meeting")}
                      {fav.ducks > 0 && ` · 🦆 ${plural(fav.ducks, "duck")}`}
                    </span>
                  </div>
                </div>

                {/* The rest: one even row of compact cards */}
                {rest.length > 0 && (
                  <ul className="grid gap-4 sm:grid-cols-3">
                    {rest.map((x) => (
                      <li key={x.name} className={`${card} flex items-center gap-4`}>
                        <Face name={x.name} photo={x.photo} size={56} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-heading text-base font-bold tracking-[-0.02em] text-jcc-blue">{x.name}</p>
                          <div className="mt-1.5"><MeetingDots won={x.wk} of={x.meetings} tone="#D4AF37" /></div>
                          <p className="mt-1 font-mono text-[10px] text-jcc-text-muted">
                            {x.wk} of {plural(x.meetings, "meeting")}
                            {x.ducks > 0 && ` · 🦆 ${x.ducks}`}
                          </p>
                        </div>
                        <span className="font-heading text-4xl font-extrabold tabular-nums text-jcc-accent-dark">{x.wk}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}

          {active === "dominated" && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {b.dominated.map((x) => (
                <li key={x.name} className={`${card} flex flex-col items-center text-center`}>
                  <Face name={x.name} photo={x.photo} size={72} ring="ring-[#2E8B57]/60" />
                  <p className="mt-3 truncate font-heading text-lg font-bold tracking-[-0.02em] text-jcc-blue">{x.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#2E8B57]/12 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2E8B57]">🛡 never out to them</p>
                  <div className="mt-4"><MeetingDots won={x.meetings} of={x.meetings} tone="#2E8B57" /></div>
                  <p className="mt-2 font-mono text-[10.5px] text-jcc-text-muted">survived all {x.meetings} meetings</p>
                </li>
              ))}
            </ul>
          )}

          {active === "rivalries" && (
            <ul className="grid gap-4 md:grid-cols-2">
              {b.rivalries.map((r) => {
                const total = r.mine + r.theirs || 1;
                const ahead = r.mine > r.theirs, level = r.mine === r.theirs;
                return (
                  <li key={r.opponent + r.batting} className="theme-static-dark relative overflow-hidden rounded-3xl bg-[#0B1424] p-6 text-white ring-1 ring-white/10">
                    <p className={`${KICK} flex items-center justify-between text-jcc-accent`}>
                      <span className="flex items-center gap-1.5"><Swords className="h-3.5 w-3.5" /> You {r.batting ? "bat" : "bowl"}</span>
                      <span className="text-white/60">{ahead ? "You lead" : level ? "All square" : "They lead"}</span>
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex flex-col items-center gap-2">
                        <Face name={me.name} photo={me.photo} size={64} />
                        <span className="font-heading text-5xl font-extrabold tabular-nums text-jcc-accent">{r.mine}</span>
                      </div>
                      <span className="font-heading text-2xl font-extrabold italic text-white/30">VS</span>
                      <div className="flex flex-col items-center gap-2">
                        <Face name={r.opponent} photo={r.photo} size={64} ring="ring-white/30" />
                        <span className="font-heading text-5xl font-extrabold tabular-nums text-white/60">{r.theirs}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-center font-heading text-lg font-bold text-white">v {r.opponent}</p>
                    <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.span className="bg-jcc-accent" initial={{ width: 0 }} whileInView={{ width: `${(100 * r.mine) / total}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} />
                    </div>
                    <p className="mt-2 flex justify-between font-mono text-[10px] text-white/55">
                      <span>{r.batting ? "survived" : "dismissed"}</span>
                      <span>{plural(r.meetings, "meeting")}</span>
                      <span>{r.batting ? "got out" : "survived"}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="mt-6 text-[12px] text-jcc-text-muted">A meeting is a match where you were both on the field. Scorecards don&apos;t record every ball, so dismissals are exact and run figures cover your whole innings.</p>
    </div>
  );
}

function Contribution({ s, teamShare, winPct }: { s: StoryData; teamShare?: number | null; winPct?: number | null }) {
  const c = s.contribution!;
  const a = c.attendance;
  const facts: [string, React.ReactNode, string][] = [
    ["Matchdays turned up", <><Counter value={a.matchdays} /><span className="text-jcc-blue/35">/{a.ofMatchdays}</span></>, "matchdays you were part of"],
    ["Wins you played in", <Counter key="w" value={c.winsPlayed} />, winPct != null ? `your side won ${Math.round(winPct)}%` : "matches won"],
  ];
  if (c.runsInWins) facts.push(["Runs in wins", <Counter key="r" value={c.runsInWins} />, teamShare != null ? `${Math.round(teamShare)}% of your team's runs` : "when you won"]);
  if (c.wicketsInWins) facts.push(["Wickets in wins", <Counter key="k" value={c.wicketsInWins} />, `bowled in ${plural(c.bowledIn, "match", "matches")}`]);
  if (a.guest) facts.push(["Guest appearances", <Counter key="g" value={a.guest} />, `helped ${a.guestTeams.join(", ")}`]);
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="relative mx-auto h-48 w-48">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="att-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F3C96A" /><stop offset="100%" stopColor="#A97824" /></linearGradient>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(18,35,63,0.08)" strokeWidth="9" />
          <motion.circle
            cx="60" cy="60" r={R} fill="none" stroke="url(#att-gold)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C}
            initial={{ strokeDashoffset: C }} viewport={{ once: true }} whileInView={{ strokeDashoffset: C * (1 - a.pct / 100) }} transition={{ duration: 1.3, ease: EASE }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-heading text-4xl font-extrabold tracking-[-0.05em] tabular-nums text-jcc-blue">{a.present}<span className="text-xl text-jcc-blue/35">/{a.teamMatches}</span></p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">{a.team} games</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-7">
        {facts.map(([label, value, sub]) => (
          <div key={label}>
            <p className={`${KICK} text-jcc-text-muted`}>{label}</p>
            <p className="mt-2 text-4xl"><Big>{value}</Big></p>
            <p className="mt-1.5 text-[12.5px] text-jcc-text-muted">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Form({ s }: { s: StoryData }) {
  const inns = s.form?.innings ?? [];
  const spells = s.form?.spells ?? [];
  const [pick, setPick] = useState(inns.length - 1);
  const max = Math.max(10, ...inns.map((r) => r.runs));
  const cur = inns[pick] ?? inns[inns.length - 1];
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {inns.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={`${KICK} text-jcc-text-muted`}>Last {inns.length} innings · tap a bar</p>
            {cur && (
              <p className="text-[12.5px] text-jcc-blue">
                <b className="font-heading text-base">{cur.runs}{cur.out ? "" : "*"}</b> off {cur.balls} v {cur.opp} · {day(cur.date)}
                <span className={`ml-2 font-mono text-[10px] uppercase tracking-[0.12em] ${cur.won ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{cur.won ? "won" : "lost"}</span>
              </p>
            )}
          </div>
          <div className="mt-4 flex h-44 items-end gap-2">
            {inns.map((r, i) => (
              <button key={`${r.date}-${i}`} type="button" onClick={() => setPick(i)} aria-label={`${r.runs} v ${r.opp}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className={`mb-1 font-heading text-[13px] font-bold tabular-nums ${i === pick ? "text-jcc-accent-dark" : "text-jcc-blue"}`}>
                  {r.runs}
                  {!r.out && "*"}
                </span>
                <motion.span
                  className={`w-full rounded-t-md ${i === pick ? "outline outline-2 outline-offset-2 outline-jcc-accent" : ""}`}
                  style={{ background: r.runs >= 20 ? "linear-gradient(180deg, #F3C96A, #A97824)" : "var(--color-jcc-blue)", opacity: r.won ? 1 : 0.5 }}
                  initial={{ height: 0 }}
                  viewport={{ once: true }} whileInView={{ height: `${Math.max(3, (r.runs / max) * 100)}%` }}
                  transition={{ delay: i * 0.05, duration: 0.8, ease: EASE }}
                />
                <span className="mt-1.5 w-full truncate text-center font-mono text-[9.5px] text-jcc-text-muted">{day(r.date)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-jcc-text-muted">Gold = 20+ · faded = your side lost · * = not out</p>
        </div>
      )}
      {spells.length > 0 && (
        <div>
          <p className={`${KICK} text-jcc-text-muted`}>Last {spells.length} spells</p>
          <ul className="mt-4">
            {[...spells].reverse().map((w, i) => (
              <li key={`${w.date}-${i}`} className="flex items-center justify-between gap-3 border-b border-jcc-blue/[0.08] py-2.5">
                <span className="min-w-0 truncate text-[13px] text-jcc-blue">
                  v {w.opp} <span className="font-mono text-[10.5px] text-jcc-text-muted">· {day(w.date)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex gap-0.5">{Array.from({ length: Math.min(5, w.wk) }, (_, k) => <span key={k} className="h-1.5 w-1.5 rounded-full bg-jcc-accent" />)}</span>
                  <span className="font-heading text-sm font-bold tabular-nums text-jcc-blue">{w.wk}/{w.runs}</span>
                  <span className="font-mono text-[10.5px] text-jcc-text-muted">{overs(w.balls)} ov</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** How hot the last five innings are against the season's own average. */
function FormMeter({ s, avgRuns }: { s: StoryData; avgRuns: number }) {
  const last = (s.form?.innings ?? []).slice(-5);
  if (last.length < 3) return null;
  const recent = last.reduce((a, r) => a + r.runs, 0) / last.length;
  const ratio = avgRuns > 0 ? recent / avgRuns : 1;
  const heat = Math.max(0.04, Math.min(1, ratio / 2)); // 2× your average = maxed out
  const state = ratio >= 1.4 ? { t: "On fire", e: "🔥" } : ratio >= 1.05 ? { t: "Heating up", e: "📈" } : ratio >= 0.75 ? { t: "Steady", e: "🎯" } : { t: "Due a big one", e: "⏳" };
  return (
    <div className="mb-8 rounded-2xl border border-jcc-blue/10 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-2xl font-bold tracking-[-0.03em] text-jcc-blue">{state.e} {state.t}</p>
        <p className="font-mono text-[11px] text-jcc-text-muted">last {last.length} innings average {recent.toFixed(1)} · your usual {avgRuns.toFixed(1)}</p>
      </div>
      <div className="relative mt-4 h-4 overflow-hidden rounded-full" style={{ backgroundImage: "linear-gradient(90deg,#3B6FC4,#12233F 40%,#D4AF37 70%,#EA580C)" }}>
        <motion.span
          className="absolute inset-y-0 right-0 bg-jcc-navy-light"
          initial={{ width: "100%" }}
          whileInView={{ width: `${100 - heat * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.3, ease: EASE }}
        />
      </div>
      <p className="mt-1.5 flex justify-between font-mono text-[10px] text-jcc-text-muted"><span>Cold</span><span>On fire</span></p>
    </div>
  );
}

/** The bowler who has their number, framed as the boss to beat. */
function BossCallout({ s }: { s: StoryData }) {
  const boss = s.battles?.nemesis[0];
  if (!boss) return null;
  return (
    <div className="theme-static-dark relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-[#3A160A] via-[#1A1210] to-[#0B1424] p-6 text-white ring-1 ring-[#EA580C]/30">
      <div aria-hidden className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#EA580C]/25 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Face name={boss.name} photo={boss.photo} size={76} ring="ring-[#EA580C]/70" />
          <div>
            <p className={`${KICK} text-[#F59E0B]`}>👹 Boss to beat</p>
            <p className="mt-1 font-heading text-2xl font-bold tracking-[-0.02em] text-white">{boss.name}</p>
            <p className="font-mono text-[11px] text-white/65">has dismissed you {boss.wk} times in {plural(boss.meetings, "meeting")}</p>
          </div>
        </div>
        <div className="min-w-[200px] flex-1 sm:max-w-xs">
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-white/65"><span>Boss HP</span><span>{boss.wk} / {boss.wk}</span></div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: boss.wk }, (_, k) => (
              <motion.span key={k} className="h-3.5 flex-1 rounded-sm bg-gradient-to-b from-[#F59E0B] to-[#EA580C]" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: k * 0.12 }} />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/75">Survive your next meeting to land the first hit.</p>
        </div>
      </div>
    </div>
  );
}

/** Quests: the next milestone on each ladder, then coaching tips as bonus quests. */
function Quests({ totals, tips }: { totals: Totals; tips: Tip[] }) {
  const ms = milestones(totals).slice(0, 4);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <p className={`${KICK} text-jcc-text-muted`}>Milestones in reach</p>
        <ul className="mt-4 space-y-3">
          {ms.map((m, i) => (
            <motion.li
              key={m.key}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: EASE }}
              className="rounded-2xl border border-jcc-blue/10 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold tracking-tight text-jcc-blue">
                  Reach {m.next} {m.unit}
                </p>
                {m.xp > 0 && <span className="font-mono text-[10.5px] font-semibold text-jcc-accent-dark">+{m.xp} XP</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-jcc-blue/[0.07]">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ backgroundImage: m.pct >= 75 ? "linear-gradient(90deg,#F3C96A,#A97824)" : "linear-gradient(90deg,#3B6FC4,#12233F)" }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(3, m.pct)}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.07, duration: 1, ease: EASE }}
                />
              </div>
              <p className="mt-1.5 flex justify-between font-mono text-[10.5px] text-jcc-text-muted">
                <span>{m.value} now</span>
                <span className={m.pct >= 75 ? "font-semibold text-jcc-accent-dark" : ""}>{m.left} to go{m.pct >= 75 ? " · almost there" : ""}</span>
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
      {tips.length > 0 && (
        <div>
          <p className={`${KICK} text-jcc-text-muted`}>Bonus quests from your numbers</p>
          <ol className="mt-4 space-y-3">
            {tips.map((t, i) => (
              <li key={t.title + i} className="rounded-2xl border border-dashed border-jcc-blue/20 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold tracking-tight text-jcc-blue">{t.title}</p>
                  <span className="shrink-0 font-mono text-[10.5px] font-semibold text-jcc-accent-dark">Bonus</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-jcc-text-muted">{t.next}</p>
                {t.target && <p className="mt-2 font-mono text-[11px] text-jcc-blue/80">🎯 {t.target}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Trophy cabinet ──────────────────────────────────────────────────────────

export type CabinetBadge = { label: string; tone: BadgeTone; why: string; holders?: number };

const TIER_RANK: Record<Tier, number> = { legendary: 0, epic: 1, rare: 2, common: 3, banter: 4, locked: 5 };

function Cabinet({ badges, mom, onShare }: { badges: CabinetBadge[]; mom: { date: string; opp: string; line: string }[]; onShare: (label: string) => void }) {
  const earned = badges
    .filter((b) => b.tone !== "warn")
    .map((b) => ({ ...b, tier: tierOf(b.tone, b.holders ?? 1) }))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || (a.holders ?? 1) - (b.holders ?? 1));
  const workOns = badges.filter((b) => b.tone === "warn");
  const [open, setOpen] = useState<string | null>(null);
  const count = (t: Tier) => earned.filter((b) => b.tier === t).length;

  return (
    <div>
      <AchievementStyles />
      {/* Tally */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-heading text-6xl font-extrabold leading-none tracking-[-0.05em] tabular-nums text-jcc-blue"><Counter value={earned.length} /></span>
        <span className="mr-3 font-mono text-[11px] uppercase tracking-[0.14em] text-jcc-text-muted">badges<br />earned</span>
        {(["legendary", "epic", "rare", "common"] as Tier[]).filter((t) => count(t)).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] ring-1 ring-jcc-blue/15" style={{ color: tierColor(t) }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tierColor(t) }} /> {count(t)} {t}
          </span>
        ))}
      </div>

      {/* The shelf: medallions, rarest first; tap one for the story behind it */}
      {earned.length > 0 ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {earned.map((b, i) => {
            const on = open === b.label;
            const n = b.holders ?? 1;
            return (
              <motion.li
                key={b.label}
                initial={{ opacity: 0, y: 30, scale: 0.85 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 170, damping: 16 }}
              >
                <button type="button" onClick={() => setOpen(on ? null : b.label)} aria-expanded={on} className="group flex w-full flex-col items-center text-center">
                  <motion.span whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }} transition={{ duration: 0.6 }} className="relative">
                    <span aria-hidden className="absolute inset-x-2 -bottom-3 h-3 rounded-[50%] bg-jcc-blue/15 blur-md" />
                    <Emblem label={b.label} tone={b.tone} tier={b.tier} size={i === 0 ? 112 : 92} />
                  </motion.span>
                  <span className="mt-5 font-heading text-[17px] font-bold leading-tight tracking-[-0.02em] text-jcc-blue">{b.label}</span>
                  <span className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: tierColor(b.tier) }}>
                    {b.tier} · {n === 1 ? "only you" : `1 of ${n}`}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onShare(b.label); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onShare(b.label); } }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-jcc-blue/75 ring-1 ring-jcc-blue/15 transition-colors hover:bg-jcc-blue hover:text-[var(--story-on-ink,#FFFFFF)]"
                  >
                    <Share2 className="h-3 w-3" /> Share
                  </span>
                  <AnimatePresence initial={false}>
                    {on ? (
                      <motion.span key="why" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="block overflow-hidden">
                        <span className="mt-2 block max-w-[15rem] text-[12.5px] leading-snug text-jcc-text-muted">{b.why}</span>
                      </motion.span>
                    ) : (
                      <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-jcc-text-muted opacity-0 transition-opacity group-hover:opacity-100">
                        Tap for why
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 text-[13.5px] text-jcc-text-muted">No badges in this scope yet. They unlock as your numbers climb the league.</p>
      )}

      {/* Player of the Match: gold tickets */}
      {mom.length > 0 && (
        <div className="mt-16">
          <p className={`${KICK} flex items-center gap-2 text-jcc-accent-dark`}><Trophy className="h-3.5 w-3.5" /> Player of the Match · {mom.length}</p>
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {[...mom].reverse().map((m, i) => (
              <motion.li
                key={`${m.date}-${m.opp}`}
                initial={{ opacity: 0, rotateX: -25, y: 20 }}
                whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.7, ease: EASE }}
                className="relative overflow-hidden rounded-3xl p-6 text-[#0B1424] [transform-style:preserve-3d]"
                style={{ backgroundImage: "linear-gradient(135deg,#FBE7A6 0%,#E9C25A 45%,#B98A2C 100%)" }}
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  initial={{ left: "-30%" }}
                  whileInView={{ left: "130%" }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6 + i * 0.08, duration: 1.2, ease: "easeInOut" }}
                />
                {/* Ticket notches */}
                <span aria-hidden className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#0B1424]/90" />
                <span aria-hidden className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#0B1424]/90" />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B1424]/70">Player of the Match</p>
                    <p className="mt-2 font-heading text-2xl font-extrabold tracking-[-0.03em]">v {m.opp}</p>
                  </div>
                  <Trophy className="h-10 w-10 shrink-0 text-[#0B1424]/80" />
                </div>
                <p className="relative mt-5 font-heading text-3xl font-extrabold tracking-[-0.04em] tabular-nums">{m.line}</p>
                <p className="relative mt-3 border-t border-dashed border-[#0B1424]/30 pt-3 font-mono text-[11px] text-[#0B1424]/75">{new Date(m.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* The work-ons, kept honest but quiet */}
      {workOns.length > 0 && (
        <div className="mt-14 rounded-2xl border border-dashed border-jcc-blue/20 p-5">
          <p className={`${KICK} text-jcc-text-muted`}>Still to shake off</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {workOns.map((b) => (
              <li key={b.label} title={b.why} className="rounded-full bg-jcc-blue/[0.06] px-3 py-1.5 text-[12.5px] text-jcc-blue/80">
                <b className="font-semibold">{b.label}</b> <span className="text-jcc-text-muted">· {b.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Bat and ball in the same match, one column per match. */
function AllRound({ s }: { s: StoryData }) {
  const rows = s.form?.allround ?? [];
  if (rows.length < 2 || !rows.some((r) => r.bat && r.bowl)) return null;
  const maxRuns = Math.max(10, ...rows.map((r) => r.bat?.runs ?? 0));
  return (
    <div className="mt-12">
      <p className={`${KICK} text-jcc-text-muted`}>All-round · last {rows.length} matches</p>
      <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {rows.map((r, i) => {
          const star = (r.bat?.runs ?? 0) >= 15 && (r.bowl?.wk ?? 0) >= 1;
          return (
            <motion.li
              key={`${r.date}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }}
              className={`relative flex flex-col rounded-2xl border p-3 ${star ? "border-jcc-accent/70 bg-jcc-accent/[0.08]" : "border-jcc-blue/10 bg-jcc-navy"}`}
            >
              {star && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-jcc-accent px-1.5 text-[10px]">⭐</span>}
              <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-jcc-text-muted">{day(r.date)}</p>
              <p className="truncate text-[11.5px] font-semibold text-jcc-blue">v {r.opp}</p>
              {/* Bat */}
              <div className="mt-3 flex h-14 items-end">
                {r.bat ? (
                  <motion.span
                    className="w-full rounded-t-md"
                    style={{ backgroundImage: "linear-gradient(180deg,#F59E0B,#EA580C)" }}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${Math.max(6, (r.bat.runs / maxRuns) * 100)}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.8, ease: EASE }}
                  />
                ) : (
                  <span className="w-full border-b border-dashed border-jcc-blue/20" />
                )}
              </div>
              <p className="mt-1 font-heading text-[15px] font-bold tabular-nums text-jcc-blue">{r.bat ? `${r.bat.runs}${r.bat.out ? "" : "*"}` : "–"}</p>
              {/* Ball */}
              <div className="mt-2 flex h-2 gap-0.5">
                {r.bowl ? Array.from({ length: Math.max(1, r.bowl.wk) }, (_, k) => <span key={k} className={`h-2 flex-1 rounded-full ${r.bowl!.wk ? "bg-[#7C3AED]" : "bg-jcc-blue/15"}`} />) : null}
              </div>
              <p className="mt-1 font-heading text-[13px] font-bold tabular-nums text-[#7C3AED]">{r.bowl ? `${r.bowl.wk}/${r.bowl.runs}` : "–"}</p>
              <p className={`mt-auto pt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] ${r.won ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{r.won ? "Won" : "Lost"}</p>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-2 font-mono text-[10px] text-jcc-text-muted">Orange = runs · purple = wickets · ⭐ = 15+ runs and a wicket in the same match</p>
    </div>
  );
}

type CaptainHonour = { label: string; tone: BadgeTone; tier: Tier; why: string; club: boolean };

/** The club's captaincy awards the member holds, then personal milestones as captain. */
function captainHonours(c: NonNullable<StoryData["captaincy"]>): CaptainHonour[] {
  const tosses = c.toss.won + c.toss.lost;
  const club: CaptainHonour[] = (c.awards ?? []).map((a) => ({ label: a.label, tone: a.tone, tier: tierOf(a.tone, 1), why: a.why, club: true }));
  const mine: [boolean, string, string, BadgeTone][] = [
    [c.w >= 1, "First Win as Captain", `${plural(c.w, "win")} with the armband.`, "team"],
    [c.matches >= 10, "Proven Leader", `Captained ${c.matches} matches.`, "team"],
    [c.streak >= 2, "Winning Run", `${c.streak} wins in a row as captain.`, "crown"],
    [tosses >= 5 && c.toss.won / tosses >= 0.6, "Lucky Coin", `Won ${c.toss.won} of ${tosses} tosses.`, "crown"],
    [c.toss.won >= 5, "Toss Caller", `${c.toss.won} tosses won.`, "team"],
    [c.toss.bowl >= 3, "Chase Merchant", `Chose to bowl first ${c.toss.bowl} times.`, "team"],
    [c.toss.bat >= 3, "Sets the Pace", `Chose to bat first ${c.toss.bat} times.`, "team"],
    [c.toss.wonThenWon >= 2, "Toss to Trophy", `Won ${c.toss.wonThenWon} matches after winning the toss.`, "crown"],
    [c.chase.w >= 2, "Cool in a Chase", `${c.chase.w} chases won as captain.`, "team"],
  ];
  const personal = mine.filter(([ok, label]) => ok && !club.some((x) => x.label === label)).map(([, label, why, tone]) => ({ label, tone, tier: "rare" as Tier, why, club: false }));
  return [...club, ...personal];
}

function Captaincy({ c, onShareHonour }: { c: NonNullable<StoryData["captaincy"]>; onShareHonour: (label: string) => void }) {
  const pct = c.matches ? Math.round((100 * c.w) / c.matches) : 0;
  const tosses = c.toss.won + c.toss.lost;
  const honours = captainHonours(c);
  const R = 38, C = 2 * Math.PI * R;
  const recOf = (r: { w: number; l: number; t: number }) => `${r.w}/${r.w + r.l + r.t}`;
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* The armband: a gold band across the top, the record under it */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative self-start overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1E3A66] via-[#132748] to-[#0B1424] ring-1 ring-jcc-accent/30"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-[#A97824] via-[#F3C96A] to-[#A97824] px-6 py-2.5 md:px-8">
            <span className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0B1424] font-heading text-sm font-extrabold text-jcc-accent">C</span>
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#0B1424]">Record with the armband</span>
            </span>
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0B1424]/75">{plural(c.matches, "match", "matches")}</span>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="font-heading text-[4.5rem] font-extrabold leading-[0.85] tracking-[-0.06em] tabular-nums text-white md:text-[5.5rem]">
                  {c.w}<span className="text-white/30">–</span>{c.l}
                  {c.t > 0 && <span className="text-white/45">–{c.t}</span>}
                </p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">won · lost{c.t ? " · tied" : ""}</p>
              </div>
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <motion.circle cx="50" cy="50" r={R} fill="none" stroke="#D4AF37" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} whileInView={{ strokeDashoffset: C * (1 - pct / 100) }} viewport={{ once: true }} transition={{ duration: 1.3, ease: EASE }} />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-center">
                  <span>
                    <span className="block font-heading text-xl font-extrabold leading-none text-white">{pct}%</span>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/50">won</span>
                  </span>
                </span>
              </div>
            </div>

            {/* Won / lost / tied, as one bar */}
            <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/10">
              {([[c.w, "bg-jcc-accent"], [c.t, "bg-[#6E9BE6]"], [c.l, "bg-white/25"]] as const).map(([n, cls], k) =>
                n ? <motion.span key={k} className={`h-full ${cls}`} initial={{ width: 0 }} whileInView={{ width: `${(100 * n) / c.matches}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: 0.2 + k * 0.1 }} /> : null,
              )}
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {[
                ["Best streak", String(c.streak), "wins in a row"],
                ["Defending", recOf(c.first), "totals held"],
                ["Chasing", recOf(c.chase), "chases won"],
                ["Tosses", tosses ? `${c.toss.won}/${tosses}` : "–", "won"],
              ].map(([k, v, sub]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">{k}</dt>
                  <dd className="mt-1 font-heading text-3xl font-extrabold tabular-nums text-white">{v}</dd>
                  <dd className="font-mono text-[10px] text-white/50">{sub}</dd>
                </div>
              ))}
            </dl>

            {/* What the toss was worth */}
            {tosses > 0 && (
              <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
                {([
                  ["After winning the toss", c.toss.wonThenWon, c.toss.won],
                  ["After losing the toss", c.toss.lostThenWon, c.toss.lost],
                ] as const).map(([label, w, n]) => (
                  <div key={label} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">{label}</p>
                    <p className="mt-1.5 font-heading text-2xl font-extrabold tabular-nums text-white">
                      {w}<span className="text-white/35">/{n}</span>
                      <span className="ml-2 font-mono text-[11px] font-semibold text-jcc-accent">{n ? Math.round((100 * w) / n) : 0}% won</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Honours */}
        <div className="self-start rounded-[28px] bg-white/[0.04] p-6 ring-1 ring-white/10 md:p-8">
          <p className={`${KICK} text-jcc-accent`}>Captain&apos;s honours · {honours.length}</p>
          {honours.length ? (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3">
              {honours.map((h, i) => (
                <motion.li
                  key={h.label}
                  initial={{ opacity: 0, scale: 0.8, y: 16 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, type: "spring", stiffness: 180, damping: 15 }}
                  className="flex flex-col items-center text-center"
                >
                  <motion.span whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }} transition={{ duration: 0.6 }}>
                    <Emblem label={h.label} tone={h.tone} tier={h.tier} size={h.club ? 84 : 68} />
                  </motion.span>
                  {h.club && <span className="mt-2 rounded-full bg-jcc-accent px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#0B1424]">Club award</span>}
                  <span className="mt-2 font-heading text-[15px] font-bold leading-tight text-white">{h.label}</span>
                  <span className="mt-1 max-w-[12rem] text-[11.5px] leading-snug text-white/60">{h.why}</span>
                  <button type="button" onClick={() => onShareHonour(h.label)} className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/75 ring-1 ring-white/20 hover:bg-white hover:text-[#0B1424]">
                    <Share2 className="h-3 w-3" /> Share
                  </button>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-[13.5px] text-white/60">Win a match or call a few tosses right to start the collection.</p>
          )}
        </div>
      </div>

      {/* Match by match: a results ledger, latest first, with the form line above */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className={`${KICK} text-white/60`}>Match by match · last {c.recent.length}</p>
          <div className="flex items-end gap-1" aria-label="Form, oldest to latest">
            {c.recent.map((m, i) => (
              <motion.span
                key={`f-${m.date}-${i}`}
                title={`${m.res === "W" ? "Won" : m.res === "L" ? "Lost" : "Tied"} v ${m.opp}`}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
                className={`w-2.5 origin-bottom rounded-sm ${m.res === "W" ? "h-6 bg-jcc-accent" : m.res === "T" ? "h-4 bg-[#6E9BE6]" : "h-3 bg-white/20"}`}
              />
            ))}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">form</span>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-4 bg-white/[0.04] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 sm:grid-cols-[5.5rem_minmax(0,1.2fr)_minmax(0,1fr)_9rem]">
            <span>Date</span>
            <span>Opponent</span>
            <span>Toss</span>
            <span className="text-right">Result</span>
          </div>
          <ol>
            {[...c.recent].reverse().map((m, i) => {
              const opp = teamByName(m.opp);
              const tossText = m.toss
                ? `${m.toss === "won" ? "Won" : "Lost"}${m.decision ? ` · ${m.toss === "won" ? "chose to" : "put in to"} ${m.decision}` : ""}`
                : "Not recorded";
              return (
                <motion.li
                  key={`${m.date}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.45, ease: EASE }}
                  className="relative grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem] items-center gap-4 border-t border-white/[0.07] px-5 py-3.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[5.5rem_minmax(0,1.2fr)_minmax(0,1fr)_9rem]"
                >
                  {/* A win gets a gold edge */}
                  {m.res === "W" && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-jcc-accent" />}
                  <span className="font-mono text-[11.5px] tabular-nums text-white/60">{day(m.date)}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    {opp?.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opp.logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
                    )}
                    <span className="truncate text-[14px] font-semibold text-white">{m.opp}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-white/70">
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.toss === "won" ? "bg-jcc-accent shadow-[0_0_8px_rgba(212,175,55,0.6)]" : m.toss === "lost" ? "border border-white/40" : "border border-dashed border-white/25"}`}
                    />
                    <span className="truncate">{tossText}</span>
                  </span>
                  <span className="flex items-center justify-end gap-2.5">
                    {m.winBy && <span className="hidden truncate font-mono text-[10.5px] text-white/45 sm:inline">{m.res === "W" ? "by " : ""}{m.winBy}</span>}
                    <span
                      className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 font-heading text-[13px] font-extrabold ${
                        m.res === "W" ? "bg-jcc-accent text-[#0B1424]" : m.res === "T" ? "bg-[#6E9BE6]/25 text-[#9DBBF0]" : "text-white/45 ring-1 ring-white/15"
                      }`}
                    >
                      {m.res}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </div>
        <p className="mt-3 text-[13px] text-white/60">
          {tosses
            ? `Won ${c.toss.won} of ${plural(tosses, "toss", "tosses")}${c.toss.won ? ` and went on to win ${c.toss.wonThenWon} of those matches` : ""}. Gold coins are tosses won; the label is what your side did.`
            : "Tosses are only recorded for matches scored in the admin."}
        </p>
      </div>
    </div>
  );
}

// ── Compare: the member against anyone in the league ────────────────────────

export type LeagueRow = {
  name: string; me: boolean; photo: string | null; team: string;
  matches: number; runs: number; balls: number; sr: number | null; avg: number | null; s6: number; bnd: number;
  wk: number; bowlBalls: number; econ: number | null; dotPct: number | null; death: number; fielding: number; mom: number;
  h2h: {
    iDismissed: number; theyDismissed: number; meetings: number;
  } | null;
};


type CmpMetric = { label: string; get: (r: LeagueRow) => number | null; fmt: (n: number | null) => string; lower?: boolean; ok?: (r: LeagueRow) => boolean };
const f = (d: number) => (n: number | null) => (n == null ? "–" : d ? n.toFixed(d) : String(Math.round(n)));
const CMP: CmpMetric[] = [
  { label: "Matches", get: (r) => r.matches, fmt: f(0) },
  { label: "Runs", get: (r) => r.runs, fmt: f(0) },
  { label: "Strike rate", get: (r) => r.sr, fmt: f(1), ok: (r) => r.balls >= 15 },
  { label: "Average", get: (r) => r.avg, fmt: f(1), ok: (r) => r.balls >= 15 },
  { label: "Sixes", get: (r) => r.s6, fmt: f(0) },
  { label: "Boundaries", get: (r) => r.bnd, fmt: f(0) },
  { label: "Wickets", get: (r) => r.wk, fmt: f(0) },
  { label: "Economy", get: (r) => r.econ, fmt: f(2), lower: true, ok: (r) => r.bowlBalls >= 12 },
  { label: "Dot-ball %", get: (r) => r.dotPct, fmt: f(1), ok: (r) => r.bowlBalls >= 12 },
  { label: "Death-over wkts", get: (r) => r.death, fmt: f(0) },
  { label: "Fielding", get: (r) => r.fielding, fmt: f(0) },
  { label: "Player of the Match", get: (r) => r.mom, fmt: f(0) },
];

/** Per metric: both values (null when the sample's too small) and who's ahead. */
function scoreCompare(a: LeagueRow, b: LeagueRow) {
  const rows = CMP.map((m) => {
    const va = !m.ok || m.ok(a) ? m.get(a) : null;
    const vb = !m.ok || m.ok(b) ? m.get(b) : null;
    let win: "me" | "them" | null = null;
    if (va != null && vb != null && va !== vb) win = (m.lower ? va < vb : va > vb) ? "me" : "them";
    return { m, va, vb, win };
  });
  return { rows, mine: rows.filter((r) => r.win === "me").length, theirs: rows.filter((r) => r.win === "them").length };
}

/** A fighter's card in the arena: tall portrait, team light, name underneath. */
function Fighter({ r, side, tag, children }: { r: LeagueRow; side: "l" | "r"; tag: React.ReactNode; children?: React.ReactNode }) {
  const color = teamByName(r.team)?.primary ?? "#D4AF37";
  return (
    <motion.div
      key={r.name}
      initial={{ opacity: 0, x: side === "l" ? -40 : 40, rotate: side === "l" ? -4 : 4 }}
      animate={{ opacity: 1, x: 0, rotate: side === "l" ? -2 : 2 }}
      transition={{ type: "spring", stiffness: 120, damping: 15 }}
      className={`relative flex flex-col ${side === "l" ? "items-start" : "items-end"}`}
    >
      <div className="relative w-full max-w-[230px]">
        <div aria-hidden className="absolute -inset-4 rounded-[36px] opacity-60 blur-2xl" style={{ background: color }} />
        <div className="relative aspect-[4/5] overflow-hidden rounded-[26px] ring-2" style={{ boxShadow: `0 0 0 2px ${color}` }}>
          {r.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.photo.split("#")[0]} alt="" className="h-full w-full object-cover" style={focusStyle(focusOf(r.photo), 0.45, 0.8)} />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[#13233D] font-heading text-6xl font-extrabold text-white/40">
              {r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
          )}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#05080F] to-transparent" />
          <span className={`absolute top-3 ${side === "l" ? "left-3" : "right-3"}`}>{tag}</span>
          <div className={`absolute bottom-3 ${side === "l" ? "left-4" : "right-4 text-right"}`}>
            <p className="font-heading text-2xl font-extrabold leading-none tracking-[-0.03em] text-white">{r.name.split(" ")[0]}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/65">{r.team} · {r.matches} m</p>
          </div>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function CompareChapter({ rows, onShare }: { rows: LeagueRow[]; onShare: (them: LeagueRow) => void }) {
  const me = rows.find((r) => r.me)!;
  const others = rows.filter((r) => !r.me);
  // Opens on the next scalp: the run-scorer just above the member, else the leader.
  const byRuns = [...rows].sort((a, b) => b.runs - a.runs);
  const above = byRuns[byRuns.indexOf(me) - 1] ?? byRuns.find((r) => !r.me)!;
  const [themName, setThem] = useState(above?.name ?? others[0]?.name);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const them = others.find((r) => r.name === themName) ?? others[0];
  if (!them) return null;
  const { rows: lines, mine, theirs } = scoreCompare(me, them);
  const decided = mine + theirs || 1;
  const verdict = mine > theirs ? "You're winning" : mine < theirs ? "They're winning" : "Dead level";
  const meColor = teamByName(me.team)?.primary ?? "#D4AF37";
  const themColor = teamByName(them.team)?.primary ?? "#3B6FC4";

  const leader = (k: keyof LeagueRow) => [...others].sort((a, b) => (b[k] as number) - (a[k] as number))[0];
  const quick: [string, LeagueRow | undefined][] = [
    ["Next above you", above && !above.me ? above : undefined],
    ["Top run-scorer", leader("runs")],
    ["Top wicket-taker", leader("wk")],
    ["A teammate", others.filter((r) => r.team === me.team).sort((a, b) => b.matches - a.matches)[0]],
    ["Biggest rival", others.filter((r) => r.h2h).sort((a, b) => b.h2h!.meetings - a.h2h!.meetings)[0]],
  ];
  const list = others.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative">
      {/* The arena: each side lit in its team's colour, a gold seam down the middle */}
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -top-48 left-1/2 w-screen -translate-x-1/2">
        <div className="absolute inset-0 transition-[background] duration-700" style={{ background: `radial-gradient(45% 55% at 12% 30%, ${meColor}55, transparent 70%), radial-gradient(45% 55% at 88% 30%, ${themColor}55, transparent 70%)` }} />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-[8deg] bg-gradient-to-b from-transparent via-jcc-accent/50 to-transparent" />
        <p className="absolute left-1/2 top-40 -translate-x-1/2 select-none font-heading text-[14rem] font-extrabold italic leading-none tracking-[-0.06em] text-white/[0.04] md:text-[22rem]">VS</p>
      </div>

      <div className="relative grid grid-cols-2 items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-8">
        <Fighter r={me} side="l" tag={<span className="rounded-full bg-jcc-accent px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0B1424]">You</span>} />

        {/* The scoreboard */}
        <div className="order-last col-span-2 text-center md:order-none md:col-span-1">
          <motion.p key={them.name} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }} className="font-heading text-7xl font-extrabold leading-none tracking-[-0.06em] tabular-nums md:text-8xl">
            <span className={mine >= theirs ? "text-jcc-accent" : "text-white/55"}>{mine}</span>
            <span className="mx-1 text-white/25">:</span>
            <span className={theirs >= mine ? "text-jcc-accent" : "text-white/55"}>{theirs}</span>
          </motion.p>
          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/60">{verdict} · categories</p>
          {/* Tug of war */}
          <div className="mx-auto mt-4 flex h-2.5 w-56 overflow-hidden rounded-full bg-white/10">
            <motion.span className="h-full" style={{ background: meColor }} initial={false} animate={{ width: `${(100 * mine) / decided}%` }} transition={{ duration: 0.8, ease: EASE }} />
            <span className="h-full w-0.5 bg-white" />
            <motion.span className="h-full flex-1" style={{ background: themColor }} />
          </div>
          <span className="mt-5 inline-grid h-14 w-14 place-items-center rounded-full bg-jcc-accent font-heading text-lg font-extrabold italic text-[#0B1424] shadow-[0_0_40px_rgba(212,175,55,0.55)]">VS</span>
        </div>

        <Fighter
          r={them}
          side="r"
          tag={
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full bg-[#05080F]/80 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/25 backdrop-blur hover:ring-jcc-accent">
              Change <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          }
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                className="absolute right-0 top-12 z-30 w-[min(22rem,85vw)] overflow-hidden rounded-2xl bg-[#0F1C33] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/15"
              >
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a player…" className="w-full border-b border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/40" />
                <ul className="max-h-72 overflow-y-auto py-1">
                  {list.map((r) => (
                    <li key={r.name}>
                      <button
                        type="button"
                        onClick={() => { setThem(r.name); setOpen(false); setQ(""); }}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.06] ${r.name === them.name ? "bg-jcc-accent/15" : ""}`}
                      >
                        <Face name={r.name} photo={r.photo} size={32} ring="ring-transparent" />
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{r.name}</span>
                        <span className="h-2 w-2 rounded-full" style={{ background: teamByName(r.team)?.primary ?? "#D4AF37" }} />
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </Fighter>
      </div>

      {/* Pick a fight */}
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-2">
        {quick.filter(([, r]) => r).map(([label, r]) => (
          <button
            key={label}
            type="button"
            onClick={() => setThem(r!.name)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${r!.name === them.name ? "bg-jcc-accent text-[#0B1424]" : "bg-white/[0.06] text-white/80 ring-1 ring-white/15 hover:ring-white/40"}`}
          >
            {label}: {r!.name.split(" ")[0]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setThem(others[Math.floor(Math.random() * others.length)].name)}
          className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-jcc-accent ring-1 ring-jcc-accent/50 hover:bg-jcc-accent/15"
        >
          🎲 Surprise me
        </button>
      </div>

      {/* One on one, on the field */}
      {them.h2h && (
        <div className="relative mx-auto mt-8 grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl bg-white/[0.05] px-6 py-4 ring-1 ring-white/10 backdrop-blur">
          <div>
            <p className="font-heading text-4xl font-extrabold tabular-nums text-white">{them.h2h.iDismissed}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">times you got {them.name.split(" ")[0]} out</p>
          </div>
          <div className="text-center">
            <p className={`${KICK} text-jcc-accent`}>One on one</p>
            <p className="mt-1 font-mono text-[11px] text-white/55">{plural(them.h2h.meetings, "meeting")}</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-4xl font-extrabold tabular-nums text-white">{them.h2h.theyDismissed}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">times {them.name.split(" ")[0]} got you</p>
          </div>
        </div>
      )}

      {/* Round by round */}
      <ol className="relative mt-12 space-y-1">
        {lines.map(({ m, va, vb, win }, i) => {
          const max = Math.max(va ?? 0, vb ?? 0) || 1;
          const w = (v: number | null) => (v == null ? 0 : Math.max(4, (100 * v) / max));
          const bar = (won: boolean, color: string, dir: "l" | "r") => ({
            background: won ? `linear-gradient(${dir === "l" ? 270 : 90}deg, #F3C96A, #A97824)` : `${color}40`,
            boxShadow: won ? "0 0 18px rgba(212,175,55,0.45)" : undefined,
          });
          return (
            <motion.li
              key={`${them.name}-${m.label}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035 }}
              className="group grid grid-cols-[3.5rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04] sm:grid-cols-[4.5rem_minmax(0,1fr)_10rem_minmax(0,1fr)_4.5rem]"
            >
              <span className={`text-right font-heading text-lg font-extrabold tabular-nums sm:text-xl ${win === "me" ? "text-jcc-accent" : "text-white/50"}`}>{m.fmt(va)}</span>
              <span className="flex h-3.5 justify-end">
                <motion.span className="h-full rounded-full" style={bar(win === "me", meColor, "l")} initial={{ width: 0 }} animate={{ width: `${w(va)}%` }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.035 }} />
              </span>
              <span className="text-center">
                <span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold leading-tight ${win ? "bg-white/[0.07] text-white" : "text-white/60"}`}>{m.label}</span>
                {m.lower && <span className="block font-mono text-[9px] text-white/45">lower wins</span>}
              </span>
              <span className="flex h-3.5">
                <motion.span className="h-full rounded-full" style={bar(win === "them", themColor, "r")} initial={{ width: 0 }} animate={{ width: `${w(vb)}%` }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.035 }} />
              </span>
              <span className={`font-heading text-lg font-extrabold tabular-nums sm:text-xl ${win === "them" ? "text-jcc-accent" : "text-white/50"}`}>{m.fmt(vb)}</span>
            </motion.li>
          );
        })}
      </ol>
      <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-white/55">Strike rate and average need 15 balls faced; economy and dot-ball % need 2 overs bowled.</p>
        <button
          type="button"
          onClick={() => onShare(them)}
          className="inline-flex items-center gap-2 rounded-full bg-jcc-accent px-5 py-2.5 text-[12px] font-bold text-[#0B1424] shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-transform hover:scale-[1.04]"
        >
          <Share2 className="h-3.5 w-3.5" /> Share this face-off
        </button>
      </div>
    </div>
  );
}

// ── Scenes: the full-bleed backdrops chapters alternate between ──────────────

type Tone = "dark" | "gold" | "cool" | "ivory" | "arena" | "royal" | "ember" | "lilac" | "vault" | "peach" | "paper";
const SCENE: Record<Tone, string> = {
  dark: "story-dark bg-[#0B1424]",
  arena: "story-dark bg-[#05080F]",
  royal: "story-dark bg-gradient-to-b from-[#12233F] to-[#0B1A33]",
  ember: "story-dark bg-gradient-to-b from-[#2B1709] via-[#1A1210] to-[#0B1424]",
  lilac: "bg-gradient-to-b from-[#F3F0FB] to-[#ECE8F8]",
  // Warm white, lit orange from the batting side and violet from the bowling side.
  paper: "bg-[radial-gradient(55%_45%_at_0%_0%,rgba(245,158,11,0.13),transparent_70%),radial-gradient(55%_45%_at_100%_100%,rgba(124,58,237,0.11),transparent_70%),linear-gradient(180deg,#FFFDF8,#F5F1E8)]",
  peach: "bg-gradient-to-br from-[#FFF5EE] via-[#FDEFE4] to-[#FBE6D6]",
  vault: "story-dark bg-gradient-to-b from-[#1E1606] via-[#141008] to-[#0B1424]",
  gold: "bg-[#FBF4E2]",
  cool: "bg-[#EDF1F8]",
  ivory: "bg-[#FCFBF8]",
};
/** Dark, warm and cool take turns, so no two neighbouring chapters look alike. */
const TONE_OF: Record<string, Tone> = {
  level: "dark", moments: "gold", ranks: "dark", strengths: "peach", battles: "dark", captaincy: "royal", compare: "arena",
  contribution: "gold", form: "ember", numbers: "paper", badges: "vault", quests: "gold",
};

/** A headline that rises in word by word. */
function RevealTitle({ text }: { text: string }) {
  return (
    <h3 className="mt-2 font-heading text-[2rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-jcc-blue md:text-5xl">
      {text.split(" ").map((w, i) => (
        <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "105%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ delay: i * 0.06, duration: 0.7, ease: EASE }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </h3>
  );
}

function Scene({ id, n, tone, children }: { id: string; n: number; tone: Tone; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["35%", "-35%"]);
  const dark = tone === "dark" || tone === "arena" || tone === "royal" || tone === "ember" || tone === "vault";
  return (
    <section
      ref={ref}
      id={`story-${id}`}
      onMouseMove={
        dark
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
            }
          : undefined
      }
      className={`group/scene relative scroll-mt-24 overflow-hidden py-16 md:py-28 ${SCENE[tone]}`}
    >
      {/* The chapter number, huge, drifting slower than the page */}
      <motion.span
        aria-hidden
        style={{ y }}
        className="pointer-events-none absolute right-[4%] top-0 select-none font-heading text-[10rem] font-extrabold leading-none tracking-[-0.08em] text-jcc-blue/[0.06] md:text-[17rem]"
      >
        {String(n).padStart(2, "0")}
      </motion.span>
      {dark && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/40 to-transparent" />
          {/* Cursor spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/scene:opacity-100"
            style={{ background: "radial-gradient(520px circle at var(--mx, 50%) var(--my, 30%), rgba(212,175,55,0.11), transparent 60%)" }}
          />
        </>
      )}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

// ── The story, one long scroll ──────────────────────────────────────────────

type Chapter = {
  id: string;
  label: string;
  icon: typeof Crown;
  kicker: string;
  title: string;
  body: React.ReactNode;
  /** Story cards for this chapter; absent when it isn't something to brag about. */
  share?: () => SheetCard[];
};

export function StoryScroll({
  s, me, axes, totals, avgRuns, teamShare, winPct, numbers, numberStats, badges, overview, cardHref,
}: {
  s: StoryData;
  me: Me;
  axes: Axis[];
  totals: Totals;
  /** Batting average runs per innings in this scope, for the form meter. */
  avgRuns: number;
  teamShare?: number | null;
  winPct?: number | null;
  /** The "your numbers" panels, built by MyStats; `share(id)` opens that number's card. */
  numbers: (share: (id: string) => void) => React.ReactNode;
  numberStats: NumberStat[];
  badges: CabinetBadge[];
  /** Role and the 3×2 headline grid, for the numbers story card. */
  overview: { role: string; stats: { label: string; value: string; note?: string }[] };
  /** The member's full card on /stats. */
  cardHref: string;
}) {
  const [sheet, setSheet] = useState<SheetCard[] | null>(null);
  const scope = s.label;
  const strengths = strengthList(s, axes);
  const ranks = rankRows(s);
  const L = xpOf(totals);
  const card = (o: Omit<Parameters<typeof statCard>[0], "name" | "photo" | "team">) => statCard({ ...o, name: me.name, photo: me.photo, team: me.team });
  const list = (o: Omit<Parameters<typeof listCard>[0], "team">) => listCard({ ...o, team: me.team });
  const plain = (name: string, value: string, note?: string): CardRow => ({ name, value, note, plain: true });
  const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const earnedBadges = badges
    .filter((b) => b.tone !== "warn")
    .map((b) => ({ ...b, n: b.holders ?? 1, tier: tierOf(b.tone, b.holders ?? 1) }))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.n - b.n);
  /** One card per badge: the medal on its sunburst, the member as the holder (as on /stats). */
  const badgeCards = (): SheetCard[] => {
    const team = teamByName(me.team ?? null);
    return earnedBadges.map((b) => ({
      id: `badge-${b.label}`,
      label: b.label,
      spec: {
        kicker: `${b.label} · ${cap1(b.tier)} badge`,
        title: me.name,
        body: b.why,
        emblem: emblemImage(b.label, b.tone, b.tier),
        burst: burstFor(b.tone, b.label),
        accent: burstFor(b.tone, b.label)[1],
        person: { name: me.name, photo: me.photo, color: team?.primary },
        teamLogo: team?.logo,
        team: me.team ?? undefined,
        facts: [
          { label: "Badge", value: b.label },
          { label: "Tier", value: cap1(b.tier) },
          { label: "Holders", value: b.n === 1 ? "Only one" : `1 of ${b.n}` },
        ],
        footer: `${window.location.host}/stats`,
      },
      text: `${b.label}: ${b.why}\n— ${me.name}, JCC Stats · ${scope}\n${window.location.origin}/stats`,
    }));
  };
  /** The whole cabinet on one card: each badge with its medal, rarest first. */
  const cabinetCard = (): SheetCard =>
    list({
      id: "badges", label: "All badges", kicker: `Trophy cabinet · ${scope}`, title: `${plural(earnedBadges.length, "badge")} unlocked`,
      rows: earnedBadges.slice(0, 9).map((b) => ({ name: b.label, value: b.n === 1 ? "Only one" : `1 of ${b.n}`, note: b.why, photo: emblemImage(b.label, b.tone, b.tier), logo: true })),
    });
  /** The face-off as a story card: both portraits split-screen, the categories underneath. */
  const versusCard = (them: LeagueRow): SheetCard => {
    const meRow = s.league!.find((r) => r.me)!;
    const { rows: lines, mine, theirs } = scoreCompare(meRow, them);
    const team = teamByName(me.team ?? null);
    // Every category with a number on both sides, in the usual order.
    const shown = lines.filter((l) => l.va != null && l.vb != null).slice(0, 8);
    return {
      id: `vs-${them.name}`,
      label: `v ${them.name}`,
      spec: {
        kicker: `Face-off · ${scope}`,
        // No title: the names ride on the portraits, and the pictures get the room.
        title: "",
        subtitle: `${mine > theirs ? "I lead" : mine < theirs ? "They lead" : "All square"} ${mine}–${theirs} on categories`,
        versus: {
          left: { name: me.name.split(" ")[0], photo: me.photo, color: team?.primary },
          right: { name: them.name.split(" ")[0], photo: them.photo, color: teamByName(them.team)?.primary },
        },
        compare: shown.map((l) => {
          const max = Math.max(l.va ?? 0, l.vb ?? 0) || 1;
          return { label: l.m.label, a: l.m.fmt(l.va), b: l.m.fmt(l.vb), win: l.win === "me" ? "a" : l.win === "them" ? "b" : null, pa: (l.va ?? 0) / max, pb: (l.vb ?? 0) / max };
        }),
        accent: team?.primary,
        teamLogo: team?.logo,
        team: me.team ?? undefined,
        footer: `${window.location.host}/stats`,
      },
      text: `${me.name} v ${them.name}: ${mine}–${theirs} on categories\n${window.location.origin}/stats`,
    };
  };
  /** The one-to-one record on the field, when they've actually played each other. */
  const battleCard = (them: LeagueRow): SheetCard | null => {
    const h = them.h2h;
    if (!h || !h.meetings) return null;
    const team = teamByName(me.team ?? null);
    const lead = h.iDismissed > h.theyDismissed ? "I'm ahead" : h.iDismissed < h.theyDismissed ? "They're ahead" : "Dead level";
    return {
      id: `battle-${them.name}`,
      label: `Battle v ${them.name.split(" ")[0]}`,
      spec: {
        kicker: `One on one · ${scope}`,
        title: "",
        subtitle: `${lead} · ${plural(h.meetings, "meeting")}`,
        versus: {
          left: { name: me.name.split(" ")[0], photo: me.photo, color: team?.primary },
          right: { name: them.name.split(" ")[0], photo: them.photo, color: teamByName(them.team)?.primary },
        },
        compare: [
          {
            label: "Wickets on each other", a: String(h.iDismissed), b: String(h.theyDismissed),
            win: h.iDismissed === h.theyDismissed ? null : h.iDismissed > h.theyDismissed ? "a" : "b",
            pa: h.iDismissed / (Math.max(h.iDismissed, h.theyDismissed) || 1), pb: h.theyDismissed / (Math.max(h.iDismissed, h.theyDismissed) || 1),
          },
        ],
        accent: team?.primary,
        teamLogo: team?.logo,
        team: me.team ?? undefined,
        footer: `${window.location.host}/stats`,
      },
      text: `${me.name} v ${them.name} on the field: I've dismissed them ${h.iDismissed}×, they've dismissed me ${h.theyDismissed}× in ${plural(h.meetings, "meeting")}\n${window.location.origin}/stats`,
    };
  };
  /** Both cards for a rival: the face-off, then the battle when there is one. */
  const rivalCards = (them: LeagueRow): SheetCard[] => [versusCard(them), battleCard(them)].filter((c): c is SheetCard => !!c);
  /** A card for every number on the "Your numbers" chapter. */
  const numberCards = (): SheetCard[] =>
    numberStats.map((x) =>
      card({
        id: `num-${x.id}`, label: x.label, kicker: `${x.kind === "bat" ? "Batting" : x.kind === "bowl" ? "Bowling" : x.kind === "field" ? "Fielding" : "Against the league"} · ${scope}`,
        title: x.kind === "dna" ? `${x.label}: ${x.note?.split(" · ")[0]}` : x.label,
        value: x.value, unit: x.unit,
        colors: x.kind === "bat" ? ORANGE : x.kind === "bowl" ? PURPLE : x.kind === "field" ? GREEN : GOLD,
        facts: [
          ...(x.rank ? [{ label: "Club rank", value: `#${x.rank.rank} of ${x.rank.of}` }] : []),
          ...(x.note ? [{ label: "Standing", value: x.note.split(" · ")[1] ?? x.note }] : []),
          { label: "Scope", value: scope },
        ].slice(0, 3),
      }),
    );
  /** A story card for each ranking: the rank huge, in the colour of what it measures. */
  const rankCards = (): SheetCard[] =>
    ranks.map((r) => {
      const colors = ["runs", "sr", "six"].includes(r.k) ? ORANGE : r.k === "field" ? GREEN : PURPLE;
      const climb = r.rank - 1;
      return card({
        id: `rank-${r.k}`, label: r.label, kicker: `Club ranking · ${scope}`,
        title: r.rank === 1 ? `Number one for ${r.label.toLowerCase()} in the club` : `#${r.rank} for ${r.label.toLowerCase()} in the club`,
        value: `#${r.rank}`, unit: `of ${r.of} players`, colors,
        facts: [{ label: "Standing", value: `Top ${r.top}%` }, { label: "To #1", value: climb ? plural(climb, "place") : "There" }, { label: "Scope", value: scope }],
      });
    });
  /** A story card for each perk: the measured number when there is one, else its rarity. */
  const perkCards = (): SheetCard[] =>
    strengths.map((p, k) =>
      card({
        id: `perk-${k}`, label: p.title, kicker: `Perk unlocked · ${scope}`, title: p.title,
        value: p.value ?? (p.pct >= 80 ? "Elite" : "Strong"), unit: p.measure ?? "standout in the club", colors: p.pct >= 80 ? GOLD : ["#6E9BE6", "#3B6FC4"],
        body: p.body,
        facts: [{ label: "Rarity", value: p.pct >= 80 ? "Legendary" : "Rare" }, ...(p.value ? [{ label: "Better than", value: `${Math.round(p.pct)}%` }] : []), { label: "Scope", value: scope }],
      }),
    );
  /** Player of the Match cards, latest first, with the match figures as the headline. */
  const momCards = (max: number): SheetCard[] => {
    const all = s.mom ?? [];
    return [...all].reverse().slice(0, max).map((m, k) => {
      const c = card({
        id: `mom-${m.date}-${k}`, label: "Player of the Match", kicker: `Player of the Match · ${day(m.date)}`, title: `Player of the Match against ${m.opp}`,
        value: "", unit: "", colors: GOLD,
        facts: [{ label: "Against", value: m.opp }, { label: "Date", value: day(m.date) }, { label: "Awards", value: String(all.length) }],
      });
      // Golden: the badge-card layout in gold, a legendary crown medal and the member at its centre.
      const gold = {
        burst: ["#F3C96A", "#A97824"] as [string, string],
        emblem: emblemImage("Player of the Match", "crown", "legendary"),
        accent: "#D4AF37",
      };
      return { ...c, spec: { ...c.spec, hero: undefined, ...potmFigures(m.line), ...gold }, text: `Player of the Match v ${m.opp}: ${m.line}\n${window.location.origin}/stats` };
    });
  };

  const chapters: Chapter[] = [
    {
      id: "level", label: "Level", icon: Zap, kicker: `Player level · ${scope}`, title: `Level ${L.level}: ${L.title}`, body: <LevelCard totals={totals} />,
      share: () => [card({ id: "level", label: "Level", kicker: `JCC player level · ${scope}`, title: L.title, value: `LVL ${L.level}`, unit: `${L.xp} XP`, colors: GOLD, facts: L.parts.filter((p) => p.xp).slice(0, 3).map((p) => ({ label: p.label, value: `${p.xp} XP` })) })],
    },
  ];
  const h = s.highlights;
  if (h && (h.bestInnings?.runs || h.bestSpell || h.boundaries)) {
    chapters.push({
      id: "moments", label: "Highlights", icon: Flame, kicker: `Highlights · ${scope}`, title: "Your best moments", body: <Moments s={s} />,
      share: () => {
        const out: SheetCard[] = [];
        const b = h.bestInnings;
        if (b && b.runs > 0) {
          out.push(card({ id: "top-score", label: "Top score", kicker: `Top score · ${scope}`, title: `${b.runs}${b.notOut ? "*" : ""} against ${b.opp}`, value: `${b.runs}${b.notOut ? "*" : ""}`, unit: `off ${b.balls} balls`, colors: ORANGE, facts: [{ label: "Against", value: b.opp }, { label: "Date", value: day(b.date) }, { label: "Result", value: b.won ? "Won" : "Lost" }] }));
        }
        const w = h.bestSpell;
        if (w) {
          out.push(card({ id: "best-spell", label: "Best spell", kicker: `Best spell · ${scope}`, title: `${w.wk} for ${w.runs} against ${w.opp}`, value: `${w.wk}/${w.runs}`, unit: `in ${overs(w.balls)} overs`, colors: PURPLE, facts: [{ label: "Against", value: w.opp }, { label: "Date", value: day(w.date) }, { label: "Result", value: w.won ? "Won" : "Lost" }] }));
        }
        out.push(...momCards(3));
        if (h.boundaries) {
          out.push(card({ id: "boundaries", label: "Boundaries", kicker: `Boundaries · ${scope}`, title: `${h.boundaries} boundaries for JCC`, value: String(h.boundaries), unit: "fours & sixes", colors: GOLD, facts: [{ label: "20+ scores", value: String(h.scores20) }, ...(h.mostSixes ? [{ label: "Most sixes in a knock", value: String(h.mostSixes.s6) }] : [])] }));
        }
        return out;
      },
    });
  }
  if (ranks.length) {
    chapters.push({
      id: "ranks", label: "Rankings", icon: Gauge, kicker: `Standing · ${scope}`, title: "Climb the club ladder",
      body: <Ranks s={s} onShare={(k) => setSheet(rankCards().filter((c) => c.id === `rank-${k}`))} />,
      // One card per ranking, then the lot on one card.
      share: () => {
        const top = ranks.filter((r) => r.top <= 25);
        const rows = (top.length ? top : ranks.slice(0, 3)).map((r) => plain(r.label, `#${r.rank}`, top.length ? `of ${r.of} · top ${r.top}%` : `of ${r.of} players`));
        return [...rankCards(), list({ id: "ranks", label: "All rankings", kicker: `Club rankings · ${scope}`, title: `${me.name.split(" ")[0]}'s club rankings`, rows })];
      },
    });
  }
  if (strengths.length) {
    chapters.push({
      id: "strengths", label: "Perks", icon: Sparkles, kicker: "Your game", title: `${plural(strengths.length, "perk")} unlocked`, body: <Strengths list={strengths} onShare={(t) => setSheet(perkCards().filter((c) => c.label === t))} />,
      share: () => [...perkCards(), list({ id: "strengths", label: "All perks", kicker: `My game · ${scope}`, title: "What I do best", rows: strengths.slice(0, 5).map((x) => plain(x.title, "", x.body)) })],
    });
  }
  const bt = s.battles;
  if (bt && (bt.rivalries.length || bt.bunnies.length || bt.dominated.length || bt.nemesis.length)) {
    const winning = bt.rivalries.filter((r) => r.mine > r.theirs);
    chapters.push({
      id: "battles", label: "Battles", icon: Swords, kicker: "Head to head", title: "Your personal battles",
      body: <><BossCallout s={s} /><Battles s={s} me={me} /></>,
      share: () => {
        const out: SheetCard[] = [
          ...(bt.bunnies.length ? [list({ id: "bunnies", label: "My bunnies", kicker: `Head to head · ${scope}`, title: "Batters I keep getting out", rows: bt.bunnies.map((x) => ({ ...plain(x.name, plural(x.wk, "wkt"), plural(x.meetings, "meeting")), photo: x.photo, plain: !x.photo })) })] : []),
          // Scorecards don't record runs off a bowler, so this one talks in meetings, not runs.
          ...(bt.dominated.length ? [list({ id: "taken-on", label: "Never out to them", kicker: `Head to head · ${scope}`, title: "Bowlers who haven't got me out", rows: bt.dominated.map((x) => ({ ...plain(x.name, "Not out", plural(x.meetings, "meeting")), photo: x.photo, plain: !x.photo })) })] : []),
          ...winning.map((r, k) =>
            card({ id: `rival-${k}`, label: `v ${r.opponent}`, kicker: `Rivalry · ${scope}`, title: `Me v ${r.opponent}`, value: `${r.mine}–${r.theirs}`, unit: r.batting ? "survived – got out" : "dismissed – survived", colors: GOLD, facts: [{ label: "Meetings", value: String(r.meetings) }, { label: "I", value: r.batting ? "bat" : "bowl" }] }),
          ),
        ];
        if (!out.length) {
          const opponents = new Set([...bt.rivalries.map((r) => r.opponent), ...bt.nemesis.map((x) => x.name)]).size;
          out.push(card({ id: "battles", label: "Battles", kicker: `Head to head · ${scope}`, title: "Rivalries running", value: String(opponents), unit: opponents === 1 ? "rival" : "rivals", colors: GOLD }));
        }
        return out;
      },
    });
  }
  if (s.league && s.league.some((r) => r.me) && s.league.length > 1) {
    const meRow = s.league.find((r) => r.me)!;
    chapters.push({
      id: "compare", label: "Compare", icon: ArrowLeftRight, kicker: `Head to head · ${scope}`, title: "You against anyone",
      body: <CompareChapter rows={s.league} onShare={(them) => setSheet(rivalCards(them))} />,
      // The whole set: you against the leaders and your closest rivals.
      share: () => {
        const others = s.league!.filter((r) => !r.me);
        const byRuns = [...s.league!].sort((a, b) => b.runs - a.runs);
        const picks = [
          byRuns[byRuns.indexOf(meRow) - 1],
          [...others].sort((a, b) => b.runs - a.runs)[0],
          [...others].sort((a, b) => b.wk - a.wk)[0],
          others.filter((r) => r.h2h).sort((a, b) => b.h2h!.meetings - a.h2h!.meetings)[0],
        ].filter((r): r is LeagueRow => !!r && !r.me);
        return [...new Map(picks.map((r) => [r.name, r])).values()].flatMap(rivalCards);
      },
    });
  }
  const cap = s.captaincy;
  /** One badge card per captain's honour, drawn like the badge cards. */
  const honourCards = (): SheetCard[] => {
    if (!cap) return [];
    const team = teamByName(me.team ?? null);
    return captainHonours(cap).map((h) => ({
      id: `honour-${h.label}`,
      label: h.label,
      spec: {
        kicker: `${h.label} · ${h.club ? "Club captaincy award" : "Captain's honour"}`,
        title: me.name,
        body: h.why,
        emblem: emblemImage(h.label, h.tone, h.tier),
        burst: burstFor(h.tone, h.label),
        accent: burstFor(h.tone, h.label)[1],
        person: { name: me.name, photo: me.photo, color: team?.primary },
        teamLogo: team?.logo,
        team: me.team ?? undefined,
        facts: [
          { label: "Honour", value: h.label },
          { label: "Record", value: `${cap.w}–${cap.l}${cap.t ? `–${cap.t}` : ""}` },
          { label: "As captain", value: plural(cap.matches, "match", "matches") },
        ],
        footer: `${window.location.host}/stats`,
      },
      text: `${h.label}: ${h.why}\n— ${me.name}, JCC Stats · ${scope}\n${window.location.origin}/stats`,
    }));
  };
  if (cap && cap.matches > 0) {
    chapters.push({
      id: "captaincy", label: "Captaincy", icon: Crown, kicker: `Captaincy · ${scope}`, title: "Leading from the front", body: <Captaincy c={cap} onShareHonour={(label) => setSheet(honourCards().filter((x) => x.label === label))} />,
      share: () => {
        const tosses = cap.toss.won + cap.toss.lost;
        return [
          ...honourCards(),
          card({
            id: "captain", label: "Captain's record", kicker: `Captaincy · ${scope}`, title: `${plural(cap.matches, "match", "matches")} as captain`,
            value: `${cap.w}–${cap.l}${cap.t ? `–${cap.t}` : ""}`, unit: "won – lost", colors: GOLD,
            facts: [{ label: "Win rate", value: `${Math.round((100 * cap.w) / cap.matches)}%` }, { label: "Best streak", value: String(cap.streak) }, ...(tosses ? [{ label: "Tosses won", value: `${cap.toss.won}/${tosses}` }] : [])],
          }),
          list({
            id: "captain-recent", label: "Recent as captain", kicker: `Captaincy · ${scope}`, title: "My last matches in charge",
            rows: [...cap.recent].slice(-6).reverse().map((m) => plain(`v ${m.opp}`, m.res === "W" ? "Won" : m.res === "L" ? "Lost" : "Tied", `${day(m.date)}${m.toss ? ` · toss ${m.toss}${m.decision ? `, ${m.decision}` : ""}` : ""}`)),
          }),
        ];
      },
    });
  }
  if (s.contribution) {
    const c = s.contribution;
    chapters.push({
      id: "contribution", label: "Contribution", icon: HandHeart, kicker: "Contribution", title: "What you give the group", body: <Contribution s={s} teamShare={teamShare} winPct={winPct} />,
      share: () => [
        card({
          id: "contribution", label: "Contribution", kicker: `Showing up · ${scope}`, title: `${c.attendance.present} of ${c.attendance.teamMatches} games for ${c.attendance.team}`,
          value: `${c.attendance.pct}%`, unit: "attendance", colors: GREEN,
          facts: [{ label: "Wins played", value: String(c.winsPlayed) }, ...(c.runsInWins ? [{ label: "Runs in wins", value: String(c.runsInWins) }] : []), ...(c.wicketsInWins ? [{ label: "Wickets in wins", value: String(c.wicketsInWins) }] : [])].slice(0, 3),
        }),
      ],
    });
  }
  if (s.form && (s.form.innings.length || s.form.spells.length)) {
    const inns = s.form.innings, spells = s.form.spells;
    chapters.push({
      id: "form", label: "Form", icon: TrendingUp, kicker: "Form", title: "How hot are you right now?", body: <><FormMeter s={s} avgRuns={avgRuns} /><Form s={s} /><AllRound s={s} /></>,
      share: () => {
        const last = inns.slice(-5);
        const recent = last.length ? last.reduce((a, r) => a + r.runs, 0) / last.length : 0;
        const hot = avgRuns > 0 && recent >= avgRuns * 1.05;
        const out: SheetCard[] = [];
        if (inns.length) {
          out.push(list({
            id: "form-bat", label: "Recent innings", kicker: `Recent form · ${scope}`, title: hot ? (recent >= avgRuns * 1.4 ? "On fire 🔥" : "Heating up 📈") : "Back in the middle",
            rows: [...inns].slice(-5).reverse().map((r) => plain(`v ${r.opp}`, `${r.runs}${r.out ? "" : "*"}`, `${r.balls} balls · ${day(r.date)}${r.won ? " · won" : ""}`)),
          }));
        }
        const both = (s.form?.allround ?? []).filter((r) => r.bat && r.bowl);
        if (both.length) {
          out.push(list({
            id: "form-allround", label: "All-round", kicker: `Recent form · ${scope}`, title: "Bat and ball",
            rows: [...both].slice(-5).reverse().map((r) => plain(`v ${r.opp}`, `${r.bat!.runs}${r.bat!.out ? "" : "*"} & ${r.bowl!.wk}/${r.bowl!.runs}`, `${day(r.date)}${r.won ? " · won" : ""}`)),
          }));
        }
        const wk = spells.filter((w) => w.wk > 0);
        if (wk.length) {
          out.push(list({ id: "form-bowl", label: "Recent spells", kicker: `Recent form · ${scope}`, title: "Latest wickets", rows: [...wk].slice(-5).reverse().map((w) => plain(`v ${w.opp}`, `${w.wk}/${w.runs}`, `${overs(w.balls)} ov · ${day(w.date)}`)) }));
        }
        return out;
      },
    });
  }
  chapters.push({
    id: "numbers", label: "Numbers", icon: BarChart3, kicker: `At a glance · ${scope}`, title: "Your numbers",
    body: numbers((id) => setSheet(numberCards().filter((c) => c.id === `num-${id}`))),
    share: () => {
      const team = teamByName(me.team ?? null);
      return [{
        id: "numbers", label: "My numbers",
        spec: {
          kicker: `${scope} · ${overview.role}`, title: me.name, subtitle: `${me.team ?? "JCC"} · ${plural(totals.matches, "match", "matches")}`,
          stats: overview.stats,
          person: { name: me.name, photo: me.photo, color: team?.primary }, accent: team?.primary, teamLogo: team?.logo, team: me.team ?? undefined,
          footer: `${window.location.host}/stats`,
        },
        text: `${totals.runs} runs, ${totals.wickets} wickets in ${plural(totals.matches, "match", "matches")}\n${window.location.origin}/stats`,
      }, ...numberCards()];
    },
  });
  chapters.push({
    id: "badges", label: "Cabinet", icon: Award, kicker: "Achievements", title: "Your trophy cabinet", body: <Cabinet badges={badges} mom={s.mom ?? []} onShare={(label) => setSheet(badgeCards().filter((c) => c.label === label))} />,
    share: () => {
      const out: SheetCard[] = [];
      if (earnedBadges.length) out.push(...badgeCards(), cabinetCard());
      out.push(...momCards(3));
      if (!out.length) out.push(card({ id: "cabinet", label: "Cabinet", kicker: `Trophy cabinet · ${scope}`, title: "Building the cabinet", value: String(totals.matches), unit: "matches played", colors: GOLD }));
      return out;
    },
  });
  chapters.push({
    id: "quests", label: "Quests", icon: Lightbulb, kicker: "Next level", title: "Your quests", body: <Quests totals={totals} tips={s.tips ?? []} />,
    share: () => [list({ id: "quests", label: "Chasing next", kicker: `Next milestones · ${scope}`, title: "What I'm chasing next", rows: milestones(totals).slice(0, 5).map((m) => plain(`${m.next} ${m.unit}`, `${m.left} to go`, `${m.value} now`)) })],
  });

  // The tracker follows whichever chapter is in the middle of the screen.
  const [active, setActive] = useState(chapters[0].id);
  const rail = useRef<HTMLDivElement>(null);
  const ids = chapters.map((c) => c.id).join(",");
  useEffect(() => {
    const els = ids.split(",").map((id) => document.getElementById(`story-${id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id.replace("story-", ""));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-ch="${active}"]`);
    if (el && rail.current) rail.current.scrollTo({ left: el.offsetLeft - rail.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);
  const seen = chapters.findIndex((c) => c.id === active);

  const shareAll = () => {
    // Award cards appear under Highlights and the Cabinet; share each once.
    const seen = new Set<string>();
    const cards = chapters.flatMap((c) => c.share?.() ?? []).filter((c) => !seen.has(c.id) && !!seen.add(c.id));
    if (cards.length) setSheet(cards);
  };
  const fileBase = `jcc-${me.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      {/* Sticky tracker: where you are in your story, tap to jump */}
      <div className="sticky top-3 z-30 mx-auto -mb-14 mt-5 w-[calc(100%-2rem)] max-w-6xl rounded-full border border-jcc-blue/10 bg-[#FFFFFF]/90 p-1.5 shadow-[0_12px_30px_-18px_rgba(18,35,63,0.45)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div ref={rail} className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chapters.map((c, k) => {
              const Icon = c.icon;
              const on = c.id === active;
              return (
                <a
                  key={c.id}
                  href={`#story-${c.id}`}
                  data-ch={c.id}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`story-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${on ? "text-[#FFFFFF]" : k < seen ? "text-jcc-accent-dark" : "text-jcc-blue/55 hover:text-jcc-blue"}`}
                >
                  {on && <motion.span layoutId="story-tracker" className="absolute inset-0 rounded-full bg-jcc-blue" transition={{ duration: 0.35, ease: EASE }} />}
                  <Icon className="relative h-3.5 w-3.5" />
                  <span className="relative">{c.label}</span>
                </a>
              );
            })}
          </div>
          <button type="button" onClick={shareAll} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-jcc-accent px-3.5 py-2 text-[11.5px] font-bold text-[#0B1424] transition-transform hover:scale-[1.04]">
            <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share my story</span>
          </button>
        </div>
        {/* Progress through the story */}
        <div className="mx-3 mt-1.5 h-0.5 overflow-hidden rounded-full bg-jcc-blue/[0.07]">
          <motion.span className="block h-full bg-jcc-accent" animate={{ width: `${(100 * (seen + 1)) / chapters.length}%` }} transition={{ duration: 0.4, ease: EASE }} />
        </div>
      </div>

      <div>
        {chapters.map((ch, k) => (
          <Scene key={ch.id} id={ch.id} n={k + 1} tone={TONE_OF[ch.id] ?? (k % 2 ? "ivory" : "dark")}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className={`${KICK} flex items-center gap-2 text-jcc-accent-dark`}
                >
                  <ch.icon className="h-3.5 w-3.5" /> {String(k + 1).padStart(2, "0")} · {ch.kicker}
                </motion.p>
                <RevealTitle text={ch.title} />
              </div>
              {ch.share && (
                <button
                  type="button"
                  onClick={() => {
                    const cards = ch.share!();
                    if (cards.length) setSheet(cards);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-jcc-blue/20 px-4 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-jcc-blue/85 transition-colors hover:border-jcc-blue hover:bg-jcc-blue hover:text-[var(--story-on-ink,#FFFFFF)]"
                >
                  <Share2 className="h-3 w-3" /> Share this
                </button>
              )}
            </div>
            <div className="mt-10">{ch.body}</div>
          </Scene>
        ))}
      </div>

      <Finale href={cardHref} scope={scope} totals={totals} level={L.level} onShare={shareAll} />

      {sheet && <ShareSheet cards={sheet} fileBase={fileBase} onClose={() => setSheet(null)} />}
    </div>
  );
}

// ── Finale: the way out to /stats ───────────────────────────────────────────

const MARQUEE = "Every innings · Every wicket · Every matchup · Every award · ";

function MiniCard({ kicker, value, unit, grad, style }: { kicker: string; value: string; unit: string; grad: string; style?: React.ComponentProps<typeof motion.div>["style"] }) {
  return (
    <motion.div
      style={style}
      whileHover={{ y: -14, scale: 1.04 }}
      className="absolute left-1/2 top-1/2 h-64 w-44 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] bg-[#101C33] p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/12 sm:h-72 sm:w-52"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundImage: grad }} />
      <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55">{kicker}</p>
      <p className="mt-10 font-heading text-6xl font-extrabold leading-none tracking-[-0.06em] tabular-nums" style={{ backgroundImage: grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{value}</p>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/60">{unit}</p>
      <p className="absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">JCC Stats</p>
    </motion.div>
  );
}

function Finale({ href, scope, totals, level, onShare }: { href: string; scope: string; totals: Totals; level: number; onShare: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const row1 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const row2 = useTransform(scrollYProgress, [0, 1], ["-30%", "0%"]);
  // The fan opens as the section arrives.
  const fan = useTransform(scrollYProgress, [0.1, 0.45], [0, 1]);
  const lx = useTransform(fan, [0, 1], ["-50%", "-112%"]);
  const rx = useTransform(fan, [0, 1], ["-50%", "12%"]);
  const lr = useTransform(fan, [0, 1], [0, -12]);
  const rr = useTransform(fan, [0, 1], [0, 12]);
  const ly = useTransform(fan, [0, 1], ["-50%", "-44%"]);

  return (
    <section ref={ref} className="theme-static-dark relative overflow-hidden bg-[#070E1A] py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 70% at 75% 50%, rgba(212,175,55,0.18), transparent 65%), radial-gradient(40% 50% at 10% 100%, rgba(59,111,196,0.18), transparent 60%)" }} />
      {/* Marquee: the whole card, scrolling past in outline */}
      {[row1, row2].map((x, i) => (
        <motion.p
          key={i}
          aria-hidden
          style={{ x, WebkitTextStroke: "1px rgba(255,255,255,0.09)" }}
          className={`pointer-events-none absolute left-0 whitespace-nowrap font-heading text-[5rem] font-extrabold uppercase leading-none tracking-[-0.04em] text-transparent md:text-[8rem] ${i ? "bottom-6" : "top-6"}`}
        >
          {MARQUEE.repeat(4)}
        </motion.p>
      ))}

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <p className={`${KICK} text-jcc-accent`}>The full picture · {scope}</p>
          <h2 className="mt-4 font-heading text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-white md:text-7xl">
            {["Every innings.", "Every wicket.", "Every matchup."].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.05em]">
                <motion.span
                  className={`block ${i === 2 ? "text-jcc-accent" : ""}`}
                  initial={{ y: "105%" }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.8, ease: EASE }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/70">
            Your complete player card on the stats desk: how you score and get out, splits, every wicket, fielding and dozens more share cards.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={href} className="btn-gold group">
              View all stats
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
            </Link>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-4 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:border-jcc-accent hover:text-jcc-accent"
            >
              <Share2 className="h-4 w-4" /> Share my story
            </button>
          </div>
        </div>

        {/* A fan of story cards, opening as you arrive */}
        <div className="relative h-80 sm:h-96">
          <MiniCard kicker="Wickets" value={String(totals.wickets)} unit={scope} grad="linear-gradient(135deg,#A78BFA,#7C3AED)" style={{ x: lx, y: ly, rotate: lr }} />
          <MiniCard kicker="Runs" value={String(totals.runs)} unit={scope} grad="linear-gradient(135deg,#F59E0B,#EA580C)" style={{ x: rx, y: ly, rotate: rr }} />
          <MiniCard kicker="Player level" value={`L${level}`} unit={`${totals.matches} matches`} grad="linear-gradient(135deg,#F3C96A,#A97824)" style={{ x: "-50%", y: "-50%" }} />
        </div>
      </div>
    </section>
  );
}
