"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Search, HelpCircle, Trophy, CheckCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  date: string;
  isDb?: boolean;
  content: string;
  subtitle?: string;
  editor_name?: string;
  reporter_alias?: string;
  tone?: string;
  key_question?: string;
  match_summary?: string;
  accused_moment?: string;
  turning_point?: string;
  closing_verdict?: string;
  player_of_the_match?: string;
  contentSections?: { type: string; content: string; caption?: string }[];
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [post, setPost] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchPost() {
    try {
      setLoading(true);
      
      const { data } = await supabase
        .from("chewvana_articles")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();

      if (data) {
        setPost({
          ...data,
          isDb: true,
          date: data.match_date || data.published_at || data.created_at,
          coverImage: data.cover_image_url
        });
      }
    } catch (err) {
      console.error("Error fetching post:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPost();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center bg-jcc-bg">
        <Loader2 className="w-10 h-10 animate-spin text-jcc-purple opacity-20" />
      </div>
    );
  }

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen pt-28 pb-20 bg-jcc-bg relative overflow-hidden">
      {/* Cinematic Background Layers */}
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-jcc-navy-deep/40 via-transparent to-jcc-navy-deep/60 pointer-events-none z-0" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Newspaper Header Label */}
        <div className="text-center mb-12 border-b-2 border-white/5 pb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-6 py-2 bg-jcc-accent text-black text-[11px] font-black uppercase tracking-[0.2em] mb-6 shadow-xl news-headline"
          >
            Chewvana Times Investigation Desk
          </motion.div>
          
          <div className="flex items-center justify-center gap-8 text-[10px] font-black text-white/60 uppercase tracking-widest">
            <span>Vol. 2025 • Issue 04</span>
            <span className="w-1.5 h-1.5 rounded-full bg-jcc-accent" />
            <span>Jaipur, Rajasthan</span>
            <span className="w-1.5 h-1.5 rounded-full bg-jcc-accent" />
            <span>{new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-10"
        >
          <Link
            href="/chewvana-times"
            className="inline-flex items-center gap-2 text-[11px] text-white/60 hover:text-jcc-accent transition-colors duration-300 group font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Return to Archives
          </Link>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest rounded-sm border border-purple-500/20">
              {post.category}
            </span>
            <span className="px-3 py-1 bg-jcc-accent/10 text-jcc-accent text-[10px] font-black uppercase tracking-widest rounded-sm border border-jcc-accent/20">
              {post.tone || "Sarcastic Investigative Report"}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[1.05] mb-8 news-headline tracking-tight uppercase">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="text-xl md:text-2xl text-white/80 font-medium italic border-l-4 border-jcc-accent pl-6 py-2 mb-10 max-w-2xl font-[var(--font-heading)]">
              {post.subtitle}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/5">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Editor Name</span>
              <p className="text-sm font-black text-white news-headline uppercase italic">{post.editor_name || "Chewvana Desk"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Reporter Alias</span>
              <p className="text-sm font-black text-white news-headline uppercase italic">{post.reporter_alias || "Anonymous Source"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Match Date</span>
              <p className="text-sm font-black text-white news-headline italic">{new Date(post.date).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">Report Status</span>
              <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest">
                <CheckCircle className="w-3.5 h-3.5" /> Filed & Verified
              </p>
            </div>
          </div>
        </motion.div>

        {/* Investigative Blocks (ONLY for DB articles) */}
        {post.isDb && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              className="premium-card p-8 relative overflow-hidden"
            >
              <HelpCircle className="absolute -top-4 -right-4 w-24 h-24 text-jcc-accent/5 rotate-12" />
              <h3 className="text-[11px] font-black text-jcc-accent uppercase tracking-widest mb-4">The Central Question</h3>
              <p className="text-2xl font-black text-white leading-snug news-headline italic">&quot;{post.key_question || "What actually happened out there?"}&quot;</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              className="premium-card p-8 relative overflow-hidden"
            >
              <Search className="absolute -top-4 -right-4 w-24 h-24 text-purple-500/5 -rotate-12" />
              <h3 className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-4">What Actually Happened?</h3>
              <p className="text-sm font-medium text-white/80 leading-relaxed italic">{post.match_summary || "Chaos ensued, as per standard protocol."}</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              className="md:col-span-2 bg-white/5 border border-white/10 backdrop-blur-md text-white p-10 rounded-3xl relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-4">
                <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">
                  Evidence File #42
                </span>
              </div>
              <div className="flex flex-col md:flex-row gap-10 items-center">
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black text-jcc-accent uppercase tracking-widest mb-3">Moment Under Investigation</h3>
                    <p className="text-4xl font-black leading-tight news-headline italic uppercase">&quot;{post.accused_moment || "That one catch that wasn't."}&quot;</p>
                  </div>
                  <div className="flex gap-12 border-t border-white/10 pt-6">
                    <div>
                      <h4 className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Turning Point</h4>
                      <p className="text-base font-black text-jcc-accent news-headline italic uppercase">{post.turning_point || "Undetermined"}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Verdict</h4>
                      <p className="text-base font-black text-white news-headline italic uppercase">{post.closing_verdict || "Vibes only."}</p>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-48 text-center shrink-0 border-l border-white/10 pl-0 md:pl-10">
                  <Trophy className="w-12 h-12 text-jcc-gold mx-auto mb-4" />
                  <h4 className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-2">Player of the Match</h4>
                  <p className="text-2xl font-black text-white news-headline italic uppercase">{post.player_of_the_match || "The Umpire"}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Cover Image */}
        {post.coverImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative h-[300px] sm:h-[500px] rounded-[3rem] overflow-hidden mb-20 border border-white/10 shadow-2xl"
          >
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-jcc-bg via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8">
               <span className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] text-white font-black uppercase tracking-widest border border-white/10">
                  Visual Evidence Archive
               </span>
            </div>
          </motion.div>
        )}

        {/* Article Content */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="markdown-content max-w-3xl mx-auto"
        >
          {post.isDb ? (
            <div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-10">
              {post.contentSections?.map((section, idx: number) => {
                if (section.type === "heading") {
                  return (
                    <h2
                      key={idx}
                      className="text-2xl sm:text-4xl font-black text-white news-headline border-b-4 border-white/5 pb-4 uppercase"
                    >
                      {section.content}
                    </h2>
                  );
                }
                if (section.type === "text") {
                  return (
                    <p
                      key={idx}
                      className="text-lg sm:text-xl text-white/80 leading-[1.8] font-medium"
                    >
                      {section.content}
                    </p>
                  );
                }
                if (section.type === "image") {
                  return (
                    <figure key={idx} className="space-y-4 my-16">
                      <div className="rounded-3xl overflow-hidden border border-white/10 shadow-lg">
                        <img
                          src={section.content}
                          alt={section.caption || post.title}
                          className="w-full h-auto"
                        />
                      </div>
                      {section.caption && (
                        <figcaption className="text-center text-[13px] text-white/40 font-black italic uppercase tracking-widest">
                          Fig {idx+1}: {section.caption}
                        </figcaption>
                      )}
                    </figure>
                  );
                }
                return null;
              })}
            </div>
          )}
        </motion.article>

        {/* Final Footer Label */}
        <div className="mt-32 pt-16 border-t-4 border-double border-white/5 text-center">
            <div className="inline-flex items-center gap-4 mb-8">
               <div className="w-12 h-[2px] bg-white/5" />
               <span className="text-[11px] font-black text-white uppercase tracking-[0.5em]">End of Investigation</span>
               <div className="w-12 h-[2px] bg-white/5" />
            </div>
             <p className="text-[10px] text-white/50 font-black uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                All findings reported here are subject to post-match banter and extreme Sunday morning exaggeration.
             </p>
        </div>
      </div>
      
      <style jsx global>{`
        .news-headline {
          font-family: var(--font-heading);
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .markdown-content h1 { font-family: var(--font-heading); font-size: 3.5rem; font-weight: 900; color: white; margin-bottom: 2rem; line-height: 1.1; letter-spacing: -0.02em; text-transform: uppercase; }
        .markdown-content h2 { font-family: var(--font-heading); font-size: 2.25rem; font-weight: 900; color: white; margin-top: 4rem; margin-bottom: 1.5rem; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 1rem; text-transform: uppercase; }
        .markdown-content h3 { font-family: var(--font-heading); font-size: 1.75rem; font-weight: 900; color: white; margin-top: 3rem; margin-bottom: 1rem; text-transform: uppercase; }
        .markdown-content p { font-family: var(--font-inter), sans-serif; font-size: 1.15rem; color: rgba(255,255,255,0.75); line-height: 1.8; margin-bottom: 1.8rem; font-weight: 500; }
        .markdown-content ul, .markdown-content ol { margin-bottom: 1.5rem; padding-left: 1.5rem; }
        .markdown-content li { margin-bottom: 0.5rem; color: rgba(255,255,255,0.75); font-size: 1.15rem; }
        .markdown-content blockquote { border-left: 6px solid var(--jcc-accent); padding-left: 2rem; font-family: var(--font-heading); font-style: italic; color: white; margin: 3rem 0; font-size: 1.5rem; background: rgba(255,255,255,0.03); padding-top: 2rem; padding-bottom: 2rem; border-radius: 0 1.5rem 1.5rem 0; text-transform: uppercase; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .markdown-content img { border-radius: 2rem; margin: 4rem 0; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4); }
        .markdown-content strong { color: white; font-weight: 900; }
        .markdown-content hr { border: none; height: 1px; background: rgba(255,255,255,0.1); margin: 4rem 0; }
      `}</style>
    </div>
  );
}
