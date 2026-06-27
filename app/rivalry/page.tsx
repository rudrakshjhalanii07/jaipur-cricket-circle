"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Trophy, Star, MapPin, Target, TrendingUp, History, ChevronRight, Swords, Calendar, ChevronDown, ChevronUp, Newspaper, ExternalLink, Sparkles } from "lucide-react";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";
import { fetchRivalrySeasons, RivalrySeason, eraTitle, eraFirstNames } from "@/lib/rivalry";
import {
  fetchFullSeries,
  computeLeaderboards,
  computeTriSeriesWins,
  computeSeriesStandings,
  computeOverallStandings,
  computeSeriesNRR,
  type FullSeries,
  type SeriesMatch,
  type SeriesStandingRow,
  type SeriesTeamId,
  type BattingLeaderRow,
  type BowlingLeaderRow,
  type AllRounderRow,
  type FieldingRow,
} from "@/lib/series";
import { TEAMS } from "@/lib/teams";

// ── Animated counting number ──────────────────────────────────────────────────
function AnimatedNumber({
  target,
  className = "",
  duration = 1600,
  style,
}: {
  target: number;
  className?: string;
  duration?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = Math.max(duration / (target || 1), 40);
    const interval = setInterval(() => {
      if (start < target) {
        start++;
        setCount(start);
      } else {
        clearInterval(interval);
      }
    }, step);
    return () => clearInterval(interval);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {count}
    </span>
  );
}

// ── Team logo with shortName fallback ────────────────────────────────────────
function TeamLogo({ src, alt, color, fallback, className = "" }: {
  src?: string; alt: string; color: string; fallback: string; className?: string;
}) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return <span className="font-black text-xl sm:text-2xl select-none" style={{ color }}>{fallback}</span>;
  }
  return <img src={src} alt={alt} className={className} onError={() => setErr(true)} />;
}

// ── Hardcoded historical baselines merged into the points tables ──────────────
// These represent matches played before the import system existed.
type BaselineEntry = { team_id: SeriesTeamId; won: number; lost: number; tied: number };
// Current season: 8 prior Mav-vs-NS matches (Mav 5, NS 3).
const CURRENT_SEASON_BASELINE: BaselineEntry[] = [
  { team_id: "mavericks", won: 5, lost: 3, tied: 0 },
  { team_id: "neurostrikers", won: 3, lost: 5, tied: 0 },
];
// Overall: cumulates current-rivalry league data only. The legacy Setia-Chaudhary
// era is intentionally excluded. Equals the current-rivalry prior 8 (5–3 Mav)
// until the second season's matches are uploaded as real data.
const OVERALL_BASELINE: BaselineEntry[] = [
  { team_id: "mavericks", won: 5, lost: 3, tied: 0 },
  { team_id: "neurostrikers", won: 3, lost: 5, tied: 0 },
];

function mergeBaseline(rows: SeriesStandingRow[], baseline: BaselineEntry[]): SeriesStandingRow[] {
  const map = new Map<string, SeriesStandingRow>(rows.map((r) => [r.team_id, { ...r }]));
  for (const b of baseline) {
    // NRR is preserved from recorded innings; baseline matches (unrecorded) contribute 0.
    const cur = map.get(b.team_id) ?? { team_id: b.team_id, played: 0, won: 0, lost: 0, tied: 0, points: 0, win_pct: 0, nrr: 0 };
    cur.won += b.won; cur.lost += b.lost; cur.tied += b.tied;
    cur.played = cur.won + cur.lost + cur.tied;
    cur.points = cur.won * 2 + cur.tied;
    map.set(b.team_id, cur);
  }
  const out = [...map.values()];
  for (const r of out) r.win_pct = r.played > 0 ? Math.round((r.points / (r.played * 2)) * 100) : 0;
  return out.sort((a, b) => b.win_pct - a.win_pct || b.points - a.points);
}

// ── Loading Skeleton for Scoreboard ──────────────────────────────────────────
function ScoreboardSkeleton() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.05] bg-white/[0.01] p-8 animate-pulse mb-8">
      <div className="h-4 w-48 bg-white/10 rounded mb-6" />
      <div className="grid grid-cols-11 items-center gap-4">
        <div className="col-span-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 mb-4" />
          <div className="h-5 w-24 bg-white/10 rounded" />
        </div>
        <div className="col-span-3 flex flex-col items-center">
          <div className="h-10 w-20 bg-white/10 rounded mb-2" />
          <div className="h-3 w-16 bg-white/5 rounded" />
        </div>
        <div className="col-span-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 mb-4" />
          <div className="h-5 w-24 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

// Recompute a season's wins/ties/matches live from its actual recorded matches,
// so the scoreboard never shows stale seeded values. Falls back to the stored
// record when the season has no linked match data yet.
function applyLiveSeasonStats(season: RivalrySeason, matches: SeriesMatch[]): RivalrySeason {
  const league = computeSeriesStandings(matches, "league");
  const final = computeSeriesStandings(matches, "final");
  const get = (rows: SeriesStandingRow[], id: string, k: "won" | "tied") =>
    rows.find((r) => r.team_id === id)?.[k] ?? 0;
  // Prior matches (Mav 5, NS 3) folded into the main-series wins.
  const base = (id: string) => CURRENT_SEASON_BASELINE.find((b) => b.team_id === id)?.won ?? 0;
  const baseTotal = CURRENT_SEASON_BASELINE.reduce((s, b) => s + b.won, 0); // 8 prior matches
  return {
    ...season,
    neurostrikers_main_wins: get(league, "neurostrikers", "won") + base("neurostrikers"),
    mavericks_main_wins: get(league, "mavericks", "won") + base("mavericks"),
    outliers_main_wins: get(league, "outliers", "won") + base("outliers"),
    neurostrikers_exhibition_wins: get(final, "neurostrikers", "won"),
    mavericks_exhibition_wins: get(final, "mavericks", "won"),
    outliers_exhibition_wins: get(final, "outliers", "won"),
    neurostrikers_main_ties: get(league, "neurostrikers", "tied"),
    mavericks_main_ties: get(league, "mavericks", "tied"),
    outliers_main_ties: get(league, "outliers", "tied"),
    neurostrikers_exhibition_ties: get(final, "neurostrikers", "tied"),
    mavericks_exhibition_ties: get(final, "mavericks", "tied"),
    outliers_exhibition_ties: get(final, "outliers", "tied"),
    total_matches_played: matches.filter((m) => m.stage === "league" && (m.winner_id || m.is_tie)).length + baseTotal,
  };
}

