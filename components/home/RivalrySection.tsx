"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Swords, Zap } from "lucide-react";
import ScorelineCard from "@/components/ScorelineCard";
import { matchHistory } from "@/lib/data";
import { fetchRivalrySeasons, RivalrySeason, fallbackRivalrySeasons } from "@/lib/rivalry";

export default function RivalrySection() {
  const latestMatch = matchHistory[0];
  const [activeSeason, setActiveSeason] = useState<RivalrySeason>(fallbackRivalrySeasons[0]);

  useEffect(() => {
    async function loadActiveSeason() {
      try {
        const seasons = await fetchRivalrySeasons();
        const active = seasons.find((s) => s.status === "active");
        if (active) {
          setActiveSeason(active);
        }
      } catch (err) {
        console.error("Failed to load active rivalry season for homepage:", err);
      }
    }
    loadActiveSeason();
  }, []);

  return (
    <section id="rivalry" className="py-24 sm:py-32 relative overflow-hidden section-bg-navy">
      {/* Cinematic top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />

      {/* Structured Glow — Refined */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-jcc-accent to-transparent opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <Zap className="w-5 h-5 animate-pulse" />
            ACTIVE CAPTAIN RIVALRY
          </span>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter mt-6 uppercase italic">
            Mavericks vs <span className="text-gradient-cyan">NeuroStrikers</span>
          </h2>
          <p className="mt-4 text-white/50 text-[11px] uppercase tracking-widest font-black">
            The {activeSeason.title} — Cap: {activeSeason.mavericks_captain} vs {activeSeason.neurostrikers_captain}
          </p>
          <p className="mt-6 text-white/70 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Every new captain pairing writes its own chapter. Two teams, one circle, pure tactical drama.
          </p>
        </motion.div>

        <div className="relative">
          {/* Central VS Badge — Tech Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ delay: 0.2 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden lg:flex"
          >
            <div className="w-16 h-16 rounded-full bg-jcc-navy-deep border-2 border-jcc-accent/30 shadow-[0_0_30px_rgba(0,194,255,0.2)] flex items-center justify-center">
              <Swords className="w-7 h-7 text-jcc-accent" />
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.6 }}>
              <ScorelineCard label="Main Series Score" team1="Mavericks" team1Score={activeSeason.mavericks_main_wins} team1Color="text-jcc-accent" team2="NeuroStrikers" team2Score={activeSeason.neurostrikers_main_wins} team2Color="text-jcc-ball-red" isDark={true} />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.6 }}>
              <ScorelineCard label="Exhibition Series Score" team1="Mavericks" team1Score={activeSeason.mavericks_exhibition_wins} team1Color="text-jcc-accent" team2="NeuroStrikers" team2Score={activeSeason.neurostrikers_exhibition_wins} team2Color="text-jcc-ball-red" isDark={true} />
            </motion.div>
          </div>
        </div>

        {/* Latest Result Pill — Structured Tech */}
        {latestMatch && (
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ delay: 0.4 }} className="mt-12 flex justify-center">
            <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-jcc-accent">Latest Match</span>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-sm font-bold text-white">
                {latestMatch.team1} <span className="text-jcc-accent">{latestMatch.team1Score}</span> vs {latestMatch.team2} <span className="text-jcc-ball-red">{latestMatch.team2Score}</span>
              </span>
              <div className="w-px h-4 bg-white/20 hidden sm:block" />
              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${latestMatch.winner === "Mavericks" ? "bg-jcc-accent/20 text-jcc-accent" : "bg-jcc-ball-red/20 text-jcc-ball-red"}`}>
                {latestMatch.winner} WON
              </span>
            </div>
          </motion.div>
        )}

        {/* Timeline Refinement */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: false, amount: 0.2 }} transition={{ delay: 0.5 }} className="mt-12 flex items-center justify-center gap-3">
          {matchHistory.slice(0, 10).map((match) => (
            <div
              key={match.id}
              className="w-2.5 h-2.5 rounded-full border border-white/10"
              style={{
                background: match.winner === "Mavericks" ? "var(--jcc-accent)" : match.winner === "NeuroStrikers" ? "var(--jcc-ball-red)" : "rgba(255,255,255,0.2)",
                boxShadow: match.winner === "Mavericks" ? "0 0 10px rgba(0,194,255,0.4)" : match.winner === "NeuroStrikers" ? "0 0 10px rgba(255,77,77,0.4)" : "none",
              }}
              title={`${match.date}: ${match.result}`}
            />
          ))}
        </motion.div>

        <div className="text-center mt-12">
          <Link href="/rivalry" className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white font-black text-[13px] hover:bg-white/10 hover:border-jcc-accent/50 transition-all duration-300">
            <Swords className="w-4 h-4 text-jcc-accent" />
            FULL RIVALRY HISTORY
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
