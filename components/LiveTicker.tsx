"use client";

import Link from "next/link";
import { Crown, Flame, Swords, Zap } from "lucide-react";

export interface TickerMatch {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  player_limit: number;
  status: string;
}

// Season 4 opener. Until then the ticker leads with the countdown; from the
// day after, the promo drops out on its own and the ticker is back to fixtures.
const SEASON_4_START = "2026-11-13";

// Short and loud — the bar is 36px tall and scrolling, so every line has to
// land in a glance.
const SEASON_4_LINES = [
  "Four teams. One crown. Zero mercy.",
  "Grudges don't retire.",
  "Hunt or be hunted.",
  "Old scores. New blood.",
  "Sharpen the willow.",
  "Come take the crown.",
];
const SEPARATORS = [Flame, Swords, Zap, Crown];

/** Whole days from today (local) to the opener; negative once it has passed. */
function daysToSeason4(): number {
  const [y, m, d] = SEASON_4_START.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}

interface LiveTickerProps {
  match: TickerMatch | null;
  isNavbarScrolled?: boolean;
}

const LINE = "text-[10px] sm:text-[11px] font-mono font-black tracking-[0.2em] uppercase";

// The colours that carry the bar's contrast are inline rather than in a
// stylesheet: the text is light-on-dark, so if the background ever failed to
// load the whole ticker would vanish into the white page.
const BAR_STYLE: React.CSSProperties = {
  background: "linear-gradient(90deg, #0D1728 0%, #12233F 50%, #0D1728 100%)",
  color: "#FFFFFF",
};
const GOLD_TEXT: React.CSSProperties = {
  background: "linear-gradient(90deg, #D4AF37 0%, #F3C96A 50%, #E6C068 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
const BADGE_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.08) 75%, rgba(212,175,55,0) 100%), #0D1728",
  clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
  boxShadow: "inset -1px 0 0 rgba(243,201,106,0.35)",
};
const FADE_MASK = "linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)";
const FADE_STYLE: React.CSSProperties = { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK };
// Explicit light colours, not the theme's text tokens — those flip with the
// site theme, and this bar is always dark.
const WHITE = "#FFFFFF";
const WHITE_SOFT = "rgba(255,255,255,0.72)";

export default function LiveTicker({ match, isNavbarScrolled = false }: LiveTickerProps) {
  const matchDateFormatted = match
    ? new Date(match.match_date).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const daysLeft = daysToSeason4();
  const showSeason4 = daysLeft >= 0;

  const visibilityClass = isNavbarScrolled ? "h-0 opacity-0 border-b-0" : "h-9 opacity-100";

  const renderSeason4Lines = () => (
    <div className="flex items-center gap-5">
      {SEASON_4_LINES.map((line, i) => {
        const Icon = SEPARATORS[i % SEPARATORS.length];
        return (
          <span key={line} className="flex items-center gap-5">
            <Icon className="w-3 h-3 text-jcc-accent shrink-0" strokeWidth={2.5} aria-hidden />
            <span className={LINE} style={i % 2 ? { color: WHITE } : GOLD_TEXT}>
              {line}
            </span>
          </span>
        );
      })}
      <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-jcc-accent/40 bg-jcc-accent/10 text-jcc-accent-highlight text-[9px] font-black tracking-[0.3em] tabular-nums">
        13 · 11 · 26
      </span>
    </div>
  );

  const renderMatch = (m: TickerMatch) => (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-ball-red/10 border border-jcc-ball-red/30 text-jcc-ball-red text-[9px] font-black tracking-widest uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-jcc-ball-red animate-pulse shrink-0" />
        LIVE
      </span>
      <span className={`${LINE} text-white/95`}>Next Match Scheduled</span>
      <span className="text-white/20 select-none">✦</span>
      <span className={`${LINE} text-jcc-accent`}>Mavericks vs NeuroStrikers</span>
      <span className="text-white/20 select-none">✦</span>
      <span className={`${LINE} text-white/90`}>
        {matchDateFormatted} • {m.match_time} • {m.location_name}
      </span>
      <span className="text-white/20 select-none">✦</span>
      {m.status === "open" ? (
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
    </div>
  );

  const renderStayTuned = () => (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-jcc-gold/10 border border-jcc-gold/30 text-jcc-gold text-[9px] font-black tracking-widest uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-jcc-gold animate-pulse shrink-0" />
        STAY TUNED
      </span>
      <span className={`${LINE} text-white/80`}>The next battle is being prepared</span>
      <span className="text-white/20 select-none">✦</span>
      <span className={`${LINE} text-jcc-accent`}>Keep your kit ready</span>
    </div>
  );

  const renderTickerContents = () => (
    <div className="flex items-center gap-10 whitespace-nowrap pr-10">
      {showSeason4 && renderSeason4Lines()}
      {match && renderMatch(match)}
      {!match && !showSeason4 && renderStayTuned()}
    </div>
  );

  const inner = (
    <>
      {/* Slow gold light sweeping across the bar */}
      <div className="ticker-sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-jcc-accent/50 to-transparent pointer-events-none" />

      <div className="relative h-full max-w-480 mx-auto flex items-center">
        {showSeason4 && (
          // Pinned: the badge and countdown stay put while the lines scroll.
          <div style={BADGE_STYLE} className="relative z-10 h-full shrink-0 flex items-center gap-2 sm:gap-3 pl-3 sm:pl-5 pr-6 sm:pr-8">
            <Crown className="w-3.5 h-3.5 text-jcc-accent-highlight shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="text-[11px] sm:text-xs font-black tracking-[0.22em] uppercase" style={GOLD_TEXT}>
              Season 4
            </span>
            <span className="w-px h-4 bg-jcc-accent/40" aria-hidden />
            <span suppressHydrationWarning className="flex items-baseline gap-1">
              {daysLeft === 0 ? (
                <span className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase" style={{ color: WHITE }}>
                  First ball tonight
                </span>
              ) : (
                <>
                  <span className="text-base sm:text-lg leading-none font-black tabular-nums" style={{ color: WHITE }}>
                    {daysLeft}
                  </span>
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: WHITE_SOFT }}>
                    {daysLeft === 1 ? "day" : "days"} to go
                  </span>
                </>
              )}
            </span>
          </div>
        )}
        <div style={FADE_STYLE} className="relative h-full flex-1 min-w-0 flex items-center overflow-hidden">
          <div className="animate-marquee-scroll flex items-center">
            {renderTickerContents()}
            {renderTickerContents()}
            {renderTickerContents()}
            {renderTickerContents()}
          </div>
        </div>
      </div>
    </>
  );

  const barClass = `theme-static-dark relative w-full border-b border-jcc-accent/20 overflow-hidden transition-all duration-500 ease-in-out z-40 select-none ${visibilityClass}`;

  // A live fixture links to registration; otherwise the promo links to the
  // seasons page, where the new season will show up.
  const href = match ? "/register" : showSeason4 ? "/seasons" : null;
  if (href) {
    return (
      <Link href={href} style={BAR_STYLE} className={`${barClass} block cursor-pointer hover:border-jcc-accent/45`}>
        {inner}
      </Link>
    );
  }
  return (
    <div style={BAR_STYLE} className={barClass}>
      {inner}
    </div>
  );
}
