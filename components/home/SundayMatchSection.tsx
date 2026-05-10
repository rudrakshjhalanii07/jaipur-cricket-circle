"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarCheck,
  MapPin,
  Clock,
  Users,
  Sunrise,
  ChevronRight,
  Flame,
} from "lucide-react";
import { clubStats, registrationData } from "@/lib/data";
import { PitchDivider } from "./CricketDecorations";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function SundayMatchSection() {
  const confirmedCount = registrationData.registeredPlayers.filter(
    (p) => p.status === "confirmed"
  ).length;
  const fillPercentage = Math.min(
    (confirmedCount / registrationData.playerLimit) * 100,
    100
  );

  return (
    <>
      <section id="sunday-match" className="py-24 sm:py-32 relative section-bg-navy overflow-hidden">
        {/* Subtle top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/5" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          {/* Section Label — Structured */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
              <Sunrise className="w-5 h-5" />
              THE SUNDAY RITUAL
            </span>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter mt-6 uppercase italic">
              Sunday is <span className="text-gradient-cyan">Match Day</span>
            </h2>
            <p className="mt-6 text-white/70 text-xl max-w-2xl font-medium leading-relaxed">
              The absolute highlight of our week. Competitive spirit, tactical cricket, and Sunday morning brotherhood.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Match Card — Sharp & Intentional */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.2 }}
              className="lg:col-span-8"
            >
              <div className="premium-card p-8 sm:p-10 relative overflow-hidden">
                {/* Accent border */}
                <div className="absolute top-0 left-0 w-full h-1 bg-jcc-accent" />

                <div className="flex flex-col sm:flex-row sm:items-start gap-8">
                  {/* Date Badge — High Contrast */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10">
                      <span className="text-[11px] uppercase tracking-widest text-jcc-accent font-black">
                        {new Date(registrationData.matchDate).toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span className="text-4xl font-black text-white">
                        {new Date(registrationData.matchDate).getDate()}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                        {registrationData.matchDay}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
                        Sunday Morning Match
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-jcc-text-soft font-bold">
                        <span className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-jcc-accent" />
                          {registrationData.venue}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-jcc-accent" />
                          {registrationData.time}
                        </span>
                      </div>
                    </div>

                    {/* Registration Progress — Clean Tech */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                        <span className="text-jcc-text-muted flex items-center gap-2">
                          <Flame className="w-4 h-4 text-jcc-ball-red" />
                          Players Confirmed
                        </span>
                        <span className="text-white">
                          {confirmedCount} / {registrationData.playerLimit}
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${fillPercentage}%` }}
                          viewport={{ once: false, amount: 0.2 }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-jcc-accent"
                        />
                      </div>
                    </div>

                    {/* CTA — Professional */}
                    <Link
                      href="/register"
                      className="group/btn inline-flex items-center gap-3 px-8 py-4 rounded-xl btn-vibrant-blue text-black font-black text-[13px] transition-all"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      {registrationData.registrationStatus === "full"
                        ? "JOIN WAITLIST"
                        : "REGISTER NOW"}
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Stats Sidebar — Structured */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {[
                {
                  icon: Sunrise,
                  value: `Since ${clubStats.founded}`,
                  label: "Every Sunday",
                  accent: "text-jcc-accent",
                },
                {
                  icon: CalendarCheck,
                  value: `${clubStats.sundaysActive}+`,
                  label: "Sundays Active",
                  accent: "text-jcc-accent",
                },
                {
                  icon: Users,
                  value: `${clubStats.totalMembers}`,
                  label: "Circle Members",
                  accent: "text-jcc-accent",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.2 }}
                  transition={{ delay: i * 0.1 }}
                  className="premium-card p-6 flex items-center gap-5"
                >
                  <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${item.accent}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-white">{item.value}</p>
                    <p className="text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">{item.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PitchDivider />
    </>
  );
}
