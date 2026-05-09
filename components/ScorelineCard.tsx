"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Trophy } from "lucide-react";

interface ScorelineCardProps { label: string; team1: string; team1Score: number; team1Color: string; team2: string; team2Score: number; team2Color: string; }

function AnimatedNumber({ target, color }: { target: number; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1800;
    const step = duration / target;
    const interval = setInterval(() => { start++; setCount(start); if (start >= target) clearInterval(interval); }, step);
    return () => clearInterval(interval);
  }, [isInView, target]);
  return <span ref={ref} className={`text-5xl sm:text-7xl font-bold score-number ${color} animate-scoreboard-flicker`}>{count}</span>;
}

export default function ScorelineCard({ label, team1, team1Score, team1Color, team2, team2Score, team2Color }: ScorelineCardProps) {
  const leader = team1Score > team2Score ? team1 : team2;
  return (
    <motion.div initial={{ opacity: 0, y: 30, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} whileHover={{ scale: 1.02, transition: { duration: 0.3 } }} className="scoreboard-card p-6 sm:p-8 group cursor-default transition-shadow duration-500">
      <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${leader === team1 ? "via-jcc-blue/30" : "via-jcc-red/30"} to-transparent`} />
      <div className="relative z-10 text-center mb-6">
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-semibold px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.04]">
          <span className={`w-1.5 h-1.5 rounded-full ${leader === team1 ? "bg-jcc-blue" : "bg-jcc-red"} animate-pulse-glow`} />
          {label}
        </span>
      </div>
      <div className="relative z-10 flex items-center justify-center gap-6 sm:gap-10">
        <div className="flex-1 text-center">
          <p className={`text-xs sm:text-sm font-bold mb-3 tracking-wider uppercase ${team1Color}`}>{team1}</p>
          <AnimatedNumber target={team1Score} color={team1Color} />
          {leader === team1 && (<motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5, type: "spring" }} className="flex items-center justify-center gap-1.5 mt-3"><Trophy className="w-3 h-3 text-jcc-gold" /><span className="text-[9px] uppercase tracking-[0.2em] text-jcc-gold font-bold">Leading</span></motion.div>)}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
          <span className="text-[10px] font-bold text-zinc-600 tracking-widest">VS</span>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
        </div>
        <div className="flex-1 text-center">
          <p className={`text-xs sm:text-sm font-bold mb-3 tracking-wider uppercase ${team2Color}`}>{team2}</p>
          <AnimatedNumber target={team2Score} color={team2Color} />
          {leader === team2 && (<motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5, type: "spring" }} className="flex items-center justify-center gap-1.5 mt-3"><Trophy className="w-3 h-3 text-jcc-gold" /><span className="text-[9px] uppercase tracking-[0.2em] text-jcc-gold font-bold">Leading</span></motion.div>)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px animate-shimmer" />
    </motion.div>
  );
}
