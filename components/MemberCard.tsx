"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { Member, MemberTag } from "@/lib/types";
import { getDiceBearUrl } from "@/lib/avatar";
import type { BattingLeaderRow, BowlingLeaderRow, AllRounderRow, FieldingRow } from "@/lib/series";

export type PlayerStats = {
  batting?: BattingLeaderRow;
  bowling?: BowlingLeaderRow;
  allRounder?: AllRounderRow;
  fielding?: FieldingRow;
};

const tagLabels: Record<MemberTag, string> = {
  "founding-member": "Founder",
  captain: "Captain",
  "vice-captain": "Vice Captain",
  batter: "Batter",
  bowler: "Bowler",
  "all-rounder": "All-Rounder",
  wicketkeeper: "WK",
};

// Dark bg aligned with pink-ball night (#17121A ink); light bg uses flannel/ivory tones
const TEAM_CONFIGS: Record<string, { primary: string; glow: string; darkBg: string; darkBase: string; lightBg: string; lightBase: string }> = {
  Mavericks: {
    primary: "#E8A820",
    glow: "rgba(232,168,32,0.28)",
    darkBg: "#1C1510",   // amber-tinted ink
    darkBase: "#17121A", // site pink-ball night base
    lightBg: "#FFF8E6",  // warm parchment
    lightBase: "#FBF7EE",
  },
  NeuroStrikers: {
    primary: "#3B6FC4",
    glow: "rgba(59,111,196,0.28)",
    darkBg: "#101528",   // blue-tinted ink
    darkBase: "#17121A",
    lightBg: "#EEF3FF",  // cool ivory
    lightBase: "#F6F2E9",
  },
  "The Outliers": {
    primary: "#1A7A5E",
    glow: "rgba(26,122,94,0.28)",
    darkBg: "#0E1816",   // green-tinted ink
    darkBase: "#17121A",
    lightBg: "#EEF7F2",  // mint ivory
    lightBase: "#F6F2E9",
  },
  Unassigned: {
    primary: "#8888aa",
    glow: "rgba(136,136,170,0.15)",
    darkBg: "#151218",
    darkBase: "#17121A",
    lightBg: "#F3EFEA",
    lightBase: "#F6F2E9",
  },
};

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDark;
}

// Fallback stats per role when no real data exists
const ROLE_DEFAULTS: Record<string, { bat: number; bwl: number; fld: number; rating: number; pos: string }> = {
  "all-rounder": { bat: 82, bwl: 78, fld: 85, rating: 87, pos: "AR" },
  batter:        { bat: 90, bwl: 40, fld: 75, rating: 83, pos: "BAT" },
  bowler:        { bat: 50, bwl: 88, fld: 78, rating: 82, pos: "BWL" },
  wicketkeeper:  { bat: 72, bwl: 30, fld: 92, rating: 80, pos: "WK" },
};

