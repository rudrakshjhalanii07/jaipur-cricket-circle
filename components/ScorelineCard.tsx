"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Trophy } from "lucide-react";

interface ScorelineCardProps {
  label: string;
  team1: string;
  team1Score: number;
  team1Color: string;
  team2: string;
  team2Score: number;
  team2Color: string;
  isDark?: boolean;
}

function AnimatedNumber({ target, color }: { target: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1800;
    const step = Math.max(duration / (target || 1), 50);
    const interval = setInterval(() => {
      if (start < target) {
        start++;
        setCount(start);
      } else {
        clearInterval(interval);
      }
    }, step);
    return () => clearInterval(interval);
  }, [isInView, target]);

  return (
    <span
      ref={ref}
      className={`text-5xl sm:text-7xl font-bold score-number ${color} animate-scoreboard-flicker`}
    >
      {count}
    </span>
  );
}

export default function ScorelineCard({
  label,
  team1,
  team1Score,
  team1Color,
  team2,
  team2Score,
  team2Color,
  isDark = false,
}: ScorelineCardProps) {
  const leader = team1Score > team2Score ? team1 : team2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
      className="premium-card p-8 sm:p-10 group cursor-default transition-all duration-500 shadow-2xl overflow-hidden relative"
    >
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent ${
          leader === team1 ? "via-jcc-accent" : "via-jcc-ball-red"
        } to-transparent opacity-40`}
      />
      
      <div className="relative z-10 text-center mb-10">
        <span
          className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.4em] font-black px-5 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 group-hover:text-white/60 transition-colors shadow-inner"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              leader === team1 ? "bg-jcc-accent shadow-[0_0_10px_#00C2FF]" : "bg-jcc-ball-red shadow-[0_0_10px_#FF4D4D]"
            } animate-pulse`}
          />
          {label}
        </span>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <p
            className={`text-sm sm:text-base font-black mb-4 tracking-[0.2em] uppercase ${team1Color} transition-all group-hover:tracking-[0.25em]`}
          >
            {team1}
          </p>
          <div className="relative inline-block">
            <AnimatedNumber target={team1Score} color={team1Color} />
            {leader === team1 && (
               <div className="absolute inset-0 bg-jcc-accent/20 blur-[40px] opacity-20" />
            )}
          </div>
          {leader === team1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5, type: "spring" }}
              className="flex items-center justify-center gap-2 mt-4"
            >
              <Trophy className="w-4 h-4 text-jcc-gold drop-shadow-lg" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-jcc-gold font-black">
                Leading Series
              </span>
            </motion.div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
          <span
            className="text-[12px] font-black tracking-[0.5em] text-white/10 group-hover:text-white/20 transition-colors"
          >
            VS
          </span>
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
        </div>

        <div className="flex-1 text-center">
          <p
            className={`text-sm sm:text-base font-black mb-4 tracking-[0.2em] uppercase ${team2Color} transition-all group-hover:tracking-[0.25em]`}
          >
            {team2}
          </p>
          <div className="relative inline-block">
            <AnimatedNumber target={team2Score} color={team2Color} />
            {leader === team2 && (
               <div className="absolute inset-0 bg-jcc-ball-red/20 blur-[40px] opacity-20" />
            )}
          </div>
          {leader === team2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.5, type: "spring" }}
              className="flex items-center justify-center gap-2 mt-4"
            >
              <Trophy className="w-4 h-4 text-jcc-gold drop-shadow-lg" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-jcc-gold font-black">
                Leading Series
              </span>
            </motion.div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </motion.div>
  );
}
