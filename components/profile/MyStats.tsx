"use client";

// The signed-in member's own record on the Profile tab: headline numbers per
// scope, the badges they hold and their player-of-the-match awards, with a link
// into their full card on /stats. Data comes from /api/player/me/stats, which
// reads the member pass set at login.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { BarChart3, Clock, Crown, Flame, Hand, Loader2, Share2, Sparkles } from "lucide-react";
import { Counter } from "@/app/stats/motion";
import { teamByName } from "@/lib/teams";
import { StoryScroll, type NumberStat, type StoryData } from "./ProfileStory";

type BadgeTone = "crown" | "bat" | "ball" | "field" | "team" | "warn";
type DnaAxis = { label: string; value: string; pct: number; hint: string };
type Scope = {
  key: string;
  label: string;
  played: boolean;
  matches?: number;
  team?: string;
  role?: string;
  winPct?: number | null;
  batting?: { inns: number; runs: number; balls: number; hs: string; notOuts: number; avg: number | null; sr: number | null; fours: number; sixes: number; ducks: number };
  bowling?: { spells: number; balls: number; wickets: number; runs: number; best: string; econ: number | null; avg: number | null; maidens: number };
  fielding?: { c: number; kc: number; st: number; ro: number; total: number };
  ranks?: Record<"runs" | "sr" | "six" | "wk" | "econ" | "dot" | "field" | "death" | "pp", { rank: number; of: number } | null>;
  dna?: { tags: string[]; batting: DnaAxis[]; bowling: DnaAxis[] };
  phase?: { powerplay: number; middle: number; death: number };
  teamShare?: number | null;
  badges?: { label: string; tone: BadgeTone; why: string; holders?: number }[];
  mom?: { date: string; season: number; line: string; opp: string }[];
} & StoryData;
type Access =
  | { kind: "permanent" }
  | { kind: "trial"; startedAt: string; endsAt: string; daysLeft: number }
  | { kind: "untracked" };
type Payload =
  | { ok: true; found: false; name: string; access: Access }
  | { ok: true; found: true; name: string; access: Access; scorecardName: string; cardHash: string; scopes: Scope[] };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The 14-day notice: how long is left, and that it ends. */
function AccessNote({ access }: { access: Access }) {
  if (access.kind !== "trial") return null;
  return (
    <p className="rounded-xl border border-jcc-accent/30 bg-jcc-accent/10 px-4 py-2.5 text-xs font-bold text-jcc-accent-dark">
      {access.daysLeft} {access.daysLeft === 1 ? "day" : "days"} of stats access left — member access lasts 14 days from
      first login and ends on {fmtDay(access.endsAt)}.
    </p>
  );
}


