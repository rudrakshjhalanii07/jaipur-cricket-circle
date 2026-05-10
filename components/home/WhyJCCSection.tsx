"use client";

import { motion } from "framer-motion";
import { Heart, Sun, Swords, Sparkles } from "lucide-react";
import { PitchDivider } from "./CricketDecorations";

const features = [
  {
    icon: Heart,
    title: "Equality on the Pitch",
    description:
      "We leave titles at the boundary. Here, a CEO faces a college student's yorker, and a first-timer can hit the winning six. The pitch is the great equalizer.",
  },
  {
    icon: Sun,
    title: "Every Sunday is Match Day",
    description:
      "Rain or shine, alarm at 5:30 AM, whites on by 6. For 52 Sundays a year, we show up. That consistency isn't discipline — it's love for the game.",
  },
  {
    icon: Swords,
    title: "Two Teams, One Brotherhood",
    description:
      "Mavericks and NeuroStrikers battle fiercely on the pitch. But off it? We're one circle — sharing chai, celebrating centuries, and planning the next Sunday together.",
  },
];

export default function WhyJCCSection() {
  return (
    <>
      <PitchDivider />
      <section id="why-jcc" className="py-24 sm:py-32 relative section-bg-navy overflow-hidden">
        {/* Subtle background wash */}
        <div className="absolute inset-0 bg-gradient-to-r from-jcc-navy/40 to-transparent" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-jcc-accent font-black">
              <Sparkles className="w-4 h-4" />
              WHAT MAKES US DIFFERENT
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mt-4">
              Why JCC Feels <span className="text-gradient-cyan">Different</span>
            </h2>
            <p className="mt-4 text-jcc-text-soft text-lg max-w-xl mx-auto font-medium">
              It&apos;s not just cricket. It&apos;s a premium social brotherhood built on Sunday morning culture.
            </p>
          </motion.div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ delay: i * 0.1 }}
                className="premium-card p-8 group"
              >
                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-jcc-accent/10 group-hover:border-jcc-accent transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-jcc-accent" />
                </div>
                <h3 className="text-xl font-black text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-jcc-text-soft text-sm font-medium leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
