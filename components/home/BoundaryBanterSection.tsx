import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Newspaper } from "lucide-react";
import type { ArticleData } from "@/app/page";

// Boundary Banter on the home page: the latest report as a full-height lead,
// the next four as a numbered list beside it, and the ticker as a quiet strip
// along the foot. Covers are stock cricket photography (lib/article-covers.ts).

const fmtDate = (iso: string, month: "short" | "long" = "short") =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month, year: "numeric", timeZone: "Asia/Kolkata" });

/** Ticker copy without the emoji it was written with. */
const calm = (s: string) =>
  s
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function Lead({ a }: { a: ArticleData }) {
  return (
    <Link href={`/boundary-banter/${a.slug}`} className="group relative block overflow-hidden rounded-[28px] bg-[#0B1424] lg:h-full">
      <div data-wipe className="relative aspect-[4/5] sm:aspect-[16/11] lg:absolute lg:inset-0 lg:aspect-auto">
        <Image
          src={a.image_url}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover transition-transform duration-[1.6s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
        />
      </div>
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-[#0B1424] via-[#0B1424]/55 to-[#0B1424]/0" />
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-jcc-accent px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0B1424]">Latest · {a.category}</span>
          <span className="kicker text-white/70">{fmtDate(a.published_at, "long")}</span>
        </div>
        <h3 className="mt-5 max-w-2xl font-heading text-3xl font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">{a.title}</h3>
        {a.excerpt && <p className="mt-4 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-white/70">{a.excerpt}</p>}
        <span className="mt-7 inline-flex items-center gap-3 text-sm font-semibold tracking-tight text-white">
          Read the report
          <span className="grid h-10 w-10 place-items-center rounded-full bg-jcc-accent text-[#0B1424] transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight size={17} />
          </span>
        </span>
      </div>
    </Link>
  );
}

function Row({ a, n }: { a: ArticleData; n: number }) {
  return (
    <li>
      <Link href={`/boundary-banter/${a.slug}`} className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-6 md:gap-6">
        <span aria-hidden className="pointer-events-none absolute -inset-x-4 inset-y-2 rounded-2xl bg-white/[0.05] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl md:h-24 md:w-24">
          <Image src={a.image_url} alt="" fill sizes="96px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#0B1424]/80 px-1.5 font-mono text-[10px] font-semibold text-jcc-accent">{String(n).padStart(2, "0")}</span>
        </span>
        <span className="relative min-w-0">
          <span className="kicker block text-white/50">
            {a.category} · {fmtDate(a.published_at)}
          </span>
          <span className="mt-2 line-clamp-2 block font-heading text-lg font-bold leading-tight tracking-[-0.03em] text-white transition-colors group-hover:text-jcc-accent md:text-xl">{a.title}</span>
        </span>
        <ArrowUpRight size={18} className="relative text-white/40 transition-all duration-300 group-hover:rotate-45 group-hover:text-jcc-accent" />
      </Link>
    </li>
  );
}

interface BoundaryBanterSectionProps {
  articles: ArticleData[];
  tickerItems: string[];
}

export default function BoundaryBanterSection({ articles, tickerItems }: BoundaryBanterSectionProps) {
  const [lead, ...rest] = articles;
  const ticker = tickerItems.map(calm).filter(Boolean);

  return (
    <section id="boundary-banter" className="theme-static-dark print-grain relative overflow-hidden bg-jcc-blue">
      <div className="relative mx-auto max-w-[88rem] px-5 pt-28 md:px-10 md:pt-36">
        <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p data-reveal className="kicker inline-flex items-center gap-2 text-jcc-accent">
              <Newspaper className="h-3.5 w-3.5" /> 07 · Boundary Banter · written from the scorecards
            </p>
            <h2 data-split className="mt-5 font-heading text-[clamp(2.8rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-white">
              Every matchday, reported.
            </h2>
          </div>
          <p data-reveal className="max-w-xs text-sm leading-relaxed text-white/60 md:pb-3 md:text-right">
            Match reports, top performers and the occasional roast — out after every match day.
          </p>
        </div>

        {lead ? (
          <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-12">
            <div className="lg:min-h-[620px]">
              <Lead a={lead} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-end justify-between border-b border-white/25 pb-3">
                <p className="kicker text-white/60">Also this week</p>
                <p className="kicker text-white/40">{rest.length} more</p>
              </div>
              <ol data-reveal-stagger>
                {rest.map((a, i) => (
                  <Row key={a.id} a={a} n={i + 2} />
                ))}
              </ol>
              {/* Always a clear gap below the list; on wide screens it then sits
                  on the lead's baseline when the list is short. */}
              <div className="pt-10 lg:mt-auto lg:pt-12">
                <Link href="/boundary-banter" className="btn-ghost group">
                  All match reports
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="kicker mt-14 rounded-[28px] border border-white/10 py-20 text-center text-white/50">No dispatches in the archive yet.</p>
        )}
      </div>

      {ticker.length > 0 && (
        <div className="relative mt-20 border-t border-white/10 py-4 md:mt-28">
          <div className="edge-fade overflow-hidden">
            <div className="marquee" style={{ "--marquee-speed": "70s" } as React.CSSProperties}>
              {[0, 1].map((dup) => (
                <div key={dup} aria-hidden={dup === 1} className="flex items-center">
                  {ticker.map((t, i) => (
                    <span key={i} className="flex items-center gap-6 whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
                      {t}
                      <span className="text-jcc-accent">✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
