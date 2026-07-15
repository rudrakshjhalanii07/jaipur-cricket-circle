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

// ─── Data shapes (mirrored from app/page.tsx) ─────────────────────────────────

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

interface SundayMatchSectionProps {
  match: Match | null;
  confirmedCount: number;
  registeredPlayers: Player[];
  stats: { totalMembers: number; matchesPlayed: number };
}

// ─── Animation variants ───────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;

    const calculate = () => {
      const target = new Date(targetDate);
      const now = new Date();
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

function CountdownUnit({ value, label, light = false }: { value: number; label: string; light?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative w-11 h-11 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl border flex items-center justify-center overflow-hidden transition-colors ${
          light
            ? "bg-[#1A1508]/[0.04] border-[#1A1508]/10 group-hover:border-jcc-accent-dark/40"
            : "bg-white/5 border-white/10 group-hover:border-jcc-accent/30"
        }`}
      >
        <span className={`text-lg sm:text-3xl font-black tabular-nums ${light ? "text-[#1A1508]" : "text-white"}`}>
          {String(value).padStart(2, "0")}
        </span>
        <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${light ? "via-jcc-accent-dark/50" : "via-jcc-accent/40"}`} />
      </div>
      <span className={`text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-black ${light ? "text-[#1A1508]/55" : "text-white/55"}`}>{label}</span>
    </div>
  );
}