// ── Active Captain Scoreboard (3-way) ─────────────────────────────────────────
function ActiveScoreboard({ season }: { season: RivalrySeason }) {
  const teams = [
    {
      label: "NeuroStrikers",
      captain: season.neurostrikers_captain,
      wins: season.neurostrikers_main_wins,
      exhWins: season.neurostrikers_exhibition_wins,
      ties: (season.neurostrikers_main_ties ?? 0) + (season.neurostrikers_exhibition_ties ?? 0),
      color: TEAMS.neurostrikers.primary,
      glow: TEAMS.neurostrikers.glow,
      logo: TEAMS.neurostrikers.logo,
      short: TEAMS.neurostrikers.shortName,
    },
    {
      label: "Mavericks",
      captain: season.mavericks_captain,
      wins: season.mavericks_main_wins,
      exhWins: season.mavericks_exhibition_wins,
      ties: (season.mavericks_main_ties ?? 0) + (season.mavericks_exhibition_ties ?? 0),
      color: TEAMS.mavericks.primary,
      glow: TEAMS.mavericks.glow,
      logo: TEAMS.mavericks.logo,
      short: TEAMS.mavericks.shortName,
    },
    ...(season.outliers_captain ? [{
      label: "The Outliers",
      captain: season.outliers_captain,
      wins: season.outliers_main_wins ?? 0,
      exhWins: season.outliers_exhibition_wins ?? 0,
      ties: (season.outliers_main_ties ?? 0) + (season.outliers_exhibition_ties ?? 0),
      color: TEAMS.outliers.primary,
      glow: TEAMS.outliers.glow,
      logo: TEAMS.outliers.logo,
      short: TEAMS.outliers.shortName,
    }] : []),
  ];

  const totalWins = teams.reduce((s, t) => s + t.wins, 0);
  const leader = teams.reduce((best, t) => t.wins > best.wins ? t : best, teams[0]);
  const isThreeWay = teams.length === 3;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
      {/* Subtle glow blobs per team color */}
      {teams.map((t, i) => (
        <div key={i} className="absolute top-0 w-32 h-32 blur-[80px] pointer-events-none opacity-[0.12]"
          style={{ background: t.color, left: `${(i / teams.length) * 100}%`, transform: "translateX(-50%)" }} />
      ))}

      {/* Header */}
      <div className="relative flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
        {/* Left: status + start date stacked */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400">
              Active {isThreeWay ? "3-Captain" : "Captain"} Rivalry
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/50">
            <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
            {season.started_at
              ? `Started ${new Date(season.started_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}`
              : "Started Last Sunday"}
          </div>
        </div>
        {/* Right: season pill, vertically centered against the whole block */}
        <span className="shrink-0 text-[10px] text-white/40 font-bold px-3 py-1 bg-white/[0.05] rounded-full inline-flex items-center justify-center text-center">
          {season.season_label || "Current Season"}
        </span>
      </div>

      {/* Body */}
      <div className="relative p-6 sm:p-10">
        <div className="text-center mb-8">
          {/* Eyebrow: thin "THE — ERA" framing line */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="h-px w-8 bg-white/15" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
              The&nbsp;·&nbsp;Era
            </span>
            <span className="h-px w-8 bg-white/15" />
          </div>
          {/* Captain first names — the focal point */}
          <h2 className="font-black text-white uppercase leading-none flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {eraFirstNames(season).map((name, i) => (
              <span key={name} className="flex items-center gap-x-2">
                {i > 0 && <span className="text-[#E8537E] text-lg sm:text-xl font-black">·</span>}
                <span className="text-2xl sm:text-4xl tracking-tight">{name}</span>
              </span>
            ))}
          </h2>
          <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mt-3">
            Current Era Captain Pairing
          </p>
        </div>

        {/* Team columns */}
        <div className={`grid gap-4 sm:gap-8 ${isThreeWay ? "grid-cols-3" : "grid-cols-2"}`}>
          {teams.map((t) => {
            const isLeader = t.label === leader.label && t.wins > 0;
            return (
              <div key={t.label} className="flex flex-col items-center text-center">
                {/* Logo */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                  <TeamLogo src={t.logo} alt={t.label} color={t.color} fallback={t.short} className="w-full h-full object-contain drop-shadow-sm" />
                </div>

                {/* Name — fixed height so all columns align below */}
                <div className="mt-2 flex items-center justify-center min-h-[2.5rem]">
                  <h3 className="text-xs sm:text-lg font-black uppercase tracking-tight leading-tight" style={{ color: t.color }}>
                    {t.label}
                  </h3>
                </div>

                {/* Captain — fixed height, label stacked above name for clean centering */}
                <div className="flex flex-col items-center justify-start min-h-[2.5rem] px-1">
                  <span className="text-[7px] sm:text-[8px] text-white/35 font-black uppercase tracking-[0.2em]">
                    Captain
                  </span>
                  <span className="mt-0.5 text-[10px] sm:text-xs text-white font-black leading-tight text-center text-balance">
                    {t.captain}
                  </span>
                </div>

                {/* Win count */}
                <AnimatedNumber
                  target={t.wins}
                  duration={1200}
                  className="text-4xl sm:text-5xl font-black tabular-nums"
                  style={{ color: t.color, textShadow: `0 0 10px ${t.color}30` }}
                />

                {/* Leading badge — always takes space to keep wins aligned */}
                <div className="h-5 flex items-center justify-center mt-0.5">
                  {isLeader && (
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-jcc-gold" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-jcc-gold">Leading</span>
                    </div>
                  )}
                </div>

                {/* Ties */}
                <div className="h-4 flex items-center justify-center">
                  {t.ties > 0 && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
                      {t.ties} {t.ties === 1 ? "Tie" : "Ties"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3-way win ratio bar */}
        <div className="mt-8">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25 text-center mb-2.5">Era Win Ratio</p>
          <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden flex gap-px border border-white/[0.03]">
            {teams.map((t, i) => {
              const pct = totalWins > 0 ? (t.wins / totalWins) * 100 : 100 / teams.length;
              return (
                <motion.div
                  key={t.label}
                  className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${i === teams.length - 1 ? "rounded-r-full" : ""}`}
                  style={{ background: t.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.4, ease: "easeOut", delay: i * 0.1 }}
                />
              );
            })}
          </div>
          {/* Evenly distributed team labels — stacked so they never collide */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {teams.map((t) => {
              const pct = totalWins > 0 ? Math.round((t.wins / totalWins) * 100) : Math.round(100 / teams.length);
              return (
                <div key={t.label} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="text-sm font-black tabular-nums" style={{ color: t.color }}>{pct}%</span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-white/40 text-center leading-tight">
                    {t.label.split(" ").pop()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer tiles */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 border-t border-white/[0.06] bg-white/[0.01]`}>
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06] hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Main Series Wins</span>
          <span className="text-sm font-black text-white mt-1">
            {teams.map((t, i) => (
              <span key={t.label}>
                <span style={{ color: t.color }}>{t.label.split(" ").pop()} {t.wins}</span>
                {i < teams.length - 1 && <span className="text-white/20 mx-1">—</span>}
              </span>
            ))}
          </span>
        </div>
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06] hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Exhibition Series Wins</span>
          {teams.every((t) => t.exhWins === 0) ? (
            <span className="text-xs font-black text-amber-400/80 uppercase tracking-wider mt-1.5 italic">
              No exhibition matches yet
            </span>
          ) : (
            <span className="text-sm font-black text-white mt-1">
              {teams.map((t, i) => (
                <span key={t.label}>
                  <span style={{ color: t.color }}>{t.label.split(" ").pop()} {t.exhWins}</span>
                  {i < teams.length - 1 && <span className="text-white/20 mx-1">—</span>}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="px-6 py-4 flex flex-col justify-center hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Total Matches Played</span>
          <span className="text-lg font-black text-cyan-400 mt-1">
            {season.total_matches_played} Matches Recorded <span className="text-white/30 font-bold text-sm">[Main Series]</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Legacy Archived Era Card ────────────────────────────────────────────────
function ArchivedEraCard({ season }: { season: RivalrySeason }) {
  const isThreeWay = !!season.outliers_captain;
  const captainCols = isThreeWay ? "grid-cols-3" : "grid-cols-2";

  return (
    <motion.div
      variants={fadeUp}
      className="group relative rounded-xl border border-white/[0.06] overflow-hidden p-6 transition-all duration-300 hover:border-white/15 bg-gradient-to-br from-white/[0.02] to-white/[0.005] hover:shadow-2xl shadow-black/40"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

      <div className="flex items-center justify-between mb-4 border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
            Archived {isThreeWay ? "3-Captain" : ""} Rivalry Era
          </span>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-white/25 px-2 py-0.5 bg-white/5 border border-white/10 rounded">
          {season.season_label || "Legacy Era"}
        </span>
      </div>

      <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-jcc-accent transition-colors duration-300">
        {eraTitle(season)}
      </h3>

      <div className={`grid ${captainCols} gap-4 mt-3 py-3 px-3 bg-white/[0.01] border border-white/[0.03] rounded-lg`}>
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: `${TEAMS.mavericks.primary}80` }}>Mavericks Cap</span>
          <p className="text-xs font-black text-white/80">{season.mavericks_captain}</p>
        </div>
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: `${TEAMS.neurostrikers.primary}80` }}>NeuroStrikers Cap</span>
          <p className="text-xs font-black text-white/80">{season.neurostrikers_captain}</p>
        </div>
        {isThreeWay && (
          <div>
            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: `${TEAMS.outliers.primary}80` }}>Outliers Cap</span>
            <p className="text-xs font-black text-white/80">{season.outliers_captain}</p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40">Main Series</span>
          <span className="font-mono font-black text-white text-right">
            <span style={{ color: TEAMS.mavericks.primary }}>Mav {season.mavericks_main_wins}</span>
            <span className="text-white/20 mx-1">–</span>
            <span style={{ color: TEAMS.neurostrikers.primary }}>NS {season.neurostrikers_main_wins}</span>
            {isThreeWay && <><span className="text-white/20 mx-1">–</span><span style={{ color: TEAMS.outliers.primary }}>Out {season.outliers_main_wins ?? 0}</span></>}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40">Exhibition Series</span>
          <span className="font-mono font-black text-white text-right">
            <span className="text-purple-400">Mav {season.mavericks_exhibition_wins}</span>
            <span className="text-white/20 mx-1">–</span>
            <span className="text-orange-400">NS {season.neurostrikers_exhibition_wins}</span>
            {isThreeWay && <><span className="text-white/20 mx-1">–</span><span className="text-teal-400">Out {season.outliers_exhibition_wins ?? 0}</span></>}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="font-bold text-white/40">Total Matches</span>
          <span className="font-mono font-black text-cyan-400">
            {season.total_matches_played} Matches
          </span>
        </div>
      </div>

      {/* Notes / Banter summary */}
      {season.notes && (
        <p className="mt-4 text-[10px] text-white/35 font-medium leading-relaxed italic border-t border-white/[0.04] pt-3">
          "{season.notes}"
        </p>
      )}
    </motion.div>
  );
}

// ── Series Progression Timeline (real cumulative wins, league only) ──────────
function SeriesProgression({ series }: { series: FullSeries[] }) {
  const ids = ["mavericks", "neurostrikers", "outliers"] as const;
  const all = series.flatMap((s) => (s.matches as SeriesMatch[]).map((m) => ({ m, seriesNo: s.series_no })));
  const ordered = all
    .filter(({ m }) => m.stage === "league" && (m.winner_id || m.is_tie))
    .sort((a, b) => (a.m.match_date ?? "").localeCompare(b.m.match_date ?? "") || a.seriesNo - b.seriesNo || a.m.match_no - b.m.match_no);

  if (ordered.length === 0) return null;

  const running: Record<string, number> = { mavericks: 0, neurostrikers: 0, outliers: 0 };
  const points = ordered.map(({ m, seriesNo }) => {
    if (m.winner_id && m.winner_id in running) running[m.winner_id]++;
    return {
      mavericks: running.mavericks, neurostrikers: running.neurostrikers, outliers: running.outliers,
      seriesNo, matchNo: m.match_no, date: m.match_date, tie: m.is_tie && !m.winner_id,
    };
  });
  const last = points[points.length - 1];
  const shown = ids.filter((id) => last[id] > 0);
  const maxV = Math.max(...ids.map((id) => last[id]), 1);

  return (
    <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden p-6 bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-jcc-accent" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.35em] text-white/50">Match-by-Match Progression</h3>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-end gap-3 min-w-max px-0.5">
          {points.map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 w-12 shrink-0">
              <div className="w-full flex items-end justify-center gap-0.5 h-24">
                {shown.map((id) => (
                  <motion.div
                    key={id}
                    className="rounded-t"
                    style={{ width: `${Math.max(60 / shown.length, 16)}%`, background: TEAMS[id].primary, alignSelf: "flex-end" }}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${Math.max((p[id] / maxV) * 90, 6)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                  />
                ))}
              </div>
              <span className="text-[8px] font-black text-white/45 leading-none tracking-wide">S{p.seriesNo}·M{p.matchNo}</span>
              <span className="text-[7px] text-white/25 leading-none">
                {p.date ? new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {shown.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TEAMS[id].primary }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{TEAMS[id].name}</span>
          </div>
        ))}
        <span className="text-[8px] text-white/20 ml-auto">S = Series · M = Match · cumulative league wins</span>
      </div>
    </div>
  );
}

// ── 3-Way Scoreline ───────────────────────────────────────────────────────────
function TriSeriesScoreline({ wins }: {
  wins: { neurostrikers: number; mavericks: number; outliers: number };
}) {
  const entries = [
    { id: "neurostrikers", label: "NeuroStrikers", color: TEAMS.neurostrikers.primary, wins: wins.neurostrikers },
    { id: "mavericks", label: "Mavericks", color: TEAMS.mavericks.primary, wins: wins.mavericks },
    { id: "outliers", label: "Outliers", color: TEAMS.outliers.primary, wins: wins.outliers },
  ];
  const max = Math.max(...entries.map((e) => e.wins), 1);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-6">
        <Swords className="w-4 h-4 text-[#E8537E]" />
        <span className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40">3-Way Overall Scoreline</span>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">All formats combined</span>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:gap-8">
        {entries.map((e) => (
          <div key={e.id} className="flex flex-col items-center gap-2">
            <div className="text-5xl sm:text-6xl font-black tabular-nums" style={{ color: e.color, textShadow: `0 0 12px ${e.color}25` }}>
              <AnimatedNumber target={e.wins} duration={1400} />
            </div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center" style={{ color: e.color, opacity: 0.7 }}>{e.label}</span>
            <div className="w-full h-1 rounded-full bg-white/[0.05]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: e.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(e.wins / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats Leaderboards ────────────────────────────────────────────────────────
type StatsTab = "batting" | "bowling" | "allrounders" | "fielding";

// Frozen "Player" column so stats can scroll horizontally beneath it.
const STICKY_HEAD = "sticky left-0 z-10 bg-[var(--jcc-navy)] text-left pb-2";
const STICKY_CELL = "sticky left-0 z-10 bg-[var(--jcc-navy)] py-2 text-left";

function PlayerCell({ rank, name, teamId }: { rank: number; name: string; teamId?: string }) {
  const team = teamId ? TEAMS[teamId as keyof typeof TEAMS] : undefined;
  return (
    <>
      <span className="inline-block w-5 text-right text-white/20 font-black mr-2 shrink-0">{rank}</span>
      <span className="font-black text-white">{name}</span>
      {team && <span className="ml-2 text-[9px] uppercase tracking-wider" style={{ color: team.primary }}>{team.name}</span>}
    </>
  );
}

// Mobile-only stacked leaderboard row: rank + name + team, a headline stat on the
// right, and the remaining stats as wrapping chips. Replaces the wide scrolling
// table on small screens so no column gets cut off.
function StatLeaderMobile({ rank, name, teamId, headLabel, headValue, stats }: {
  rank: number; name: string; teamId?: string;
  headLabel: string; headValue: React.ReactNode;
  stats: { label: string; value: React.ReactNode }[];
}) {
  const team = teamId ? TEAMS[teamId as keyof typeof TEAMS] : undefined;

  return (
    <div className="py-3 border-b border-white/[0.05] last:border-0">
      {/* top line: rank + name + team, headline stat on the right */}
      <div className="flex items-baseline gap-2">
        <span className="text-white/20 font-black text-xs tabular-nums shrink-0 w-4">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white text-[13px] leading-tight truncate">{name}</p>
          {team && (
            <p className="text-[9px] font-black uppercase tracking-wider mt-0.5" style={{ color: team.primary }}>
              {team.name}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[#E8537E] font-black text-lg leading-none tabular-nums">{headValue}</span>
          <p className="text-[7px] uppercase tracking-widest text-white/30 mt-0.5">{headLabel}</p>
        </div>
      </div>

      {/* compact secondary stat line */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pl-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-[8px] uppercase tracking-wide text-white/25">{s.label}</span>
              <span className="text-[11px] font-bold tabular-nums text-white/65">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type LeaderboardSet = {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  allRounders: AllRounderRow[];
  fielding: FieldingRow[];
};

function StatsLeaderboards({ current, overall, finals }: {
  current: LeaderboardSet;
  overall: LeaderboardSet;
  finals: LeaderboardSet;
}) {
  const [tab, setTab] = useState<StatsTab>("batting");
  const [scope, setScope] = useState<"current" | "overall" | "finals">("current");
  const { batting, bowling, allRounders, fielding } =
    scope === "current" ? current : scope === "overall" ? overall : finals;

  const tabs: { id: StatsTab; label: string }[] = [
    { id: "batting", label: "Batting" },
    { id: "bowling", label: "Bowling" },
    { id: "allrounders", label: "All-rounders" },
    { id: "fielding", label: "Fielding" },
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      {/* Scope toggle */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-0">
        {(["current", "overall", "finals"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
              scope === s
                ? "bg-[#E8537E] text-white shadow-[0_0_12px_rgba(232,83,126,0.3)]"
                : "text-white/30 hover:text-white/55 bg-white/[0.04] border border-white/[0.08]"
            }`}
          >
            {s === "current" ? "Latest Series" : s === "overall" ? "All Leagues" : "Finals"}
          </button>
        ))}
        <span className="ml-auto text-[8px] text-white/20 font-bold">
          {scope === "current"
            ? "League only · latest tri-series · max 2 matches/player"
            : scope === "overall"
            ? "League only · all tri-series · max 2 × series count"
            : "Finals only · all tri-series combined"}
        </span>
      </div>

      {/* Tab header */}
      <div className="flex border-b border-white/[0.08] mt-3">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.id ? "text-[#E8537E] border-b-2 border-[#E8537E]" : "text-white/30 hover:text-white/50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5 sm:overflow-x-auto">
        {/* Mobile stacked lists (no horizontal scroll) */}
        <div className="sm:hidden">
          {tab === "batting" && batting.slice(0, 10).map((r, i) => (
            <StatLeaderMobile key={r.player_name} rank={i + 1} name={r.player_name} teamId={r.team_id}
              headLabel="Runs" headValue={r.total_runs}
              stats={[
                { label: "M", value: r.matches },
                { label: "HS", value: r.high_score },
                { label: "Avg", value: r.batting_average != null ? r.batting_average.toFixed(2) : "—" },
                { label: "SR", value: r.strike_rate != null ? r.strike_rate.toFixed(1) : "—" },
                { label: "4s", value: r.fours },
                { label: "6s", value: r.sixes },
              ]} />
          ))}
          {tab === "bowling" && bowling.slice(0, 10).map((r, i) => (
            <StatLeaderMobile key={r.player_name} rank={i + 1} name={r.player_name} teamId={r.team_id}
              headLabel="Wkts" headValue={r.total_wickets}
              stats={[
                { label: "M", value: r.matches },
                { label: "Ov", value: r.total_overs },
                { label: "Runs", value: r.runs_conceded },
                { label: "Econ", value: r.economy },
                { label: "Avg", value: r.bowling_average != null ? r.bowling_average.toFixed(2) : "—" },
              ]} />
          ))}
          {tab === "allrounders" && allRounders.slice(0, 10).map((r, i) => (
            <StatLeaderMobile key={r.player_name} rank={i + 1} name={r.player_name} teamId={r.team_id}
              headLabel="Combined" headValue={r.combined_score}
              stats={[
                { label: "M", value: r.matches },
                { label: "Runs", value: r.total_runs },
                { label: "Wkts", value: r.total_wickets },
                { label: "Bat", value: r.batting_score },
                { label: "Bowl", value: r.bowling_score },
              ]} />
          ))}
          {tab === "fielding" && fielding.slice(0, 10).map((r, i) => (
            <StatLeaderMobile key={r.player_name} rank={i + 1} name={r.player_name}
              headLabel="Catches" headValue={r.catches} stats={[]} />
          ))}
        </div>

        {tab === "batting" && (
          <table className="hidden sm:table text-sm w-full min-w-[760px] border-collapse [&_th]:px-3.5 [&_td]:px-3.5 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                <th className={STICKY_HEAD}>Player</th>
                <th className="text-center pb-2">M</th>
                <th className="text-center pb-2">Inn</th>
                <th className="text-center pb-2">Runs</th>
                <th className="text-center pb-2">HS</th>
                <th className="text-center pb-2">Avg</th>
                <th className="text-center pb-2">SR</th>
                <th className="text-center pb-2">4s</th>
                <th className="text-center pb-2">6s</th>
                <th className="text-center pb-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {batting.slice(0, 10).map((r, i) => (
                <tr key={r.player_name} className="border-b border-white/[0.03]">
                  <td className={STICKY_CELL}><PlayerCell rank={i + 1} name={r.player_name} teamId={r.team_id} /></td>
                  <td className="py-2 text-center text-white/50">{r.matches}</td>
                  <td className="py-2 text-center text-white/50">{r.innings}</td>
                  <td className="py-2 text-center font-black text-white">{r.total_runs}</td>
                  <td className="py-2 text-center text-white/60">{r.high_score}</td>
                  <td className="py-2 text-center text-white/60 tabular-nums">{r.batting_average != null ? r.batting_average.toFixed(2) : "—"}</td>
                  <td className="py-2 text-center text-white/60 tabular-nums">{r.strike_rate != null ? r.strike_rate.toFixed(1) : "—"}</td>
                  <td className="py-2 text-center text-white/40">{r.fours}</td>
                  <td className="py-2 text-center text-white/40">{r.sixes}</td>
                  <td className="py-2 text-center"><span className="text-[#E8537E] font-black">{r.batting_score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "bowling" && (
          <table className="hidden sm:table text-sm w-full min-w-[760px] border-collapse [&_th]:px-3.5 [&_td]:px-3.5 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                <th className={STICKY_HEAD}>Player</th>
                <th className="text-center pb-2">M</th>
                <th className="text-center pb-2">Inn</th>
                <th className="text-center pb-2">Wkts</th>
                <th className="text-center pb-2">Overs</th>
                <th className="text-center pb-2">Runs</th>
                <th className="text-center pb-2">Econ</th>
                <th className="text-center pb-2">Avg</th>
                <th className="text-center pb-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {bowling.slice(0, 10).map((r, i) => (
                <tr key={r.player_name} className="border-b border-white/[0.03]">
                  <td className={STICKY_CELL}><PlayerCell rank={i + 1} name={r.player_name} teamId={r.team_id} /></td>
                  <td className="py-2 text-center text-white/50">{r.matches}</td>
                  <td className="py-2 text-center text-white/50">{r.innings}</td>
                  <td className="py-2 text-center font-black text-white">{r.total_wickets}</td>
                  <td className="py-2 text-center text-white/60">{r.total_overs}</td>
                  <td className="py-2 text-center text-white/50">{r.runs_conceded}</td>
                  <td className="py-2 text-center text-white/50">{r.economy}</td>
                  <td className="py-2 text-center text-white/60 tabular-nums">{r.bowling_average != null ? r.bowling_average.toFixed(2) : "—"}</td>
                  <td className="py-2 text-center"><span className="text-[#E8537E] font-black">{r.bowling_score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "allrounders" && (
          <>
            <p className="hidden sm:block text-[9px] text-white/25 uppercase tracking-widest mb-3">Combined score = avg of batting rank + bowling rank (ICC method)</p>
            <table className="hidden sm:table text-sm w-full min-w-[560px] border-collapse [&_th]:px-3.5 [&_td]:px-3.5 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
              <thead>
                <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                  <th className={STICKY_HEAD}>Player</th>
                  <th className="text-center pb-2">M</th>
                  <th className="text-center pb-2">Runs</th>
                  <th className="text-center pb-2">Wkts</th>
                  <th className="text-center pb-2">Bat</th>
                  <th className="text-center pb-2">Bowl</th>
                  <th className="text-center pb-2">Combined</th>
                </tr>
              </thead>
              <tbody>
                {allRounders.slice(0, 10).map((r, i) => (
                  <tr key={r.player_name} className="border-b border-white/[0.03]">
                    <td className={STICKY_CELL}><PlayerCell rank={i + 1} name={r.player_name} teamId={r.team_id} /></td>
                    <td className="py-2 text-center text-white/50">{r.matches}</td>
                    <td className="py-2 text-center text-white/60">{r.total_runs}</td>
                    <td className="py-2 text-center text-white/60">{r.total_wickets}</td>
                    <td className="py-2 text-center text-white/40">{r.batting_score}</td>
                    <td className="py-2 text-center text-white/40">{r.bowling_score}</td>
                    <td className="py-2 text-center font-black text-[#E8537E] text-sm">{r.combined_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === "fielding" && (
          <table className="hidden sm:table text-sm w-full min-w-[320px] border-collapse [&_th]:px-3.5 [&_td]:px-3.5 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                <th className={STICKY_HEAD}>Player</th>
                <th className="text-center pb-2">Catches</th>
              </tr>
            </thead>
            <tbody>
              {fielding.slice(0, 10).map((r, i) => (
                <tr key={r.player_name} className="border-b border-white/[0.03]">
                  <td className={STICKY_CELL}><PlayerCell rank={i + 1} name={r.player_name} /></td>
                  <td className="py-2 text-center font-black text-[#E8537E]">{r.catches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(tab === "batting" && batting.length === 0) || (tab === "bowling" && bowling.length === 0) || (tab === "allrounders" && allRounders.length === 0) || (tab === "fielding" && fielding.length === 0) ? (
          <p className="text-center text-white/20 text-xs py-8">No data yet — import matches to see stats</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Section Heading (eyebrow + title) ────────────────────────────────────────
// Shared across the page sections. Mobile uses tighter tracking + smaller text
// so the wide-tracked eyebrow line never wraps awkwardly.
function SectionHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: string }) {
  return (
    <div className="mb-6 border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-1 rounded-full bg-[#E8537E] shrink-0" />
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.4em] text-white/35 leading-relaxed">
            {eyebrow}
          </p>
        </div>
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-1.5 pl-3">
          {title}
        </h2>
      </div>
      {aside && (
        <p className="text-[10px] text-white/40 font-bold max-w-xs pl-3 sm:pl-0 sm:text-right">
          {aside}
        </p>
      )}
    </div>
  );
}

// ── Points Table ─────────────────────────────────────────────────────────────
function PointsTable({ rows, compact = false }: { rows: SeriesStandingRow[]; compact?: boolean }) {
  if (rows.length === 0) return null;
  const fmtNRR = (nrr: number) => `${nrr >= 0 ? "+" : ""}${nrr.toFixed(3)}`;
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className={`w-full ${compact ? "max-w-md text-xs min-w-0 [&_th]:px-1.5 [&_td]:px-1.5" : "text-sm min-w-[360px] [&_th]:px-2.5 [&_td]:px-2.5"}`}>
        <thead>
          <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
            <th className="text-left pb-2">Team</th>
            <th className="text-center pb-2 w-7">P</th>
            <th className="text-center pb-2 w-7">W</th>
            <th className="text-center pb-2 w-7">T</th>
            <th className="text-center pb-2 w-7">L</th>
            <th className="text-center pb-2 w-9">Pts</th>
            {!compact && <th className="text-center pb-2 w-14">Pts%</th>}
            <th className="text-center pb-2 w-16">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color = TEAMS[r.team_id as keyof typeof TEAMS]?.primary ?? "#888";
            const name = TEAMS[r.team_id as keyof typeof TEAMS]?.name ?? r.team_id;
            return (
              <tr key={r.team_id} className={`border-b border-white/[0.03] ${i === 0 ? "bg-white/[0.02]" : ""}`}>
                <td className={`py-1.5 font-black ${compact ? "pr-1 truncate max-w-[110px]" : "pr-3"}`} style={{ color }}>{name}</td>
                <td className="py-1.5 text-center text-white/40">{r.played}</td>
                <td className="py-1.5 text-center font-black text-white">{r.won}</td>
                <td className="py-1.5 text-center text-white/40">{r.tied}</td>
                <td className="py-1.5 text-center text-white/40">{r.lost}</td>
                <td className="py-1.5 text-center font-black text-[#E8537E]">{r.points}</td>
                {!compact && <td className="py-1.5 text-center text-white/50">{r.win_pct}%</td>}
                <td className="py-1.5 text-center font-bold text-[10px]">
                  <span className={r.nrr >= 0 ? "text-emerald-400/80" : "text-red-400/70"}>
                    {fmtNRR(r.nrr)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Finals trophy cabinet panel ───────────────────────────────────────────────
function FinalsTrophyPanel({ rows }: { rows: SeriesStandingRow[] }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-6 h-full max-w-2xl mx-auto">
      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.4em] text-[#E8537E]/70 mb-1">Finals · Exhibition Series</p>
      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mb-4">Trophy Cabinet</h3>
      {rows.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-8">No finals recorded yet.</p>
      ) : (
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm min-w-[280px] [&_th]:px-2.5 [&_td]:px-2.5">
            <thead>
              <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                <th className="text-left pb-2">Team</th>
                <th className="text-center pb-2 w-12">M</th>
                <th className="text-center pb-2 w-12">W</th>
                <th className="text-left pb-2 pl-4">Trophies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const color = TEAMS[r.team_id as keyof typeof TEAMS]?.primary ?? "#888";
                const name = TEAMS[r.team_id as keyof typeof TEAMS]?.name ?? r.team_id;
                return (
                  <tr key={r.team_id} className="border-b border-white/[0.03]">
                    <td className="py-2 font-black pr-3" style={{ color }}>{name}</td>
                    <td className="py-2 text-center text-white/40">{r.played}</td>
                    <td className="py-2 text-center font-black text-white">{r.won}</td>
                    <td className="py-2 pl-4 text-base leading-none tracking-tight">
                      {r.won > 0
                        ? Array.from({ length: r.won }).map((_, i) => <span key={i}>🏆</span>)
                        : <span className="text-white/20 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[9px] text-white/20 mt-4 font-bold">M = Finals Played · W = Finals Won · Trophies = 🏆 per win</p>
    </div>
  );
}

// ── Standings panel + swipeable current-vs-overall ───────────────────────────
function StandingsPanel({ label, sub, rows }: { label: string; sub: string; rows: SeriesStandingRow[] }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-6 h-full max-w-2xl mx-auto">
      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.4em] text-[#E8537E]/70 mb-1">{sub}</p>
      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mb-4">{label}</h3>
      {rows.length > 0
        ? <PointsTable rows={rows} />
        : <p className="text-center text-white/30 text-sm py-8">No matches recorded yet.</p>}
      <p className="text-[9px] text-white/20 mt-4 font-bold">P = Played · W = Won · T = Tied · L = Lost · Pts = Points (W×2, T×1) · Pts% = Pts ÷ (2×P) · NRR = Net Run Rate (recorded matches only)</p>
    </div>
  );
}

function SwipeableStandings({ current, overall, finals, currentSeriesName }: {
  current: SeriesStandingRow[];
  overall: SeriesStandingRow[];
  finals: SeriesStandingRow[];
  currentSeriesName: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const TOTAL = 3;
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const hints = ["Swipe for overall standings", "Swipe for trophy cabinet"];
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="snap-center shrink-0 w-full">
          <StandingsPanel
            label={currentSeriesName ? `League Standings — ${currentSeriesName}` : "League Standings"}
            sub="Latest Series · Points % Based"
            rows={current}
          />
        </div>
        <div className="snap-center shrink-0 w-full">
          <StandingsPanel label="All-Time · Overall" sub="Every Series Combined · Points % Based" rows={overall} />
        </div>
        <div className="snap-center shrink-0 w-full">
          <FinalsTrophyPanel rows={finals} />
        </div>
      </div>

      {/* Pager dots */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Panel ${i + 1}`}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: idx === i ? 22 : 8, background: idx === i ? "#E8537E" : "color-mix(in srgb, var(--color-white) 22%, transparent)" }}
          />
        ))}
      </div>

      {/* Swipe hint — shown on panels 0 and 1 */}
      <AnimatePresence>
        {idx < TOTAL - 1 && (
          <motion.button
            key={idx}
            onClick={() => go(idx + 1)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
          >
            {hints[idx]}
            <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact, readable team labels for narrow mobile rows (avoids "OUT" misreading).
const MOBILE_SHORT: Record<string, string> = {
  mavericks: "Mave",
  neurostrikers: "Neuro",
  outliers: "Outliers",
};
function teamShortMobile(id: string): string {
  return MOBILE_SHORT[id] ?? TEAMS[id as keyof typeof TEAMS]?.name ?? id;
}

// ── Per-Match Scorecard Card ──────────────────────────────────────────────────
function MatchScorecardCard({ match }: { match: FullSeries["matches"][0] }) {
  const [open, setOpen] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Captain of a given team in this match → used to append a (C) tag in the scorecard.
  const captainOf = (teamId: string) =>
    teamId === match.team1_id ? match.team1_captain
    : teamId === match.team2_id ? match.team2_captain
    : null;
  const withCaptain = (name: string, teamId: string) =>
    captainOf(teamId) && name === captainOf(teamId) ? `${name} (C)` : name;

  const winner = match.winner_id ? TEAMS[match.winner_id as keyof typeof TEAMS]?.name ?? match.winner_id : null;
  const result = match.is_tie
    ? "Match tied"
    : winner
    ? `${winner} won${match.margin_value ? ` by ${match.margin_value} ${match.margin_type}` : ""}`
    : "Result pending";

  return (
    <div className="border border-white/[0.07] rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent">
      {/* Compact header (always visible) */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col gap-1.5 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25 shrink-0 sm:w-12">
            {match.stage === "final" ? "FINAL" : `M${match.match_no}`}
          </span>
          <span className="flex-1 sm:flex-none min-w-0 truncate text-xs font-black text-white/70 sm:w-64">
            <span className="sm:hidden">{teamShortMobile(match.team1_id)}</span>
            <span className="hidden sm:inline">{TEAMS[match.team1_id as keyof typeof TEAMS]?.name ?? match.team1_id}</span>
            <span className="text-white/25 mx-1">vs</span>
            <span className="sm:hidden">{teamShortMobile(match.team2_id)}</span>
            <span className="hidden sm:inline">{TEAMS[match.team2_id as keyof typeof TEAMS]?.name ?? match.team2_id}</span>
          </span>
          <span className="shrink-0 flex items-center gap-1 sm:w-28">
            {match.innings.map((inn) => (
              <span key={inn.innings_no} className="text-xs font-black font-mono text-white/60 shrink-0">
                {inn.total_runs}/{inn.total_wickets}
              </span>
            )).reduce((prev, curr, i) => i === 0 ? [curr] : [...(prev as React.ReactNode[]), <span key={`sep-${i}`} className="text-white/20 text-xs">·</span>, curr] as React.ReactNode[], [] as React.ReactNode[])}
          </span>
          <span className="hidden sm:block sm:flex-1 min-w-0 truncate text-[10px] text-[#E8537E] font-bold">{result}</span>
          {match.player_of_match && (
            <span className="hidden sm:flex items-center gap-1 shrink-0 sm:w-44 text-[10px] font-black text-jcc-gold/80">
              <Star className="w-3 h-3 shrink-0" /> {match.player_of_match}
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0 ml-auto sm:ml-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0 ml-auto sm:ml-0" />}
        </div>

        {/* Mobile-only result + Player of the Match line */}
        <div className="sm:hidden flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="text-[10px] text-[#E8537E] font-bold">{result}</span>
          {match.player_of_match && (
            <span className="flex items-center gap-1 text-[10px] font-black text-jcc-gold/80">
              <Star className="w-3 h-3 shrink-0" /> {match.player_of_match.split(" ")[0]}
            </span>
          )}
        </div>
      </button>

      {/* Expanded scorecard */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] px-4 py-4 space-y-5">
              {/* Match meta */}
              <div className="flex flex-wrap gap-3 text-[9px] font-black uppercase tracking-widest text-white/30">
                {match.match_date && <span>{new Date(match.match_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                {match.venue && <span>· {match.venue}</span>}
                {match.toss_winner_id && <span>· Toss: {TEAMS[match.toss_winner_id as keyof typeof TEAMS]?.name ?? match.toss_winner_id} elected to {match.toss_decision}</span>}
              </div>

              {/* Innings */}
              {match.innings.map((inn) => (
                <div key={inn.innings_no} className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {TEAMS[inn.batting_team_id as keyof typeof TEAMS]?.name ?? inn.batting_team_id} — {inn.total_runs}/{inn.total_wickets} ({inn.total_overs} ov){inn.all_out ? " all out" : ""}
                  </p>

                  {/* Batting */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] min-w-[400px]">
                      <thead>
                        <tr className="text-white/20 border-b border-white/[0.04]">
                          <th className="text-left pb-1 font-bold">Batter</th>
                          <th className="text-right pb-1 font-bold w-10">R</th>
                          <th className="text-right pb-1 font-bold w-10">B</th>
                          <th className="text-right pb-1 font-bold w-8">4s</th>
                          <th className="text-right pb-1 font-bold w-8">6s</th>
                          <th className="text-left pb-1 font-bold pl-3">How out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.batting.map((b, bi) => (
                          <tr key={bi} className="border-b border-white/[0.03]">
                            <td className="py-1 font-black text-white/80">{withCaptain(b.player_name, inn.batting_team_id)}</td>
                            <td className="py-1 text-right font-black text-white">{b.runs}</td>
                            <td className="py-1 text-right text-white/40">{b.balls_faced ?? "—"}</td>
                            <td className="py-1 text-right text-white/40">{b.fours}</td>
                            <td className="py-1 text-right text-white/40">{b.sixes}</td>
                            <td className="py-1 pl-3 text-white/35">
                              {b.dismissal_type === "not_out" ? "not out"
                                : b.dismissal_type === "did_not_bat" ? "dnb"
                                : b.dismissal_type === "caught" ? `c ${b.caught_by ?? "?"} b ${b.dismissed_by ?? "?"}`
                                : b.dismissal_type === "run_out" ? `run out (${b.dismissed_by ?? "?"})`
                                : `${b.dismissal_type?.replace("_", " ")} b ${b.dismissed_by ?? "?"}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bowling */}
                  <div className="overflow-x-auto mt-1">
                    <table className="w-full text-[10px] min-w-[340px]">
                      <thead>
                        <tr className="text-white/20 border-b border-white/[0.04]">
                          <th className="text-left pb-1 font-bold">Bowler</th>
                          <th className="text-right pb-1 font-bold w-10">O</th>
                          <th className="text-right pb-1 font-bold w-8">M</th>
                          <th className="text-right pb-1 font-bold w-10">R</th>
                          <th className="text-right pb-1 font-bold w-8">W</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.bowling.map((bw, bi) => (
                          <tr key={bi} className="border-b border-white/[0.03]">
                            <td className="py-1 font-black text-white/80">{withCaptain(bw.player_name, inn.bowling_team_id)}</td>
                            <td className="py-1 text-right text-white/50">{bw.overs}</td>
                            <td className="py-1 text-right text-white/30">{bw.maidens}</td>
                            <td className="py-1 text-right text-white/50">{bw.runs_conceded}</td>
                            <td className="py-1 text-right font-black text-white">{bw.wickets}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FOW */}
                  {inn.fall_of_wickets?.length > 0 && (
                    <p className="text-[9px] text-white/25 leading-relaxed">
                      <span className="font-black text-white/30">FOW: </span>
                      {(inn.fall_of_wickets as Array<{wkt:number;score:number;overs:string;player:string}>)
                        .map((f) => `${f.wkt}/${f.score}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              ))}

              {/* Result + POM */}
              <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-white/[0.05]">
                <span className="text-xs font-black text-white">{result}</span>
                {match.player_of_match && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-jcc-gold/80">
                    <Star className="w-3 h-3" /> {match.player_of_match}
                  </span>
                )}
              </div>

              {/* AI Analysis */}
              {match.ai_analysis && (
                <div className="mt-2">
                  <button onClick={() => setShowAnalysis(!showAnalysis)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#E8537E]/70 hover:text-[#E8537E] transition-colors mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    {showAnalysis ? "Hide" : "Show"} AI Match Analysis
                  </button>
                  <AnimatePresence>
                    {showAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-[#E8537E]/5 border border-[#E8537E]/15 rounded-xl p-4">
                          <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{match.ai_analysis}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tri-Series Card ───────────────────────────────────────────────────────────
function TriSeriesCard({ series }: { series: FullSeries }) {
  const [open, setOpen] = useState(false);
  const articles = (series.articles ?? []) as Array<{ title: string; url: string }>;

  const leagueMatches = series.matches.filter((m) => m.stage === "league");
  const finalMatch = series.matches.find((m) => m.stage === "final");
  const leagueStandings = computeOverallStandings([series]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors text-left">
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#E8537E]/60 mb-1">Tri-Series #{series.series_no}</p>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">{series.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-white/25 font-bold">
            {series.started_at && <span>{new Date(series.started_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>}
            {series.venue && <span>· {series.venue}</span>}
            <span>· {series.matches.length} matches</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-white/20" /> : <ChevronDown className="w-5 h-5 text-white/20" />}
      </button>

      {/* Chewvana Times */}
      {articles.length > 0 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {articles.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-[#E8537E]/80 transition-colors border border-white/[0.06] hover:border-[#E8537E]/20 rounded-full px-3 py-1.5">
              <Newspaper className="w-3 h-3" />
              {a.title}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}

      {/* Matches */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-4 py-4 space-y-2">
              {series.notes && (
                <p className="text-[10px] text-white/30 italic px-1 pb-2">{series.notes}</p>
              )}

              {/* League standings */}
              {leagueStandings.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 mb-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/25 mb-2">League Standings</p>
                  <PointsTable rows={leagueStandings} compact />
                </div>
              )}

              {leagueMatches.map((m) => (
                <MatchScorecardCard key={m.id} match={m} />
              ))}
              {finalMatch && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#E8537E]/50">Final</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                  <MatchScorecardCard match={finalMatch} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function RivalryPage() {
  const [seasons, setSeasons] = useState<RivalrySeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullSeries, setFullSeries] = useState<FullSeries[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [seasonData, seriesData] = await Promise.all([
          fetchRivalrySeasons(),
          fetchFullSeries(),
        ]);
        setSeasons(seasonData);
        setFullSeries(seriesData);
      } catch (err) {
        console.error("Failed to load rivalry data:", err);
      } finally {
        setLoading(false);
        setSeriesLoading(false);
      }
    }
    loadData();
  }, []);

  const activeSeason = seasons.find((s) => s.status === "active");
  const archivedSeasons = seasons.filter((s) => s.status === "archived");

  // Compute 3-way scoreline: base wins (main series) + tri-series wins
  const baseWins = {
    mavericks: seasons.reduce((s, e) => s + e.mavericks_main_wins, 0),
    neurostrikers: seasons.reduce((s, e) => s + e.neurostrikers_main_wins, 0),
    outliers: seasons.reduce((s, e) => s + (e.outliers_main_wins ?? 0), 0),
  };
  const triWins = computeTriSeriesWins(fullSeries);
  const totalWins = {
    mavericks: baseWins.mavericks + triWins.mavericks,
    neurostrikers: baseWins.neurostrikers + triWins.neurostrikers,
    outliers: triWins.outliers,
  };

  const overallStandings = mergeBaseline(computeOverallStandings(fullSeries), OVERALL_BASELINE);
  const activeSeasonSeries = activeSeason
    ? fullSeries.filter((s) => s.season_id === activeSeason.id)
    : [];
  // latestSeries derived first — used both for the standings panel and F1 leaderboards.
  const latestSeries = activeSeasonSeries.length
    ? activeSeasonSeries.reduce((a, b) => (b.series_no > a.series_no ? b : a))
    : null;
  const currentSeasonStandings = latestSeries ? computeOverallStandings([latestSeries]) : [];
  const latestSeriesName = latestSeries?.name ?? null;
  // F1: latest tri-series, league only — max M = 2 per player.
  const latestSeriesLeaderboards = computeLeaderboards(latestSeries ? [latestSeries] : [], "league");
  // F2: all tri-series, league only — max M = 2 × recorded series count.
  const allLeagueLeaderboards = computeLeaderboards(fullSeries, "league");
  // F3 (finals tab): all tri-series finals only — max M = 1 per series per player.
  const finalsLeaderboards = computeLeaderboards(fullSeries, "final");
  // Finals standings: who played/won finals across all series (no NRR, no points needed).
  const finalsStandings = computeSeriesStandings(
    fullSeries.flatMap((s) => s.matches as SeriesMatch[]),
    "final",
  );
  // Header scoreboard derives live from linked matches → no stale seeded numbers.
  const liveActiveSeason = activeSeason
    ? applyLiveSeasonStats(activeSeason, activeSeasonSeries.flatMap((s) => s.matches as SeriesMatch[]))
    : null;

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 stadium-glow opacity-40 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-15 pointer-events-none z-0" />
      <div className="absolute inset-0 dot-pattern opacity-[0.05] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center sm:text-left"
        >
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-jcc-ball-red font-black">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-ball-red opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-ball-red" />
              </span>
              Community Captain Era History
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
            The <span className="text-gradient-cyan">Rivalry</span>
          </h1>
          <p className="mt-4 text-white/60 text-lg font-black tracking-tight max-w-xl">
            "Every new captain pairing writes its own chapter."
          </p>
        </motion.div>

        {/* ── Active Captain Scoreboard ── */}
        <div className="mb-16">
          {loading ? (
            <ScoreboardSkeleton />
          ) : liveActiveSeason ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <ActiveScoreboard season={liveActiveSeason} />
            </motion.div>
          ) : (
            <div className="p-8 text-center text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
              No active captain rivalry season found.
            </div>
          )}
        </div>

        {/* ── Tri-Series History ── */}
        {(seriesLoading || fullSeries.length > 0) && (
          <div className="mb-16">
            <SectionHeading eyebrow="Complete Scorecards & AI Reports" title="Tri-Series Archive" />
            {seriesLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />)}
              </div>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={VIEWPORT_CONFIG} className="space-y-4">
                {fullSeries.map((s) => (
                  <motion.div key={s.id} variants={fadeUp}>
                    <TriSeriesCard series={s} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* ── Collective Points Table ── */}
        {!seriesLoading && overallStandings.length > 0 && (
          <div className="mb-16">
            <SectionHeading eyebrow="Points Table · Swipe to Compare" title="Standings" />
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <SwipeableStandings current={currentSeasonStandings} overall={overallStandings} finals={finalsStandings} currentSeriesName={latestSeriesName} />
            </motion.div>
          </div>
        )}

        {/* ── Stats Leaderboards ── */}
        {(seriesLoading || fullSeries.length > 0) && (
          <div className="mb-16">
            <SectionHeading eyebrow="Batting · Bowling · All-rounders · Fielding" title="Player Stats" />
            {seriesLoading ? (
              <div className="h-48 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <StatsLeaderboards current={latestSeriesLeaderboards} overall={allLeagueLeaderboards} finals={finalsLeaderboards} />
              </motion.div>
            )}
          </div>
        )}

        {/* ── Archived Rivalry Eras ── */}
        <div className="mb-16">
          <SectionHeading eyebrow="Past Chapters" title="Archived Rivalry Eras" aside="Legacy captain pairs and their corresponding final scores." />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 w-full border border-white/[0.05] rounded-xl bg-white/[0.01] animate-pulse" />
              ))}
            </div>
          ) : archivedSeasons.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT_CONFIG}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {archivedSeasons.map((season) => (
                <ArchivedEraCard key={season.id} season={season} />
              ))}
            </motion.div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center border border-dashed border-white/10 rounded-xl">
              No archived rivalry seasons found.
            </div>
          )}
        </div>

        {/* ── Historic Progression Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <SeriesProgression series={activeSeasonSeries} />
        </motion.div>

        {/* ── CTA to Register ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-jcc-accent/20 bg-gradient-to-br from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-8 text-center"
        >
          <Trophy className="w-8 h-8 text-jcc-gold mx-auto mb-3" />
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
            Be Part of the Next Chapter
          </h3>
          <p className="text-white/40 text-sm font-medium mb-5 max-w-sm mx-auto">
            Pick your side. Join the Sunday ritual. Add your name to the rivalry story.
          </p>
          <a
            href="/register"
            className="inline-flex items-center gap-2 btn-vibrant-blue text-sm font-black"
          >
            Register for Sunday
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
