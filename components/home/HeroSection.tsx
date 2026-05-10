"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ChevronRight,
  Users,
  Newspaper,
  CalendarCheck,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { LightRays, DotGrid, FloatingParticles } from "./CricketDecorations";
import { clubStats } from "@/lib/data";
import { fadeUp, scaleIn, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";

// ---- Hero Cricket Animation (Bat striking Ball) ----
function CricketHeroAnimation() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Large centered cricket scene — high-contrast behind text */}
      <div className="relative w-[600px] h-[500px] sm:w-[800px] sm:h-[600px] lg:w-[1000px] lg:h-[700px] opacity-[0.45]">
        {/* Impact Burst — Cyan & Blue Glows */}
        <div className="absolute top-[38%] left-[48%]">
          <div className="w-40 h-40 sm:w-60 sm:h-60 rounded-full bg-gradient-to-br from-jcc-accent/50 via-jcc-accent/30 to-transparent animate-impact-burst" />
        </div>
        <div className="absolute top-[38%] left-[48%]" style={{ animationDelay: "0.5s" }}>
          <div className="w-28 h-28 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-jcc-accent/40 via-jcc-accent/15 to-transparent animate-impact-burst" style={{ animationDelay: "0.5s" }} />
        </div>
 
        {/* Cricket Bat — vibrant wood tones */}
        <svg
          className="absolute top-[20%] left-[28%] w-[200px] h-[360px] sm:w-[260px] sm:h-[460px] animate-bat-swing"
          viewBox="0 0 120 240"
          fill="none"
        >
          {/* Bat handle */}
          <rect x="52" y="0" width="16" height="90" rx="4" fill="#9B7C2A" opacity="0.9" />
          <rect x="54" y="0" width="12" height="90" rx="3" fill="#B68C10" opacity="0.7" />
          {/* Grip lines */}
          <line x1="54" y1="10" x2="66" y2="10" stroke="#755E0B" strokeWidth="1.5" opacity="0.6" />
          <line x1="54" y1="20" x2="66" y2="20" stroke="#755E0B" strokeWidth="1.5" opacity="0.6" />
          <line x1="54" y1="30" x2="66" y2="30" stroke="#755E0B" strokeWidth="1.5" opacity="0.6" />
          {/* Bat blade */}
          <rect x="35" y="85" width="50" height="140" rx="6" fill="#D4A045" opacity="0.85" />
          <rect x="38" y="88" width="44" height="134" rx="4" fill="#EBB860" opacity="0.6" />
          {/* Blade center stripe */}
          <rect x="55" y="95" width="10" height="120" rx="3" fill="#FFD870" opacity="0.5" />
          {/* Toe */}
          <ellipse cx="60" cy="225" rx="25" ry="8" fill="#C8983C" opacity="0.8" />
        </svg>
 
        {/* Cricket Ball — vibrant red */}
        <div className="absolute top-[32%] left-[48%] animate-ball-fly">
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="url(#heroball)" filter="drop-shadow(0 0 8px rgba(255, 77, 77, 0.4))" />
            <path d="M 8 24 C 16 14, 32 14, 40 24" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" fill="none" />
            <path d="M 8 24 C 16 34, 32 34, 40 24" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" fill="none" />
            {[13, 18, 23, 28, 33].map((x) => (
              <line key={x} x1={x} y1="19" x2={x + 1} y2="21" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            ))}
            <defs>
              <radialGradient id="heroball" cx="35%" cy="35%">
                <stop offset="0%" stopColor="#FF4D4D" />
                <stop offset="100%" stopColor="#A00000" />
              </radialGradient>
            </defs>
          </svg>
        </div>
 
        {/* Speed Lines — High Contrast Cyan */}
        {[
          { top: "35%", left: "50%", width: 140, delay: "0s", color: "rgba(0, 194, 255, 0.7)" },
          { top: "38%", left: "52%", width: 120, delay: "0.15s", color: "rgba(0, 240, 255, 0.5)" },
          { top: "41%", left: "49%", width: 100, delay: "0.3s", color: "rgba(0, 194, 255, 0.4)" },
          { top: "33%", left: "51%", width: 110, delay: "0.1s", color: "rgba(0, 240, 255, 0.6)" },
        ].map((line, i) => (
          <div
            key={i}
            className="absolute h-[2px] rounded-full animate-speed-line"
            style={{
              top: line.top,
              left: line.left,
              width: line.width,
              background: `linear-gradient(90deg, ${line.color}, transparent)`,
              animationDelay: line.delay,
            }}
          />
        ))}
 
        {/* Stumps — bright wood */}
        <svg
          className="absolute top-[45%] right-[10%] w-[60px] h-[120px] animate-stump-shake"
          viewBox="0 0 40 80"
          fill="none"
        >
          <rect x="8" y="10" width="4" height="60" rx="2" fill="#B68C10" opacity="0.7" />
          <rect x="18" y="5" width="4" height="65" rx="2" fill="#D4A045" opacity="0.8" />
          <rect x="28" y="10" width="4" height="60" rx="2" fill="#B68C10" opacity="0.7" />
          {/* Bails */}
          <rect x="9" y="8" width="13" height="3" rx="1.5" fill="#EBB860" opacity="0.8" />
          <rect x="19" y="3" width="13" height="3" rx="1.5" fill="#EBB860" opacity="0.8" />
        </svg>
 
        {/* Turf ground line */}
        <div className="absolute bottom-[15%] left-[5%] right-[5%] h-[4px] rounded-full bg-gradient-to-r from-transparent via-jcc-turf/60 to-transparent" />
      </div>
    </div>
  );
}
 
