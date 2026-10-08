"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Jaali from "@/components/Jaali";
import { Newspaper } from "lucide-react";
import { fallbackSeasons, normalizeSeason, seasonScoreline, type SeasonRow } from "@/lib/seasons";
import { supabase } from "@/lib/supabase";
import type { DayPreview } from "@/lib/match-reports";
import Matchdays from "./Matchdays";
import { afterLoader, gsap, reduceMotion, useGSAP } from "./motion";

// The page lists the scorecard-generated matchday reports only. Articles
// written in the admin panel (chewvana_articles) are no longer listed here,
// though their /boundary-banter/[slug] pages still load.

function NewsTicker({ reports }: { reports: DayPreview[] }) {
  const [tickerItems, setTickerItems] = useState<string[]>([]);

  useEffect(() => {
    async function loadTickerData() {
      const items: string[] = [];
      try {
        const { data: seasonDataDb } = await supabase
          .from("rivalry_seasons")
          .select("*, season_teams(*)")
          .eq("status", "active")
          .limit(1);
        const activeSeason = (seasonDataDb && seasonDataDb.length > 0)
          ? normalizeSeason(seasonDataDb[0] as unknown as SeasonRow)
          : fallbackSeasons.find(s => s.status === "active") || fallbackSeasons[0];

        const todayStr = new Date().toISOString().split("T")[0];
        const { data: matchData } = await supabase
          .from("matches")
          .select("*")
          .in("status", ["open", "closed"])
          .gte("match_date", todayStr)
          .order("match_date", { ascending: true })
          .limit(1);
        const nextMatch = (matchData && matchData.length > 0) ? matchData[0] : null;

        if (nextMatch) {
          const mDate = new Date(nextMatch.match_date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
          items.push(`🏏 NEXT BATTLE: ${nextMatch.location_name} · ${mDate} @ ${nextMatch.match_time} · REGISTRATION ${nextMatch.status.toUpperCase()}`);
        }
        if (activeSeason) {
          items.push(`⚡ SEASON UPDATE: ${activeSeason.title} active! Series score: ${seasonScoreline(activeSeason)}`);
        }
      } catch (err) {
        console.error("Error loading ticker data:", err);
        const fallbackActiveSeason = fallbackSeasons.find(s => s.status === "active") || fallbackSeasons[0];
        items.push(`⚡ SEASON UPDATE: ${fallbackActiveSeason.title} active! Series score: ${seasonScoreline(fallbackActiveSeason)}`);
      }
      reports.slice(0, 3).forEach((r) => {
        items.push(`📰 SEASON ${r.season} · WEEK ${r.week}: ${r.headline}`);
      });
      items.push(`📰 DISPATCH: A new matchday report after every match day`);
      setTickerItems(items);
    }

    loadTickerData();
  }, [reports]);

  const doubled = tickerItems.length > 0 ? [...tickerItems, ...tickerItems] : [];
  return (
    <div
      className="theme-static-dark relative overflow-hidden border-b border-jcc-accent/15"
      style={{ background: "var(--color-jcc-blue)" }}
    >
      <div className="flex items-center" style={{ minHeight: "34px" }}>
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/[0.05] border-r border-white/10">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-jcc-accent">LATEST ISSUE</span>
        </div>
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

export default function BoundaryBanterClient({ reports }: { reports: DayPreview[] }) {
  const masthead = useRef<HTMLDivElement>(null);

  // Masthead entrance, held until the site's intro loader has gone.
  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(masthead);
      gsap.set(q("[data-mh-fade]"), { autoAlpha: 0, y: 18 });
      gsap.set(q("[data-mh-word]"), { yPercent: 110 });
      gsap.set(q("[data-mh-rule]"), { scaleX: 0, transformOrigin: "left center" });
      return afterLoader(() => {
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .to(q("[data-mh-fade]").slice(0, 1), { autoAlpha: 1, y: 0, duration: 0.8 })
          .to(q("[data-mh-word]"), { yPercent: 0, duration: 1.1, stagger: 0.09 }, "-=0.55")
          .to(q("[data-mh-rule]"), { scaleX: 1, duration: 1, ease: "power3.inOut" }, "-=0.7")
          .to(q("[data-mh-fade]").slice(1), { autoAlpha: 1, y: 0, duration: 0.8 }, "-=0.6");
      });
    },
    { scope: masthead },
  );

  return (
    <div className="min-h-screen relative overflow-hidden section-bg-navy">
      {/* ── Newsroom Masthead: the page's one Royal Blue band ── */}
      <div className="theme-static-dark section-bg-royal relative z-10 page-top overflow-hidden pb-6">
        <Jaali intensity={3} weight={1.6} fade="0.88 0.4" drift={[0.95, 0.15, 0.72, 0.85]} />
        <div
          className="pointer-events-none absolute -top-20 right-0 h-[460px] w-[680px] max-w-full"
          style={{ background: "radial-gradient(ellipse at top right, rgba(212,175,55,0.14), transparent 65%)" }}
        />
        <NewsTicker reports={reports} />

        <div ref={masthead} className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div data-mh-fade className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Newspaper className="w-3.5 h-3.5 text-jcc-accent" />
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-jcc-accent">The Circle Journal</span>
            </div>
            <span className="w-px h-3.5 bg-white/15" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Updated every match day</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">
            <span className="inline-block overflow-hidden pb-1 align-bottom"><span data-mh-word className="inline-block">Boundary</span></span>{" "}
            <span className="inline-block overflow-hidden pb-1 align-bottom"><span data-mh-word className="inline-block text-gradient-cyan">Banter</span></span>
          </h1>

          <div data-mh-rule className="editorial-rule my-5 max-w-xs" />

          <p data-mh-fade className="text-white/60 text-base font-medium max-w-xl leading-relaxed italic">
            Where Legends Are Roasted.
          </p>
        </div>
      </div>

      {/* ── Matchday reports, generated from the scorecards ── */}
      <Matchdays reports={reports} />

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
