"use client";

import { motion } from "framer-motion";
import { VIEWPORT_CONFIG, fadeUp } from "@/lib/animations";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  accentColor?: "blue" | "turf" | "purple" | "gold" | "red";
  /**
   * Set to true for headings that are visible in the initial viewport.
   * Renders with opacity:1 in SSR HTML (no initial="hidden" invisible state),
   * eliminating the LCP delay caused by whileInView + Framer Motion hydration.
   * Below-fold SectionHeadings should leave this false (default) to keep the
   * scroll-triggered fade-up animation.
   */
  priority?: boolean;
}
const accentGradients = {
  blue: "from-jcc-accent via-jcc-accent/50 to-transparent",
  turf: "from-jcc-green via-jcc-green/50 to-transparent",
  purple: "from-purple-400 via-purple-400/50 to-transparent",
  gold: "from-jcc-gold via-jcc-gold/50 to-transparent",
  red: "from-jcc-ball-red via-jcc-ball-red/50 to-transparent"
};

export default function SectionHeading({ title, subtitle, align = "center", accentColor = "blue", priority = false }: SectionHeadingProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial={priority ? false : "hidden"}
      animate={priority ? "visible" : undefined}
      whileInView={priority ? undefined : "visible"}
      viewport={priority ? undefined : VIEWPORT_CONFIG}
      className={`mb-12 sm:mb-20 ${align === "center" ? "text-center" : "text-left"}`}
    >
      <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white font-[var(--font-heading)] tracking-tighter uppercase leading-[0.9] mb-6">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[14px] sm:text-[16px] text-jcc-text-soft/80 max-w-2xl mx-auto leading-relaxed font-bold uppercase tracking-widest">
          {subtitle}
        </p>
      )}
      <div className={`mt-10 h-1 w-24 rounded-full bg-gradient-to-r ${accentGradients[accentColor as keyof typeof accentGradients] || accentGradients.blue} ${align === "center" ? "mx-auto" : ""}`} />
    </motion.div>
  );
}
