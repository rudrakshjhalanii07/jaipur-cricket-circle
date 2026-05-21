"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { registrationData } from "@/lib/data";
import { Trophy, Users, MapPin, Calendar, Timer, Bell } from "lucide-react";

interface Match {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  location_map_url: string;
  player_limit: number;
  status: string;
}

interface MatchTickerProps {
  isNavbarScrolled?: boolean;
}

export default function MatchTicker({ isNavbarScrolled = false }: MatchTickerProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [confirmedCount, setConfirmedCount] = useState<number>(0);
  const [waitlistCount, setWaitlistCount] = useState<number>(0);
  const [countdown, setCountdown] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch match details and registrations
  useEffect(() => {
    async function fetchMatchAndRegistrations() {
      try {
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .order("match_date", { ascending: false })
          .limit(1)
          .single();

        if (matchError || !matchData) {
          // Fallback to static registration data if Supabase has no records or fails
          loadStaticFallback();
          return;
        }

        setMatch(matchData);

        const { data: regsData, error: regsError } = await supabase
          .from("registrations")
          .select("status")
          .eq("match_id", matchData.id);

        if (!regsError && regsData) {
          const confirmed = regsData.filter((r) => r.status === "registered").length;
          const waitlist = regsData.filter((r) => r.status === "waitlist").length;
          setConfirmedCount(confirmed);
          setWaitlistCount(waitlist);
        } else {
          // Use default values matching limit
          setConfirmedCount(0);
          setWaitlistCount(0);
        }
      } catch (err) {
        console.error("MatchTicker data fetch error:", err);
        loadStaticFallback();
      } finally {
        setLoading(false);
      }
    }

    function loadStaticFallback() {
      // Fallback matching data.ts
      setMatch({
        id: "fallback-match",
        match_date: registrationData.matchDate,
        match_time: registrationData.time,
        location_name: registrationData.venue,
        location_map_url: registrationData.locationMapUrl,
        player_limit: registrationData.playerLimit,
        status: registrationData.registrationStatus,
      });

      const confirmed = registrationData.registeredPlayers.filter(
        (p) => p.status === "registered"
      ).length;
      const waitlist = registrationData.registeredPlayers.filter(
        (p) => p.status === "waitlist"
      ).length;
      setConfirmedCount(confirmed);
      setWaitlistCount(waitlist);
    }

    fetchMatchAndRegistrations();
  }, []);

  // Update countdown
  useEffect(() => {
    if (!match?.match_date) return;

    const updateCountdown = () => {
      try {
        const dateStr = match.match_date;
        const timeStr = match.match_time || "07:00 AM";
        const matchDate = new Date(dateStr);

        // Parse "07:00 AM" or "19:00"
        const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const modifier = timeParts[3]?.toUpperCase();

          if (modifier === "PM" && hours < 12) hours += 12;
          if (modifier === "AM" && hours === 12) hours = 0;

          matchDate.setHours(hours, minutes, 0, 0);
        } else {
          matchDate.setHours(7, 0, 0, 0); // Fallback
        }

        const now = new Date();
        const diff = matchDate.getTime() - now.getTime();

        if (diff <= 0) {
          setCountdown("BATTLE IN PROGRESS");
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (d > 0) {
          setCountdown(`STARTS IN ${d}D ${h}H ${m}M`);
        } else {
          setCountdown(`STARTS IN ${h}H ${m}M`);
        }
      } catch (err) {
        console.error("Countdown calculation error:", err);
        setCountdown("");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [match]);

  if (loading && !match) {
    return (
      <div className="h-9 w-full bg-[#050e17] border-b border-white/5 flex items-center justify-center">
        <div className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase animate-pulse">
          Synchronizing Live Broadcast Stream...
        </div>
      </div>
    );
  }

  // Construct our marquee message segments
  const matchDateFormatted = match
    ? new Date(match.match_date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const isFullString =
    confirmedCount >= (match?.player_limit || 18)
      ? "SQUAD IS FULL (WAITLIST ACTIVE)"
      : `${(match?.player_limit || 18) - confirmedCount} SPOTS REMAINING`;

  const registrationStatusText =
    match?.status === "open"
      ? `REGISTRATION OPEN • ${isFullString}`
      : match?.status === "closed"
      ? "REGISTRATION CLOSED • ROSTER LOCKED"
      : match?.status === "cancelled"
      ? "MATCH DAY POSTPONED"
      : "LOCKED";

  const tickerSegments = [
    {
      icon: <Trophy className="w-3.5 h-3.5 text-jcc-accent animate-pulse" />,
      text: `UPCOMING SHOWDOWN: MAVERICKS VS NEUROSTRIKERS`,
    },
    {
      icon: <Calendar className="w-3.5 h-3.5 text-jcc-accent" />,
      text: `${matchDateFormatted.toUpperCase()} • ${match?.match_time}`,
    },
    {
      icon: <MapPin className="w-3.5 h-3.5 text-jcc-accent" />,
      text: `${match?.location_name.toUpperCase()}`,
    },
    {
      icon: <Users className="w-3.5 h-3.5 text-jcc-accent" />,
      text: `${confirmedCount} WARRIORS DEPLOYED • ${waitlistCount} WAITLIST`,
    },
    {
      icon: <Bell className="w-3.5 h-3.5 text-jcc-green" />,
      text: `${registrationStatusText.toUpperCase()}`,
    },
  ];

  if (countdown) {
    tickerSegments.push({
      icon: <Timer className="w-3.5 h-3.5 text-jcc-accent" />,
      text: `${countdown}`,
    });
  }

  // Construct a single pass of the scrolling ticker text
  const renderTickerContents = () => (
    <div className="flex items-center gap-12 whitespace-nowrap">
      {tickerSegments.map((seg, idx) => (
        <div key={idx} className="flex items-center gap-2.5">
          {/* Pulse DOT badge at the start of matches */}
          {idx === 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-jcc-green/10 border border-jcc-green/30 text-jcc-green text-[8px] font-black tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-jcc-green animate-ping shrink-0" />
              LIVE
            </span>
          )}
          {seg.icon}
          <span className="text-[10px] sm:text-[11px] font-mono font-black tracking-[0.18em] text-white/95">
            {seg.text}
          </span>
          <span className="text-white/10 select-none ml-8">✦</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={`relative w-full bg-[#050e17]/95 border-b border-jcc-accent/15 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none ${
        isNavbarScrolled ? "h-0 opacity-0 border-b-0" : "h-9 opacity-100"
      }`}
    >
      {/* Glow Effect Line at the absolute bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-jcc-accent/30 to-transparent shadow-[0_0_10px_rgba(0,194,255,0.4)] pointer-events-none" />

      <div className="h-full max-w-[1920px] mx-auto flex items-center overflow-hidden">
        {/* Double-render wrapper for infinite scrolling marquee loop */}
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
