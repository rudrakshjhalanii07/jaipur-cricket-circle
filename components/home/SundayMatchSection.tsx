"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  CalendarCheck,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Zap,
  Trophy,
  Flame,
  Shield,
} from "lucide-react";
import { clubStats, registrationData } from "@/lib/data";
import { supabase } from "@/lib/supabase";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

// Countdown timer hook
function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const calculate = () => {
      const match = new Date(targetDate);
      const now = new Date();
      
      const target = new Date(match);
      // If match date is in the past (e.g. today's match ended), we default target or let it hit zero
      if (target <= now) {
        // Set to match date but allow it to show 0 if fully passed
        const diffToday = target.getTime() - now.getTime();
        if (diffToday <= 0) {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
          return;
        }
      }

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// Countdown unit block
function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-11 h-11 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-jcc-accent/30 transition-colors">
        <span className="text-lg sm:text-3xl font-black text-white tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/40 to-transparent" />
      </div>
      <span className="text-[7.5px] sm:text-[9px] uppercase tracking-[0.15em] font-black text-white/30">{label}</span>
    </div>
  );
}

// Team badge component
function TeamBadge({ name, color, accent }: { name: string; color: string; accent: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 sm:gap-3 px-2.5 py-3 sm:px-6 sm:py-5 rounded-2xl border ${color} bg-white/[0.03] flex-1`}>
      <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${accent} flex items-center justify-center`}>
        <Shield className="w-4.5 h-4.5 sm:w-7 sm:h-7 text-white" />
      </div>
      <div className="text-center">
        <p className="text-white font-black text-xs sm:text-base uppercase tracking-wide leading-tight">{name}</p>
        <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/30 font-bold mt-0.5">JCC Season 2026</p>
      </div>
    </div>
  );
}

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  player_limit: number;
  status: string;
}

interface Player {
  id: string;
  name: string;
  status: string;
}