function StatBar({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span
        className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest w-6 sm:w-8 shrink-0"
        style={{ color: isDark ? "rgba(246,242,233,0.30)" : "rgba(21,17,14,0.35)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-1 rounded-full overflow-hidden"
        style={{ background: isDark ? "rgba(246,242,233,0.07)" : "rgba(21,17,14,0.08)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      <span
        className="text-[8px] sm:text-[9px] font-black w-4 sm:w-5 text-right"
        style={{ color: isDark ? "rgba(246,242,233,0.40)" : "rgba(21,17,14,0.45)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function MemberCard({
  member,
  index,
  playerStats,
  onClick,
  priority = false,
}: {
  member: Member;
  index: number;
  playerStats?: PlayerStats;
  onClick?: () => void;
  priority?: boolean;
}) {
  const isDark = useIsDarkMode();
  const [photoError, setPhotoError] = useState(false);
  const diceBearUrl = getDiceBearUrl(member.name, member.team);
  const cfg = TEAM_CONFIGS[member.team] ?? TEAM_CONFIGS.Unassigned;
  const defaults = ROLE_DEFAULTS[member.cricketRole ?? ""] ?? { bat: 65, bwl: 50, fld: 70, rating: 75, pos: "PLR" };

  // Rating badge: prefer all-rounder combined, then role-specific score
  const rating =
    playerStats?.allRounder?.combined_score ??
    (member.cricketRole === "bowler"
      ? (playerStats?.bowling?.bowling_score ?? defaults.rating)
      : (playerStats?.batting?.batting_score ?? defaults.rating));

  // Stat bars: use real normalized 0-100 scores when available
  const batStat = playerStats?.batting?.batting_score ?? defaults.bat;
  const bwlStat = playerStats?.bowling?.bowling_score ?? defaults.bwl;
  const fldStat = playerStats?.fielding
    ? Math.min(100, playerStats.fielding.catches * 20)
    : defaults.fld;

  // Key stats row
  const matches =
    playerStats?.batting?.matches ??
    playerStats?.bowling?.matches ??
    playerStats?.allRounder?.matches ??
    0;
  const isMainBowler = member.cricketRole === "bowler";
  const keyValue = isMainBowler
    ? (playerStats?.bowling?.total_wickets ?? "—")
    : (playerStats?.batting?.total_runs ?? "—");
  const keyLabel = isMainBowler ? "Wickets" : "Runs";

  // Primary status tag
  const statusTags = member.tags.filter((t) =>
    ["captain", "vice-captain", "founding-member"].includes(t)
  );
  const primaryTag = statusTags[0] ?? member.tags[0];

  return (
    <div className="group h-full max-w-77.5 sm:max-w-none mx-auto w-full transition-transform duration-300 ease-out hover:-translate-y-1.5 will-change-transform">
      <div
        onClick={onClick}
        className="relative rounded-xl sm:rounded-2xl border overflow-hidden h-full transition-all duration-300 cursor-pointer select-none"
        style={{
          background: isDark
            ? `linear-gradient(160deg, ${cfg.darkBg} 0%, ${cfg.darkBase} 100%)`
            : `linear-gradient(160deg, ${cfg.lightBg} 0%, ${cfg.lightBase} 100%)`,
          borderColor: `${cfg.primary}${isDark ? "22" : "30"}`,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = `0 20px 60px -15px ${cfg.glow}`;
          el.style.borderColor = `${cfg.primary}${isDark ? "44" : "55"}`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = "";
          el.style.borderColor = `${cfg.primary}${isDark ? "22" : "30"}`;
        }}
      >
        {/* Top gradient band */}
        <div
          className="absolute top-0 left-0 right-0 h-27.5 sm:h-32.5 opacity-80"
          style={{
            background: `linear-gradient(to bottom, ${isDark ? cfg.darkBg : cfg.lightBg}, transparent)`,
          }}
        />

        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(to right, ${cfg.primary}, ${cfg.primary}55, transparent)` }}
        />

        {/* FIFA Rating (top-left) */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col items-center leading-none">
          <span
            className="text-2xl sm:text-4xl font-black leading-none drop-shadow-lg"
            style={{ color: cfg.primary }}
          >
            {rating}
          </span>
          <span
            className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest"
            style={{ color: isDark ? "rgba(246,242,233,0.40)" : "rgba(21,17,14,0.45)" }}
          >
            {defaults.pos}
          </span>
        </div>

        {/* Status tag (top-right) */}
        {primaryTag && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
            <span
              className="px-1.5 py-0.5 sm:px-2 rounded-full border text-[7px] sm:text-[8px] font-black uppercase tracking-widest"
              style={{
                background: `${cfg.primary}${isDark ? "1a" : "15"}`,
                borderColor: `${cfg.primary}${isDark ? "55" : "44"}`,
                color: cfg.primary,
              }}
            >
              {tagLabels[primaryTag]}
            </span>
          </div>
        )}

        {/* Avatar */}
        <div className="relative z-10 flex justify-center pt-6 pb-3 sm:pt-5 sm:pb-3">
          <div
            className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl border sm:border-2 overflow-hidden flex items-center justify-center shadow-xl"
            style={{
              background: `${cfg.primary}${isDark ? "12" : "10"}`,
              borderColor: `${cfg.primary}44`,
              boxShadow: `0 8px 30px -5px ${cfg.glow}`,
            }}
          >
            {member.image && !photoError ? (
              <Image
                src={member.image}
                alt={member.name}
                width={96}
                height={96}
                priority={priority}
                loading={priority ? undefined : "lazy"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setPhotoError(true)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={diceBearUrl}
                alt={member.name}
                loading={priority ? "eager" : "lazy"}
                // eslint-disable-next-line react/no-unknown-property
                fetchPriority={priority ? "high" : undefined}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
          </div>
        </div>

        {/* Name & Role */}
        <div className="relative z-10 text-center px-3 sm:px-4 pb-2">
          <h3
            className="text-xs sm:text-base font-black uppercase tracking-tight leading-tight truncate"
            style={{ color: cfg.primary }}
          >
            {member.name}
          </h3>
          <p
            className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: isDark ? "rgba(246,242,233,0.35)" : "rgba(21,17,14,0.40)" }}
          >
            {member.team}
          </p>
          <p
            className="text-[9px] sm:text-[11px] font-medium mt-1.5 sm:mt-2 leading-relaxed italic px-1 sm:px-2 line-clamp-2 sm:line-clamp-none"
            style={{ color: isDark ? "rgba(246,242,233,0.50)" : "rgba(21,17,14,0.55)" }}
          >
            {member.shortBio}
          </p>
        </div>

        {/* Divider */}
        <div className="relative z-10 mx-3 sm:mx-4 my-3 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

        {/* Key stats row */}
        <div className="relative z-10 grid grid-cols-3 divide-x divide-white/6 px-1 pb-3">
          {[
            { label: "Matches", value: matches || "—" },
            { label: keyLabel, value: keyValue },
            {
              label: "Role",
              value:
                member.cricketRole === "all-rounder"
                  ? "AR"
                  : (member.cricketRole?.slice(0, 3).toUpperCase() ?? "PLR"),
            },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center py-0.5 sm:py-1 px-1 sm:px-2">
              <span
                className="text-sm sm:text-lg font-black leading-none"
                style={{ color: cfg.primary }}
              >
                {s.value}
              </span>
              <span
                className="text-[7px] sm:text-[8px] uppercase tracking-widest font-black"
                style={{ color: isDark ? "rgba(246,242,233,0.25)" : "rgba(21,17,14,0.30)" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Stat bars */}
        <div className="relative z-10 px-3 sm:px-4 pb-3.5 sm:pb-4 space-y-1.5 sm:space-y-2">
          <StatBar label="BAT" value={batStat} color={cfg.primary} isDark={isDark} />
          <StatBar label="BWL" value={bwlStat} color={cfg.primary} isDark={isDark} />
          <StatBar label="FLD" value={fldStat} color={cfg.primary} isDark={isDark} />
        </div>

        {/* Style tags footer */}
        <div className="relative z-10 px-3 sm:px-4 pb-4 flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{
              color: isDark ? "rgba(246,242,233,0.22)" : "rgba(21,17,14,0.35)",
              background: isDark ? "rgba(246,242,233,0.04)" : "rgba(21,17,14,0.05)",
              border: `1px solid ${isDark ? "rgba(246,242,233,0.06)" : "rgba(21,17,14,0.10)"}`,
            }}
          >
            {member.battingStyle}
          </span>
          {member.bowlingStyle !== "N/A" && (
            <span
              className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                color: isDark ? "rgba(246,242,233,0.22)" : "rgba(21,17,14,0.35)",
                background: isDark ? "rgba(246,242,233,0.04)" : "rgba(21,17,14,0.05)",
                border: `1px solid ${isDark ? "rgba(246,242,233,0.06)" : "rgba(21,17,14,0.10)"}`,
              }}
            >
              {member.bowlingStyle}
            </span>
          )}
        </div>

        {/* Bottom hover glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `linear-gradient(to right, transparent, ${cfg.primary}, transparent)` }}
        />
      </div>
    </div>
  );
}
