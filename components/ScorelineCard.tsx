"use client";

import { motion, useInView } from "framer-motion";
import { Fragment, useRef, useEffect, useState } from "react";
import { Trophy } from "lucide-react";

interface ScorelineCardProps {
  label: string;
  team1: string;
  team1Score: number;
  team1Color: string;
  team1Ties?: number;
  team2: string;
  team2Score: number;
  team2Color: string;
  team2Ties?: number;
  team3?: string;
  team3Score?: number;
  team3Color?: string;
  team3Ties?: number;
  isDark?: boolean;
}

function AnimatedNumber({ target, color, small = false }: { target: number; color: string; small?: boolean }) {
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
      className={`${small ? "text-4xl sm:text-5xl" : "text-5xl sm:text-7xl"} font-bold score-number ${color} animate-scoreboard-flicker`}
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
  team1Ties = 0,
  team2,
  team2Score,
  team2Color,
  team2Ties = 0,
  team3,
  team3Score,
  team3Color,
  team3Ties = 0,
  isDark = false,
}: ScorelineCardProps) {
  const hasThirdTeam = !!team3 && team3Score !== undefined;
  const teams = [
    { name: team1, score: team1Score, color: team1Color, ties: team1Ties },
    { name: team2, score: team2Score, color: team2Color, ties: team2Ties },
    ...(hasThirdTeam ? [{ name: team3, score: team3Score as number, color: team3Color as string, ties: team3Ties }] : []),
  ];
  const maxScore = Math.max(...teams.map((t) => t.score));
  const leaders = teams.filter((t) => t.score === maxScore);
  const isTied = leaders.length > 1;
  const leader = isTied ? null : leaders[0].name;

  const COLOR_VAR: Record<string, string> = {
    "text-jcc-accent": "var(--color-jcc-accent)",
    "text-jcc-ball-red": "var(--color-jcc-ball-red)",
  };
  const resolveColor = (cls: string) =>
    cls.startsWith("text-[") && cls.endsWith("]") ? cls.slice(6, -1) : (COLOR_VAR[cls] ?? "var(--color-jcc-gold)");
  const leaderColor = leader
    ? resolveColor(teams.find((t) => t.name === leader)!.color)
    : "var(--color-jcc-gold)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
      className={`premium-card p-5 sm:p-10 group cursor-default transition-all duration-500 overflow-hidden relative ${isDark ? "theme-static-dark border-jcc-accent/25" : ""}`}
      style={isDark ? { background: "linear-gradient(160deg, var(--color-jcc-blue) 0%, var(--color-jcc-blue-deep) 100%)" } : undefined}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 opacity-40"
        style={{ background: `linear-gradient(to right, transparent, ${leaderColor}, transparent)` }}
      />

      <div className="relative z-10 text-center mb-6 sm:mb-10">
        <span
          className="inline-flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.4em] font-black px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-xl shadow-inner transition-colors bg-white/[0.03] border border-white/5 text-white/40 group-hover:text-white/60"
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: leaderColor, boxShadow: `0 0 10px ${leaderColor}` }}
          />
          {label} {isTied && <span className="ml-1 sm:ml-2 text-jcc-gold opacity-100">— Series Tied</span>}
        </span>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
        {teams.map((t, i) => (
          <Fragment key={t.name}>
            {i > 0 && (
              <div key={`sep-${i}`} className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/[0.15] to-transparent" />
                <span className="text-[12px] font-black tracking-[0.5em] text-white/15 group-hover:text-white/30 transition-colors">
                  VS
                </span>
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/[0.15] to-transparent" />
              </div>
            )}
            <div className="flex-1 text-center min-w-0">
              <p
                className={`${
                  teams.length === 3
                    ? "text-[6.5px] min-[360px]:text-[7.5px] min-[385px]:text-[9px] sm:text-[11px] tracking-tighter sm:tracking-[0.08em]"
                    : "text-[10px] min-[360px]:text-[11px] min-[385px]:text-xs sm:text-base tracking-[0.1em] sm:tracking-[0.2em] sm:group-hover:tracking-[0.25em]"
                } font-black mb-4 uppercase truncate ${t.color} transition-all`}
              >
                {t.name}
              </p>
              <div className="relative inline-block">
                <AnimatedNumber target={t.score} color={t.color} small={teams.length === 3} />
                {leader === t.name && (
                  <div className="absolute inset-0 bg-jcc-accent/20 blur-[40px] opacity-20" />
                )}
                {isTied && (
                  <div className="absolute inset-0 bg-jcc-gold/10 blur-[40px] opacity-10" />
                )}
              </div>
              {t.ties > 0 && (
                <p className="mt-1.5 text-[7px] sm:text-[9px] font-bold uppercase tracking-widest text-white/35">
                  {t.ties} {t.ties === 1 ? "Tie" : "Ties"}
                </p>
              )}
              {leader === t.name && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.5, type: "spring" }}
                  className="flex items-center justify-center gap-2 mt-4"
                >
                  <Trophy className="w-4 h-4 text-jcc-gold drop-shadow-lg" />
                  <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.25em] text-jcc-gold font-black">
                    Leading Series
                  </span>
                </motion.div>
              )}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
  );
}
