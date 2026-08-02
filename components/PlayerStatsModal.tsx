"use client";

// A member's career card — the panel /members opens off a directory card, and
// the one /seasons opens off a name in a scorecard. It lives here rather than in
// either page so the two can never drift into two different cards.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Trophy, Target, Shield, Info } from "lucide-react";
import Image from "next/image";
import type { PlayerStats } from "@/components/MemberCard";
import { getDiceBearUrl } from "@/lib/avatar";

/**
 * The card's minimum data need — a full `Member` satisfies it structurally, and
 * so does a `ClubRosterRow` resolved from a scorecard name (see
 * PlayerCareerCardProvider), which carries no `tags`/`cricketRole` of its own.
 */
export type CareerCardSubject = {
  name: string;
  image?: string | null;
  team: string;
  role: string;
  shortBio?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  joinedDate?: string | null;
};

const TEAM_COLORS: Record<string, string> = {
  Mavericks: "#E8A820",
  NeuroStrikers: "#3B6FC4",
  "The Outliers": "#1A7A5E",
  Unassigned: "#8888aa",
};

/** Headline number — one per panel, the thing the eye lands on first. */
function HeroStat({
  value,
  label,
  sub,
  accentColor,
}: {
  value: React.ReactNode;
  label: string;
  sub?: string;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="text-[2.75rem] sm:text-5xl font-black leading-[0.85] tabular-nums"
        style={{ color: accentColor }}
      >
        {value}
      </span>
      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/45 mt-2">{label}</span>
      {sub && <span className="text-[9px] text-white/25 mt-0.5">{sub}</span>}
    </div>
  );
}

/** Small supporting metric, used in the 2×N grid beside every hero stat. */
function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-lg bg-white/[0.03] px-2.5 py-2">
      <span className="text-[13px] font-black text-white tabular-nums leading-none">{value}</span>
      <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-black mt-1">{label}</span>
    </div>
  );
}

/** Score meter — 0..100 IPL-ranking score rendered as a filled track. */
function ScoreMeter({
  label,
  score,
  accentColor,
}: {
  label: string;
  score: number;
  accentColor: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="px-4 py-3 border-t border-white/[0.06]">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35">{label}</span>
        <span className="text-sm font-black tabular-nums" style={{ color: accentColor }}>
          {score}
          <span className="text-white/20 text-[10px]">/100</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="h-full rounded-full"
          style={{ background: accentColor }}
        />
      </div>
    </div>
  );
}

