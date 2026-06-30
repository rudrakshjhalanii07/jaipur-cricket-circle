import Link from "next/link";
import Image from "next/image";
import { Newspaper, ChevronRight, Clock, Zap, Radio } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";
import type { ArticleData } from "@/app/page";

type Article = ArticleData;

// ─── Live Ticker (pure CSS scroll animation, no client JS) ───────────────────
function LiveTicker({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div
      className="relative overflow-hidden border-y border-white/[0.07]"
      style={{ background: "linear-gradient(90deg, #0C1E30 0%, #07111F 50%, #0C1E30 100%)" }}
    >
      <div className="flex items-center" style={{ minHeight: "36px" }}>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/[0.05] border-r border-white/10 z-10">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-jcc-accent">LATEST ISSUE</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker-scroll whitespace-nowrap">
            {doubled.map((item, i) => (
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

// ─── Category badge ───────────────────────────────────────────────────────────
const CATEGORY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "Match Report": { bg: "bg-jcc-accent/15 border-jcc-accent/30", text: "text-jcc-accent", dot: "bg-jcc-accent" },
  Analysis: { bg: "bg-jcc-green/15 border-jcc-green/30", text: "text-jcc-green", dot: "bg-jcc-green" },
  "Origin Story": { bg: "bg-jcc-gold/15 border-jcc-gold/30", text: "text-jcc-gold", dot: "bg-jcc-gold" },
  Culture: { bg: "bg-purple-400/15 border-purple-400/30", text: "text-purple-400", dot: "bg-purple-400" },
  Exhibition: { bg: "bg-orange-400/15 border-orange-400/30", text: "text-orange-400", dot: "bg-orange-400" },
  default: { bg: "bg-white/5 border-white/10", text: "text-white/60", dot: "bg-white/40" },
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

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ article }: { article: Article }) {
  return (
    <AnimateIn>
      <Link href={`/chewvana-times/${article.slug}`} className="block group">
        <div
          className="relative rounded-2xl overflow-hidden border border-jcc-ball-red/20 animate-border-pulse hover:border-jcc-ball-red/50 transition-all duration-500"
          style={{ background: "linear-gradient(160deg, #1a0a0a 0%, #07111F 100%)" }}
        >
          <div className="editorial-rule" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[340px] overflow-hidden">
              <Image
                src={article.image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=65&fm=webp"}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-linear-to-r from-transparent md:from-transparent to-transparent md:to-[#07111F]" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg animate-breaking-flash text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
                  <Radio className="w-3 h-3" />
                  Breaking
                </span>
                <CategoryBadge category={article.category} />
              </div>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-jcc-ball-red">CHEWVANA TIMES</span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-white/30 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  {new Date(article.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <h3
                className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-[1.08] mb-5 group-hover:text-jcc-accent transition-colors duration-300"
                style={{ fontFamily: "var(--font-fraunces, var(--font-heading))" }}
              >
                {article.title}
              </h3>
              <p className="text-white/50 text-[15px] font-medium leading-relaxed mb-8 italic line-clamp-3">
                &quot;{article.excerpt}&quot;
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-jcc-accent group-hover:text-white transition-colors">
                  READ FULL REPORT
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                {article.author_name && (
                  <>
                    <span className="w-px h-4 bg-white/15 hidden min-[350px]:block" />
                    <span className="text-[10px] font-black text-white/25 uppercase tracking-widest">By {article.author_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </AnimateIn>
  );
}

// ─── Editorial card ───────────────────────────────────────────────────────────
function EditorialCard({ article, index }: { article: Article; index: number }) {
  return (
    <AnimateIn delay={index * 100}>
      <Link href={`/chewvana-times/${article.slug}`} className="block h-full group">
        <div
          className="relative rounded-2xl overflow-hidden border border-white/[0.07] h-full flex flex-col hover:border-jcc-accent/30 transition-all duration-400 card-shimmer"
          style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
        >
          <div className="relative aspect-[16/9] overflow-hidden flex-shrink-0">
            <Image
              src={article.image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=65&fm=webp"}
              alt={article.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#07111F] via-transparent to-transparent" />
            <div className="absolute top-3 left-3">
              <CategoryBadge category={article.category} />
            </div>
          </div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/25">
                {new Date(article.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-3 line-clamp-2 group-hover:text-jcc-accent transition-colors duration-300">
              {article.title}
            </h3>
            <p className="text-white/40 text-[13px] font-medium leading-relaxed line-clamp-2 flex-1 italic mb-5">
              {article.excerpt}
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-widest text-jcc-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                Read More <ChevronRight className="w-3 h-3" />
              </span>
              <Zap className="w-4 h-4 text-jcc-gold opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-linear-to-r from-jcc-accent via-jcc-green to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </Link>
    </AnimateIn>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────
interface ChewvanaTimesSectionProps {
  articles: Article[];
  tickerItems: string[];
}

export default function ChewvanaTimesSection({ articles, tickerItems }: ChewvanaTimesSectionProps) {
  const [featured, ...rest] = articles;

  return (
    <section
      id="chewvana-times"
      className="theme-static-dark relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #07111F 0%, #0C1E30 50%, #07111F 100%)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative z-10 pt-20 pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateIn className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-4 h-4 text-jcc-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-jcc-accent">The Circle Journal</span>
              </div>
              <span className="w-px h-4 bg-white/15" />
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/40">UPDATED MONDAYS</span>
            </div>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none mb-4">
              Chewvana <span className="text-gradient-cyan">Times</span>
            </h2>
            <p className="text-white/40 text-base font-medium max-w-2xl leading-relaxed">
              Unfiltered match reports, tactical dispatches, and editorial investigations from inside the circle.
            </p>
          </AnimateIn>
        </div>
        <LiveTicker items={tickerItems} />
      </div>

      <div className="relative z-10 pt-10 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
          {articles.length > 0 ? (
            <>
              {featured && <FeatureCard article={featured} />}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {rest.map((article, i) => (
                    <EditorialCard key={article.id} article={article} index={i} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              className="text-center py-24 rounded-2xl border border-white/[0.06]"
              style={{ background: "linear-gradient(160deg, #0C1E30 0%, #07111F 100%)" }}
            >
              <p className="text-white/25 font-black uppercase tracking-[0.2em] text-sm">No dispatches in the archive yet.</p>
            </div>
          )}

          <AnimateIn delay={200} className="flex justify-center pt-4">
            <Link
              href="/chewvana-times"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl border border-white/10 bg-white/[0.03] text-white font-black text-[12px] hover:bg-white/[0.07] hover:border-jcc-accent/40 hover:text-jcc-accent transition-all duration-400 uppercase tracking-widest"
            >
              <Newspaper className="w-4 h-4" />
              EXPLORE THE ARCHIVE
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </AnimateIn>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
