"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Trophy, UserPlus, RefreshCw } from "lucide-react";
import { SMOOTH_EASE, fadeUp, scaleIn, staggerContainer } from "@/lib/animations";

export default function NotFound() {
  const [isHit, setIsHit] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);

  // Trigger the bowling animation shortly after mounting
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHit(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [triggerCount]);

  const handleResetAnimation = () => {
    setIsHit(false);
    // Tiny delay before starting the next animation to allow the reset state to take effect
    setTimeout(() => {
      setTriggerCount((prev) => prev + 1);
    }, 100);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start page-top pb-20 overflow-hidden px-4 sm:px-6 lg:px-8 bg-jcc-bg">
      {/* Stadium ambient light effect */}
      <div className="stadium-glow opacity-60 pointer-events-none" />
      
      {/* Interactive lighting sweeps */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-jcc-accent/10 rounded-full blur-[120px] animate-stadium-sweep-left" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-jcc-accent/5 rounded-full blur-[120px] animate-stadium-sweep-right" />
        
        {/* Subtle glowing ray lines */}
        <div className="light-ray left-1/3 bg-gradient-to-b from-jcc-accent/20 to-transparent h-full w-[2px] opacity-20" />
        <div className="light-ray left-2/3 bg-gradient-to-b from-jcc-accent/20 to-transparent h-full w-[2px] opacity-20" style={{ animationDelay: "4s" }} />
      </div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 dot-pattern opacity-[0.06] pointer-events-none" />
      <div className="absolute inset-0 noise-overlay opacity-[0.04] pointer-events-none" />

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center"
      >
        {/* Flag Tag */}
        <motion.div 
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-jcc-ball-red/20 bg-jcc-ball-red/5 backdrop-blur-md mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-jcc-ball-red animate-live-blink" />
          <span className="text-[10px] font-black uppercase tracking-widest text-jcc-ball-red">CREASE VIOLATION — OUT!</span>
        </motion.div>

        {/* Big Bold Headline */}
        <motion.h1 
          variants={fadeUp}
          className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-4 leading-none uppercase"
        >
          CLEAN <span className="text-gradient-red">BOWLED!</span>
        </motion.h1>

        {/* Sports Scoreboard Decision Container */}
        <motion.div
          variants={scaleIn}
          className="w-full max-w-md bg-jcc-navy/60 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden card-shimmer"
        >
          {/* Neon digital screen headers */}
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5 pb-3 mb-4">
            <span>DECISION SYSTEM</span>
            <span className="text-jcc-accent">DRS v1.0</span>
          </div>

          <div className="space-y-4">
            {/* Blinking decision light box */}
            <div className="theme-static-dark bg-[#050E17] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[90px]">
              <AnimatePresence mode="wait">
                {isHit ? (
                  <motion.div
                    key="decision-out"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-4xl md:text-5xl font-black text-jcc-ball-red tracking-wider font-[var(--font-heading)] animate-pulse">
                      OUT
                    </span>
                    <span className="text-[9px] font-black tracking-widest text-white/50 uppercase mt-1">
                      Wickets Broken
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="decision-checking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-xl md:text-2xl font-black text-jcc-gold tracking-widest font-[var(--font-heading)] uppercase animate-pulse">
                      CHECKING...
                    </span>
                    <span className="text-[9px] font-black tracking-widest text-white/40 uppercase mt-1">
                      Analyzing Crease
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scorecard data row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[8px] font-bold text-white/40 uppercase tracking-wider mb-0.5">Decision</div>
                <div className="text-xs font-black text-white font-mono uppercase">DRS OUT</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[8px] font-bold text-white/40 uppercase tracking-wider mb-0.5">Error Code</div>
                <div className="text-xs font-black text-jcc-accent font-mono">404</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="text-[8px] font-bold text-white/40 uppercase tracking-wider mb-0.5">Delivery</div>
                <div className="text-xs font-black text-jcc-green font-mono">148.5 KMH</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Stumps and Ball SVG Container */}
        <motion.div 
          variants={fadeUp}
          className="relative w-full max-w-sm h-52 bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-center mb-8 backdrop-blur-sm group hover:border-jcc-accent/20 transition-colors duration-300"
        >
          {/* Interactive replay button floating inside */}
          <button 
            onClick={handleResetAnimation}
            className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-all border border-white/5 hover:border-white/10 z-20 group-hover:scale-105 active:scale-95"
            title="Bowl again"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!isHit ? "animate-spin" : ""}`} />
          </button>

          <svg 
            width="280" 
            height="160" 
            viewBox="0 0 280 160" 
            className="overflow-visible select-none"
          >
            <defs>
              {/* Ball glowing red filter */}
              <filter id="ball-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              
              {/* Cyber stump glowing cyan filter */}
              <filter id="cyber-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Crease line (crease marking) */}
            <line x1="20" y1="140" x2="260" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />
            <text x="35" y="152" fill="rgba(255,255,255,0.25)" className="text-[8px] font-black uppercase tracking-widest font-mono">POPPING CREASE</text>

            {/* Wickets & Stumps with Framer Motion animations */}
            
            {/* Left Stump */}
            <motion.rect
              width="8"
              height="80"
              rx="3"
              fill="#14B8FF"
              filter="url(#cyber-glow)"
              style={{ originX: "114px", originY: "140px" }}
              animate={isHit ? {
                x: 110,
                y: 60,
                rotate: -22,
                opacity: 0.9,
              } : {
                x: 110,
                y: 60,
                rotate: 0,
                opacity: 0.8,
              }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
            />

            {/* Middle Stump (Direct impact) */}
            <motion.rect
              width="8"
              height="80"
              rx="3"
              fill="#14B8FF"
              filter="url(#cyber-glow)"
              style={{ originX: "136px", originY: "140px" }}
              animate={isHit ? {
                x: 136,
                y: 64,
                rotate: 8,
                opacity: 0.9,
              } : {
                x: 136,
                y: 60,
                rotate: 0,
                opacity: 0.8,
              }}
              transition={{ type: "spring", stiffness: 150, damping: 10 }}
            />

            {/* Right Stump */}
            <motion.rect
              width="8"
              height="80"
              rx="3"
              fill="#14B8FF"
              filter="url(#cyber-glow)"
              style={{ originX: "162px", originY: "140px" }}
              animate={isHit ? {
                x: 162,
                y: 60,
                rotate: 26,
                opacity: 0.9,
              } : {
                x: 162,
                y: 60,
                rotate: 0,
                opacity: 0.8,
              }}
              transition={{ type: "spring", stiffness: 100, damping: 12 }}
            />

            {/* Bails */}
            {/* Left Bail */}
            <motion.rect
              width="26"
              height="4"
              rx="1"
              fill="#FFD700"
              animate={isHit ? {
                x: 95,
                y: 10,
                rotate: -130,
                opacity: 0,
              } : {
                x: 111,
                y: 56,
                rotate: 0,
                opacity: 1,
              }}
              transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            />

            {/* Right Bail */}
            <motion.rect
              width="26"
              height="4"
              rx="1"
              fill="#FFD700"
              animate={isHit ? {
                x: 185,
                y: 20,
                rotate: 150,
                opacity: 0,
              } : {
                x: 137,
                y: 56,
                rotate: 0,
                opacity: 1,
              }}
              transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            />

            {/* Glowing Ball */}
            <motion.circle
              r="9"
              fill="#FF4D4D"
              filter="url(#ball-glow)"
              animate={isHit ? {
                cx: [10, 140, 195],
                cy: [140, 68, 40],
                opacity: [0, 1, 0],
              } : {
                cx: 10,
                cy: 140,
                opacity: 0,
              }}
              transition={{ 
                duration: 0.8, 
                times: [0, 0.6, 1],
                ease: "easeOut"
              }}
            />

            {/* Ground Stand */}
            <rect x="94" y="139" width="92" height="4" fill="rgba(255,255,255,0.1)" rx="2" />
          </svg>
        </motion.div>

        {/* Interactive instruction caption */}
        <motion.div
          variants={fadeUp}
          className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-jcc-accent animate-pulse" />
          <span>{isHit ? "Click the refresh icon on the card to bowl again" : "Preparing delivery..."}</span>
        </motion.div>

        {/* Dynamic fun warning copy */}
        <motion.p 
          variants={fadeUp}
          className="text-base sm:text-lg text-jcc-text-muted max-w-lg mb-10 leading-relaxed"
        >
          Howzat! You&rsquo;ve wandered way outside the crease, and the bails are off. This page is not in our playbook and has been retired back to the pavilion.
        </motion.p>

        {/* Action Button Navigation Pathways */}
        <motion.div 
          variants={fadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4"
        >
          <Link href="/" className="btn-vibrant-blue w-full sm:w-auto min-w-[200px]">
            <Home className="w-4 h-4" />
            <span>Return to Crease</span>
          </Link>
          
          <Link href="/rivalry" className="btn-ghost w-full sm:w-auto min-w-[200px]">
            <Trophy className="w-4 h-4" />
            <span>Rivalry Hub</span>
          </Link>
          
          <Link href="/register" className="btn-ghost w-full sm:w-auto min-w-[200px]">
            <UserPlus className="w-4 h-4" />
            <span>Register Now</span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
