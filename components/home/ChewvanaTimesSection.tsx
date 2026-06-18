"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Newspaper, ChevronRight, Clock, Zap, Radio } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { blogPosts, clubStats, registrationData } from "@/lib/data";
import { fallbackRivalrySeasons } from "@/lib/rivalry";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image_url: string;
  category: string;
  published_at: string;
  author_name?: string;
}

function LiveTicker() {
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

        const sourceArticles = (articlesData && articlesData.length > 0) 
          ? articlesData 
          : blogPosts;

        // 2. Fetch active rivalry season
        const { data: rivalryDataDb } = await supabase
          .from("rivalry_seasons")
          .select("*")
          .eq("status", "active")
          .limit(1);

        const activeRivalry = (rivalryDataDb && rivalryDataDb.length > 0)
          ? rivalryDataDb[0]
          : fallbackRivalrySeasons.find(s => s.status === "active") || fallbackRivalrySeasons[0];

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
          items.push(`📍 NEXT BATTLE: ${nextMatch.location_name} · ${mDate} @ ${nextMatch.match_time} · REGISTRATION ${nextMatch.status.toUpperCase()}`);
        } else if (registrationData) {
          items.push(`📍 NEXT BATTLE: ${registrationData.venue} · Sunday 6:00 AM · REGISTRATION ${registrationData.registrationStatus.toUpperCase()}`);
        }

        // Add rivalry update
        if (activeRivalry) {
          items.push(`🏆 RIVALRY UPDATE: ${activeRivalry.title} active! Series score: Mavericks (${activeRivalry.mavericks_main_wins}) - (${activeRivalry.neurostrikers_main_wins}) NeuroStrikers`);
        }

        // Add articles excerpts
        sourceArticles.forEach((art: { title: string; excerpt?: string; match_summary?: string; category?: string }) => {
          const excerptText = art.excerpt || art.match_summary || "";
          const articleTitle = art.title;
          const categoryText = art.category ? `[${art.category.toUpperCase()}]` : "NEWS";
          
          if (excerptText) {
            items.push(`📰 ${categoryText}: ${articleTitle} — "${excerptText}"`);
          } else {
            items.push(`📰 ${categoryText}: ${articleTitle}`);
          }
        });

        // Fetch active players and matches count from rivalry_seasons (all seasons combined)
        const { data: dbPlayers } = await supabase
          .from("players")
          .select("id")
          .eq("approval_status", "approved")
          .eq("is_active", true);

        const { data: rivalrySeasons } = await supabase
          .from("rivalry_seasons")
          .select("total_matches_played");

        const activeCount = dbPlayers ? dbPlayers.length : clubStats.totalMembers;
        const totalMatches = rivalrySeasons
          ? rivalrySeasons.reduce((sum: number, s: any) => sum + (s.total_matches_played || 0), 0)
          : clubStats.matchesPlayed;

        // Add club stats
        if (clubStats) {
          items.push(`⚡ SQUAD STATS: ${totalMatches} matches recorded over ${clubStats.sundaysActive} Sundays active`);
          items.push(`👥 MEMBERSHIP: ${activeCount} players confirmed in the Circle`);
        }

        if (items.length > 0) {
          setTickerItems(items);
        }
      } catch (err) {
        console.error("Error loading ticker data:", err);
        // Fallback using static data only
        const fallbackItems: string[] = [];
        if (registrationData) {
          fallbackItems.push(`📍 NEXT BATTLE: ${registrationData.venue} · Sunday 6:00 AM · REGISTRATION ${registrationData.registrationStatus.toUpperCase()}`);
        }
        
        const fallbackActiveRivalry = fallbackRivalrySeasons.find(s => s.status === "active") || fallbackRivalrySeasons[0];
        if (fallbackActiveRivalry) {
          fallbackItems.push(`🏆 RIVALRY UPDATE: ${fallbackActiveRivalry.title} active! Series score: Mavericks (${fallbackActiveRivalry.mavericks_main_wins}) - (${fallbackActiveRivalry.neurostrikers_main_wins}) NeuroStrikers`);
        }
        
        blogPosts.forEach(bp => {
          fallbackItems.push(`📰 [${bp.category.toUpperCase()}]: ${bp.title} — "${bp.excerpt}"`);
        });

        if (clubStats) {
          fallbackItems.push(`⚡ SQUAD STATS: ${clubStats.matchesPlayed} matches recorded over ${clubStats.sundaysActive} Sundays active`);
        }
        setTickerItems(fallbackItems);
      }
    }

    loadTickerData();
  }, []);

  // Duplicate for seamless loop
  const items = tickerItems.length > 0 ? [...tickerItems, ...tickerItems] : [];
  return (
    <div className="relative overflow-hidden border-y border-white/[0.07]"
      style={{ background: "linear-gradient(90deg, #0C1E30 0%, #07111F 50%, #0C1E30 100%)" }}
    >
      {/* Breaking tag */}
      <div className="flex items-center" style={{ minHeight: "36px" }}>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/[0.05] border-r border-white/10 z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-jcc-accent">LATEST ISSUE</span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker-scroll whitespace-nowrap">
            {items.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-8 text-[11px] font-black text-white/60 uppercase tracking-wide">
                {item}
                <span className="inline-block w-px h-3 bg-white/15 mx-2" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Category badge colours
const CATEGORY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Match Report":    { bg: "bg-jcc-accent/15 border-jcc-accent/30",    text: "text-jcc-accent",     dot: "bg-jcc-accent" },
  "Analysis":        { bg: "bg-jcc-green/15 border-jcc-green/30",       text: "text-jcc-green",      dot: "bg-jcc-green" },
  "Origin Story":    { bg: "bg-jcc-gold/15 border-jcc-gold/30",         text: "text-jcc-gold",       dot: "bg-jcc-gold" },
  "Culture":         { bg: "bg-purple-400/15 border-purple-400/30",     text: "text-purple-400",     dot: "bg-purple-400" },
  "Exhibition":      { bg: "bg-orange-400/15 border-orange-400/30",     text: "text-orange-400",     dot: "bg-orange-400" },
  "default":         { bg: "bg-white/5 border-white/10",                text: "text-white/60",       dot: "bg-white/40" },
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE["default"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${style.bg} ${style.text}`}>
      <span className={`w-1 h-1 rounded-full ${style.dot}`} />
      {category}
    </span>
  );
}

// Breaking news feature card (large)
function FeatureCard({ article }: { article: Article }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Link href={`/chewvana-times/${article.slug}`} className="block">
        <div className="relative rounded-2xl overflow-hidden border border-jcc-ball-red/20 animate-border-pulse hover:border-jcc-ball-red/50 transition-all duration-500"
          style={{ background: "linear-gradient(160deg, #1a0a0a 0%, #07111F 100%)" }}
        >
          {/* Top editorial rule */}
          <div className="editorial-rule" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Image half */}
            <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[340px] overflow-hidden">
              <Image
                src={article.image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80"}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent md:from-transparent to-transparent md:to-[#07111F]" />
              {/* Breaking news badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg animate-breaking-flash text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
                  <Radio className="w-3 h-3" />
                  Breaking
                </span>
                <CategoryBadge category={article.category} />
              </div>
            </div>

            {/* Text half */}
            <div className="flex flex-col justify-center p-8 sm:p-10">
              {/* Dateline — newspaper style */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-jcc-ball-red">
                  CHEWVANA TIMES
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  {new Date(article.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>

              {/* Headline — editorial serif feel */}
              <h3 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-[1.08] mb-5 group-hover:text-jcc-accent transition-colors duration-300"
                style={{ fontFamily: "var(--font-fraunces, var(--font-heading))" }}
              >
                {article.title}
              </h3>

              {/* Deck copy */}
              <p className="text-white/50 text-[15px] font-medium leading-relaxed mb-8 italic line-clamp-3">
                &quot;{article.excerpt}&quot;
              </p>

              {/* CTA */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-jcc-accent group-hover:text-white transition-colors">
                  READ FULL REPORT
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                {article.author_name && (
                  <>
                    <span className="w-px h-4 bg-white/15 hidden min-[350px]:block" />
                    <span className="text-[10px] font-black text-white/25 uppercase tracking-widest">
                      By {article.author_name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Smaller editorial card
function EditorialCard({ article, index }: { article: Article; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group h-full"
    >
      <Link href={`/chewvana-times/${article.slug}`} className="block h-full">
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] h-full flex flex-col hover:border-jcc-accent/30 transition-all duration-400 card-shimmer"
          style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
        >
          {/* Image */}
          <div className="relative aspect-[16/9] overflow-hidden flex-shrink-0">
            <Image
              src={article.image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80"}
              alt={article.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent" />
            <div className="absolute top-3 left-3">
              <CategoryBadge category={article.category} />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col flex-1">
            {/* Dateline */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/25">
                {new Date(article.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Headline */}
            <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-3 line-clamp-2 group-hover:text-jcc-accent transition-colors duration-300">
              {article.title}
            </h3>

            {/* Excerpt */}
            <p className="text-white/40 text-[13px] font-medium leading-relaxed line-clamp-2 flex-1 italic mb-5">
              {article.excerpt}
            </p>

            {/* CTA row */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-widest text-jcc-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                Read More <ChevronRight className="w-3 h-3" />
              </span>
              <Zap className="w-4 h-4 text-jcc-gold opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-jcc-accent via-jcc-green to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </Link>
    </motion.div>
  );
}

// Skeleton loader card
function SkeletonCard({ large = false }: { large?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] animate-pulse overflow-hidden ${large ? "h-[340px]" : "h-[380px]"}`}
      style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
    />
  );
}

