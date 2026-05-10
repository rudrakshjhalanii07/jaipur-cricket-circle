"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Sparkles, BookOpen } from "lucide-react";
import {
  FloatingCricketBall,
  FloatingParticles,
} from "./CricketDecorations";

export default function FinalCTASection() {
  return (
    <section id="final-cta" className="py-32 sm:py-48 relative overflow-hidden text-center section-bg-navy">
      {/* Cinematic Overlays */}
      <div className="hero-overlay opacity-60" />
      <div className="absolute inset-0 stadium-glow opacity-30 pointer-events-none" />

      {/* Floating decorations — Subdued */}
      <FloatingCricketBall
        size={56}
        className="absolute top-[15%] left-[5%] opacity-10 hidden lg:block"
        delay={0.2}
      />
      <FloatingCricketBall
        size={40}
        className="absolute bottom-[20%] right-[8%] opacity-10 hidden lg:block"
        delay={0.5}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Structured Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-jcc-accent font-black">
              <Sparkles className="w-4 h-4" />
              JOIN THE MOVEMENT
            </span>
          </motion.div>

          <h2 className="text-5xl sm:text-6xl lg:text-8xl font-black text-white tracking-tight leading-[0.9] mb-8">
            Where Sunday
            <br />
            Becomes <span className="text-gradient-cyan">Legacy</span>
          </h2>

          <p className="text-white/60 text-lg sm:text-xl font-medium max-w-xl mx-auto mb-14 leading-relaxed">
            Every Sunday morning, we lace up and play the game we love. No egos — just cricket, community, and the joy of showing up.
          </p>

          {/* Two CTA buttons — Cinematic Sports Tech */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              href="/register"
              className="btn-vibrant-blue group text-[15px]"
            >
              BECOME A MEMBER
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/about"
              className="btn-ghost group text-[15px]"
            >
              <BookOpen className="w-5 h-5 text-jcc-accent" />
              OUR STORY
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
