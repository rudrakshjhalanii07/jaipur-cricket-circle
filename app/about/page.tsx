"use client";

import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabase";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function AboutPage() {
  const [stats, setStats] = useState({
    activePlayers: `${clubStats.totalMembers}+`,
    sundayGames: `${clubStats.matchesPlayed}+`,
    sundaysActive: `${clubStats.sundaysActive}+`,
    communityLove: "∞"
  });

  useEffect(() => {
    async function loadDynamicStats() {
      try {
        const { data: dbPlayers, error: playersError } = await supabase
          .from("players")
          .select("id")
          .eq("approval_status", "approved")
          .eq("is_active", true);

        if (playersError) throw playersError;

        const { data: rivalrySeasons } = await supabase
          .from("rivalry_seasons")
          .select("total_matches_played");

        const activeCount = dbPlayers ? dbPlayers.length : 0;
        const totalMatches = rivalrySeasons
          ? rivalrySeasons.reduce((sum: number, s: any) => sum + (s.total_matches_played || 0), 0)
          : 0;

        setStats({
          activePlayers: `${activeCount}+`,
          sundayGames: `${totalMatches}+`,
          sundaysActive: `${clubStats.sundaysActive}+`,
          communityLove: "∞"
        });
      } catch (err) {
        console.error("Error loading dynamic about page stats:", err);
      }
    }
    loadDynamicStats();
  }, []);

  return (
    <div className="min-h-screen pt-28 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-6"
          >
            <Info className="w-3.5 h-3.5 text-jcc-accent" />
            <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
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
          className="premium-card p-8 sm:p-12 mb-14"
        >
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1 space-y-6 text-[15px] sm:text-lg text-white/70 leading-relaxed font-medium">
              <p>
                {clubStats.mission}
              </p>
              <p>
                Founded in <span className="text-white font-black">{clubStats.founded}</span> by Opal Chaudhary, Nitin Setia, Sagar Sharma, Abhijeet Singh Shekhawat, and Nitesh Jhurani, the circle was born from a simple WhatsApp message that resonated with everyone: <span className="italic text-jcc-accent font-black">&quot;Cricket this Sunday?&quot;</span>
              </p>
              <p>
                What followed was a movement. Every Sunday, rain or shine, the group grew. Professional scoreboards, match reports, and a deep-seated rivalry soon followed, making JCC the city&apos;s most spirited community.
              </p>
            </div>
            <div className="w-full md:w-1/3 aspect-square rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center p-8 shadow-inner">
              <div className="text-center">
                <span className="text-6xl font-black text-white font-[var(--font-heading)]">100%</span>
                <p className="text-[10px] uppercase tracking-widest text-jcc-accent font-black mt-2">Pure Passion</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Impact Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-24">
          {[
            { icon: Users, value: stats.activePlayers, label: "Active Members", color: "text-jcc-accent" },
            { icon: Trophy, value: stats.sundayGames, label: "Matches Played", color: "text-emerald-400" },
            { icon: Calendar, value: stats.sundaysActive, label: "Sundays Active", color: "text-purple-400" },
            { icon: Heart, value: stats.communityLove, label: "Community Love", color: "text-jcc-ball-red" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="premium-card p-6 text-center group hover:border-white/20 transition-all duration-300"
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-4 group-hover:scale-110 transition-transform opacity-60`} />
              <div className="text-3xl font-black text-white font-[var(--font-heading)]">
                {stat.value}
              </div>
              <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-1 font-black">
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
            viewport={{ once: false, amount: 0.2 }}
            className="premium-card p-8 flex flex-col hover:border-purple-400/30 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Newspaper className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase mb-4">Chewvana Times</h3>
            <p className="text-white/60 text-base leading-relaxed flex-1 mb-8 font-medium">
              {clubStats.chewvanaTimesDescription}
            </p>
            <Link href="/chewvana-times" className="inline-flex items-center gap-2 text-[11px] text-purple-400 font-black uppercase tracking-widest group">
              Enter the Newsroom <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.2 }}
            className="premium-card p-8 flex flex-col hover:border-jcc-ball-red/30 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-center justify-center mb-6">
              <Swords className="w-6 h-6 text-jcc-ball-red" />
            </div>
            <h3 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase mb-4">The Rivalry</h3>
            <p className="text-white/60 text-base leading-relaxed flex-1 mb-8 font-medium">
              Mavericks vs NeuroStrikers. It&apos;s more than just a match; it&apos;s a legacy in the making. Every Sunday adds a new chapter to this epic saga.
            </p>
            <Link href="/rivalry" className="inline-flex items-center gap-2 text-[11px] text-jcc-ball-red font-black uppercase tracking-widest group">
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
            { icon: Target, title: "Competitive Spirit", desc: "We play to win, every single Sunday. The rivalry is real, the competition fierce.", color: "text-jcc-accent" },
            { icon: Shield, title: "Sportsmanship", desc: "Respect the game, respect the opponent. We compete hard but play fair.", color: "text-emerald-400" },
            { icon: Users, title: "Brotherhood", desc: "Beyond the boundary, we're family. The bonds built on this pitch last forever.", color: "text-jcc-accent" },
            { icon: Zap, title: "Consistency", desc: "Rain or shine, summer or winter — we show up. Every. Single. Sunday.", color: "text-jcc-gold" },
            { icon: Heart, title: "Passion", desc: "Cricket isn't just a sport for us. It's the highlight of our week.", color: "text-jcc-ball-red" },
            { icon: Newspaper, title: "Storytelling", desc: "Every match has a story. Chewvana Times ensures none are forgotten.", color: "text-purple-400" },
          ].map((value, i) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="premium-card p-8 group hover:border-jcc-accent/20 transition-all duration-500"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 group-hover:border-jcc-accent/30 transition-colors">
                <value.icon className={`w-5 h-5 ${value.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
              </div>
              <h3 className="text-[16px] font-black text-white mb-3 font-[var(--font-heading)] uppercase tracking-tight">{value.title}</h3>
              <p className="text-[14px] text-jcc-text-soft/60 leading-relaxed font-bold uppercase tracking-wide text-xs">{value.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
