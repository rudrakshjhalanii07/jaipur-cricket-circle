"use client";

import { motion } from "framer-motion";
import { Calendar, Clock, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { BlogPost } from "@/lib/data";

export default function BlogPreviewCard({ post, index }: { post: BlogPost; index: number }) {
  const gradients = [
    "from-jcc-blue/20 to-jcc-purple/10", 
    "from-jcc-turf/20 to-jcc-blue/10", 
    "from-jcc-purple/20 to-jcc-red/10", 
    "from-jcc-red/15 to-jcc-gold/10", 
    "from-jcc-blue/15 to-jcc-turf/10", 
    "from-jcc-gold/15 to-jcc-purple/10"
  ];
  const gradient = gradients[index % gradients.length];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true }} 
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link href={`/chewvana-times/${post.slug}`} className="block group">
        <div className="relative glass-card overflow-hidden h-full flex flex-col group-hover:shadow-lg transition-all duration-300 group-hover:border-jcc-blue/30">
          <div className={`relative h-32 bg-gradient-to-br ${gradient} overflow-hidden`}>
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt={post.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 pitch-lines opacity-30" />
            <motion.div className="absolute inset-0 bg-jcc-blue/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 1).map((tag) => (
                <span key={tag} className="text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-jcc-blue-deep font-bold border border-jcc-border">
                  {tag}
                </span>
              ))}
            </div>
            <div className="absolute top-3 right-3">
              <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 border border-jcc-border">
                <ArrowUpRight className="w-3.5 h-3.5 text-jcc-blue-deep" />
              </div>
            </div>
          </div>
          <div className="p-5 flex flex-col flex-1">
            <h3 className="text-[19px] font-black text-jcc-navy group-hover:text-jcc-blue transition-colors duration-300 mb-2 leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
              {post.title}
            </h3>
            <p className="text-[13px] text-jcc-muted leading-relaxed mb-4 flex-1 line-clamp-2 font-[var(--font-inter)]">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-3 pt-3 border-t border-jcc-border">
              <span className="flex items-center gap-1.5 text-[10px] text-jcc-muted mono-label">
                <Calendar className="w-3 h-3" />
                {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-jcc-purple mono-label">
                {post.readTime}
              </span>
              <span className="ml-auto text-[10px] text-jcc-muted font-bold mono-label truncate max-w-[120px] text-right" title={post.author}>
                {post.author}
              </span>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-jcc-blue font-bold text-[10px] mono-label opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Read Investigation</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-jcc-blue to-jcc-turf opacity-0 group-hover:opacity-100 transition-all duration-500" />
        </div>
      </Link>
    </motion.div>
  );
}
