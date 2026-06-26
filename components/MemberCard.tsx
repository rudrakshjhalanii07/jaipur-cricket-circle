"use client";

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

// Colors matching TEAMS.ts (primary, glow, dark bg tint)
const TEAM_CONFIGS: Record<string, { primary: string; glow: string; darkBg: string }> = {
  Mavericks: {
    primary: "#E8A820",
    glow: "rgba(232,168,32,0.28)",
    darkBg: "#1a0f00",
  },
  NeuroStrikers: {
    primary: "#3B6FC4",
    glow: "rgba(59,111,196,0.28)",
    darkBg: "#00112a",
  },
  "The Outliers": {
    primary: "#1A7A5E",
    glow: "rgba(26,122,94,0.28)",
    darkBg: "#001a0f",
  },
  Unassigned: {
    primary: "#8888aa",
    glow: "rgba(136,136,170,0.15)",
    darkBg: "#101826",
  },
};

// Fallback stats per role when no real data exists
const ROLE_DEFAULTS: Record<string, { bat: number; bwl: number; fld: number; rating: number; pos: string }> = {
  "all-rounder": { bat: 82, bwl: 78, fld: 85, rating: 87, pos: "AR" },
  batter:        { bat: 90, bwl: 40, fld: 75, rating: 83, pos: "BAT" },
  bowler:        { bat: 50, bwl: 88, fld: 78, rating: 82, pos: "BWL" },
  wicketkeeper:  { bat: 72, bwl: 30, fld: 92, rating: 80, pos: "WK" },
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/30 w-6 sm:w-8 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      <span className="text-[8px] sm:text-[9px] font-black text-white/40 w-4 sm:w-5 text-right">{value}</span>
    </div>
  );
}

export default function MemberCard({
  member,
  index,
  playerStats,
  onClick,
}: {
  member: Member;
  index: number;
  playerStats?: PlayerStats;
  onClick?: () => void;
}) {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
      className="group h-full max-w-[310px] sm:max-w-none mx-auto w-full"
    >
      <div
        onClick={onClick}
        className="theme-static-dark relative rounded-xl sm:rounded-2xl border overflow-hidden h-full transition-all duration-300 cursor-pointer select-none"
        style={{
          background: `linear-gradient(160deg, ${cfg.darkBg} 0%, #081826 100%)`,
          borderColor: `${cfg.primary}22`,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = `0 20px 60px -15px ${cfg.glow}`;
          el.style.borderColor = `${cfg.primary}44`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.boxShadow = "";
          el.style.borderColor = `${cfg.primary}22`;
        }}
      >
        {/* Top gradient band */}
        <div
          className="absolute top-0 left-0 right-0 h-[110px] sm:h-[130px] opacity-80"
          style={{ background: `linear-gradient(to bottom, ${cfg.darkBg}, transparent)` }}
        />

        {/* Top accent stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
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
          <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white/40">
            {defaults.pos}
          </span>
        </div>

        {/* Status tag (top-right) */}
        {primaryTag && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
            <span
              className="px-1.5 py-0.5 sm:px-2 rounded-full border text-[7px] sm:text-[8px] font-black uppercase tracking-widest"
              style={{
                background: `${cfg.primary}1a`,
                borderColor: `${cfg.primary}55`,
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
              background: `${cfg.primary}12`,
              borderColor: `${cfg.primary}44`,
              boxShadow: `0 8px 30px -5px ${cfg.glow}`,
            }}
          >
            <img
              src={member.image || getDiceBearUrl(member.name, member.team)}
              alt={member.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                const img = e.currentTarget;
                const fallback = getDiceBearUrl(member.name, member.team);
                if (img.src !== fallback) img.src = fallback;
              }}
            />
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
          <p className="text-[8px] sm:text-[10px] font-bold text-white/35 uppercase tracking-[0.2em]">
            {member.team}
          </p>
          <p className="text-[9px] sm:text-[11px] text-white/50 font-medium mt-1.5 sm:mt-2 leading-relaxed italic px-1 sm:px-2 line-clamp-2 sm:line-clamp-none">
            {member.shortBio}
          </p>
        </div>

        {/* Divider */}
        <div className="relative z-10 mx-3 sm:mx-4 my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Key stats row */}
        <div className="relative z-10 grid grid-cols-3 divide-x divide-white/[0.06] px-1 pb-3">
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
              <span className="text-[7px] sm:text-[8px] uppercase tracking-widest text-white/25 font-black">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Stat bars */}
        <div className="relative z-10 px-3 sm:px-4 pb-3.5 sm:pb-4 space-y-1.5 sm:space-y-2">
          <StatBar label="BAT" value={batStat} color={cfg.primary} />
          <StatBar label="BWL" value={bwlStat} color={cfg.primary} />
          <StatBar label="FLD" value={fldStat} color={cfg.primary} />
        </div>

        {/* Style tags footer */}
        <div className="relative z-10 px-3 sm:px-4 pb-4 flex items-center gap-1.5 flex-wrap">
          <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
            {member.battingStyle}
          </span>
          {member.bowlingStyle !== "N/A" && (
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
              {member.bowlingStyle}
            </span>
          )}
        </div>

        {/* Bottom hover glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: `linear-gradient(to right, transparent, ${cfg.primary}, transparent)` }}
        />
      </div>
    </motion.div>
  );
}
