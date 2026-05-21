"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Trophy, Star, MapPin, Shield, Zap, TrendingUp, History, ChevronRight, Swords, Calendar } from "lucide-react";
import { matchHistory } from "@/lib/data";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";
import { fetchRivalrySeasons, RivalrySeason } from "@/lib/rivalry";

// ── Animated counting number ──────────────────────────────────────────────────
function AnimatedNumber({
  target,
  className = "",
  duration = 1600,
}: {
  target: number;
  className?: string;
  duration?: number;
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
    <span ref={ref} className={className}>
      {count}
    </span>
  );
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

// ── Active Captain Scoreboard (ESPN/Broadcast style) ───────────────────────
function ActiveScoreboard({ season }: { season: RivalrySeason }) {
  const mavWins = season.mavericks_main_wins + season.mavericks_exhibition_wins;
  const nsWins = season.neurostrikers_main_wins + season.neurostrikers_exhibition_wins;
  const total = season.total_matches_played;
  
  const mavPct = total > 0 ? Math.round((mavWins / total) * 100) : 50;
  const nsPct = 100 - mavPct;
  const leader = mavWins > nsWins ? "Mavericks" : nsWins > mavWins ? "NeuroStrikers" : null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-jcc-accent/20 bg-gradient-to-b from-[#0d2238] via-[#091826] to-[#050e17] shadow-[0_15px_40px_rgba(0,194,255,0.15)] transition-all duration-300">
      {/* Glow effects */}
      <div className="absolute top-0 left-0 w-24 h-24 bg-jcc-accent/10 blur-[60px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-jcc-ball-red/10 blur-[60px] pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] gap-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400">
            Active Captain Rivalry
          </span>
          <span className="text-[10px] text-white/40 font-bold px-2 py-0.5 bg-white/[0.05] rounded-full">
            {season.season_label || "Current Season"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/50">
          <Calendar className="w-3.5 h-3.5 text-jcc-accent" />
          {season.started_at ? `Started ${new Date(season.started_at).toLocaleDateString("en-IN", { weekday: 'long', day: 'numeric', month: 'short' })}` : "Started Last Sunday"}
        </div>
      </div>

      {/* Main Scoreboard Content */}
      <div className="p-6 sm:p-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-[var(--font-heading)]">
            {season.title}
          </h2>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">
            Current Era Captain pairing
          </p>
        </div>

        <div className="grid grid-cols-11 items-center gap-2">
          {/* Mavericks */}
          <div className="col-span-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/30 flex items-center justify-center shadow-[0_0_25px_rgba(0,194,255,0.15)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-jcc-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-jcc-accent z-10" />
              </div>
            </div>
            <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-jcc-accent leading-none">
              Mavericks
            </h3>
            <p className="text-[10px] text-white/50 font-bold mt-1">
              Cap: <span className="text-white font-black">{season.mavericks_captain}</span>
            </p>
            {leader === "Mavericks" && (
              <div className="flex items-center justify-center gap-1 mt-2">
                <Trophy className="w-3.5 h-3.5 text-jcc-gold" />
                <span className="text-[9px] font-black uppercase tracking-widest text-jcc-gold">Leading Era</span>
              </div>
            )}
          </div>

          {/* Series Score display */}
          <div className="col-span-3 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <AnimatedNumber
                target={season.mavericks_main_wins}
                className="text-4xl sm:text-6xl font-black text-jcc-accent tabular-nums drop-shadow-[0_4px_12px_rgba(0,194,255,0.2)]"
                duration={1200}
              />
              <span className="text-2xl sm:text-4xl font-black text-white/20 leading-none">—</span>
              <AnimatedNumber
                target={season.neurostrikers_main_wins}
                className="text-4xl sm:text-6xl font-black text-jcc-ball-red tabular-nums drop-shadow-[0_4px_12px_rgba(255,77,77,0.2)]"
                duration={1200}
              />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30 text-center mt-2">
              Main Series
            </span>
          </div>

          {/* NeuroStrikers */}
          <div className="col-span-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/30 flex items-center justify-center shadow-[0_0_25px_rgba(255,77,77,0.15)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-jcc-ball-red/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-jcc-ball-red z-10" />
              </div>
            </div>
            <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-jcc-ball-red leading-none">
              NeuroStrikers
            </h3>
            <p className="text-[10px] text-white/50 font-bold mt-1">
              Cap: <span className="text-white font-black">{season.neurostrikers_captain}</span>
            </p>
            {leader === "NeuroStrikers" && (
              <div className="flex items-center justify-center gap-1 mt-2">
                <Trophy className="w-3.5 h-3.5 text-jcc-gold" />
                <span className="text-[9px] font-black uppercase tracking-widest text-jcc-gold">Leading Era</span>
              </div>
            )}
          </div>
        </div>

        {/* win percent progress bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest mb-2">
            <span className="text-jcc-accent">Mavericks {mavPct}%</span>
            <span className="text-white/25">Era Win Ratio</span>
            <span className="text-jcc-ball-red">NeuroStrikers {nsPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden flex border border-white/[0.03]">
            <motion.div
              className="h-full bg-gradient-to-r from-jcc-accent to-cyan-400 rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: `${mavPct}%` }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <motion.div
              className="h-full bg-gradient-to-l from-jcc-ball-red to-orange-500 rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${nsPct}%` }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ flexGrow: 1 }}
            />
          </div>
        </div>
      </div>

      {/* Scoreboard Info Tiles Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06] hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Main Series Wins</span>
          <span className="text-lg font-black text-white mt-1">
            Mavericks {season.mavericks_main_wins} — {season.neurostrikers_main_wins} NeuroStrikers
          </span>
        </div>
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06] hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Exhibition Series Wins</span>
          {season.mavericks_exhibition_wins === 0 && season.neurostrikers_exhibition_wins === 0 ? (
            <span className="text-xs font-black text-amber-400/80 uppercase tracking-wider mt-1.5 italic">
              No exhibition matches yet
            </span>
          ) : (
            <span className="text-lg font-black text-purple-400 mt-1">
              Mavericks {season.mavericks_exhibition_wins} — {season.neurostrikers_exhibition_wins} NeuroStrikers
            </span>
          )}
        </div>
        <div className="px-6 py-4 flex flex-col justify-center hover:bg-white/[0.02] transition-colors">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Total Matches Played</span>
          <span className="text-lg font-black text-cyan-400 mt-1">
            {season.total_matches_played} Matches Recorded
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Legacy Archived Era Card ────────────────────────────────────────────────
function ArchivedEraCard({ season }: { season: RivalrySeason }) {
  return (
    <motion.div
      variants={fadeUp}
      className="group relative rounded-xl border border-white/[0.06] overflow-hidden p-6 transition-all duration-300 hover:border-white/15 bg-gradient-to-br from-white/[0.02] to-white/[0.005] hover:shadow-2xl shadow-black/40"
    >
      {/* Brushed legacy accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

      {/* Header with status */}
      <div className="flex items-center justify-between mb-4 border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
            Archived Rivalry Era
          </span>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-white/25 px-2 py-0.5 bg-white/5 border border-white/10 rounded">
          {season.season_label || "Legacy Era"}
        </span>
      </div>

      {/* Title & Captain pairing */}
      <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-jcc-accent transition-colors duration-300">
        {season.title}
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mt-3 py-3 px-3 bg-white/[0.01] border border-white/[0.03] rounded-lg">
        <div>
          <span className="text-[8px] font-black text-jcc-accent/50 uppercase tracking-widest">Mavericks Cap</span>
          <p className="text-xs font-black text-white/80">{season.mavericks_captain}</p>
        </div>
        <div>
          <span className="text-[8px] font-black text-jcc-ball-red/50 uppercase tracking-widest">NeuroStrikers Cap</span>
          <p className="text-xs font-black text-white/80">{season.neurostrikers_captain}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40">Main Series</span>
          <span className="font-mono font-black text-white">
            Mavericks <span className="text-jcc-accent">{season.mavericks_main_wins}</span> – <span className="text-jcc-ball-red">{season.neurostrikers_main_wins}</span> NeuroStrikers
          </span>
        </div>
        <div className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40">Exhibition Series</span>
          <span className="font-mono font-black text-white">
            Mavericks <span className="text-purple-400">{season.mavericks_exhibition_wins}</span> – <span className="text-orange-400">{season.neurostrikers_exhibition_wins}</span> NeuroStrikers
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

// ── Series Progression Timeline ───────────────────────────────────────────────
function SeriesProgression() {
  const recent = matchHistory.slice(0, 8).reverse();
  let mavRunning = 0;
  let nsRunning = 0;

  const points = recent.map((m) => {
    if (m.winner === "Mavericks") mavRunning++;
    else if (m.winner === "NeuroStrikers") nsRunning++;
    return { winner: m.winner, mav: mavRunning, ns: nsRunning, date: m.date };
  });

  return (
    <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden p-6 bg-gradient-to-b from-[#0a1f33] to-[#081826]">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-jcc-accent" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.35em] text-white/50">Historic Match-by-Match Progression</h3>
      </div>

      {/* Simple dot timeline */}
      <div className="relative">
        <div className="flex items-end justify-between gap-1 h-28">
          {points.map((p, i) => {
            const mavH = Math.max((p.mav / Math.max(p.mav, p.ns, 1)) * 90, 10);
            const nsH = Math.max((p.ns / Math.max(p.mav, p.ns, 1)) * 90, 10);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-0.5 h-24">
                  <motion.div
                    className="w-[45%] rounded-t bg-jcc-accent/60 animate-glow"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${mavH}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
                    style={{ alignSelf: "flex-end" }}
                  />
                  <motion.div
                    className="w-[45%] rounded-t bg-jcc-ball-red/60 animate-glow"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${nsH}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.06 + 0.05, ease: "easeOut" }}
                    style={{ alignSelf: "flex-end" }}
                  />
                </div>
                <span className="text-[7px] text-white/20 font-bold uppercase">
                  {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }).split(" ")[1]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-jcc-accent/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Mavericks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-jcc-ball-red/60" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">NeuroStrikers</span>
        </div>
      </div>
    </div>
  );
}

// ── Match History Card ────────────────────────────────────────────────────────
function MatchCard({ match }: { match: typeof matchHistory[0]; index: number }) {
  const mavWon = match.winner === "Mavericks";
  const nsWon = match.winner === "NeuroStrikers";

  return (
    <motion.div
      variants={fadeUp}
      className="group relative rounded-xl border border-white/[0.07] overflow-hidden hover:border-white/15 transition-all duration-300"
      style={{ background: "linear-gradient(160deg, #0d2033 0%, #081826 100%)" }}
    >
      {/* Winner accent bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[3px]"
        style={{
          background: mavWon
            ? "linear-gradient(180deg, #00C2FF, #39FF88)"
            : "linear-gradient(180deg, #FF4D4D, #FF8C42)",
        }}
      />

      <div className="pl-5 pr-4 py-4 flex flex-col sm:flex-row gap-4">
        {/* Date + type */}
        <div className="flex-shrink-0 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 sm:w-20">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${match.type === "main" ? "bg-jcc-ball-red/10 text-jcc-ball-red" : "bg-purple-500/10 text-purple-400"}`}>
            {match.type}
          </span>
          <span className="text-[10px] font-black text-white/30 font-mono">
            {new Date(match.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </div>

        {/* Scoreline */}
        <div className="flex-1 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-black uppercase tracking-tight ${mavWon ? "text-jcc-accent" : "text-white/35"}`}>
                Mavericks
              </span>
              <span className="text-sm font-black font-mono text-white">{match.team1Score}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-black uppercase tracking-tight ${nsWon ? "text-jcc-ball-red" : "text-white/35"}`}>
                NeuroStrikers
              </span>
              <span className="text-sm font-black font-mono text-white">{match.team2Score}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-10 bg-white/[0.07]" />

          {/* Result details */}
          <div className="flex-1 flex flex-col justify-center gap-1">
            <p className="text-[11px] font-black uppercase tracking-tight text-white group-hover:translate-x-0.5 transition-transform">
              {match.result}
            </p>
            <p className="text-[10px] text-white/40 font-medium leading-snug line-clamp-1">{match.summary}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-jcc-gold/70">
                <Star className="w-2.5 h-2.5" />
                {match.playerOfTheMatch}
              </span>
              <span className="flex items-center gap-1 text-[9px] text-white/20 uppercase tracking-widest">
                <MapPin className="w-2.5 h-2.5" />
                {match.venue.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function RivalryPage() {
  const [seasons, setSeasons] = useState<RivalrySeason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchRivalrySeasons();
        setSeasons(data);
      } catch (err) {
        console.error("Failed to load rivalry seasons:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeSeason = seasons.find((s) => s.status === "active");
  const archivedSeasons = seasons.filter((s) => s.status === "archived");

  return (
    <div className="min-h-screen pt-28 pb-20 relative overflow-hidden hero-gradient">
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
          ) : activeSeason ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <ActiveScoreboard season={activeSeason} />
            </motion.div>
          ) : (
            <div className="p-8 text-center text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
              No active captain rivalry season found.
            </div>
          )}
        </div>

        {/* ── Archived Rivalry Eras ── */}
        <div className="mb-16">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/[0.08] pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Past Chapters</p>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
                Archived Rivalry Eras
              </h2>
            </div>
            <p className="text-[10px] text-white/40 font-bold max-w-xs">
              Legacy captain pairs and their corresponding final scores.
            </p>
          </div>

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
          <SeriesProgression />
        </motion.div>

        {/* ── Match History Logs ── */}
        <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Recent Banter & Game Logs</p>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">Recorded Match History</h2>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/35 font-mono bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
            <History className="w-3.5 h-3.5 text-jcc-accent" />
            {matchHistory.length} Recorded Matches
          </span>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="space-y-4 mb-16"
        >
          {matchHistory.map((match, i) => (
            <MatchCard key={match.id} match={match} index={i} />
          ))}
        </motion.div>

        {/* ── CTA to Register ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-jcc-accent/20 bg-gradient-to-br from-[#0a1f33] to-[#050e17] p-8 text-center"
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
