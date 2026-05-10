"use client";

import { motion } from "framer-motion";
import { Newspaper, Tag, Loader2 } from "lucide-react";
import BlogPreviewCard from "@/components/BlogPreviewCard";
import SectionHeading from "@/components/SectionHeading";
import { BlogPost } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";

export default function ChewvanaTimesPage() {
  const [articles, setArticles] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState("All Stories");

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      // Fetch published articles from Supabase
      const { data, error } = await supabase
        .from("chewvana_articles")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Supabase Fetch Error:", error);
        throw error;
      }

      console.log("Chewvana Articles Fetched:", data);

      if (data) {
        // Map Supabase articles to BlogPost format
        const dbPosts: BlogPost[] = data.map(art => ({
          id: art.id,
          slug: art.slug,
          title: art.title,
          category: art.category,
          excerpt: art.excerpt || art.match_summary || "",
          coverImage: art.cover_image_url || "",
          contentSections: [], // Not needed for preview
          date: art.match_date || art.published_at || art.created_at,
          author: art.reporter_alias || art.editor_name || art.author,
          readTime: "Investigation",
          tags: [art.category]
        }));
        setArticles(dbPosts);
      }
    } catch (err) {
      console.error("Error fetching articles:", err);
    } finally {
      setLoading(false);
    }
  };

  const allTags = ["All Stories", ...Array.from(new Set(articles.flatMap((p) => p.tags)))];
  const filteredArticles = selectedTag === "All Stories" 
    ? articles 
    : articles.filter(p => p.tags.includes(selectedTag));

  return (
    <div className="min-h-screen pt-28 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-6"
          >
            <Newspaper className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
              Weekly Archive & Reports
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="Chewvana Times"
          subtitle="Match reports, deep dives, origin stories, and everything that happens inside the circle."
          accentColor="purple"
        />

        {/* Filters/Tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-16"
        >
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                selectedTag === tag 
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" 
                  : "bg-white/5 text-white/60 border border-white/10 hover:border-purple-400/40 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </motion.div>

        {/* Blog grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-purple-400 opacity-40" />
          </div>
        ) : (
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT_CONFIG}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredArticles.map((post, i) => (
              <BlogPreviewCard key={post.id} post={post} index={i} />
            ))}
          </motion.div>
        )}

        {filteredArticles.length === 0 && !loading && (
            <div className="text-center py-20 premium-card">
                <p className="text-white/40 italic font-black uppercase tracking-widest">No stories found in the archive yet.</p>
            </div>
        )}
      </div>
    </div>
  );
}