export default function SundayMatchSection() {
  const [match, setMatch] = useState<Match | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({
    totalMembers: clubStats.totalMembers,
    matchesPlayed: clubStats.matchesPlayed,
  });

  async function fetchUpcomingMatch() {
    try {
      setLoading(true);
      setError(false);
      const today = new Date().toISOString().split("T")[0];

      // Query nearest upcoming match where status is open or closed
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .gte("match_date", today)
        .in("status", ["open", "closed"])
        .order("match_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (matchError) throw matchError;

      // Fetch dynamic stats from database
      const { data: dbPlayers } = await supabase
        .from("players")
        .select("id")
        .eq("approval_status", "approved")
        .eq("is_active", true);

      const { data: rivalrySeasons } = await supabase
        .from("rivalry_seasons")
        .select("total_matches_played");

      const activeCount = dbPlayers ? dbPlayers.length : clubStats.totalMembers;
      const totalMatches = rivalrySeasons
        ? rivalrySeasons.reduce((sum: number, s: { total_matches_played: number | null }) => sum + (s.total_matches_played || 0), 0)
        : clubStats.matchesPlayed;

      setStats({
        totalMembers: activeCount,
        matchesPlayed: totalMatches,
      });

      if (matchData) {
        setMatch(matchData);

        // Fetch actual confirmed registrations count & snapshots for custom avatars row
        const { data: regData, error: regError } = await supabase
          .from("registrations")
          .select("id, name, status")
          .eq("match_id", matchData.id)
          .order("created_at", { ascending: true });

        if (regError) throw regError;

        const confirmed = (regData || []).filter((r) => r.status === "registered");
        setConfirmedCount(confirmed.length);
        setRegisteredPlayers(confirmed);
      } else {
        setMatch(null);
      }
    } catch (err) {
      console.error("Error fetching Sunday match card details:", err);
      setError(true); // Triggers graceful static fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUpcomingMatch();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const countdown = useCountdown(match ? match.match_date : (error ? registrationData.matchDate : null));

  // Loading skeleton screen using premium styling matching the theme
  if (loading) {
    return (
      <section className="theme-static-dark py-24 sm:py-32 relative overflow-hidden bg-[#081826]">
        <div className="absolute inset-0 dot-pattern opacity-[0.06] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 animate-pulse">
          <div className="mb-14 space-y-4">
            <div className="w-24 h-4 bg-white/10 rounded-full" />
            <div className="w-80 h-14 bg-white/10 rounded-2xl" />
            <div className="w-96 h-5 bg-white/5 rounded-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 h-[550px] bg-white/[0.03] border border-white/10 rounded-2xl" />
            <div className="lg:col-span-4 flex flex-col gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white/[0.03] border border-white/10 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Graceful Fallback in case of database fetch error
  const displayMatch = error ? {
    id: "mock-match-id",
    match_date: registrationData.matchDate,
    match_time: registrationData.time,
    location_name: registrationData.venue,
    player_limit: registrationData.playerLimit,
    status: registrationData.registrationStatus === "full" ? "open" : registrationData.registrationStatus,
  } : match;

  const finalConfirmedCount = error ? registrationData.registeredPlayers.filter((p) => p.status === "registered").length : confirmedCount;
  const finalRegisteredPlayers = error ? registrationData.registeredPlayers.filter((p) => p.status === "registered") : registeredPlayers;
  const finalPlayerLimit = displayMatch?.player_limit || 18;
  const fillPercentage = Math.min((finalConfirmedCount / finalPlayerLimit) * 100, 100);
  const isFull = finalConfirmedCount >= finalPlayerLimit;

  // Empty state rendering when no active upcoming match exists
  if (!displayMatch) {
    return (
      <>
        <section
          id="sunday-match"
          className="theme-static-dark py-24 sm:py-32 relative overflow-hidden"
          style={{ background: "radial-gradient(ellipse 180% 25% at 50% 0%, rgba(255,255,255,0.018) 0%, #081826 100%)" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent" />
          <div className="absolute inset-0 dot-pattern opacity-[0.10] pointer-events-none" />
          <div className="absolute inset-0 noise-overlay opacity-[0.06] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            {/* Header */}
            <div className="mb-14">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-jcc-accent/70 font-black">
                  NEXT MATCH
                </span>
              </div>
              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic">
                Sunday is <span className="text-white/40">Match Day</span>
              </h2>
            </div>

            {/* Empty State Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col items-center justify-center p-12 sm:p-20 text-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent relative group">
                <div className="absolute inset-0 rounded-2xl border border-white/10 group-hover:border-jcc-accent/20 transition-colors" />
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner text-3xl">
                  🏏
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-3">
                  Next Sunday Match Coming Soon
                </h3>
                <p className="text-sm font-medium text-white/60 max-w-md leading-relaxed uppercase tracking-wider">
                  The next battle is being planned. Stay tuned and keep your kit ready.
                </p>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-4 flex flex-col gap-4 justify-between">
                {[
                  {
                    icon: "🏏",
                    label: "Active Squad",
                    value: `${stats.totalMembers}+`,
                    sub: "registered players",
                    borderColor: "border-jcc-accent/20",
                    glowColor: "from-jcc-accent/10",
                    textColor: "text-jcc-accent",
                  },
                  {
                    icon: "⚡",
                    label: "Matches Played",
                    value: `${stats.matchesPlayed}+`,
                    sub: "since season start",
                    borderColor: "border-yellow-400/20",
                    glowColor: "from-yellow-400/10",
                    textColor: "text-yellow-400",
                  },
                  {
                    icon: "🔥",
                    label: "Sundays Strong",
                    value: `${clubStats.sundaysActive}+`,
                    sub: "consecutive Sundays",
                    borderColor: "border-orange-500/20",
                    glowColor: "from-orange-500/10",
                    textColor: "text-orange-400",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`group relative overflow-hidden rounded-2xl border ${item.borderColor} bg-gradient-to-br ${item.glowColor} to-transparent p-5 flex items-center gap-4 cursor-default hover:scale-[1.02] transition-all duration-300`}
                  >
                    <div className="text-3xl flex-shrink-0">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-2xl font-black ${item.textColor} leading-none`}>{item.value}</div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-white/70 mt-0.5">{item.label}</div>
                      <div className="text-[10px] text-white/40 font-medium mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pitch divider */}
        <div className="relative h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </>
    );
  }

  const isClosed = displayMatch.status === "closed";

  return (
    <>
      <section
        id="sunday-match"
        className="theme-static-dark pt-12 pb-24 sm:pt-20 sm:pb-32 relative overflow-hidden"
        style={{ background: "#081826" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[240px] bg-jcc-accent/[0.04] rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute inset-0 dot-pattern opacity-[0.10] pointer-events-none" />
        <div className="absolute inset-0 noise-overlay opacity-[0.06] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-6 sm:mb-14"
          >
            <div className="flex items-center gap-3 mb-3 sm:mb-5">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-jcc-accent font-black">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-accent" />
                </span>
                NEXT MATCH
              </span>
            </div>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
              Sunday is <span className="text-gradient-cyan">Match Day</span>
            </h2>
            <p className="mt-2 sm:mt-4 text-white/50 text-sm sm:text-lg max-w-xl font-medium leading-relaxed">
              Competitive cricket, tactical brilliance, and the brotherhood of Sunday morning.
            </p>
          </motion.div>

          {/* Main Grid */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >

            {/* MATCH CARD */}
            <motion.div variants={fadeUp} className="lg:col-span-8">
              <div className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] overflow-hidden hover:border-jcc-accent/30 transition-all duration-500">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-jcc-accent via-jcc-green to-transparent" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(0,194,255,0.08) 0%, transparent 70%)" }}
                />

                <div className="p-4 sm:p-8">

                  {/* Header: Live + Title */}
                  <div className="flex items-start justify-between gap-4 mb-3.5 sm:mb-6 md:mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jcc-ball-red/10 border border-jcc-ball-red/20 text-jcc-ball-red text-[10px] font-black uppercase tracking-widest">
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jcc-accent/10 border border-jcc-accent/20 text-jcc-accent text-[10px] font-black uppercase tracking-widest">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-60" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-jcc-accent" />
                            </span>
                            {isFull ? "Match Full" : "Registration Open"}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-widest text-white/20 font-black">
                          Main Series
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tight">
                        Next Sunday Match
                      </h3>
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-jcc-gold" />
                    </div>
                  </div>

                  {/* TEAMS vs TEAMS */}
                  <div className="flex items-center gap-1.5 sm:gap-3 mb-3.5 sm:mb-6 md:mb-8">
                    <TeamBadge
                      name="Mavericks"
                      color="border-jcc-accent/20"
                      accent="bg-jcc-accent/20"
                    />

                    {/* VS divider */}
                    <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-jcc-accent/20 to-jcc-green/20 border border-white/10 flex items-center justify-center">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-jcc-accent" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-white/30 uppercase tracking-widest">vs</span>
                    </div>

                    <TeamBadge
                      name="Neuro Strikers"
                      color="border-jcc-green/20"
                      accent="bg-jcc-green/20"
                    />
                  </div>

                  {/* Venue & Time */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 mb-3.5 sm:mb-6 md:mb-8">
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/5 border border-white/[0.07] flex-1 hover:bg-white/[0.08] transition-colors">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-white/30">Venue</p>
                        <p className="text-xs sm:text-sm font-bold text-white leading-tight uppercase mt-0.5">{displayMatch.location_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/5 border border-white/[0.07] flex-1 hover:bg-white/[0.08] transition-colors">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-white/30">Reporting Time</p>
                        <p className="text-xs sm:text-sm font-bold text-white uppercase mt-0.5">{displayMatch.match_time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-white/5 border border-white/[0.07] flex-1 hover:bg-white/[0.08] transition-colors">
                      <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-white/30">Date</p>
                        <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                          {new Date(displayMatch.match_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  <div className="mb-3.5 sm:mb-6 md:mb-8">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] font-black text-white/30 mb-2">
                      Countdown to Match Day
                    </p>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <CountdownUnit value={countdown.days} label="Days" />
                      <span className="text-lg sm:text-2xl font-black text-white/20 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.hours} label="Hrs" />
                      <span className="text-lg sm:text-2xl font-black text-white/20 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.minutes} label="Min" />
                      <span className="text-lg sm:text-2xl font-black text-white/20 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.seconds} label="Sec" />
                    </div>
                  </div>

                  {/* Registration Progress */}
                  <div className="mb-3.5 sm:mb-6 md:mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-white/40">
                        <Users className="w-3.5 h-3.5" />
                        {isClosed ? "Registration Closed" : "Registration"}
                      </span>
                      <div className="flex items-center gap-2">
                        {isClosed ? (
                          <span className="px-2 py-0.5 rounded-full bg-jcc-ball-red/15 border border-jcc-ball-red/25 text-jcc-ball-red text-[9px] font-black uppercase tracking-widest">
                            Closed
                          </span>
                        ) : isFull ? (
                          <span className="px-2 py-0.5 rounded-full bg-jcc-gold/15 border border-jcc-gold/25 text-jcc-gold text-[9px] font-black uppercase tracking-widest">
                            Full
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/25 text-emerald-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
                            Open
                          </span>
                        )}
                        <span className="text-sm font-black text-white">
                          {finalConfirmedCount}
                          <span className="text-white/30">/{finalPlayerLimit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] border border-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${fillPercentage}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: isClosed
                            ? "rgba(239, 68, 68, 0.4)"
                            : isFull
                            ? "linear-gradient(90deg, #FF4D4D, #FF6B6B)"
                            : "linear-gradient(90deg, #00C2FF, #39FF88)",
                        }}
                      />
                    </div>
                    {/* Player initials row */}
                    <div className="flex items-center mt-3 sm:mt-4 flex-wrap">
                      <div className="flex items-center pl-2 select-none">
                        {finalRegisteredPlayers.slice(0, 8).map((p, i) => (
                          <div
                            key={p.id}
                            className="w-7 h-7 rounded-full bg-gradient-to-br from-jcc-accent/40 to-jcc-navy-light border-2 border-[#102339] flex items-center justify-center text-[9px] font-black text-white uppercase shadow-lg -ml-2 first:ml-0 hover:scale-110 hover:z-20 transition-all duration-200 cursor-default"
                            style={{ zIndex: 10 - i }}
                            title={p.name}
                          >
                            {p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)}
                          </div>
                        ))}
                        {finalConfirmedCount > 8 && (
                          <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-[#102339] flex items-center justify-center text-[9px] font-black text-white/60 -ml-2 shadow-lg relative z-0">
                            +{finalConfirmedCount - 8}
                          </div>
                        )}
                      </div>
                      <span className="ml-2.5 text-[10px] sm:text-[11px] text-white/30 font-black uppercase tracking-widest">registered</span>
                    </div>
                  </div>

                  {/* CTA */}
                  {isClosed ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-2.5 bg-white/5 border border-white/10 text-white/30 text-[12px] sm:text-[13px] font-black w-full sm:w-auto justify-center px-5 py-3 sm:px-6 sm:py-4 rounded-xl cursor-not-allowed uppercase tracking-wider"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      Registration Closed
                    </button>
                  ) : (
                    <Link
                      href="/register"
                      className="group/btn inline-flex items-center gap-2.5 btn-vibrant-blue text-[12px] sm:text-[13px] font-black w-full sm:w-auto justify-center px-5 py-3 sm:px-8 sm:py-4 rounded-xl"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      {isFull ? "JOIN WAITLIST" : "REGISTER FOR SUNDAY"}
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>

            {/* SIDEBAR: Stats + Heat Card */}
            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col gap-4">

              {/* Club Stats Cards */}
              {[
                {
                  icon: "🏏",
                  label: "Active Squad",
                  value: `${stats.totalMembers}+`,
                  sub: "registered players",
                  borderColor: "border-jcc-accent/20",
                  glowColor: "from-jcc-accent/10",
                  textColor: "text-jcc-accent",
                },
                {
                  icon: "⚡",
                  label: "Matches Played",
                  value: `${stats.matchesPlayed}+`,
                  sub: "since season start",
                  borderColor: "border-yellow-400/20",
                  glowColor: "from-yellow-400/10",
                  textColor: "text-yellow-400",
                },
                {
                  icon: "🔥",
                  label: "Win Streak",
                  value: "3",
                  sub: "matches in a row",
                  borderColor: "border-orange-500/20",
                  glowColor: "from-orange-500/10",
                  textColor: "text-orange-400",
                },
                {
                  icon: "👑",
                  label: "Sundays Strong",
                  value: `${clubStats.sundaysActive}+`,
                  sub: "consecutive Sundays",
                  borderColor: "border-jcc-green/20",
                  glowColor: "from-jcc-green/10",
                  textColor: "text-jcc-green",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.2 }}
                  transition={{ delay: i * 0.08 }}
                  className={`group relative overflow-hidden rounded-2xl border ${item.borderColor} bg-gradient-to-br ${item.glowColor} to-transparent p-5 flex items-center gap-4 cursor-default hover:scale-[1.02] transition-all duration-300 hover:shadow-lg`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-white/[0.02]" />

                  <div className="text-3xl flex-shrink-0">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-2xl font-black ${item.textColor} leading-none`}>{item.value}</div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-white/70 mt-0.5">{item.label}</div>
                    <div className="text-[10px] text-white/25 font-medium mt-0.5">{item.sub}</div>
                  </div>

                  <div className={`absolute right-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b ${item.glowColor.replace("/10", "/60")} to-transparent`} />
                </motion.div>
              ))}

              {/* Rivalry Teaser */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ delay: 0.4 }}
                className="group relative rounded-2xl border border-jcc-ball-red/20 bg-gradient-to-br from-jcc-ball-red/10 to-transparent p-5 cursor-default hover:scale-[1.02] transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-jcc-ball-red" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-jcc-ball-red">Hot Rivalry</span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">
                  Mavericks vs NeuroStrikers — the eternal battle. Who claims bragging rights this Sunday?
                </p>
                <Link
                  href="/rivalry"
                  className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-black uppercase tracking-widest text-jcc-ball-red hover:text-white transition-colors"
                >
                  View Rivalry Stats
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pitch divider */}
      <div className="relative h-px">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </>
  );
}
