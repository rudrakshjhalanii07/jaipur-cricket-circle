"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import {
  ChevronRight,
  Users,
  CalendarCheck,
  ChevronDown,
  Trophy,
  Calendar,
  Heart,
} from "lucide-react";
import { fadeUp } from "@/lib/animations";

interface HeroStats {
  activePlayers: string;
  sundayGames: string;
  sundaysActive: string;
  communityLove: string;
}

export default function HeroSection({ stats }: { stats: HeroStats }) {
  // Parallax Motion Values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Cache pointer-type check — avoids calling matchMedia on every mousemove.
  const isFinePtrRef = useRef<boolean | null>(null);

  // Smooth springs for lag-free cinematic feel
  const springConfig = { damping: 45, stiffness: 180, mass: 1 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const textX = useTransform(springX, [-0.5, 0.5], ["-8px", "8px"]);
  const textY = useTransform(springY, [-0.5, 0.5], ["-8px", "8px"]);

  const cardX = useTransform(springX, [-0.5, 0.5], ["-14px", "14px"]);
  const cardY = useTransform(springY, [-0.5, 0.5], ["-14px", "14px"]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isFinePtrRef.current === null) {
      isFinePtrRef.current = window.matchMedia("(pointer: fine)").matches;
    }
    if (!isFinePtrRef.current) return;
    // Use viewport-normalised coords instead of getBoundingClientRect() to
    // avoid forcing a layout reflow on every mousemove. Equivalent for a
    // full-width, viewport-height section.
    mouseX.set(e.clientX / window.innerWidth - 0.5);
    mouseY.set(e.clientY / window.innerHeight - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-jcc-navy-deep"
    >
      {/* Flat, solid background — no gradient fades or glow spotlights.
          A thin subtle texture is kept for material feel, not color blending. */}
      <div className="absolute inset-0 dot-pattern opacity-[0.08] pointer-events-none z-0" />

      {/* ============================================================
         CONTENT
         ============================================================ */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 pb-16">
        <motion.div style={{ x: textX, y: textY }} className="text-center max-w-4xl mx-auto">
          {/* Status Badge */}
          <div className="mb-8 hero-enter hero-enter-d1 flex justify-center">
            <div className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-45" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-accent" />
              </span>
              <span className="text-[10px] font-extrabold text-white/80 tracking-[0.25em] uppercase">
                Est. 2026 &middot; Jaipur&apos;s Elite Cricket Community
              </span>
            </div>
          </div>

          {/* LCP element — no animation, paints immediately at full opacity */}
          <h1 className="text-[2.75rem] sm:text-[4.5rem] md:text-[5.5rem] lg:text-[6.5rem] font-black text-white tracking-tighter leading-[0.9] mb-6 uppercase italic">
            Jaipur Cricket
            <br />
            <span className="text-gradient-cyan">Circle</span>
          </h1>

          {/* Tagline */}
          <div className="hero-enter hero-enter-d2 max-w-xl mx-auto">
            <blockquote className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white italic tracking-wide leading-tight">
              &ldquo;Sunday isn&apos;t a day. It&apos;s <span className="text-gradient-cyan">match day</span>.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm font-semibold tracking-wider text-jcc-text-muted uppercase">
              Jaipur&apos;s premier social brotherhood built on weekly competition.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 hero-enter hero-enter-d3">
            <Link
              href="/register"
              className="w-full sm:w-auto btn-vibrant-blue group text-sm font-black relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <CalendarCheck className="w-4.5 h-4.5" />
                REGISTER FOR NEXT MATCH
                <ChevronRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link href="/members" className="w-full sm:w-auto btn-ghost group text-sm font-black">
              <Users className="w-4.5 h-4.5 text-jcc-accent group-hover:text-jcc-blue group-hover:scale-110 transition-transform" />
              VIEW SQUAD
            </Link>
          </div>
        </motion.div>

        {/* ============================================================
           STAT CARDS — navy + white pairing, matching the Rivalry hero motif
           ============================================================ */}
        <motion.div
          style={{ x: cardX, y: cardY }}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="relative z-20 mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto"
        >
          {/* Navy card */}
          <div className="theme-static-dark rounded-2xl p-7 border border-jcc-accent/15" style={{ background: "linear-gradient(160deg, var(--color-jcc-blue) 0%, var(--color-jcc-blue-deep) 100%)" }}>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-jcc-accent">Season Registry</span>
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-jcc-accent" />
                </div>
                <div className="text-3xl font-black text-white">{stats.activePlayers}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-0.5">Active Members</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy className="w-3.5 h-3.5 text-jcc-accent" />
                </div>
                <div className="text-3xl font-black text-white">{stats.sundayGames}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-0.5">Matches Played</div>
              </div>
            </div>
          </div>

          {/* White card */}
          <div className="premium-card rounded-2xl p-7">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-jcc-accent-dark">Community Pulse</span>
            <div className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-jcc-accent-dark" />
                </div>
                <div className="text-3xl font-black text-jcc-blue">{stats.sundaysActive}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mt-0.5">Sundays Active</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Heart className="w-3.5 h-3.5 text-jcc-accent-dark" />
                </div>
                <div className="text-3xl font-black text-jcc-blue">{stats.communityLove}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mt-0.5">Community Love</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bouncing scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20"
      >
        <ChevronDown className="w-4.5 h-4.5 text-jcc-accent animate-bounce" />
      </motion.div>
    </section>
  );
}
