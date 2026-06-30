"use client";

import Link from "next/link";

export interface TickerMatch {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  player_limit: number;
  status: string;
}

interface LiveTickerProps {
  match: TickerMatch | null;
  isNavbarScrolled?: boolean;
}

export default function LiveTicker({ match, isNavbarScrolled = false }: LiveTickerProps) {
  const matchDateFormatted = match
    ? new Date(match.match_date).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const visibilityClass = isNavbarScrolled
    ? "h-0 opacity-0 border-b-0"
    : "h-9 opacity-100";

  const renderTickerContents = () => (
    <div className="flex items-center gap-12 whitespace-nowrap">
      {match ? (
        <div className="flex items-center gap-3">
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

  if (match) {
    return (
      <Link
        href="/register"
        className={`theme-static-dark relative w-full bg-[#050e17]/95 border-b border-jcc-accent/15 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none cursor-pointer block hover:border-jcc-accent/35 hover:shadow-[0_0_20px_rgba(20,184,255,0.15)] hover:bg-[#071322]/95 ${visibilityClass}`}
      >
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-jcc-accent/30 to-transparent shadow-[0_0_10px_rgba(0,194,255,0.4)] pointer-events-none" />
        <div className="h-full max-w-480 mx-auto flex items-center overflow-hidden">
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

  return (
    <div
      className={`theme-static-dark relative w-full bg-[#050e17]/95 border-b border-white/5 backdrop-blur-md overflow-hidden transition-all duration-500 ease-in-out z-40 select-none ${visibilityClass}`}
    >
      <div className="h-full max-w-480 mx-auto flex items-center overflow-hidden">
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