export default function ChewvanaTimesSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestArticles() {
      try {
        const { data, error } = await supabase
          .from("chewvana_articles")
          .select("*")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(3);

        if (error) throw error;

        if (data && data.length > 0) {
          setArticles(data.map((art: {
            id: string;
            title: string;
            slug: string;
            excerpt?: string | null;
            match_summary?: string | null;
            cover_image_url?: string | null;
            category: string;
            published_at?: string | null;
            created_at: string;
            reporter_alias?: string | null;
            editor_name?: string | null;
            author?: string | null;
          }) => ({
            id: art.id,
            title: art.title,
            slug: art.slug,
            excerpt: art.excerpt || art.match_summary || "",
            image_url: art.cover_image_url || "",
            category: art.category,
            published_at: art.published_at || art.created_at,
            author_name: art.reporter_alias || art.editor_name || art.author || "Chewvana Desk",
          })));
        } else {
          setArticles(blogPosts.slice(0, 3).map(bp => ({
            id: bp.id,
            title: bp.title,
            slug: bp.slug,
            excerpt: bp.excerpt,
            image_url: bp.coverImage,
            category: bp.category,
            published_at: bp.date,
            author_name: bp.author,
          })));
        }
      } catch {
        setArticles(blogPosts.slice(0, 3).map(bp => ({
          id: bp.id,
          title: bp.title,
          slug: bp.slug,
          excerpt: bp.excerpt,
          image_url: bp.coverImage,
          category: bp.category,
          published_at: bp.date,
          author_name: bp.author,
        })));
      } finally {
        setLoading(false);
      }
    }
    fetchLatestArticles();
  }, []);

  const [featured, ...rest] = articles;

  return (
    <section id="chewvana-times" className="theme-static-dark relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #07111F 0%, #0C1E30 50%, #07111F 100%)" }}
    >
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* ── Newsroom Masthead ── */}
      <div className="relative z-10 pt-20 pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            {/* Masthead label */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-4 h-4 text-jcc-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-jcc-accent">
                  The Circle Journal
                </span>
              </div>
              <span className="w-px h-4 bg-white/15" />
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/40">
                UPDATED MONDAYS
              </span>
            </div>

            {/* Big headline */}
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none mb-4">
              Chewvana{" "}
              <span className="text-gradient-cyan">Times</span>
            </h2>

            {/* Sub-deck */}
            <p className="text-white/40 text-base font-medium max-w-2xl leading-relaxed">
              Unfiltered match reports, tactical dispatches, and editorial investigations from inside the circle.
            </p>
          </motion.div>
        </div>

        {/* ── Live Ticker Strip ── */}
        <LiveTicker />
      </div>

      {/* ── Articles Grid ── */}
      <div className="relative z-10 pt-10 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">

          {loading ? (
            <>
              <SkeletonCard large />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </>
          ) : articles.length > 0 ? (
            <>
              {/* Feature (breaking news) card */}
              {featured && <FeatureCard article={featured} />}

              {/* Secondary editorial cards */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {rest.map((article, i) => (
                    <EditorialCard key={article.id} article={article} index={i} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24 rounded-2xl border border-white/[0.06]"
              style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
            >
              <p className="text-white/25 font-black uppercase tracking-[0.2em] text-sm">
                No dispatches in the archive yet.
              </p>
            </div>
          )}

          {/* ── Archive CTA ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center pt-4"
          >
            <Link
              href="/chewvana-times"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl border border-white/10 bg-white/[0.03] text-white font-black text-[12px] hover:bg-white/[0.07] hover:border-jcc-accent/40 hover:text-jcc-accent transition-all duration-400 uppercase tracking-widest"
            >
              <Newspaper className="w-4 h-4" />
              EXPLORE THE ARCHIVE
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
