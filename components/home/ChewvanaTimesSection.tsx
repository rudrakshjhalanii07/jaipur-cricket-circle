"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Newspaper, ChevronRight, Calendar, Clock, User } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

import { blogPosts } from "@/lib/data";

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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function ChewvanaTimesSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestArticles() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("*")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        
        if (data && data.length > 0) {
          setArticles(data);
        } else {
          // Fallback to static data if no data in DB
          setArticles(blogPosts.slice(0, 3).map(bp => ({
            id: bp.id,
            title: bp.title,
            slug: bp.slug,
            excerpt: bp.excerpt,
            image_url: bp.coverImage,
            category: bp.category,
            published_at: bp.date
          })));
        }
      } catch (err) {
        console.warn("Chewvana: Supabase fetch inactive or failed, using local fallback.");
        // Fallback on error
        setArticles(blogPosts.slice(0, 3).map(bp => ({
          id: bp.id,
          title: bp.title,
          slug: bp.slug,
          excerpt: bp.excerpt,
          image_url: bp.coverImage,
          category: bp.category,
          published_at: bp.date
        })));
      } finally {
        setLoading(false);
      }
    }

    fetchLatestArticles();
  }, []);

  return (
    <section id="chewvana-times" className="py-24 sm:py-32 relative section-bg-ice overflow-hidden">
      {/* Subtle background wash */}
      <div className="absolute inset-0 bg-gradient-to-tr from-jcc-navy/50 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <Newspaper className="w-5 h-5" />
            THE CIRCLE JOURNAL
          </span>
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter mt-6 uppercase italic">
            Chewvana <span className="text-gradient-cyan">Times</span>
          </h2>
          <p className="mt-6 text-white/70 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Unfiltered stories, tactical insights, and investigative match reports from the heart of our community.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="premium-card h-[450px] animate-pulse" />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {articles.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ delay: i * 0.1 }}
                className="premium-card group flex flex-col h-full hover:border-jcc-accent/40 shadow-2xl"
              >
                <div className="relative aspect-[16/11] overflow-hidden rounded-t-2xl">
                  <Image
                    src={article.image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80"}
                    alt={article.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">
                      {article.category}
                    </span>
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 group-hover:text-jcc-accent transition-colors">
                    <Calendar className="w-4 h-4" />
                    {new Date(article.published_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4 line-clamp-2 leading-tight uppercase tracking-tight group-hover:text-white transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-white/60 text-[15px] font-medium line-clamp-3 mb-8 flex-1 leading-relaxed italic">
                    "{article.excerpt}"
                  </p>
                  <Link
                    href={`/chewvana-times/${article.slug}`}
                    className="inline-flex items-center gap-2.5 text-[12px] font-black uppercase tracking-widest text-jcc-accent hover:gap-4 transition-all"
                  >
                    READ INTEL REPORT
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 premium-card bg-white/[0.02]">
            <p className="text-white/30 font-black uppercase tracking-[0.2em]">No operational intelligence found yet.</p>
          </div>
        )}

        <div className="mt-20 text-center">
          <Link
            href="/chewvana-times"
            className="group inline-flex items-center gap-4 px-12 py-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-white font-black text-[14px] hover:bg-white/10 hover:border-jcc-accent shadow-2xl transition-all duration-500 uppercase tracking-widest"
          >
            EXPLORE THE ARCHIVE
            <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
