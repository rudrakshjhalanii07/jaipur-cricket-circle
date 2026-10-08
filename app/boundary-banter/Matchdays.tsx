"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Trophy } from "lucide-react";
import type { DayPreview } from "@/lib/match-reports";
import { teamByName } from "@/lib/teams";
import { afterLoader, gsap, reduceMotion, useGSAP, whenSeen } from "./motion";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-jcc-text-muted";
/** Weeks rendered up front; the rest are appended as the reader scrolls. */
const FIRST_BATCH = 6;
const NEXT_BATCH = 3;

// Formatted by hand, not toLocaleDateString: this renders on the server and
// again in the browser, and ICU versions disagree ("Sep" vs "Sept", commas),
// which breaks hydration.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

function Crest({ team, size }: { team: string; size: number }) {
  const t = teamByName(team);
  if (!t) return <span style={{ width: size, height: size }} className="shrink-0" />;
  return <Image src={t.logo} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

/** One week. Reveals itself the first time it scrolls into view. */
function Matchday({ r, alt }: { r: DayPreview; alt: boolean }) {
  const root = useRef<HTMLLIElement>(null);

  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.set(q("[data-md-rule]"), { scaleX: 0, transformOrigin: "left center" });
      gsap.set(q("[data-md-week]"), { yPercent: 105 });
      gsap.set(q("[data-md-fade]"), { autoAlpha: 0, y: 14 });
      gsap.set(q("[data-md-head]"), { autoAlpha: 0, y: 28 });
      gsap.set(q("[data-md-tile]"), { autoAlpha: 0, y: 16 });
      let cancelSeen: (() => void) | undefined;
      const cancelLoader = afterLoader(() => {
        cancelSeen = whenSeen(root.current!, () => {
          gsap.timeline({ defaults: { ease: "expo.out" } })
            .to(q("[data-md-rule]"), { scaleX: 1, duration: 1.1, ease: "power3.inOut" })
            .to(q("[data-md-week]"), { yPercent: 0, duration: 1 }, "-=0.75")
            .to(q("[data-md-head]"), { autoAlpha: 1, y: 0, duration: 1 }, "<0.1")
            .to(q("[data-md-fade]"), { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06 }, "<0.15")
            .to(q("[data-md-tile]"), { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07 }, "<0.1");
        });
      });
      return () => {
        cancelLoader();
        cancelSeen?.();
      };
    },
    { scope: root },
  );

  return (
    <li ref={root} className="relative isolate">
      {/* Every other week sits on the warm secondary surface, edge to edge. */}
      {alt && <span aria-hidden className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-jcc-navy-light" />}
      <span data-md-rule className="absolute inset-x-0 top-0 h-0.5 bg-jcc-blue" />
      <Link href={`/boundary-banter/${r.slug}`} className="group grid gap-x-12 gap-y-6 py-8 lg:grid-cols-[160px_minmax(0,1fr)]">
        <div>
          <div className="overflow-hidden pb-1">
            <div data-md-week className="font-heading text-4xl tracking-tight text-white">Week {r.week}</div>
          </div>
          <div data-md-fade className={`${LABEL} mt-2`}>{shortDate(r.date)}</div>
          <div data-md-fade className={`${LABEL} mt-1`}>{r.venue}</div>
        </div>

        <div className="min-w-0">
          <div data-md-fade className={`${LABEL} mb-3 text-jcc-accent-dark`}>{r.kicker}</div>
          <h3 data-md-head className="flex items-start gap-3 font-heading text-2xl leading-snug tracking-tight text-white transition-colors group-hover:text-jcc-accent-dark sm:text-[2rem]">
            <span>{r.headline}</span>
            <ArrowUpRight className="mt-1.5 h-5 w-5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </h3>
          <p data-md-fade className="mt-3 max-w-2xl text-[15px] leading-relaxed text-jcc-text-muted">{r.dek}</p>

          <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {r.matches.map((m, j) => (
              <div key={j} data-md-tile className="border-l border-jcc-border pl-4 transition-colors group-hover:border-jcc-accent/40">
                {m.scores.map((s) => {
                  const won = m.winner === s.team;
                  return (
                    <div key={s.team} className="flex items-center gap-2.5 py-0.5">
                      <Crest team={s.team} size={18} />
                      <span className={`flex-1 truncate text-sm ${won ? "font-semibold text-white" : "text-jcc-text-muted"}`}>
                        {s.team.replace(/^The /, "")}
                      </span>
                      <span className={`font-heading text-base tabular-nums ${won ? "text-white" : "text-jcc-text-muted"}`}>
                        {s.runs}/{s.wickets}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {r.star && (
            <div data-md-fade className="mt-5 flex items-center gap-1.5 text-xs text-jcc-text-muted">
              <Trophy className="h-3 w-3 text-jcc-accent" /> Star of the day: <span className="font-semibold text-white">{r.star}</span>
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function Matchdays({ reports }: { reports: DayPreview[] }) {
  const seasons = useMemo(() => [...new Set(reports.map((r) => r.season))].sort((a, b) => b - a), [reports]);
  const [season, setSeason] = useState(seasons[0]);
  const [count, setCount] = useState(FIRST_BATCH);
  const header = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // /boundary-banter?season=2#match-reports, linked from each matchday page.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = Number(new URLSearchParams(window.location.search).get("season"));
      if (seasons.includes(s)) setSeason(s);
    }, 0);
    return () => clearTimeout(t);
  }, [seasons]);

  const days = useMemo(() => reports.filter((r) => r.season === season).sort((a, b) => b.week - a.week), [reports, season]);
  const shown = days.slice(0, count);
  const games = days.reduce((n, d) => n + d.matches.length, 0);

  // Keep appending weeks while the end of the list is near the viewport. A
  // fresh observer per batch reports its initial state, so a batch that
  // doesn't push the sentinel out of range still triggers the next one.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= days.length) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setCount((c) => Math.min(c + NEXT_BATCH, days.length));
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, days.length]);

  // Section header reveal.
  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(header);
      gsap.set(q("[data-hd]"), { autoAlpha: 0, y: 24 });
      let cancelSeen: (() => void) | undefined;
      const cancelLoader = afterLoader(() => {
        cancelSeen = whenSeen(header.current!, () => {
          gsap.to(q("[data-hd]"), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: "expo.out" });
        });
      });
      return () => {
        cancelLoader();
        cancelSeen?.();
      };
    },
    { scope: header },
  );

  if (!reports.length) return null;
  const other = seasons.find((s) => s !== season);

  return (
    <section id="match-reports" className="relative z-10 scroll-mt-28 border-t border-jcc-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div ref={header} className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div data-hd className={`${LABEL} mb-4 text-jcc-accent-dark`}>Matchday Reports</div>
            <h2 data-hd className="font-heading text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl">
              Every matchday, on the record.
            </h2>
            <p data-hd className="mt-4 max-w-lg text-base leading-relaxed text-jcc-text-muted">
              One dispatch per week, written from the official scorecards. The numbers are gospel; the opinions are ours.
            </p>
          </div>
          <div data-hd className="flex items-center gap-1 self-start rounded-full border border-jcc-border p-1 sm:self-auto" role="tablist">
            {seasons.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={s === season}
                onClick={() => {
                  setSeason(s);
                  setCount(FIRST_BATCH);
                }}
                className={`relative rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  s === season ? "text-white" : "text-jcc-text-muted hover:text-white"
                }`}
              >
                {s === season && (
                  <motion.span layoutId="season-pill" className="absolute inset-0 rounded-full bg-jcc-navy-light ring-1 ring-jcc-accent/40" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                )}
                <span className="relative">Season {s}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`${LABEL} mb-2`}>
          {days.length} matchdays · {games} matches
        </div>

        <ol>
          {shown.map((r, i) => (
            <Matchday key={r.slug} r={r} alt={i % 2 === 1} />
          ))}
        </ol>

        <div ref={sentinel} aria-hidden className="h-px" />

        {count >= days.length && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-jcc-blue pt-6">
            <span className={LABEL}>That&apos;s every matchday of Season {season}.</span>
            {other && (
              <button
                onClick={() => {
                  setSeason(other);
                  setCount(FIRST_BATCH);
                  document.getElementById("match-reports")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-full border border-jcc-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:border-jcc-accent hover:text-jcc-accent-dark"
              >
                Read Season {other} →
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