function TeamBadge({ name, color, accent, light = false }: { name: string; color: string; accent: string; light?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 sm:gap-3 px-2.5 py-3 sm:px-6 sm:py-5 rounded-2xl border ${color} ${light ? "bg-[#1A1508]/[0.03]" : "bg-white/[0.03]"} flex-1`}>
      <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${accent} flex items-center justify-center`}>
        <Shield className={`w-4.5 h-4.5 sm:w-7 sm:h-7 ${light ? "text-[#1A1508]" : "text-white"}`} />
      </div>
      <div className="text-center">
        <p className={`font-black text-xs sm:text-base uppercase tracking-wide leading-tight ${light ? "text-[#1A1508]" : "text-white"}`}>{name}</p>
        <p className={`text-[9px] sm:text-[10px] uppercase tracking-widest font-bold mt-0.5 ${light ? "text-[#1A1508]/55" : "text-white/55"}`}>JCC Season 2026</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SundayMatchSection({
  match,
  confirmedCount,
  registeredPlayers,
  stats,
}: SundayMatchSectionProps) {
  const countdown = useCountdown(match ? match.match_date : null);

  // ── No upcoming match ──────────────────────────────────────────────────────
  if (!match) {
    return (
      <>
        <section
          id="sunday-match"
          className="theme-static-dark py-24 sm:py-32 relative overflow-hidden"
          style={{ background: "#12233F" }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent" />
          <div className="absolute inset-0 dot-pattern opacity-[0.10] pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="mb-14">
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-jcc-accent/70 font-black">
                  NEXT MATCH
                </span>
              </div>
              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic">
                Sunday is <span className="text-jcc-accent">Match Day</span>
              </h2>
            </div>

            <div>
              <div
                className="flex flex-col items-center justify-center px-8 py-12 sm:px-16 sm:py-20 text-center rounded-2xl relative group overflow-hidden"
                style={{
                  background:
                    "radial-gradient(ellipse 160% 140% at 50% -20%, rgba(169,120,36,0.025) 0%, #F6F2E9 65%)",
                  border: "1px solid rgba(169,120,36,0.14)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(169,120,36,0.12), 0 18px 40px -22px rgba(18,35,63,0.16), 0 2px 10px -4px rgba(18,35,63,0.06)",
                }}
              >
                <div className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-jcc-accent-dark/25 transition-colors" />

                {/* Gold-foiled seal */}
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6 -mt-2 relative flex-shrink-0"
                  style={{
                    background: "linear-gradient(160deg, #F6F2E9 0%, #EAE0C8 100%)",
                    border: "1px solid rgba(169,120,36,0.35)",
                    boxShadow:
                      "0 1px 1px rgba(255,255,255,0.7) inset, 0 8px 18px -8px rgba(26,21,8,0.3)",
                  }}
                >
                  <div className="absolute inset-[3px] rounded-full border border-jcc-accent-dark/25" />
                  <CalendarCheck className="w-9 h-9 text-jcc-accent-dark relative z-10" />
                </div>

                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-jcc-accent-dark/70 mb-4">
                  An Invitation Awaits
                </span>

                <h3 className="font-black uppercase italic leading-[0.95] tracking-tight mb-6">
                  <span className="block text-xl sm:text-2xl not-italic text-[#12233F]">Next Sunday</span>
                  <span className="block text-5xl sm:text-6xl text-jcc-accent-dark my-1">Match</span>
                  <span className="block text-xl sm:text-2xl not-italic text-[#12233F]">Coming Soon</span>
                </h3>

                <div className="w-24 h-px bg-jcc-accent-dark/30 mb-6" />

                <p className="text-sm sm:text-base font-medium text-[#12233F]/60 max-w-md leading-relaxed">
                  The fixture is being set. When confirmed, an invitation to register will be
                  extended to the full circle — until then, hold your Sunday and keep your kit close.
                </p>

                <div className="mt-8 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.32em] text-jcc-accent-dark/60">
                  <span>Est. 2026</span>
                  <span className="w-1 h-1 rounded-full bg-jcc-accent-dark/35" />
                  <span>Jaipur Cricket Circle</span>
                  <span className="w-1 h-1 rounded-full bg-jcc-accent-dark/35" />
                  <span>This Sunday</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="relative h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </>
    );
  }

  // ── Upcoming match ─────────────────────────────────────────────────────────
  const finalPlayerLimit = match.player_limit || 18;
  const fillPercentage = Math.min((confirmedCount / finalPlayerLimit) * 100, 100);
  const isFull = confirmedCount >= finalPlayerLimit;
  const isClosed = match.status === "closed";

  return (
    <>
      <section
        id="sunday-match"
        className="theme-static-dark pt-12 pb-24 sm:pt-20 sm:pb-32 relative overflow-hidden"
        style={{ background: "#12233F" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[240px] bg-jcc-accent/[0.04] rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute inset-0 dot-pattern opacity-[0.10] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
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
              Sunday is <span className="text-jcc-accent">Match Day</span>
            </h2>
            <p className="mt-2 sm:mt-4 text-white/50 text-sm sm:text-lg max-w-xl font-medium leading-relaxed">
              Competitive cricket, tactical brilliance, and the brotherhood of Sunday morning.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* MATCH CARD — ivory surface, the site's one deliberate "light card" moment */}
            <motion.div variants={fadeUp} className="lg:col-span-8">
              <div
                className="group relative rounded-2xl border overflow-hidden hover:border-jcc-accent-dark/40 transition-all duration-500"
                style={{ background: "#F6F2E9", borderColor: "rgba(169,120,36,0.25)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-transparent" />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(169,120,36,0.06) 0%, transparent 70%)" }}
                />

                <div className="p-4 sm:p-8">
                  <div className="flex items-start justify-between gap-4 mb-3.5 sm:mb-6 md:mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jcc-danger/10 border border-jcc-danger/25 text-jcc-danger text-[10px] font-black uppercase tracking-widest">
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jcc-accent-dark/10 border border-jcc-accent-dark/25 text-jcc-accent-dark text-[10px] font-black uppercase tracking-widest">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent-dark opacity-60" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-jcc-accent-dark" />
                            </span>
                            {isFull ? "Match Full" : "Registration Open"}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-widest text-[#1A1508]/50 font-black">Main Series</span>
                      </div>
                      <h3 className="text-xl sm:text-3xl font-black text-[#1A1508] uppercase tracking-tight">
                        Next Sunday Match
                      </h3>
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1A1508]/[0.04] border border-[#1A1508]/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-jcc-accent-dark" />
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center gap-1.5 sm:gap-3 mb-3.5 sm:mb-6 md:mb-8">
                    <TeamBadge name="Mavericks" color="border-jcc-accent-dark/25" accent="bg-jcc-accent-dark/20" light />
                    <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-jcc-accent-dark/20 to-jcc-accent/20 border border-[#1A1508]/10 flex items-center justify-center">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-jcc-accent-dark" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-[#1A1508]/55 uppercase tracking-widest">vs</span>
                    </div>
                    <TeamBadge name="Neuro Strikers" color="border-jcc-accent/25" accent="bg-jcc-accent/20" light />
                  </div>

                  {/* Venue & Time */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 mb-3.5 sm:mb-6 md:mb-8">
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1 hover:bg-[#1A1508]/[0.05] transition-colors">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent-dark flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-[#1A1508]/55">Venue</p>
                        <p className="text-xs sm:text-sm font-bold text-[#1A1508] leading-tight uppercase mt-0.5">{match.location_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1 hover:bg-[#1A1508]/[0.05] transition-colors">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent-dark flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-[#1A1508]/55">Reporting Time</p>
                        <p className="text-xs sm:text-sm font-bold text-[#1A1508] uppercase mt-0.5">{match.match_time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1 hover:bg-[#1A1508]/[0.05] transition-colors">
                      <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-jcc-accent-dark flex-shrink-0" />
                      <div>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-[#1A1508]/55">Date</p>
                        <p className="text-xs sm:text-sm font-bold text-[#1A1508] mt-0.5">
                          {new Date(match.match_date).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Countdown */}
                  <div className="mb-3.5 sm:mb-6 md:mb-8">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] font-black text-[#1A1508]/55 mb-2">
                      Countdown to Match Day
                    </p>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <CountdownUnit value={countdown.days} label="Days" light />
                      <span className="text-lg sm:text-2xl font-black text-[#1A1508]/35 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.hours} label="Hrs" light />
                      <span className="text-lg sm:text-2xl font-black text-[#1A1508]/35 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.minutes} label="Min" light />
                      <span className="text-lg sm:text-2xl font-black text-[#1A1508]/35 h-11 sm:h-16 flex items-center">:</span>
                      <CountdownUnit value={countdown.seconds} label="Sec" light />
                    </div>
                  </div>

                  {/* Registration progress */}
                  <div className="mb-3.5 sm:mb-6 md:mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#1A1508]/60">
                        <Users className="w-3.5 h-3.5" />
                        {isClosed ? "Registration Closed" : "Registration"}
                      </span>
                      <div className="flex items-center gap-2">
                        {isClosed ? (
                          <span className="px-2 py-0.5 rounded-full bg-jcc-danger/10 border border-jcc-danger/25 text-jcc-danger text-[9px] font-black uppercase tracking-widest">Closed</span>
                        ) : isFull ? (
                          <span className="px-2 py-0.5 rounded-full bg-jcc-accent-dark/15 border border-jcc-accent-dark/30 text-jcc-accent-dark text-[9px] font-black uppercase tracking-widest">Full</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-jcc-accent-dark/15 border border-jcc-accent-dark/30 text-jcc-accent-dark text-[9px] font-black uppercase tracking-widest animate-pulse">Open</span>
                        )}
                        <span className="text-sm font-black text-[#1A1508]">
                          {confirmedCount}
                          <span className="text-[#1A1508]/55">/{finalPlayerLimit}</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#1A1508]/[0.06] border border-[#1A1508]/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${fillPercentage}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: isClosed
                            ? "rgba(162, 58, 50, 0.5)"
                            : isFull
                            ? "linear-gradient(90deg, #A97824, #D4AF37)"
                            : "linear-gradient(90deg, #A97824, #F2C35D)",
                        }}
                      />
                    </div>
                    {/* Player initials row */}
                    <div className="flex items-center mt-3 sm:mt-4 flex-wrap">
                      <div className="flex items-center pl-2 select-none">
                        {registeredPlayers.slice(0, 8).map((p, i) => (
                          <div
                            key={p.id}
                            className="w-7 h-7 rounded-full bg-gradient-to-br from-jcc-accent-dark/50 to-jcc-accent/40 border-2 flex items-center justify-center text-[9px] font-black text-[#1A1508] uppercase shadow-lg -ml-2 first:ml-0 hover:scale-110 hover:z-20 transition-all duration-200 cursor-default"
                            style={{ zIndex: 10 - i, borderColor: "#F6F2E9" }}
                            title={p.name}
                          >
                            {p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2)}
                          </div>
                        ))}
                        {confirmedCount > 8 && (
                          <div
                            className="w-7 h-7 rounded-full bg-[#1A1508]/10 border-2 flex items-center justify-center text-[9px] font-black text-[#1A1508]/60 -ml-2 shadow-lg relative z-0"
                            style={{ borderColor: "#F6F2E9" }}
                          >
                            +{confirmedCount - 8}
                          </div>
                        )}
                      </div>
                      <span className="ml-2.5 text-[10px] sm:text-[11px] text-[#1A1508]/55 font-black uppercase tracking-widest">registered</span>
                    </div>
                  </div>

                  {/* CTA */}
                  {isClosed ? (
                    <button disabled className="inline-flex items-center gap-2.5 bg-[#1A1508]/[0.04] border border-[#1A1508]/10 text-[#1A1508]/30 text-[12px] sm:text-[13px] font-black w-full sm:w-auto justify-center px-5 py-3 sm:px-6 sm:py-4 rounded-xl cursor-not-allowed uppercase tracking-wider">
                      <CalendarCheck className="w-4 h-4" />
                      Registration Closed
                    </button>
                  ) : (
                    <Link href="/register" className="group/btn inline-flex items-center gap-2.5 btn-vibrant-blue text-[12px] sm:text-[13px] font-black w-full sm:w-auto justify-center px-5 py-3 sm:px-8 sm:py-4 rounded-xl">
                      <CalendarCheck className="w-4 h-4" />
                      {isFull ? "JOIN WAITLIST" : "REGISTER FOR SUNDAY"}
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>

            {/* SIDEBAR */}
            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col gap-4">
              {[
                { Icon: Users, label: "Active Squad", value: `${stats.totalMembers}+`, sub: "registered players", borderColor: "border-jcc-accent/20", glowColor: "from-jcc-accent/10", textColor: "text-jcc-accent" },
                { Icon: Zap, label: "Matches Played", value: `${stats.matchesPlayed}+`, sub: "since season start", borderColor: "border-jcc-accent/20", glowColor: "from-jcc-accent/10", textColor: "text-jcc-accent" },
                { Icon: Flame, label: "Win Streak", value: "3", sub: "matches in a row", borderColor: "border-jcc-accent-dark/20", glowColor: "from-jcc-accent-dark/10", textColor: "text-jcc-accent-dark" },
                { Icon: Trophy, label: "Sundays Strong", value: `${stats.matchesPlayed}+`, sub: "consecutive Sundays", borderColor: "border-jcc-green/20", glowColor: "from-jcc-green/10", textColor: "text-jcc-green" },
              ].map((item, i) => {
                const light = i % 2 === 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.2 }}
                    transition={{ delay: i * 0.08 }}
                    className={`group relative overflow-hidden rounded-2xl border p-5 flex items-center gap-4 cursor-default hover:scale-[1.02] transition-all duration-300 hover:shadow-lg ${
                      light
                        ? "border-jcc-accent-dark/25"
                        : `${item.borderColor} bg-gradient-to-br ${item.glowColor} to-transparent`
                    }`}
                    style={light ? { background: "#F6F2E9" } : undefined}
                  >
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${light ? "bg-[#1A1508]/[0.02]" : "bg-white/[0.02]"}`} />
                    <item.Icon className={`w-7 h-7 flex-shrink-0 ${light ? "text-jcc-accent-dark" : item.textColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-2xl font-black leading-none ${light ? "text-jcc-accent-dark" : item.textColor}`}>{item.value}</div>
                      <div className={`text-[11px] font-black uppercase tracking-widest mt-0.5 ${light ? "text-[#1A1508]/70" : "text-white/70"}`}>{item.label}</div>
                      <div className={`text-[10px] font-medium mt-0.5 ${light ? "text-[#1A1508]/55" : "text-white/55"}`}>{item.sub}</div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Rivalry teaser */}
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
                <Link href="/rivalry" className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-black uppercase tracking-widest text-jcc-ball-red hover:text-white transition-colors">
                  View Rivalry Stats
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="relative h-px">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </>
  );
}