const GRAD = {
  gold: "linear-gradient(135deg, #F3C96A 0%, #D4AF37 45%, #A97824 100%)",
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
  green: "linear-gradient(135deg, #6EE7B7 0%, #2E8B57 100%)",
};
const clip = (g: string) => ({ backgroundImage: g, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;

const n = (v: number | null | undefined, d = 1) => (v == null ? "–" : v.toFixed(d));
const overs = (balls: number) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
const KICK = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]";

/** True once the element has scrolled into view, so bars grow from zero as
 *  you reach them instead of having finished off-screen. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  return [ref, seen] as const;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Where a rank sits in the field, 0–1 (1 = top). */
const standing = (r: { rank: number; of: number }) => (r.of <= 1 ? 1 : 1 - (r.rank - 1) / (r.of - 1));

/** One line of the ledger: the number, what's behind it, and where it ranks. */
function LedgerRow({ i, label, value, grad, sub, rank, on }: { i: number; label: string; value: number; grad: string; sub: string; rank?: { rank: number; of: number } | null; on: boolean }) {
  const top = !!rank && rank.rank <= 3;
  return (
    <motion.li
      initial={{ opacity: 0, x: 18 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ delay: i * 0.09, duration: 0.7, ease: EASE }}
      className="border-t border-white/10 py-6 first:border-t-0 first:pt-0 last:pb-0 @3xl:border-t-0 @3xl:px-8 @3xl:py-0 @3xl:first:pl-0 @3xl:last:pr-0"
    >
      {/* Label and rank share the top line; the number and its details sit
          below, then the bar runs the full width. Nothing sits side by side
          with a fixed width, so a narrow card can't squeeze them together. */}
      <div className={`flex items-baseline justify-between gap-4 ${KICK}`}>
        <span className="text-white/80">{label}</span>
        {rank && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 ${top ? "text-jcc-accent" : "text-white/80"}`}>
            {top && <Crown className="h-3 w-3" />}#{rank.rank}
            <span className="text-white/40">of {rank.of}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/45">top {Math.max(1, Math.round((rank.rank / rank.of) * 100))}%</span>
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="shrink-0 font-heading text-6xl font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums md:text-7xl" style={clip(grad)}>
          <Counter value={value} />
        </p>
        <p className="pb-1 font-mono text-[11px] text-white/55">{sub}</p>
      </div>
      {rank && (
        <div className="relative mt-4 h-1 rounded-full bg-white/10">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: on ? `${Math.max(2, standing(rank) * 100)}%` : "0%", backgroundImage: grad, transitionDelay: `${300 + i * 90}ms` }}
          />
        </div>
      )}
    </motion.li>
  );
}

/** How often the player's side won, as a gold ring. */
function WinRing({ pct, on }: { pct: number; on: boolean }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="mystats-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F3C96A" />
            <stop offset="100%" stopColor="#A97824" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="url(#mystats-gold)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct / 100) : c}
          className="transition-[stroke-dashoffset] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-heading text-2xl font-extrabold tracking-[-0.04em] tabular-nums text-white">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

const SHARE_DOT = "grid h-6 w-6 shrink-0 place-items-center rounded-full text-jcc-blue/55 ring-1 ring-jcc-blue/12 transition-colors hover:bg-jcc-blue hover:text-[var(--story-on-ink,#FFFFFF)]";

function Num({ label, value, rank, onShare }: { label: string; value: React.ReactNode; rank?: { rank: number; of: number } | null; onShare?: () => void }) {
  return (
    <div className="group relative rounded-2xl bg-[color-mix(in_srgb,var(--tint,#12233F)_6%,#FFFFFF)] px-4 py-4 ring-1 ring-[color-mix(in_srgb,var(--tint,#12233F)_14%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--tint,#12233F)_10%,#FFFFFF)]">
      {onShare && (
        <button type="button" onClick={onShare} aria-label={`Share ${label}`} className={`${SHARE_DOT} absolute right-2.5 top-2.5`}>
          <Share2 className="h-3 w-3" />
        </button>
      )}
      <p className={`${KICK} text-jcc-text-muted`}>{label}</p>
      <p className="mt-2 font-heading text-3xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-jcc-blue">{value}</p>
      {rank && (
        <span className="mt-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold" style={{ background: "color-mix(in srgb, var(--tint) 14%, transparent)", color: "var(--tint)" }}>
          #{rank.rank} of {rank.of}
        </span>
      )}
    </div>
  );
}

/** One DNA axis: where this player sits among qualified players, 0–100. */
function DnaBar({ a, i, onShare }: { a: DnaAxis; i: number; onShare?: () => void }) {
  const [ref, on] = useSeen<HTMLLIElement>();
  const tier = a.pct >= 80 ? "Elite" : a.pct >= 60 ? "Strong" : a.pct >= 40 ? "Average" : "Below avg";
  return (
    <li ref={ref} title={a.hint} className="grid grid-cols-[120px_minmax(0,1fr)_76px_24px] items-center gap-4 py-2">
      <span className="text-[13px] font-semibold tracking-tight text-jcc-blue">{a.label}<span className="block font-mono text-[10px] font-normal text-jcc-text-muted">{a.hint.replace(", lower is better", " ↓")}</span></span>
      <span className="relative h-2 overflow-hidden rounded-full bg-jcc-blue/[0.07]">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: on ? `${Math.max(3, a.pct)}%` : "0%", background: a.pct >= 60 ? GRAD.gold : "#12233F", transitionDelay: `${i * 70}ms` }}
        />
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-jcc-blue/25" />
      </span>
      <span className="text-right">
        <span className="block font-heading text-sm font-bold tabular-nums text-jcc-blue">{a.value}</span>
        <span className={`block whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.1em] ${a.pct >= 60 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{tier}</span>
      </span>
      {/* Only bars at league average or better get a card */}
      {onShare && a.pct >= 40 ? (
        <button type="button" onClick={onShare} aria-label={`Share ${a.label}`} className={SHARE_DOT}>
          <Share2 className="h-3 w-3" />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

/** A numbers panel: a coloured top edge, its icon in a tinted disc, and a headline total on the right. */
function Panel({ title, icon: Icon, tint, total, children, className = "" }: { title: string; icon: typeof Crown; tint: string; total?: { value: React.ReactNode; label: string }; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] bg-[#FFFFFF] p-5 shadow-[0_24px_60px_-40px_rgba(18,35,63,0.45)] ring-1 ring-jcc-blue/[0.07] md:p-7 ${className}`}
      style={{ ["--tint" as string]: tint }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: tint }} />
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-3 font-heading text-xl font-bold tracking-[-0.02em] text-jcc-blue">
          <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: `${tint}1A`, color: tint }}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </p>
        {total && (
          <p className="text-right">
            <span className="block font-heading text-3xl font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ color: tint }}>{total.value}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">{total.label}</span>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

export default function MyStats({ photo = null }: { photo?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [expiredOn, setExpiredOn] = useState<string | null>(null);
  const [scopeKey, setScopeKey] = useState("career");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/player/me/stats")
      .then(async (r) => {
        const j = await r.json();
        if (r.status === 403 && j.expired) {
          if (!cancelled) setExpiredOn(j.endsAt);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        if (!cancelled) setData(j as Payload);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (expiredOn) {
    return (
      <div className="space-y-4">
        <div className="premium-card mx-auto my-10 max-w-3xl p-8 text-center">
          <Clock className="w-6 h-6 text-jcc-accent mx-auto" />
          <p className="mt-3 text-sm font-black text-white">Your stats access has ended</p>
          <p className="mt-1 text-xs text-white/65">
            Member access to stats and badges lasts 14 days from first login; yours ended on {fmtDay(expiredOn)}. Speak to the
            JCC admins if you need it back.
          </p>
        </div>
      </div>
    );
  }
  if (error) return null;
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="premium-card mx-auto my-10 flex max-w-3xl items-center justify-center gap-2 p-8 text-xs font-bold text-white/65">
          <Loader2 className="w-4 h-4 animate-spin text-jcc-accent" /> Loading your stats…
        </div>
      </div>
    );
  }
  if (!data.found) {
    return (
      <div className="space-y-4">
        <div className="premium-card mx-auto my-10 max-w-3xl p-8 text-center">
          <BarChart3 className="w-6 h-6 text-jcc-accent mx-auto" />
          <p className="mt-3 text-sm font-black text-white">No scorecards on record yet</p>
          <div className="mt-4"><AccessNote access={data.access} /></div>
          <p className="mt-3 text-xs text-white/65">
            Your numbers and badges appear here after your first recorded match. If you have played, ask an admin to check
            how your name is spelled on the scorecards.
          </p>
        </div>
      </div>
    );
  }

  return <Card data={data} scopeKey={scopeKey} setScopeKey={setScopeKey} photo={photo} />;
}

function Card({ data, scopeKey, setScopeKey, photo }: { data: Extract<Payload, { found: true }>; scopeKey: string; setScopeKey: (k: string) => void; photo: string | null }) {
  const [heroRef, on] = useSeen<HTMLDivElement>();
  const [phaseRef, phaseOn] = useSeen<HTMLDivElement>();
  const scopes = data.scopes.filter((s) => s.played);
  const s = scopes.find((x) => x.key === scopeKey) ?? scopes[0];
  if (!s) return null;
  const B = s.batting!, W = s.bowling!, F = s.fielding!;
  const R = s.ranks;
  const dna = s.dna;
  const ph = s.phase;
  const phaseTotal = ph ? ph.powerplay + ph.middle + ph.death : 0;
  const dismissals = F.total;
  const team = teamByName(s.team);
  const teamColor = team?.primary ?? "#D4AF37";
  const tierOfPct = (p: number) => (p >= 80 ? "Elite" : p >= 60 ? "Strong" : "League average");
  // Every number on the "Your numbers" chapter that can stand on a story card.
  const allStats: NumberStat[] = [
    { id: "bat-avg", label: "Batting average", value: n(B.avg), unit: "runs per dismissal", kind: "bat" },
    { id: "bat-sr", label: "Strike rate", value: n(B.sr), unit: "runs per 100 balls", kind: "bat", rank: R?.sr },
    { id: "bat-hs", label: "Top score", value: B.hs, unit: "highest score", kind: "bat" },
    { id: "bat-4s", label: "Fours", value: String(B.fours), unit: B.fours === 1 ? "four" : "fours", kind: "bat" },
    { id: "bat-6s", label: "Sixes", value: String(B.sixes), unit: B.sixes === 1 ? "six" : "sixes", kind: "bat", rank: R?.six },
    { id: "bat-inns", label: "Innings", value: String(B.inns), unit: `innings · ${B.notOuts} not out`, kind: "bat" },
    { id: "bowl-wk", label: "Wickets", value: String(W.wickets), unit: W.wickets === 1 ? "wicket" : "wickets", kind: "bowl", rank: R?.wk },
    { id: "bowl-ov", label: "Overs bowled", value: overs(W.balls), unit: "overs", kind: "bowl" },
    { id: "bowl-econ", label: "Economy", value: n(W.econ), unit: "runs an over", kind: "bowl", rank: R?.econ },
    { id: "bowl-avg", label: "Bowling average", value: n(W.avg), unit: "runs per wicket", kind: "bowl" },
    { id: "bowl-best", label: "Best figures", value: W.best, unit: "best spell", kind: "bowl" },
    { id: "bowl-mdn", label: "Maidens", value: String(W.maidens), unit: W.maidens === 1 ? "maiden over" : "maiden overs", kind: "bowl" },
    ...(ph ? ([["powerplay", "Powerplay wickets", "in overs 1–2", R?.pp], ["middle", "Middle-over wickets", "in the middle overs", null], ["death", "Death-over wickets", "in the last 2 overs", R?.death]] as const).map(
      ([k, label, unit, rank]): NumberStat => ({ id: `phase-${k}`, label, value: String(ph[k]), unit, kind: "bowl", rank }),
    ) : []),
    { id: "field-total", label: "Fielding dismissals", value: String(F.total), unit: "catches, stumpings & run outs", kind: "field", rank: R?.field },
    { id: "field-ct", label: "Catches", value: String(F.c + F.kc), unit: F.c + F.kc === 1 ? "catch" : "catches", kind: "field" },
    { id: "field-ro", label: "Run outs", value: String(F.ro), unit: F.ro === 1 ? "run out" : "run outs", kind: "field" },
    { id: "field-st", label: "Stumpings", value: String(F.st), unit: F.st === 1 ? "stumping" : "stumpings", kind: "field" },
    ...[...(dna?.batting ?? []), ...(dna?.bowling ?? [])]
      .filter((a) => a.pct >= 40)
      .map((a): NumberStat => ({ id: `dna-${a.label}`, label: a.label, value: a.value, unit: a.hint.replace(", lower is better", ""), kind: "dna", note: `${tierOfPct(a.pct)} · better than ${Math.round(a.pct)}% of the league` })),
  ];
  const numberStats = allStats.filter((x) => x.value && x.value !== "–" && x.value !== "0" && x.value !== "0/0");

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-clip">
      {/* ── The player card: identity on the left, the ledger on the right ── */}
      <div ref={heroRef} className="theme-static-dark @container relative overflow-hidden bg-[#0B1424]">
        {/* Plain deep navy, lit from the team side: a team-coloured hairline along
            the top and the club crest, oversized and nearly invisible, bleeding off
            the right edge. No grids or glow blobs. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${teamColor}, ${teamColor}00 70%)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 80% at 0% 0%, ${teamColor}14, transparent 60%)` }} />
        {team && (
          <Image
            aria-hidden
            src={team.logo}
            alt=""
            width={560}
            height={560}
            className="pointer-events-none absolute -bottom-24 -right-28 h-[30rem] w-[30rem] select-none object-contain opacity-[0.045] grayscale"
          />
        )}

        {/* Scope switcher: an underlined tab row across the top */}
        <div className="relative border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 flex items-center justify-between gap-4">
          <p className={`${KICK} shrink-0 py-4 text-jcc-accent`}>Scoreboard</p>
          <div role="tablist" aria-label="Scope" className="-mb-px flex gap-5 overflow-x-auto md:gap-7">
            {scopes.map((x) => {
              const active = x.key === s.key;
              return (
                <button
                  key={x.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setScopeKey(x.key)}
                  className={`relative shrink-0 py-4 text-[13px] font-semibold tracking-tight transition-colors ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}
                >
                  {x.label}
                  {active && <motion.span layoutId="mystats-scope" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-jcc-accent" transition={{ duration: 0.45, ease: EASE }} />}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {/* The scoreboard: three headline numbers across, then the season in brief */}
        <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-14">
          <ol className="grid min-w-0 @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-white/10">
            <LedgerRow i={0} on={on} label="Runs" value={B.runs} grad={GRAD.orange} rank={R?.runs} sub={`SR ${n(B.sr)} · HS ${B.hs} · ${B.inns} inns`} />
            <LedgerRow i={1} on={on} label="Wickets" value={W.wickets} grad={GRAD.purple} rank={R?.wk} sub={`Econ ${n(W.econ)} · best ${W.best}`} />
            <LedgerRow i={2} on={on} label="Dismissals" value={dismissals} grad={GRAD.green} rank={R?.field} sub={`${F.c + F.kc} ct · ${F.st} st · ${F.ro} ro`} />
          </ol>

          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-white/10 pt-8"
          >
            {s.winPct != null && (
              <div className="flex items-center gap-4">
                <WinRing pct={s.winPct} on={on} />
                <div>
                  <p className={`${KICK} text-white/50`}>Win share</p>
                  <p className="mt-1 max-w-[11rem] text-[13px] leading-snug text-white/80">Your side won {Math.round(s.winPct)}% of your {s.matches} games</p>
                </div>
              </div>
            )}
            {s.teamShare != null && (
              <div>
                <p className={`${KICK} text-white/50`}>Share of team runs</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-jcc-accent transition-[width] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: on ? `${Math.min(100, s.teamShare)}%` : "0%" }} />
                  </span>
                  <span className="font-heading text-lg font-bold tabular-nums text-white">{Math.round(s.teamShare)}%</span>
                </div>
              </div>
            )}
            <div>
              <p className={`${KICK} text-white/50`}>Role · {s.label}</p>
              <p className="mt-1.5 font-heading text-lg font-bold text-white">{s.role}</p>
            </div>
            {dna && dna.tags.length > 0 && (
              <div className="min-w-0">
                <p className={`${KICK} text-white/50`}>Player type</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dna.tags.map((t) => (
                    <span key={t} className="rounded-full border border-jcc-accent/35 bg-jcc-accent/[0.08] px-3 py-1 text-[12px] font-semibold text-jcc-accent-highlight">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div>
        {data.access.kind === "trial" && (
          <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-8">
            <AccessNote access={data.access} />
          </div>
        )}

        <StoryScroll
          s={s}
          me={{ name: data.name, photo, team: s.team }}
          totals={{ runs: B.runs, wickets: W.wickets, sixes: B.sixes, fielding: F.total, matches: s.matches ?? 0, mom: s.mom?.length ?? 0 }}
          avgRuns={B.inns ? B.runs / B.inns : 0}
          axes={[...(dna?.batting ?? []), ...(dna?.bowling ?? [])]}
          teamShare={s.teamShare}
          winPct={s.winPct}
          numberStats={numberStats}
          numbers={(share) => (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Batting" icon={Flame} tint="#EA580C" total={{ value: B.runs, label: "runs" }}>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Num label="Average" value={n(B.avg)} onShare={() => share("bat-avg")} />
                  <Num label="Strike rate" value={n(B.sr)} rank={R?.sr} onShare={() => share("bat-sr")} />
                  <Num label="Top score" value={B.hs} onShare={() => share("bat-hs")} />
                  <Num label="Fours" value={B.fours} onShare={() => share("bat-4s")} />
                  <Num label="Sixes" value={B.sixes} rank={R?.six} onShare={() => share("bat-6s")} />
                  <Num label="Innings" value={`${B.inns}`} onShare={() => share("bat-inns")} />
                </div>
                {dna && dna.batting.length > 0 ? (
                  <>
                    <p className={`${KICK} mt-6 text-jcc-text-muted`}>Against the league · centre line = median</p>
                    <ul className="mt-1">{dna.batting.map((a, i) => <DnaBar key={a.label} a={a} i={i} onShare={() => share(`dna-${a.label}`)} />)}</ul>
                  </>
                ) : (
                  <p className="mt-5 text-[13px] text-jcc-text-muted">Face 30 balls in this scope to see how you compare with the league.</p>
                )}
              </Panel>

              <Panel title="Bowling" icon={Sparkles} tint="#7C3AED" total={{ value: W.wickets, label: "wickets" }}>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Num label="Wickets" value={W.wickets} rank={R?.wk} onShare={() => share("bowl-wk")} />
                  <Num label="Overs" value={overs(W.balls)} onShare={() => share("bowl-ov")} />
                  <Num label="Economy" value={n(W.econ)} rank={R?.econ} onShare={() => share("bowl-econ")} />
                  <Num label="Average" value={n(W.avg)} onShare={() => share("bowl-avg")} />
                  <Num label="Best" value={W.best} onShare={() => share("bowl-best")} />
                  <Num label="Maidens" value={W.maidens} onShare={() => share("bowl-mdn")} />
                </div>
                {ph && phaseTotal > 0 && (
                  <div className="mt-5">
                    <p className={`${KICK} text-jcc-text-muted`}>When your wickets fall · by the over each one fell in</p>
                    <div ref={phaseRef} className="mt-2 flex h-9 gap-[3px] overflow-hidden rounded-xl">
                      {([["powerplay", "Overs 1–2", "#3B6FC4"], ["middle", "Middle", "#12233F"], ["death", "Last 2", "#D4AF37"]] as const).map(([k, label, c]) =>
                        ph[k] ? (
                          <button
                            type="button"
                            key={k}
                            onClick={() => share(`phase-${k}`)}
                            title={`${label}: ${ph[k]} · tap to share`}
                            className="flex items-center justify-center font-mono text-[10.5px] font-semibold text-[#FFFFFF] transition-[flex-grow,filter] duration-1000 hover:brightness-125"
                            style={{ flexGrow: phaseOn ? ph[k] : 0.001, flexBasis: 0, background: c }}
                          >
                            {ph[k]}
                          </button>
                        ) : null,
                      )}
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-jcc-text-muted">
                      <span>Powerplay {ph.powerplay}{R?.pp ? ` · #${R.pp.rank}` : ""}</span>
                      <span>Middle {ph.middle}</span>
                      <span>Death {ph.death}{R?.death ? ` · #${R.death.rank}` : ""}</span>
                    </div>
                  </div>
                )}
                {dna && dna.bowling.length > 0 ? (
                  <ul className="mt-4">{dna.bowling.map((a, i) => <DnaBar key={a.label} a={a} i={i} onShare={() => share(`dna-${a.label}`)} />)}</ul>
                ) : (
                  <p className="mt-5 text-[13px] text-jcc-text-muted">Bowl 5 overs in this scope to see how you compare with the league.</p>
                )}
              </Panel>

              <Panel title="Fielding" icon={Hand} tint="#2E8B57" total={{ value: F.total, label: "dismissals" }} className="lg:col-span-2">
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Num label="Dismissals" value={F.total} rank={R?.field} onShare={() => share("field-total")} />
                  <Num label="Catches" value={F.c + F.kc} onShare={() => share("field-ct")} />
                  <Num label="Run outs" value={F.ro} onShare={() => share("field-ro")} />
                  <Num label="Stumpings" value={F.st} onShare={() => share("field-st")} />
                </div>
              </Panel>
            </div>
          )}
          badges={s.badges ?? []}
          cardHref={`/stats#${data.cardHash}`}
          overview={{
            role: s.role ?? "Player",
            stats: [
              { label: "Runs", value: String(B.runs), note: R?.runs ? `#${R.runs.rank} of ${R.runs.of}` : undefined },
              { label: "Wickets", value: String(W.wickets), note: R?.wk ? `#${R.wk.rank} of ${R.wk.of}` : undefined },
              { label: "Fielding", value: String(F.total), note: R?.field ? `#${R.field.rank} of ${R.field.of}` : undefined },
              { label: "Strike rate", value: n(B.sr) },
              { label: "Economy", value: n(W.econ) },
              { label: "Best", value: B.inns ? B.hs : W.best || "–" },
            ],
          }}
        />

      </div>
    </motion.section>
  );
}