/** Panel shell: accent-tinted card with a titled header row. */
function StatPanel({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${accentColor}26`, background: `${accentColor}0a` }}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <span className="h-2.5 w-[3px] rounded-full" style={{ background: accentColor }} />
        <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/40">{title}</p>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30 mb-3">{children}</p>
  );
}

export default function PlayerStatsModal({
  member,
  stats,
  onClose,
}: {
  member: CareerCardSubject;
  stats: PlayerStats | undefined;
  onClose: () => void;
}) {
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => { setPhotoError(false); }, [member.image]);
  // Portalled to <body> so no ancestor transform or `overflow: hidden` can clip
  // it — the scorecard rows this opens from sit several such wrappers deep.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { batting, bowling, mvp, fielding } = stats ?? {};
  const accentColor = TEAM_COLORS[member.team] ?? "#8888aa";
  const hasBatting = !!batting;
  const hasBowling = !!bowling;
  const hasFielding = fielding && fielding.dismissals > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-static-dark relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-jcc-blue-deep shadow-2xl"
        style={{ borderColor: `${accentColor}22` }}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className="flex items-start gap-4 px-5 pt-4 pb-5"
          style={{ background: `linear-gradient(160deg, ${accentColor}26, ${accentColor}05 55%, transparent)` }}
        >
          <div
            className="portrait-frame w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 overflow-hidden flex-shrink-0"
            style={{ borderColor: `${accentColor}44`, background: `${accentColor}12` }}
          >
            {member.image && !photoError ? (
              <Image
                src={member.image}
                alt={member.name}
                width={80}
                height={80}
                loading="lazy"
                className="w-full h-full object-cover portrait-photo"
                onError={() => setPhotoError(true)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getDiceBearUrl(member.name, member.team)}
                alt={member.name}
                loading="lazy"
                className="w-full h-full object-cover portrait-photo"
              />
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight truncate">
              {member.name}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: accentColor }}>
              {member.team} · {member.role}
            </p>
            {member.shortBio && (
              <p className="text-[10px] text-white/45 mt-2 leading-relaxed italic">{member.shortBio}</p>
            )}
          </div>

          {mvp && (
            <div
              className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-2xl border flex-shrink-0 mr-10"
              style={{ borderColor: `${accentColor}44`, background: `${accentColor}14` }}
            >
              <span className="text-xl font-black leading-none" style={{ color: accentColor }}>
                {mvp.total_points.toFixed(1)}
              </span>
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/35 mt-1">MVP</span>
            </div>
          )}
        </div>

        {/* Glance strip — the numbers that answer "how good is this player?" at a look. */}
        {(hasBatting || hasBowling || hasFielding) && (
          <div className="mx-5 grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            {[
              { label: "Matches", value: batting?.matches ?? bowling?.matches ?? 0 },
              { label: "Runs", value: hasBatting ? batting!.total_runs : "—" },
              hasBowling
                ? { label: "Wickets", value: bowling!.total_wickets }
                : { label: "Dismissals", value: fielding?.dismissals ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3">
                <span className="text-xl font-black text-white tabular-nums leading-none">{value}</span>
                <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30 mt-1.5">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 pt-5 pb-8 space-y-4">
          {hasBatting && (
            <StatPanel title="Batting" accentColor={accentColor}>
              <div className="flex gap-4 px-4 pt-2 pb-4">
                <div className="w-[104px] flex-shrink-0">
                  <HeroStat
                    value={batting!.total_runs}
                    label="Runs"
                    sub={`${batting!.innings} inn · ${batting!.matches} mat`}
                    accentColor={accentColor}
                  />
                </div>
                <div className="grid flex-1 grid-cols-3 gap-1.5 self-center">
                  <StatCell label="High" value={batting!.high_score} />
                  <StatCell label="Avg" value={batting!.batting_average != null ? batting!.batting_average.toFixed(2) : "—"} />
                  <StatCell label="SR" value={batting!.strike_rate != null ? batting!.strike_rate.toFixed(1) : "—"} />
                  <StatCell label="4s" value={batting!.fours} />
                  <StatCell label="6s" value={batting!.sixes} />
                  <StatCell label="Bdry Runs" value={batting!.fours * 4 + batting!.sixes * 6} />
                </div>
              </div>
              <ScoreMeter label="Batting score · IPL ranking" score={batting!.batting_score} accentColor={accentColor} />
            </StatPanel>
          )}

          {hasBowling && (
            <StatPanel title="Bowling" accentColor={accentColor}>
              <div className="flex gap-4 px-4 pt-2 pb-4">
                <div className="w-[104px] flex-shrink-0">
                  <HeroStat
                    value={bowling!.total_wickets}
                    label="Wickets"
                    sub={`${bowling!.total_overs} ov · ${bowling!.innings} inn`}
                    accentColor={accentColor}
                  />
                </div>
                <div className="grid flex-1 grid-cols-3 gap-1.5 self-center">
                  <StatCell label="Econ" value={bowling!.economy} />
                  <StatCell label="Avg" value={bowling!.bowling_average != null ? bowling!.bowling_average.toFixed(2) : "—"} />
                  <StatCell label="Runs" value={bowling!.runs_conceded} />
                  <StatCell label="Matches" value={bowling!.matches} />
                  <StatCell label="Overs" value={bowling!.total_overs} />
                  <StatCell label="Catches" value={fielding?.catches ?? 0} />
                </div>
              </div>
              <ScoreMeter label="Bowling score · IPL ranking" score={bowling!.bowling_score} accentColor={accentColor} />
            </StatPanel>
          )}

          {mvp && mvp.total_points > 0 && (
            <StatPanel title="MVP Points" accentColor={accentColor}>
              <div className="flex items-center justify-between gap-4 px-4 pt-2 pb-4">
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: "Bat", points: mvp.batting_points },
                    { label: "Bowl", points: mvp.bowling_points },
                    { label: "Field", points: mvp.fielding_points },
                  ].map(({ label, points }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="w-8 text-[8px] font-black uppercase tracking-[0.2em] text-white/35">{label}</span>
                      <div className="h-1 flex-1 rounded-full bg-white/[0.07] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            // Bars read as a share of this player's own total,
                            // so the three of them always fill the panel.
                            width: `${mvp.total_points > 0 ? Math.min(100, (points / mvp.total_points) * 100) : 0}%`,
                          }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                          className="h-full rounded-full bg-white/50"
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] font-black text-white tabular-nums">
                        {points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-center pl-4 border-l border-white/[0.08]">
                  <p className="text-4xl font-black leading-none" style={{ color: accentColor }}>
                    {mvp.total_points.toFixed(1)}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30 mt-1.5">Total</p>
                </div>
              </div>
            </StatPanel>
          )}

          {hasFielding && !hasBowling && (
            <StatPanel title="Fielding" accentColor={accentColor}>
              <div className="flex items-center gap-4 px-4 pt-2 pb-4">
                <span className="text-4xl font-black leading-none" style={{ color: accentColor }}>
                  {fielding!.dismissals}
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Dismissals</p>
                  <p className="text-[9px] text-white/30 mt-0.5">
                    {fielding!.catches} ct · {fielding!.stumpings} st · {fielding!.run_outs} ro
                  </p>
                </div>
              </div>
            </StatPanel>
          )}

          <div className="pt-1">
            <SectionLabel>Cricket Profile</SectionLabel>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
              {[
                { icon: Target, label: "Batting Style", value: member.battingStyle || "—" },
                { icon: Shield, label: "Bowling Style", value: !member.bowlingStyle || member.bowlingStyle === "N/A" ? "None" : member.bowlingStyle },
                { icon: Trophy, label: "Primary Role", value: member.role },
                { icon: Info, label: "Joined JCC", value: member.joinedDate ? new Date(member.joinedDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black">{label}</p>
                  <p className="ml-auto text-[11px] font-black text-white text-right">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {!hasBatting && !hasBowling && !hasFielding && (
            <div className="text-center py-6 border border-white/[0.06] rounded-xl bg-white/[0.02]">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">
                No match stats recorded yet
              </p>
              <p className="text-[9px] text-white/15 mt-1">Stats appear after match data is imported</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
