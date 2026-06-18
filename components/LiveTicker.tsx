"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  location_map_url: string;
  player_limit: number;
  status: string;
}

interface LiveTickerProps {
  isNavbarScrolled?: boolean;
}

export default function LiveTicker({ isNavbarScrolled = false }: LiveTickerProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch the nearest upcoming match from Supabase
  useEffect(() => {
    async function fetchUpcomingMatch() {
      try {
        setLoading(true);
        const today = new Date().toISOString().split("T")[0];

        // Fetch matches that are active (status is "open" or "closed") and date is today or in the future
        const { data, error } = await supabase
          .from("matches")
          .select("*")
          .in("status", ["open", "closed"])
          .gte("match_date", today)
          .order("match_date", { ascending: true })
          .limit(1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setMatch(data[0]);
        } else {
          setMatch(null);
        }
      } catch (err) {
        console.error("LiveTicker data fetch error:", err);
        setMatch(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUpcomingMatch();
  }, []);

  if (loading) {
    return (
      <div
        className={`theme-static-dark relative w-full bg-[#050e17]/95 border-b border-white/5 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none flex items-center justify-center ${
          isNavbarScrolled ? "h-0 opacity-0 border-b-0" : "h-9 opacity-100"
        }`}
      >
        <div className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase animate-pulse">
          Connecting to Broadcaster Stream...
        </div>
      </div>
    );
  }

  // Formatting date for scheduled match
  const matchDateFormatted = match
    ? new Date(match.match_date).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  // Repeating Content Renderers to ensure infinite scrolling marquee flow
  const renderTickerContents = () => (
    <div className="flex items-center gap-12 whitespace-nowrap">
      {match ? (
        <div className="flex items-center gap-3">
          {/* Pulsing red LIVE badge */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-ball-red/10 border border-jcc-ball-red/30 text-jcc-ball-red text-[9px] font-black tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-jcc-ball-red animate-pulse shrink-0" />
            LIVE
          </span>

          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-white/95 uppercase">
            Next Sunday Match Scheduled
          </span>

          <span className="text-white/20 select-none">✦</span>

          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-jcc-accent uppercase">
            Mavericks vs NeuroStrikers
          </span>

          <span className="text-white/20 select-none">✦</span>

          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-white/90 uppercase">
            {matchDateFormatted} • {match.match_time} • {match.location_name}
          </span>

          <span className="text-white/20 select-none">✦</span>

          {match.status === "open" ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-green/10 border border-jcc-green/30 text-jcc-green text-[9px] font-black tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-jcc-green animate-pulse shrink-0" />
              REGISTRATION OPEN (REGISTER NOW)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-gold/10 border border-jcc-gold/30 text-jcc-gold text-[9px] font-black tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-jcc-gold shrink-0" />
              REGISTRATION CLOSED (ROSTER LOCKED)
            </span>
          )}

          <span className="text-white/10 select-none ml-6">✦✦✦</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* Muted STAY TUNED badge */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-gold/10 border border-jcc-gold/30 text-jcc-gold text-[9px] font-black tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-jcc-gold animate-pulse shrink-0" />
            STAY TUNED
          </span>

          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-white/80 uppercase">
            The next Sunday battle is being prepared
          </span>

          <span className="text-white/20 select-none">✦</span>

          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-jcc-accent uppercase">
            Keep your kit ready
          </span>

          <span className="text-white/10 select-none ml-6">✦✦✦</span>
        </div>
      )}
    </div>
  );

  // Return Clickable Ticker if match is active, else Non-clickable
  if (match) {
    return (
      <Link
        href="/register"
        className={`theme-static-dark relative w-full bg-[#050e17]/95 border-b border-jcc-accent/15 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none cursor-pointer block hover:border-jcc-accent/35 hover:shadow-[0_0_20px_rgba(20,184,255,0.15)] hover:bg-[#071322]/95 ${
          isNavbarScrolled ? "h-0 opacity-0 border-b-0" : "h-9 opacity-100"
        }`}
      >
        {/* Premium Neon Border Glow at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-jcc-accent/30 to-transparent shadow-[0_0_10px_rgba(0,194,255,0.4)] pointer-events-none" />

        <div className="h-full max-w-[1920px] mx-auto flex items-center overflow-hidden">
          {/* Continuous scrolling marquee loop */}
          <div className="animate-marquee-scroll flex items-center gap-12">
            {renderTickerContents()}
            {renderTickerContents()}
            {renderTickerContents()}
            {renderTickerContents()}
          </div>
        </div>
      </Link>
    );
  }

  // Non-clickable container for Stay Tuned state
  return (
    <div
      className={`theme-static-dark relative w-full bg-[#050e17]/95 border-b border-white/5 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none ${
        isNavbarScrolled ? "h-0 opacity-0 border-b-0" : "h-9 opacity-100"
      }`}
    >
      <div className="h-full max-w-[1920px] mx-auto flex items-center overflow-hidden">
        {/* Continuous scrolling marquee loop */}
        <div className="animate-marquee-scroll flex items-center gap-12">
          {renderTickerContents()}
          {renderTickerContents()}
          {renderTickerContents()}
          {renderTickerContents()}
        </div>
      </div>
    </div>
  );
}