export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden hero-gradient">
      {/* Cinematic Overlays for Readability */}
      <div className="hero-overlay" />
      <div className="absolute inset-0 stadium-glow opacity-60 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-25 pointer-events-none z-0" />
 
      {/* ---- Cricket Bat & Ball Animation (Layered behind overlay) ---- */}
      <div className="absolute inset-0 z-0 opacity-[0.85]">
        <CricketHeroAnimation />
      </div>
 
      {/* Atmospheric Effects */}
      <LightRays className="z-0 opacity-60" />
      <DotGrid className="z-0 opacity-25" />
      <FloatingParticles className="z-0 opacity-50" count={14} />
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-jcc-bg/5" />
      </div>

      {/* ---- Content ---- */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center pt-24 pb-12"
      >
        {/* Status Badge — Sharp & Restrained */}
        <motion.div variants={fadeUp} className="mb-10">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-accent" />
            </span>
            <span className="text-[10px] font-extrabold text-white/70 tracking-[0.3em] uppercase">
              Est. {clubStats.founded} • Jaipur&apos;s Finest
            </span>
          </div>
        </motion.div>

        {/* Main Title — Ultra-bold Cinematic */}
        <motion.h1
          variants={scaleIn}
          className="text-[3.5rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[8.5rem] font-black text-white font-[var(--font-heading)] tracking-[-0.04em] leading-[0.85] mb-6"
        >
          <span className="block">Jaipur</span>
          <span className="block text-gradient-cyan">Cricket</span>
          <span className="block">Circle</span>
        </motion.h1>

        {/* Tagline — Readable & Clean */}
        <motion.p
          variants={fadeUp}
          className="mt-8 text-white/70 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium"
        >
          Where Sunday cricket becomes a{" "}
          <span className="text-white font-bold">culture</span>. A premium
          social brotherhood built on competition and the love of the game.
        </motion.p>

        {/* CTA Buttons — High-end Sports Tech */}
        <motion.div
          variants={fadeUp}
          className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="btn-vibrant-blue group text-[14px]"
          >
            <CalendarCheck className="w-4 h-4" />
            REGISTER FOR SUNDAY
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/members"
            className="btn-ghost group text-[14px]"
          >
            <Users className="w-4 h-4 text-jcc-accent" />
            VIEW MEMBERS
          </Link>
        </motion.div>

        {/* Hero Stats Strip — Structured */}
        <motion.div
          variants={fadeUp}
          className="mt-20 sm:mt-24 inline-flex items-center gap-3 flex-wrap justify-center"
        >
          {[
            { label: "Active Members", value: clubStats.totalMembers + "+", icon: Users },
            { label: "Matches Played", value: clubStats.matchesPlayed + "+", icon: TrendingUp },
            { label: "Sundays Strong", value: clubStats.sundaysActive + "+", icon: CalendarCheck },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 transition-colors cursor-default">
              <stat.icon className="w-4 h-4 text-jcc-accent" />
              <span className="text-sm font-bold text-white">{stat.value}</span>
              <span className="text-[10px] uppercase tracking-widest font-black hidden sm:inline">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
      >
        <ChevronDown className="w-4 h-4 text-jcc-accent animate-bounce" />
      </motion.div>
    </section>
  );
}
