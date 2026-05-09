"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoaderWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const scoreInterval = setInterval(() => {
      setScore((prev) => { if (prev >= 100) { clearInterval(scoreInterval); return 100; } return prev + 2; });
    }, 35);
    const timer = setTimeout(() => setLoading(false), 2400);
    return () => { clearTimeout(timer); clearInterval(scoreInterval); };
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-jcc-bg">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-jcc-blue/[0.08] rounded-full blur-[100px]" />
              <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] bg-jcc-turf/[0.06] rounded-full blur-[80px]" />
            </div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, ease: "backOut" }} className="relative mb-10">
              <div className="animate-ball-bounce">
                <div className="relative w-14 h-14">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 shadow-[0_10px_30px_rgba(255,71,87,0.4)]">
                    <svg viewBox="0 0 56 56" className="absolute inset-0 w-14 h-14 animate-ball-spin">
                      <path d="M 8 28 C 18 18, 38 18, 48 28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                      <path d="M 8 28 C 18 38, 38 38, 48 28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                      {[14, 20, 26, 30, 36, 42].map((x) => (<line key={x} x1={x} y1="22" x2={x} y2="25" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeLinecap="round" />))}
                    </svg>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-2 bg-jcc-navy/[0.1] rounded-full blur-sm" />
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="text-center relative z-10">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-wider font-[var(--font-heading)] text-jcc-navy">JCC</h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }} className="text-[11px] text-jcc-muted mt-2 tracking-[0.35em] uppercase font-bold">Jaipur Cricket Circle</motion.p>
            </motion.div>
            <div className="mt-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-32 h-1 rounded-full bg-jcc-border overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-jcc-blue-deep" />
                </div>
                <motion.span key={score} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} className="text-[10px] font-mono text-jcc-blue-deep w-8 text-right tabular-nums font-bold">{score}%</motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: loading ? 0 : 1 }} transition={{ duration: 0.6, delay: 0.1 }}>{children}</motion.div>
    </>
  );
}
