"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";

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
      className="jcc-luxury-hero relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-jcc-navy-deep"
    >
      <div className="luxury-hero-rays absolute inset-0 pointer-events-none z-0" />
      <div className="luxury-hero-dust absolute inset-0 pointer-events-none z-0" />

      {/* ============================================================
         CONTENT
         ============================================================ */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 page-top pb-16">
        <motion.div style={{ x: textX, y: textY }} className="text-center max-w-4xl mx-auto">
          {/* Tagline */}
          <div className="hero-enter hero-enter-d2 max-w-xl mx-auto mb-6">
            <blockquote className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white italic tracking-wide leading-tight">
              India&apos;s most loved box cricket community.
            </blockquote>
          </div>

          {/* LCP element — no animation, paints immediately at full opacity */}
          <h1 className="text-[2.75rem] sm:text-[4.5rem] md:text-[5.5rem] lg:text-[6.5rem] font-black text-white tracking-tighter leading-[0.9] mb-6 uppercase italic">
            Jaipur Cricket
            <br />
            <span className="text-gradient-cyan">Circle</span>
          </h1>

          <p className="hero-enter hero-enter-d2 max-w-xl mx-auto text-sm font-semibold tracking-wider text-jcc-text-muted uppercase">
            Play. Connect. Thrive.
          </p>

          {/* CTA Button */}
          <div className="mt-10 sm:mt-12 flex items-center justify-center hero-enter hero-enter-d3">
            <Link
              href="/profile"
              className="w-full sm:w-auto btn-vibrant-blue group text-sm font-black relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Become a Member
                <ChevronRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>

          {/* Stat strip — fills the dead air below the CTA with proof points */}
          <div className="hero-enter hero-enter-d4 mt-10 sm:mt-12 grid grid-cols-4 gap-3 sm:gap-6 max-w-xl mx-auto border-t border-jcc-border pt-6">
            {[
              { value: stats.activePlayers, label: "Players" },
              { value: stats.sundayGames, label: "Sunday Games" },
              { value: stats.sundaysActive, label: "Weekends Active" },
              { value: stats.communityLove, label: "Community Love" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-xl sm:text-2xl md:text-3xl font-black text-white">
                  {stat.value}
                </p>
                <p className="mt-1 text-[9px] sm:text-[10px] uppercase tracking-[0.12em] font-bold text-jcc-text-muted leading-tight">
                  {stat.label}
                </p>
              </div>
            ))}
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
