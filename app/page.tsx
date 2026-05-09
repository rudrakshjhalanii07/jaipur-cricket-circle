"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ChevronRight,
  Swords,
  Users,
  Newspaper,
  CalendarCheck,
  TrendingUp,
  Award,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ScorelineCard from "@/components/ScorelineCard";
import BlogPreviewCard from "@/components/BlogPreviewCard";
import SectionHeading from "@/components/SectionHeading";
import { rivalryData, clubStats, BlogPost } from "@/lib/data";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Home() {
  const [latestArticles, setLatestArticles] = useState<BlogPost[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    const fetchLatestArticles = async () => {
      try {
        const { data, error } = await supabase
          .from('chewvana_articles')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(3);

        if (error) throw error;

        if (data) {
          const mapped = data.map(article => ({
            id: article.id,
            slug: article.slug,
            title: article.title,
            category: article.category,
            excerpt: article.excerpt || article.subtitle || "",
            coverImage: article.cover_image_url || "",
            date: article.published_at || article.created_at,
            author: article.author || "Jaipur Cricket Circle",
            readTime: "5 min read",
            tags: [article.category],
            contentSections: []
          }));
          setLatestArticles(mapped);
        }
      } catch (err) {
        console.error("Error fetching articles:", err);
      } finally {
        setLoadingArticles(false);
      }
    };

    fetchLatestArticles();
  }, []);
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden noise-overlay">
        {/* Background Layer */}
        <div className="absolute inset-0 hero-gradient animate-gradient-shift" />
        <div className="absolute inset-0 pitch-lines opacity-20" />
        
        {/* Stadium light effect */}
        <div className="absolute top-0 left-0 right-0 h-1/2 stadium-glow pointer-events-none" />

        {/* Content */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center pt-20"
        >
          {/* Status Badge */}
          <motion.div variants={fadeUp} className="mb-8">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-jcc-border shadow-sm backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-blue opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-blue shadow-sm" />
              </span>
              <span className="text-[10px] font-bold text-jcc-blue-deep tracking-[0.25em] uppercase">
                Est. {clubStats.founded} • Jaipur&apos;s Finest
              </span>
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={fadeUp}
            className="text-6xl sm:text-8xl md:text-9xl font-bold text-jcc-navy font-[var(--font-heading)] tracking-tighter leading-[0.85] mb-8"
          >
            Jaipur
            <br />
            <span className="text-gradient-blue">Cricket</span>
            <br />
            Circle
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={fadeUp}
            className="mt-6 text-jcc-muted text-base sm:text-lg max-w-lg mx-auto leading-relaxed"
          >
            {clubStats.tagline}. A premium brotherhood built on Sunday mornings, competitive spirit, and the love of the game.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="group relative flex items-center gap-2 px-8 py-4 rounded-2xl bg-jcc-turf text-white font-bold text-[14px] shadow-lg shadow-jcc-turf/20 hover:bg-jcc-turf-dim hover:shadow-xl transition-all duration-300"
            >
              Register for Sunday
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/rivalry"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-jcc-border bg-white text-jcc-navy font-bold text-[14px] hover:bg-jcc-bg hover:border-jcc-blue/30 transition-all duration-300"
            >
              <Swords className="w-4 h-4 text-jcc-blue" />
              View Rivalry
            </Link>
          </motion.div>

          {/* Hero Stats */}
          <motion.div
            variants={fadeUp}
            className="mt-20 flex items-center justify-center gap-10 sm:gap-20"
          >
            {[
              { label: "Active Members", value: clubStats.totalMembers + "+", icon: Users },
              { label: "Match History", value: clubStats.matchesPlayed + "+", icon: TrendingUp },
              { label: "Sunday Rituals", value: clubStats.sundaysActive + "+", icon: CalendarCheck },
            ].map((stat) => (
              <div key={stat.label} className="text-center group">
                <stat.icon className="w-5 h-5 text-jcc-blue group-hover:text-jcc-turf transition-colors mx-auto mb-3" />
                <div className="text-2xl sm:text-3xl font-bold text-jcc-navy font-[var(--font-heading)]">
                  {stat.value}
                </div>
                <div className="text-[9px] text-jcc-muted uppercase tracking-[0.2em] mt-1 font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-px h-12 bg-gradient-to-b from-jcc-blue to-transparent opacity-30" />
        </motion.div>
      </section>

      {/* ===== RIVALRY PREVIEW ===== */}
      <section className="py-24 sm:py-32 relative bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <SectionHeading
            title="The Main Event"
            subtitle="Mavericks vs NeuroStrikers — the battle that defines every Sunday."
            accentColor="turf"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <ScorelineCard
              label="The Main Series"
              team1="Mavericks"
              team1Score={rivalryData.mainSeries.mavericks}
              team1Color="text-jcc-blue-deep"
              team2="NeuroStrikers"
              team2Score={rivalryData.mainSeries.neuroStrikers}
              team2Color="text-jcc-red"
            />
            <ScorelineCard
              label="Exhibition Series"
              team1="Mavericks"
              team1Score={rivalryData.exhibitionSeries.mavericks}
              team1Color="text-jcc-blue-deep"
              team2="NeuroStrikers"
              team2Score={rivalryData.exhibitionSeries.neuroStrikers}
              team2Color="text-jcc-red"
            />
          </div>
          <div className="text-center">
            <Link
              href="/rivalry"
              className="inline-flex items-center gap-2 text-jcc-muted hover:text-jcc-blue-deep font-semibold text-[13px] transition-colors group"
            >
              Full Match History & Rivalry Stats
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== LATEST STORIES ===== */}
      <section className="py-24 sm:py-32 bg-jcc-bg relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-blue/10 to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <SectionHeading
            title="Chewvana Times"
            subtitle="Match reports, deep dives, and circle culture."
            accentColor="purple"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingArticles ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-[400px] animate-pulse bg-white/50" />
              ))
            ) : latestArticles.length > 0 ? (
              latestArticles.map((post, i) => (
                <BlogPreviewCard key={post.id} post={post} index={i} />
              ))
            ) : (
              <div className="col-span-full text-center py-20">
                <p className="text-jcc-muted font-bold">No investigations found on the desk.</p>
              </div>
            )}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/chewvana-times"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-jcc-border text-jcc-navy font-bold text-[13px] hover:bg-jcc-bg transition-all duration-300"
            >
              <Newspaper className="w-4 h-4 text-jcc-purple" />
              Visit The Newsroom
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CLUB FEATURES ===== */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "The Circle",
                desc: "Meet the legends of Jaipur Cricket Circle.",
                href: "/members",
                icon: Users,
                color: "text-jcc-blue",
              },
              {
                title: "Next Match",
                desc: "Every Sunday is a new story. Claim your spot.",
                href: "/register",
                icon: CalendarCheck,
                color: "text-jcc-turf",
              },
              {
                title: "Our Story",
                desc: "Five friends, one vision, endless passion.",
                href: "/about",
                icon: Award,
                color: "text-jcc-gold",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={feature.href} className="block h-full group">
                  <div className="glass-card p-8 h-full group-hover:border-jcc-blue/30 transition-all duration-300">
                    <feature.icon className={`w-8 h-8 ${feature.color} mb-6`} />
                    <h3 className="text-xl font-bold text-jcc-navy font-[var(--font-heading)] mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-jcc-muted text-sm leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-32 sm:py-48 relative overflow-hidden text-center">
        <div className="absolute inset-0 bg-jcc-bg" />
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-6xl font-bold text-jcc-navy font-[var(--font-heading)] mb-6 tracking-tight">
              Where Sunday <br />
              Becomes <span className="text-gradient-turf">Legacy</span>
            </h2>
            <p className="text-jcc-muted mb-10 text-[15px] leading-relaxed">
              Every Sunday morning, we lace up and play the game we love. No try-outs, no egos — just cricket and community.
            </p>
            <Link
              href="/register"
              className="px-10 py-4 rounded-2xl bg-jcc-turf text-white font-bold text-[14px] shadow-lg shadow-jcc-turf/20 hover:bg-jcc-turf-dim hover:shadow-xl transition-all duration-300"
            >
              Join The Circle
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
