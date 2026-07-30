"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper, Loader2, Radio, TrendingUp,
  BookOpen, Zap, ChevronRight, Filter,
} from "lucide-react";
import BlogPreviewCard from "@/components/BlogPreviewCard";
import type { BlogPost } from "@/lib/types";
import { fallbackSeasons, normalizeSeason, seasonScoreline, type SeasonRow } from "@/lib/seasons";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import Link from "next/link";

function NewsTicker() {
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  useEffect(() => {
    async function loadTickerData() {
      try {
        // 1. Fetch latest published articles
        const { data: articlesData } = await supabase
          .from("chewvana_articles")
          .select("title, excerpt, match_summary, category")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(5);

        const sourceArticles = articlesData ?? [];

        // 2. Fetch active season
        const { data: seasonDataDb } = await supabase
          .from("rivalry_seasons")
          .select("*, season_teams(*)")
          .eq("status", "active")
          .limit(1);

        const activeSeason = (seasonDataDb && seasonDataDb.length > 0)
          ? normalizeSeason(seasonDataDb[0] as unknown as SeasonRow)
          : fallbackSeasons.find(s => s.status === "active") || fallbackSeasons[0];

        // 3. Fetch upcoming match
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: matchData } = await supabase
          .from("matches")
          .select("*")
          .in("status", ["open", "closed"])
          .gte("match_date", todayStr)
          .order("match_date", { ascending: true })
          .limit(1);

        const nextMatch = (matchData && matchData.length > 0) ? matchData[0] : null;

        // 4. Construct dynamic ticker items
        const items: string[] = [];

        // Add next match headline if scheduled
        if (nextMatch) {
          const mDate = new Date(nextMatch.match_date).toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          items.push(`🏏 NEXT BATTLE: ${nextMatch.location_name} · ${mDate} @ ${nextMatch.match_time} · REGISTRATION ${nextMatch.status.toUpperCase()}`);
        }

        // Add season update
        if (activeSeason) {
          items.push(`⚡ SEASON UPDATE: ${activeSeason.title} active! Series score: ${seasonScoreline(activeSeason)}`);
        }

        // Add articles excerpts
        sourceArticles.forEach((art: { title: string; excerpt?: string | null; match_summary?: string | null; category?: string | null }) => {
          const excerptText = art.excerpt || art.match_summary || "";
          const articleTitle = art.title;
          const categoryText = art.category ? `[${art.category.toUpperCase()}]` : "NEWS";
          
          if (excerptText) {
            items.push(`📰 ${categoryText}: ${articleTitle} — "${excerptText}"`);
          } else {
            items.push(`📰 ${categoryText}: ${articleTitle}`);
          }
        });

        // Fetch total matches from rivalry_seasons combined
        const { data: seasonsData } = await supabase
          .from("rivalry_seasons")
          .select("total_matches_played");
        const totalMatchesPlayed = seasonsData
          ? seasonsData.reduce((sum: number, s: any) => sum + (s.total_matches_played || 0), 0)
          : 0;

        items.push(`👑 SQUAD STATS: ${totalMatchesPlayed} matches recorded`);
        items.push(`📰 DISPATCH: New dispatch published every Monday post-match`);

        if (items.length > 0) {
          setTickerItems(items);
        }
      } catch (err) {
        console.error("Error loading ticker data:", err);
        const fallbackActiveSeason = fallbackSeasons.find(s => s.status === "active") || fallbackSeasons[0];
        const fallbackItems: string[] = [
          `⚡ SEASON UPDATE: ${fallbackActiveSeason.title} active! Series score: ${seasonScoreline(fallbackActiveSeason)}`,
          `📰 DISPATCH: New dispatch published every Monday post-match`,
        ];
        setTickerItems(fallbackItems);
      }
    }

    loadTickerData();
  }, []);

  const doubled = tickerItems.length > 0 ? [...tickerItems, ...tickerItems] : [];
  return (
    <div
      className="theme-static-dark relative overflow-hidden border-b border-jcc-accent/15"
      style={{ background: "var(--color-jcc-blue)" }}
    >
      <div className="flex items-center" style={{ minHeight: "34px" }}>
        {/* Live tag */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] border-r border-white/10">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-jcc-accent">LATEST ISSUE</span>
        </div>
        {/* Scroll */}
        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker-scroll whitespace-nowrap">
            {doubled.map((item, i) => (
              <span key={i} className="inline-flex items-center px-8 text-[10px] font-bold text-white/50 uppercase tracking-wide gap-3">
                {item}
                <span className="w-px h-3 bg-white/10 inline-block" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category config ───────────────────────────────────────────────────────────
const TAG_CONFIG: Record<string, { icon: React.ReactNode; color: string; active: string }> = {
  "All Stories":    { icon: <Newspaper className="w-3 h-3" />,   color: "border-blue-400/25 text-blue-200/70",   active: "border-jcc-accent bg-jcc-accent/15 text-jcc-accent" },
  "Match Report":   { icon: <Radio className="w-3 h-3" />,       color: "border-blue-400/25 text-blue-200/70",   active: "border-jcc-accent bg-jcc-accent/15 text-jcc-accent" },
  "Analysis":       { icon: <TrendingUp className="w-3 h-3" />,  color: "border-blue-400/25 text-blue-200/70",   active: "border-jcc-green bg-jcc-green/15 text-jcc-green" },
  "Exhibition":     { icon: <Zap className="w-3 h-3" />,         color: "border-blue-400/25 text-blue-200/70",   active: "border-jcc-accent-dark bg-jcc-accent-dark/15 text-jcc-accent-dark" },
  "Origin Story":   { icon: <BookOpen className="w-3 h-3" />,    color: "border-blue-400/25 text-blue-200/70",   active: "border-jcc-gold bg-jcc-gold/15 text-jcc-gold" },
};
const DEFAULT_TAG_CFG = { icon: <ChevronRight className="w-3 h-3" />, color: "border-blue-400/25 text-blue-200/70", active: "border-jcc-accent-dark bg-jcc-accent-dark/15 text-jcc-accent-dark" };

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ total, filtered }: { total: number; filtered: number }) {
  return (
    <div className="flex items-center gap-6 py-3 px-4 rounded-xl border border-jcc-border bg-jcc-navy-light">
      <div className="flex items-center gap-2">
        <span className="text-[22px] font-black text-jcc-accent tabular-nums">{filtered}</span>
        <span className="text-[10px] font-bold text-jcc-blue/40 uppercase tracking-widest leading-tight">
          {filtered === total ? "dispatches" : `of ${total}`}
        </span>
      </div>
      <div className="w-px h-6 bg-jcc-blue/10" />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-jcc-green" />
        <span className="text-[10px] font-black text-jcc-blue/40 uppercase tracking-widest">Archive Online</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BoundaryBanterPage() {
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState("All Stories");

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("chewvana_articles")
          .select("*")
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false });

        if (error) throw error;

        if (data) {
          const dbPosts: BlogPost[] = data.map(art => ({
            id: art.id,
            slug: art.slug,
            title: art.title,
            category: art.category,
            excerpt: art.excerpt || art.match_summary || "",
            coverImage: art.cover_image_url || "",
            contentSections: [],
            date: art.match_date || art.published_at || art.created_at,
            author: art.reporter_alias || art.editor_name || art.author,
            readTime: "Investigation",
            tags: [art.category],
          }));
          setArticles(dbPosts);
        }
      } catch {
        // silently fallback — data stays empty, empty state shown
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const allTags = ["All Stories", ...Array.from(new Set(articles.flatMap(p => p.tags)))].filter(tag => tag !== "Match Report");
  const filtered = selectedTag === "All Stories"
    ? articles
    : articles.filter(p => p.tags.includes(selectedTag));

  return (
    <div className="min-h-screen relative overflow-hidden section-bg-navy">
      {/* Ambient top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[40vh] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.07) 0%, transparent 70%)" }}
      />

      {/* ── Newsroom Masthead ── */}
      <div className="relative z-10 page-top pb-0">
        {/* Live ticker */}
        <NewsTicker />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Newspaper className="w-3.5 h-3.5 text-jcc-accent" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em] text-jcc-accent">
                  The Circle Journal
                </span>
              </div>
              <span className="w-px h-3.5 bg-white/15" />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                  UPDATED MONDAYS
                </span>
              </div>
            </div>

            {/* Masthead title */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
              Boundary{" "}
              <span className="text-gradient-cyan">Banter</span>
            </h1>

            {/* Editorial rule */}
            <div className="editorial-rule my-5 max-w-xs" />

            {/* Sub-headline */}
            <p className="text-white/40 text-base font-medium max-w-xl leading-relaxed italic">
              Where Legends Are Roasted.
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters + Stats bar ── */}
      <div className="theme-static-dark relative z-10 border-t border-white/[0.06]"
        style={{ background: "var(--color-jcc-blue)", backdropFilter: "blur(16px)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter icon */}
            <Filter className="w-3.5 h-3.5 text-blue-300/40 flex-shrink-0" />

            {/* Tag buttons */}
            {allTags.map((tag) => {
              const cfg = TAG_CONFIG[tag] ?? DEFAULT_TAG_CFG;
              const isActive = selectedTag === tag;
              return (
                <motion.button
                  key={tag}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTag(tag)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? cfg.active : cfg.color + " hover:text-white hover:border-white/20"}`}
                >
                  {cfg.icon}
                  {tag}
                </motion.button>
              );
            })}

            {/* Spacer + stats */}
            {articles.length > 0 && (
              <div className="ml-auto">
                <StatsBar total={articles.length} filtered={filtered.length} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Article Grid ── */}
      <div className="relative z-10 py-10 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-28 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-jcc-accent opacity-60" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/30">
                Pulling dispatches…
              </span>
            </div>
          ) : filtered.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTag}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                {/* Featured row — first article larger on desktop */}
                {filtered.length >= 3 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                    {/* Feature card takes 2 columns */}
                    <div className="lg:col-span-2">
                      <BlogPreviewCard post={filtered[0]} index={0} />
                    </div>
                    {/* Second card */}
                    <div>
                      <BlogPreviewCard post={filtered[1]} index={1} />
                    </div>
                  </div>
                ) : null}

                {/* Remaining grid */}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`}>
                  {filtered.slice(filtered.length >= 3 ? 2 : 0).map((post, i) => (
                    <BlogPreviewCard key={post.id} post={post} index={filtered.length >= 3 ? i + 2 : i} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-28 rounded-2xl border border-jcc-border bg-jcc-navy-light"
            >
              <Radio className="w-8 h-8 text-jcc-blue/15 mx-auto mb-4" />
              <p className="text-jcc-blue/30 font-black uppercase tracking-[0.2em] text-sm">
                No dispatches in this category yet.
              </p>
              <button
                onClick={() => setSelectedTag("All Stories")}
                className="mt-4 text-[10px] font-black uppercase tracking-widest text-jcc-accent hover:text-white transition-colors"
              >
                See all stories →
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Back to home CTA ── */}
      <div className="relative z-10 border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/25 hover:text-jcc-accent transition-colors"
          >
            ← Back to JCC Home
          </Link>
        </div>
      </div>
    </div>
  );
}
