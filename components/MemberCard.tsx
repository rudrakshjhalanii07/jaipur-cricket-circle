"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Member, MemberTag } from "@/lib/data";
import { getDiceBearUrl } from "@/lib/avatar";

const tagLabels: Record<MemberTag, string> = {
  "founding-member": "Founder",
  captain: "Captain",
  "vice-captain": "Vice Captain",
  batter: "Batter",
  bowler: "Bowler",
  "all-rounder": "All-Rounder",
  wicketkeeper: "WK",
};

// Role to abbreviated display label (FIFA-style top stat)
const roleRating: Record<string, { rating: number; pos: string }> = {
  "all-rounder": { rating: 87, pos: "AR" },
  batter: { rating: 83, pos: "BAT" },
  bowler: { rating: 82, pos: "BWL" },
  wicketkeeper: { rating: 80, pos: "WK" },
};

// Team-based colour theme
const teamTheme = {
  Mavericks: {
    gradient: "from-[#003d66] via-[#00264d] to-[#081826]",
    accentBar: "from-jcc-accent via-cyan-300 to-jcc-green",
    glowColor: "rgba(0,194,255,0.25)",
    borderHover: "hover:border-jcc-accent/50",
    nameColor: "text-jcc-accent",
    badgeBg: "bg-jcc-accent/15 border-jcc-accent/30 text-jcc-accent",
    avatarBg: "bg-jcc-accent/10 border-jcc-accent/30",
    ratingColor: "text-jcc-accent",
    statBarColor: "bg-jcc-accent",
  },
  NeuroStrikers: {
    gradient: "from-[#4d0014] via-[#330010] to-[#081826]",
    accentBar: "from-jcc-ball-red via-red-400 to-orange-400",
    glowColor: "rgba(255,77,77,0.20)",
    borderHover: "hover:border-jcc-ball-red/50",
    nameColor: "text-jcc-ball-red",
    badgeBg: "bg-jcc-ball-red/15 border-jcc-ball-red/30 text-jcc-ball-red",
    avatarBg: "bg-jcc-ball-red/10 border-jcc-ball-red/30",
    ratingColor: "text-jcc-ball-red",
    statBarColor: "bg-jcc-ball-red",
  },
  Unassigned: {
    gradient: "from-[#1a2535] via-[#101c2c] to-[#081826]",
    accentBar: "from-white/20 via-white/10 to-transparent",
    glowColor: "rgba(255,255,255,0.08)",
    borderHover: "hover:border-white/20",
    nameColor: "text-white",
    badgeBg: "bg-white/5 border-white/10 text-white/50",
    avatarBg: "bg-white/5 border-white/10",
    ratingColor: "text-white",
    statBarColor: "bg-white/40",
  },
};

// Deterministic stat bars based on role (no Math.random)
const roleStats: Record<string, { bat: number; bowl: number; field: number; speed: number }> = {
  "all-rounder": { bat: 82, bowl: 78, field: 85, speed: 80 },
  batter: { bat: 90, bowl: 40, field: 75, speed: 82 },
  bowler: { bat: 50, bowl: 88, field: 78, speed: 84 },
  wicketkeeper: { bat: 72, bowl: 30, field: 92, speed: 78 },
};

// MOTM count per player name (static — would come from DB in real system)
const motmCount: Record<string, number> = {
  "Opal Chaudhary": 3,
  "Nitin Setia": 2,
  "Sagar Sharma": 2,
  "Arjun Rathore": 4,
  "Rohit Meena": 1,
  "Vikram Joshi": 2,
  "Karan Patel": 1,
  "Abhijeet Singh Shekhawat": 1,
};

// Matches per player (static fallback)
const matchesPlayed: Record<string, number> = {
  "Opal Chaudhary": 24,
  "Nitin Setia": 22,
  "Sagar Sharma": 20,
  "Arjun Rathore": 18,
  "Rohit Meena": 15,
  "Vikram Joshi": 14,
  "Karan Patel": 12,
  "Abhijeet Singh Shekhawat": 19,
};

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/30 w-6 sm:w-8 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      <span className="text-[8px] sm:text-[9px] font-black text-white/40 w-4 sm:w-5 text-right">{value}</span>
    </div>
  );
}

