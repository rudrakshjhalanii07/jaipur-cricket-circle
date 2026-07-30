"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Trophy,
  Zap,
  Shield,
  X,
} from "lucide-react";

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

interface FloatingMatchButtonProps {
  match: Match | null;
  confirmedCount: number;
  registeredPlayers: Player[];
  stats: { totalMembers: number; matchesPlayed: number };
}

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

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border flex items-center justify-center overflow-hidden transition-colors bg-[#1A1508]/[0.04] border-[#1A1508]/10">
        <span className="text-lg sm:text-2xl font-black tabular-nums text-[#1A1508]">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-black text-[#1A1508]/55">
        {label}
      </span>
    </div>
  );
}

function TeamBadge({ name, color, accent }: { name: string; color: string; accent: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 px-2.5 py-3 rounded-2xl border ${color} bg-[#1A1508]/[0.03] flex-1`}>
      <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center`}>
        <Shield className="w-4.5 h-4.5 text-[#1A1508]" />
      </div>
      <div className="text-center">
        <p className="font-black text-xs uppercase tracking-wide leading-tight text-[#1A1508]">{name}</p>
        <p className="text-[9px] uppercase tracking-widest font-bold mt-0.5 text-[#1A1508]/55">JCC Season 2026</p>
      </div>
    </div>
  );
}

export default function FloatingMatchButton({
  match,
  confirmedCount,
  registeredPlayers,
  stats,
}: FloatingMatchButtonProps) {
  const [open, setOpen] = useState(false);
  const countdown = useCountdown(match ? match.match_date : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const finalPlayerLimit = match?.player_limit || 18;
  const fillPercentage = match ? Math.min((confirmedCount / finalPlayerLimit) * 100, 100) : 0;
  const isFull = match ? confirmedCount >= finalPlayerLimit : false;
  const isClosed = match?.status === "closed";

  return (
    <>
      <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50">
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          whileTap={{ scale: 0.97 }}
          aria-label="View next match details"
          className="theme-static-dark relative flex items-center justify-center rounded-full bg-jcc-blue w-12 h-12 sm:w-14 sm:h-14 shadow-[0_6px_20px_rgba(18,35,63,0.28)] border transition-shadow duration-500 ease-out"
          style={{ borderColor: "color-mix(in srgb, var(--color-jcc-accent) 40%, transparent)" }}
        >
          {match && !isClosed && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-jcc-accent" />
            </span>
          )}
          <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-jcc-accent" />
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-[#12233F]/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border"
              style={{ background: "#F6F2E9", borderColor: "rgba(169,120,36,0.25)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-transparent" />

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#1A1508]/[0.05] border border-[#1A1508]/10 flex items-center justify-center text-[#1A1508]/60 hover:bg-[#1A1508]/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-5 sm:p-8">
                {!match ? (
                  <div className="text-center py-8">
                    <CalendarCheck className="w-9 h-9 text-jcc-accent-dark mx-auto mb-4" />
                    <h3 className="font-black uppercase italic text-2xl text-[#12233F] mb-2">
                      Next Match Coming Soon
                    </h3>
                    <p className="text-sm font-medium text-[#12233F]/60 max-w-sm mx-auto leading-relaxed">
                      The fixture is being set. Hold the date and keep your kit close.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 mb-5 pr-8">
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
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#1A1508] uppercase tracking-tight">
                          Next Match
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 mb-5">
                      <TeamBadge name="Mavericks" color="border-jcc-accent-dark/25" accent="bg-jcc-accent-dark/20" />
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-jcc-accent-dark/20 to-jcc-accent/20 border border-[#1A1508]/10 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-jcc-accent-dark" />
                        </div>
                        <span className="text-[10px] font-black text-[#1A1508]/55 uppercase tracking-widest">vs</span>
                      </div>
                      <TeamBadge name="Neuro Strikers" color="border-jcc-accent/25" accent="bg-jcc-accent/20" />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 mb-5">
                      <div className="col-span-2 sm:col-span-1 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1">
                        <MapPin className="w-3.5 h-3.5 text-jcc-accent-dark flex-shrink-0" />
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-[#1A1508]/55">Venue</p>
                          <p className="text-xs font-bold text-[#1A1508] leading-tight uppercase mt-0.5">{match.location_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1">
                        <Clock className="w-3.5 h-3.5 text-jcc-accent-dark flex-shrink-0" />
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-[#1A1508]/55">Reporting</p>
                          <p className="text-xs font-bold text-[#1A1508] uppercase mt-0.5">{match.match_time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#1A1508]/[0.03] border border-[#1A1508]/[0.08] flex-1">
                        <CalendarCheck className="w-3.5 h-3.5 text-jcc-accent-dark flex-shrink-0" />
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-[#1A1508]/55">Date</p>
                          <p className="text-xs font-bold text-[#1A1508] mt-0.5">
                            {new Date(match.match_date).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-5">
                      <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#1A1508]/55 mb-2">
                        Countdown to Match Day
                      </p>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <CountdownUnit value={countdown.days} label="Days" />
                        <span className="text-lg font-black text-[#1A1508]/35 h-11 sm:h-14 flex items-center">:</span>
                        <CountdownUnit value={countdown.hours} label="Hrs" />
                        <span className="text-lg font-black text-[#1A1508]/35 h-11 sm:h-14 flex items-center">:</span>
                        <CountdownUnit value={countdown.minutes} label="Min" />
                        <span className="text-lg font-black text-[#1A1508]/35 h-11 sm:h-14 flex items-center">:</span>
                        <CountdownUnit value={countdown.seconds} label="Sec" />
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#1A1508]/60">
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
                      <div className="flex items-center mt-3 flex-wrap">
                        <div className="flex items-center pl-2 select-none">
                          {registeredPlayers.slice(0, 8).map((p, i) => (
                            <div
                              key={p.id}
                              className="w-7 h-7 rounded-full bg-gradient-to-br from-jcc-accent-dark/50 to-jcc-accent/40 border-2 flex items-center justify-center text-[9px] font-black text-[#1A1508] uppercase shadow-lg -ml-2 first:ml-0"
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
                        <span className="ml-2.5 text-[10px] text-[#1A1508]/55 font-black uppercase tracking-widest">registered</span>
                      </div>
                    </div>

                    {isClosed ? (
                      <button disabled className="inline-flex items-center gap-2.5 bg-[#1A1508]/[0.04] border border-[#1A1508]/10 text-[#1A1508]/30 text-[12px] font-black w-full justify-center px-5 py-3 rounded-xl cursor-not-allowed uppercase tracking-wider">
                        <CalendarCheck className="w-4 h-4" />
                        Registration Closed
                      </button>
                    ) : (
                      <Link
                        href="/register"
                        onClick={() => setOpen(false)}
                        className="group/btn inline-flex items-center gap-2.5 btn-vibrant-blue text-[12px] font-black w-full justify-center px-5 py-3 rounded-xl"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        {isFull ? "JOIN WAITLIST" : "REGISTER TO PLAY"}
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    )}

                    <p className="mt-4 text-[10px] text-[#1A1508]/45 text-center">
                      {stats.totalMembers}+ active squad · {stats.matchesPlayed}+ matches played
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
