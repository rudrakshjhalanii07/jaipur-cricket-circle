"use client";

import { motion } from "framer-motion";

interface SectionHeadingProps { title: string; subtitle?: string; align?: "left" | "center"; accentColor?: "blue" | "turf" | "purple" | "gold" | "red"; }
const accentGradients = { 
  blue: "from-jcc-blue via-jcc-blue/50 to-transparent", 
  turf: "from-jcc-turf via-jcc-turf/50 to-transparent", 
  purple: "from-jcc-purple via-jcc-purple/50 to-transparent", 
  gold: "from-jcc-gold via-jcc-gold/50 to-transparent", 
  red: "from-jcc-red via-jcc-red/50 to-transparent" 
};

export default function SectionHeading({ title, subtitle, align = "center", accentColor = "blue" }: SectionHeadingProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className={`mb-12 sm:mb-16 ${align === "center" ? "text-center" : "text-left"}`}>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-jcc-navy font-[var(--font-heading)] tracking-tight">{title}</h2>
      {subtitle && (<p className="mt-3 text-sm sm:text-base text-jcc-muted max-w-xl mx-auto leading-relaxed">{subtitle}</p>)}
      <div className={`mt-5 h-px w-20 bg-gradient-to-r ${accentGradients[accentColor as keyof typeof accentGradients] || accentGradients.blue} ${align === "center" ? "mx-auto" : ""}`} />
    </motion.div>
  );
}