export default function MemberCard({ member, index }: { member: Member; index: number }) {
  const theme = teamTheme[member.team] ?? teamTheme.Unassigned;
  const ratingData = roleRating[member.cricketRole] ?? { rating: 75, pos: "PLR" };
  const stats = roleStats[member.cricketRole] ?? roleStats["all-rounder"];
  const motm = motmCount[member.name] ?? 0;
  const played = matchesPlayed[member.name] ?? 10;

  // Primary tag (skip cricketRole tags, prefer status tags)
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
      <Link href={`/members/${member.id}`} className="block h-full">
        <div
          className={`relative rounded-xl sm:rounded-2xl border border-white/[0.08] ${theme.borderHover} overflow-hidden h-full transition-all duration-400 cursor-pointer`}
          style={{
            background: `linear-gradient(160deg, var(--color-jcc-navy-light, #163B61) 0%, #081826 100%)`,
            boxShadow: `0 0 0 0 ${theme.glowColor}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px -15px ${theme.glowColor}, 0 0 0 1px ${theme.glowColor}`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${theme.glowColor}`;
          }}
        >
          {/* Top Gradient Band */}
          <div className={`absolute top-0 left-0 right-0 h-[110px] sm:h-[130px] bg-gradient-to-b ${theme.gradient} opacity-80`} />

          {/* Accent stripe */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${theme.accentBar}`} />

          {/* ── FIFA Rating Badge (top-left) ── */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col items-center leading-none">
            <span className={`text-2xl sm:text-4xl font-black ${theme.ratingColor} leading-none drop-shadow-lg`}>
              {ratingData.rating}
            </span>
            <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white/40 mt-0">
              {ratingData.pos}
            </span>
          </div>

          {/* ── Status Tag (top-right) ── */}
          {primaryTag && (
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
              <span className={`px-1.5 py-0.5 sm:px-2 rounded-full border text-[7px] sm:text-[8px] font-black uppercase tracking-widest ${theme.badgeBg}`}>
                {tagLabels[primaryTag]}
              </span>
            </div>
          )}

          {/* ── Player Photo / Avatar ── */}
          <div className="relative z-10 flex justify-center pt-6 pb-3 sm:pt-5 sm:pb-3">
            <div
              className={`w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl border sm:border-2 ${theme.avatarBg} overflow-hidden flex items-center justify-center shadow-xl`}
              style={{ boxShadow: `0 8px 30px -5px ${theme.glowColor}` }}
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

          {/* ── Name & Role ── */}
          <div className="relative z-10 text-center px-3 sm:px-4 pb-2">
            <h3 className={`text-xs sm:text-base font-black uppercase tracking-tight ${theme.nameColor} leading-tight truncate`}>
              {member.name}
            </h3>
            <p className="text-[8px] sm:text-[10px] font-bold text-white/35 uppercase tracking-[0.2em] mt-0">
              {member.team}
            </p>
            {/* Speciality line */}
            <p className="text-[9px] sm:text-[11px] text-white/50 font-medium mt-1.5 sm:mt-2 leading-relaxed italic px-1 sm:px-2 line-clamp-2 sm:line-clamp-none">
              {member.shortBio}
            </p>
          </div>

          {/* ── Divider ── */}
          <div className="relative z-10 mx-3 sm:mx-4 my-3 sm:my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* ── Key Stats Row ── */}
          <div className="relative z-10 grid grid-cols-3 divide-x divide-white/[0.06] px-1 pb-3 sm:pb-3">
            {[
              { label: "Matches", value: played },
              { label: "MOTM", value: motm },
              { label: "Role", value: member.cricketRole === "all-rounder" ? "AR" : member.cricketRole.slice(0, 3).toUpperCase() },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-0.5 sm:py-1 px-1 sm:px-2">
                <span className={`text-sm sm:text-lg font-black ${theme.nameColor} leading-none`}>{s.value}</span>
                <span className="text-[7px] sm:text-[8px] uppercase tracking-widest text-white/25 font-black mt-0">{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Stat Bars ── */}
          <div className="relative z-10 px-3 sm:px-4 pb-3.5 sm:pb-4 space-y-1.5 sm:space-y-2">
            <StatBar label="BAT" value={stats.bat} color={theme.statBarColor} />
            <StatBar label="BWL" value={stats.bowl} color={theme.statBarColor} />
            <StatBar label="FLD" value={stats.field} color={theme.statBarColor} />
            <StatBar label="SPD" value={stats.speed} color={theme.statBarColor} />
          </div>

          {/* ── Batting / Bowling style footer ── */}
          <div className="relative z-10 px-3 sm:px-4 pb-4 sm:pb-4 flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
              {member.battingStyle}
            </span>
            {member.bowlingStyle !== "N/A" && (
              <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                {member.bowlingStyle}
              </span>
            )}
          </div>

          {/* Bottom glow line on hover */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${theme.accentBar} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />
        </div>
      </Link>
    </motion.div>
  );
}
