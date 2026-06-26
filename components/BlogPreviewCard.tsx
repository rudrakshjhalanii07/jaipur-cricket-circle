"use client";

import { motion } from "framer-motion";
import { Clock, ArrowUpRight, Radio } from "lucide-react";
import Link from "next/link";
import type { BlogPost } from "@/lib/types";

// Category colour map
const CAT: Record<string, { border: string; text: string; dot: string }> = {
  "Match Report":  { border: "border-jcc-accent/40",    text: "text-jcc-accent",   dot: "bg-jcc-accent" },
  "Analysis":      { border: "border-jcc-green/40",     text: "text-jcc-green",    dot: "bg-jcc-green" },
  "Origin Story":  { border: "border-jcc-gold/40",      text: "text-jcc-gold",     dot: "bg-jcc-gold" },
  "Culture":       { border: "border-purple-400/40",    text: "text-purple-400",   dot: "bg-purple-400" },
  "Exhibition":    { border: "border-orange-400/40",    text: "text-orange-400",   dot: "bg-orange-400" },
  "default":       { border: "border-white/10",         text: "text-white/50",     dot: "bg-white/30" },
};

// Cover image accent gradients matched to index (editorial colour theory)
const ACCENTS = [
  "from-jcc-accent/20 via-transparent to-jcc-green/10",
  "from-jcc-gold/20 via-transparent to-jcc-ball-red/10",
  "from-purple-400/20 via-transparent to-jcc-accent/10",
  "from-jcc-green/20 via-transparent to-jcc-gold/10",
  "from-jcc-ball-red/15 via-transparent to-purple-400/10",
  "from-jcc-accent/15 via-transparent to-orange-400/10",
];

export default function BlogPreviewCard({ post, index }: { post: BlogPost; index: number }) {
  const cat    = CAT[post.category] ?? CAT["default"];
  const accent = ACCENTS[index % ACCENTS.length];
  const isFirst = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15 }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Link href={`/chewvana-times/${post.slug}`} className="block h-full group">
        <article
          className={`theme-static-dark relative h-full flex flex-col rounded-2xl overflow-hidden border transition-all duration-400 ${cat.border} hover:border-opacity-80`}
          style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
        >

          {/* ── Cover image / gradient ── */}
          <div className={`relative overflow-hidden flex-shrink-0 ${isFirst ? "h-52" : "h-36"}`}>
            {post.coverImage ? (
              <img
                src={post.coverImage}
                alt={post.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
            )}
            {/* Vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-[#07111F]/30 to-transparent" />

            {/* Category badge — top left */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              {isFirst && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-jcc-ball-red text-white text-[8px] font-black uppercase tracking-widest shadow-md">
                  <Radio className="w-2.5 h-2.5" />
                  Feature
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest bg-black/60 backdrop-blur-sm ${cat.border} ${cat.text}`}>
                <span className={`w-1 h-1 rounded-full ${cat.dot}`} />
                {post.category}
              </span>
            </div>

            {/* Read arrow — top right on hover */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
              <div className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15">
                <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          {/* ── Editorial content ── */}
          <div className="flex flex-col flex-1 p-5">

            {/* Dateline */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-jcc-ball-red">
                CHEWVANA TIMES
              </span>
              <span className="w-px h-2.5 bg-white/15" />
              <span className="flex items-center gap-1 text-[8px] text-white/25 font-bold uppercase tracking-wider">
                <Clock className="w-2.5 h-2.5" />
                {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Headline */}
            <h3
              className={`font-black text-white group-hover:text-jcc-accent transition-colors duration-300 uppercase tracking-tight leading-tight mb-3 ${isFirst ? "text-2xl line-clamp-2" : "text-lg line-clamp-2"}`}
              style={{ fontFamily: "var(--font-fraunces, var(--font-heading))" }}
            >
              {post.title}
            </h3>

            {/* Excerpt */}
            <p className="text-white/40 text-[13px] leading-relaxed line-clamp-2 flex-1 italic font-medium mb-4">
              {post.excerpt}
            </p>

            {/* Footer row */}
            <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.06] mt-auto">
              <span className="text-[9px] font-black text-white/25 uppercase tracking-widest truncate max-w-[130px]">
                {post.author}
              </span>
              <span
                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cat.border} ${cat.text} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              >
                Read →
              </span>
            </div>
          </div>

          {/* Bottom accent bar on hover */}
          <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-jcc-accent via-jcc-green to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        </article>
      </Link>
    </motion.div>
  );
}
