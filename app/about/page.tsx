"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Info,
  ChevronRight,
  Users,
  Trophy,
  Calendar,
  Newspaper,
  Heart,
  Target,
  Shield,
  Zap,
  Swords,
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import { clubStats } from "@/lib/data";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 noise-overlay bg-jcc-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-jcc-blue/[0.06] border border-jcc-blue/15 mb-6"
          >
            <Info className="w-3.5 h-3.5 text-jcc-blue-deep" />
            <span className="text-[10px] font-bold text-jcc-blue-deep tracking-[0.25em] uppercase">
              The JCC Origin Story
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="About Jaipur Cricket Circle"
          subtitle="Five friends. One dream. Endless Sundays."
          accentColor="blue"
        />

        {/* Origin Story Card */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="glass-card p-8 sm:p-12 mb-14"
        >
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1 space-y-6 text-[15px] sm:text-lg text-jcc-muted leading-relaxed font-medium">
                <p>
                    {clubStats.mission}
                </p>
                <p>
                    Founded in <span className="text-jcc-navy font-bold">{clubStats.founded}</span> by Opal Chaudhary, Nitin Setia, Sagar Sharma, Abhijeet Singh Shekhawat, and DJ Nitesh, the circle was born from a simple WhatsApp message that resonated with everyone: <span className="italic text-jcc-blue-deep font-bold">&quot;Cricket this Sunday?&quot;</span>
                </p>
                <p>
                    What followed was a movement. Every Sunday, rain or shine, the group grew. Professional scoreboards, match reports, and a deep-seated rivalry soon followed, making JCC the city&apos;s most spirited community.
                </p>
            </div>
            <div className="w-full md:w-1/3 aspect-square rounded-3xl bg-gradient-to-br from-jcc-blue/10 to-jcc-turf/10 border border-jcc-border flex items-center justify-center p-8 shadow-inner">
                <div className="text-center">
                    <span className="text-6xl font-bold text-jcc-navy font-[var(--font-heading)]">100%</span>
                    <p className="text-[10px] uppercase tracking-widest text-jcc-blue-deep font-bold mt-2">Pure Passion</p>
                </div>
            </div>
          </div>
        </motion.div>

        {/* Impact Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-24">
          {[
            { icon: Users, value: clubStats.totalMembers + "+", label: "Active Members", color: "text-jcc-blue-deep" },
            { icon: Trophy, value: clubStats.matchesPlayed + "+", label: "Matches Played", color: "text-jcc-turf" },
            { icon: Calendar, value: clubStats.sundaysActive + "+", label: "Sundays Active", color: "text-jcc-purple" },
            { icon: Heart, value: "∞", label: "Community Love", color: "text-jcc-red" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card p-6 text-center group hover:border-jcc-blue/30 transition-all duration-300"
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-4 group-hover:scale-110 transition-transform opacity-70`} />
              <div className="text-3xl font-bold text-jcc-navy font-[var(--font-heading)]">
                {stat.value}
              </div>
              <div className="text-[9px] text-jcc-muted uppercase tracking-[0.2em] mt-1 font-bold">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Narrative Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8 flex flex-col hover:border-jcc-purple/30 transition-all duration-300"
            >
                <div className="w-12 h-12 rounded-2xl bg-jcc-purple/[0.06] border border-jcc-purple/20 flex items-center justify-center mb-6">
                    <Newspaper className="w-6 h-6 text-jcc-purple" />
                </div>
                <h3 className="text-2xl font-bold text-jcc-navy font-[var(--font-heading)] mb-4">Chewvana Times</h3>
                <p className="text-jcc-muted text-base leading-relaxed flex-1 mb-8 font-medium">
                    {clubStats.chewvanaTimesDescription}
                </p>
                <Link href="/chewvana-times" className="inline-flex items-center gap-2 text-[13px] text-jcc-purple font-bold group">
                    Enter the Newsroom <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8 flex flex-col hover:border-jcc-red/30 transition-all duration-300"
            >
                <div className="w-12 h-12 rounded-2xl bg-jcc-red/[0.06] border border-jcc-red/20 flex items-center justify-center mb-6">
                    <Swords className="w-6 h-6 text-jcc-red" />
                </div>
                <h3 className="text-2xl font-bold text-jcc-navy font-[var(--font-heading)] mb-4">The Rivalry</h3>
                <p className="text-jcc-muted text-base leading-relaxed flex-1 mb-8 font-medium">
                    Mavericks vs NeuroStrikers. It&apos;s more than just a match; it&apos;s a legacy in the making. Every Sunday adds a new chapter to this epic saga.
                </p>
                <Link href="/rivalry" className="inline-flex items-center gap-2 text-[13px] text-jcc-red font-bold group">
                    Explore Match History <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </motion.div>
        </div>

        {/* Values Grid */}
        <SectionHeading
          title="Our Ethos"
          subtitle="What the circle stands for"
          accentColor="blue"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Target, title: "Competitive Spirit", desc: "We play to win, every single Sunday. The rivalry is real, the competition fierce.", color: "text-jcc-blue-deep" },
            { icon: Shield, title: "Sportsmanship", desc: "Respect the game, respect the opponent. We compete hard but play fair.", color: "text-jcc-turf" },
            { icon: Users, title: "Brotherhood", desc: "Beyond the boundary, we're family. The bonds built on this pitch last forever.", color: "text-jcc-blue" },
            { icon: Zap, title: "Consistency", desc: "Rain or shine, summer or winter — we show up. Every. Single. Sunday.", color: "text-jcc-gold" },
            { icon: Heart, title: "Passion", desc: "Cricket isn't just a sport for us. It's the highlight of our week.", color: "text-jcc-red" },
            { icon: Newspaper, title: "Storytelling", desc: "Every match has a story. Chewvana Times ensures none are forgotten.", color: "text-jcc-purple" },
          ].map((value, i) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass-card p-6 group hover:border-jcc-blue/30 transition-all duration-300"
            >
              <value.icon className={`w-5 h-5 ${value.color} mb-4 opacity-60 group-hover:opacity-100 transition-opacity`} />
              <h3 className="text-[15px] font-bold text-jcc-navy mb-2 font-[var(--font-heading)]">{value.title}</h3>
              <p className="text-[13px] text-jcc-muted leading-relaxed font-medium">{value.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
