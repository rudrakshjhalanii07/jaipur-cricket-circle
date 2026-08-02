"use client";

import { useRef, useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Star,
  TrendingUp,
  History,
  ChevronRight,
  ChevronLeft,
  Swords,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Newspaper,
  ExternalLink,
  Sparkles,
  Users,
  MapPin,
  Clock,
} from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { photoFor, type PlayerPhotoMap } from "@/lib/player-photos";
import { type ClubRosterRow } from "@/lib/club-roster";
import { fadeUp, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";
import { type Season } from "@/lib/seasons";
import {
  computeOverallStandings,
  type FullSeries,
  type FullSeriesMatch,
  type SeriesMatch,
  type SeriesStandingRow,
  type BattingLeaderRow,
  type BowlingLeaderRow,
  type MVPRow,
  type FieldingRow,
  type PlayerPoolRow,
  type BattingPerf,
  type FallOfWicket,
} from "@/lib/series";
import { runOutFielders } from "@/lib/mvp";
import {
  resolveBracket,
  resolveVenue,
  type ScheduledFixture,
} from "@/lib/season-schedule";
import { TEAMS, type TeamId } from "@/lib/teams";
import PlayersPoolModal from "@/components/PlayersPoolModal";
import PlayerCareerCardProvider, { usePlayerClick } from "@/components/PlayerCareerCardProvider";

// ── Date formatting ───────────────────────────────────────────────────────────
// Intl abbreviations differ between the Node build and browser ICU data
// ("Sep" vs "Sept"), which breaks hydration. Format these by hand instead.
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function fmtDayMonth(value: string | Date) {
  const d = new Date(value);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmtDayMonthYear(value: string | Date) {
  const d = new Date(value);
  return `${fmtDayMonth(d)} ${d.getFullYear()}`;
}

function fmtMonthYear(value: string | Date) {
  const d = new Date(value);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtWeekdayDayMonth(value: string | Date) {
  const d = new Date(value);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${fmtDayMonth(d)}`;
}

// ── Animated counting number ──────────────────────────────────────────────────
function AnimatedNumber({
  target,
  className = "",
  duration = 1600,
  style,
}: {
  target: number;
  className?: string;
  duration?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = Math.max(duration / (target || 1), 40);
    const interval = setInterval(() => {
      if (start < target) {
        start++;
        setCount(start);
      } else {
        clearInterval(interval);
      }
    }, step);
    return () => clearInterval(interval);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {count}
    </span>
  );
}

// ── Team logo with shortName fallback ────────────────────────────────────────
function TeamLogo({
  src,
  alt,
  color,
  fallback,
  className = "",
  style,
}: {
  src?: string;
  alt: string;
  color: string;
  fallback: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <span
        className="font-black text-xl sm:text-2xl select-none"
        style={{ color, ...style }}
      >
        {fallback}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setErr(true)}
    />
  );
}

// ── Season team helpers ───────────────────────────────────────────────────────
// Everything below is driven by season.teams, so a 2-captain legacy era, the
// 3-captain era and Season 3's four teams all render through the same code.

interface SeasonTeamView {
  id: TeamId;
  label: string;
  short: string;
  logo: string;
  color: string;
  captain: string | null;
  wins: number;
  playoffWins: number;
  ties: number;
}

function seasonTeamViews(season: Season): SeasonTeamView[] {
  return season.teams.map((t) => {
    const cfg = TEAMS[t.team_id];
    return {
      id: t.team_id,
      label: cfg?.name ?? t.team_id,
      short: cfg?.shortName ?? t.team_id.slice(0, 3).toUpperCase(),
      logo: cfg?.logo ?? "",
      color: cfg?.primary ?? "#888",
      captain: t.captain,
      wins: t.main_wins,
      playoffWins: t.playoff_wins,
      ties: t.main_ties + t.playoff_ties,
    };
  });
}

// ── Season header — identity, dates, captains ─────────────────────────────────
export function SeasonHeader({
  season,
  archived = false,
}: {
  season: Season;
  archived?: boolean;
}) {
  const teams = seasonTeamViews(season);
  const leader = teams.reduce<SeasonTeamView | null>(
    (best, t) => (!best || t.wins > best.wins ? t : best),
    null,
  );
  // These rows are reserved grid-wide so every card stays aligned, but a season
  // where nobody leads or ties yet would reserve them for nothing — leaving a
  // block of dead space under "Wins".
  const showLeaderRow = (leader?.wins ?? 0) > 0;
  const showTiesRow = teams.some((t) => t.ties > 0);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] shadow-[0_15px_40px_rgba(0,0,0,0.35)]">
      {teams.map((t, i) => (
        <div
          key={t.id}
          className="absolute top-0 w-32 h-32 blur-[80px] pointer-events-none opacity-[0.12]"
          style={{
            background: t.color,
            left: `${(i / teams.length) * 100}%`,
            transform: "translateX(-50%)",
          }}
        />
      ))}

      <div className="relative flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {!archived && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-jcc-accent" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-jcc-accent">
              {archived ? "Archived" : "Active"} Season · {teams.length} Teams
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/50">
            <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
            {archived
              ? season.ended_at
                ? `Concluded ${fmtDayMonthYear(season.ended_at)}`
                : "Concluded"
              : season.started_at
                ? `Started ${fmtWeekdayDayMonth(season.started_at)}`
                : "Season under way"}
          </div>
        </div>
        <span className="shrink-0 text-[10px] text-white/40 font-bold px-3 py-1 bg-white/[0.05] rounded-full inline-flex items-center justify-center text-center">
          {season.season_label ||
            (archived ? "Archived Season" : "Current Season")}
        </span>
      </div>

      <div className="relative p-6 sm:p-10">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-1.5">
            <span className="h-px w-8 bg-white/15" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
              {season.season_label || "Season"}
            </span>
            <span className="h-px w-8 bg-white/15" />
          </div>
          <h2 className="font-black text-white uppercase leading-none">
            {/* Constant club banner — not the season title, which stays per-season data. */}
            <span className="text-4xl sm:text-6xl tracking-tight">
              The Matrix
            </span>
          </h2>
          <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mt-2">
            4 Teams. 1 Champion.
          </p>
        </div>

        <div className="pt-4 grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          {teams.map((t) => {
            const isLeader = leader?.id === t.id && t.wins > 0;
            return (
              <div
                key={t.id}
                className="flex flex-col items-center text-center"
              >
                <div className="relative w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-[0.12] pointer-events-none"
                    style={{ background: t.color }}
                  />
                  <TeamLogo
                    src={t.logo}
                    alt={t.label}
                    color={t.color}
                    fallback={t.short}
                    className="relative w-full h-full object-contain"
                    style={{ filter: `drop-shadow(0 0 8px ${t.color}40)` }}
                  />
                </div>
                <div className="mt-3 flex flex-col items-center justify-start min-h-[2.5rem] px-1">
                  <span className="text-[7px] sm:text-[8px] text-white/35 font-black uppercase tracking-[0.2em]">
                    Captain
                  </span>
                  <span className="mt-0.5 text-[10px] sm:text-xs text-white font-black leading-tight text-center text-balance">
                    {t.captain ?? "—"}
                  </span>
                </div>
                <AnimatedNumber
                  target={t.wins}
                  duration={1200}
                  className="text-3xl sm:text-4xl font-black tabular-nums"
                  style={{
                    color: t.color,
                    textShadow: `0 0 10px ${t.color}30`,
                  }}
                />
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/25">
                  Wins
                </span>
                {showLeaderRow && (
                  <div className="h-5 flex items-center justify-center mt-0.5">
                    {isLeader && (
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-jcc-gold" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-jcc-gold">
                          Leading
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {showTiesRow && (
                  <div className="h-4 flex items-center justify-center">
                    {t.ties > 0 && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
                        {t.ties} {t.ties === 1 ? "Tie" : "Ties"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06]">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            League Wins
          </span>
          <span className="text-sm font-black text-white mt-1 flex flex-wrap gap-x-2">
            {teams.map((t) => (
              <span key={t.id} style={{ color: t.color }}>
                {t.short} {t.wins}
              </span>
            ))}
          </span>
        </div>
        <div className="px-6 py-4 flex flex-col justify-center border-b sm:border-b-0 sm:border-r border-white/[0.06]">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            Playoff Wins
          </span>
          {teams.every((t) => t.playoffWins === 0) ? (
            <span className="text-xs font-black text-jcc-accent-dark/80 uppercase tracking-wider mt-1.5 italic">
              Bracket not played yet
            </span>
          ) : (
            <span className="text-sm font-black text-white mt-1 flex flex-wrap gap-x-2">
              {teams.map((t) => (
                <span key={t.id} style={{ color: t.color }}>
                  {t.short} {t.playoffWins}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="px-6 py-4 flex flex-col justify-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            Total Matches Played
          </span>
          <span className="text-lg font-black text-jcc-accent mt-1">
            {season.total_matches_played} Recorded{" "}
            <span className="text-white/30 font-bold text-sm">[League]</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── League Table ──────────────────────────────────────────────────────────────
// The page's centre of gravity. Works for any team count; when the season has
// more teams than playoff berths, the qualifying cut is marked on the table.

/** Last N results per team, most recent first: W / L / T. */
function formGuide(
  matches: SeriesMatch[],
  teamId: TeamId,
  limit = 5,
): Array<"W" | "L" | "T"> {
  return matches
    .filter(
      (m) =>
        m.stage === "league" &&
        (m.winner_id || m.is_tie) &&
        (m.team1_id === teamId || m.team2_id === teamId),
    )
    .sort(
      (a, b) =>
        (b.match_date ?? "").localeCompare(a.match_date ?? "") ||
        b.match_no - a.match_no,
    )
    .slice(0, limit)
    .map((m) =>
      m.is_tie && !m.winner_id ? "T" : m.winner_id === teamId ? "W" : "L",
    );
}

const FORM_STYLE: Record<"W" | "L" | "T", string> = {
  W: "bg-emerald-500/80 text-black",
  L: "bg-red-500/70 text-white",
  T: "bg-white/25 text-white",
};

export function SeasonLeagueTable({
  standings,
  matches,
  playoffBerths = 0,
  title = "League Table",
}: {
  standings: SeriesStandingRow[];
  matches: SeriesMatch[];
  playoffBerths?: number;
  title?: string;
}) {
  if (standings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-white/35">
          No matches played yet
        </p>
        <p className="mt-2 text-xs text-white/25 font-medium">
          The table fills in as results come in.
        </p>
      </div>
    );
  }

  const showCut = playoffBerths > 0 && standings.length > playoffBerths;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/60">
          {title}
        </h3>
        {showCut && (
          <span className="text-[10px] font-black uppercase tracking-widest text-jcc-gold/80">
            Top {playoffBerths} qualify
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-white/45">
              <th className="px-3 py-2.5 w-8">#</th>
              <th className="px-3 py-2.5">Team</th>
              <th className="px-2 py-2.5 text-center tabular-nums">P</th>
              <th className="px-2 py-2.5 text-center tabular-nums">W</th>
              <th className="px-2 py-2.5 text-center tabular-nums">T</th>
              <th className="px-2 py-2.5 text-center tabular-nums">L</th>
              <th className="px-2 py-2.5 text-center tabular-nums text-jcc-accent/70">
                Pts
              </th>
              <th className="px-2 py-2.5 text-center tabular-nums">NRR</th>
              <th className="px-3 py-2.5 text-right">Form</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const cfg = TEAMS[row.team_id];
              const color = cfg?.primary ?? "#888";
              const form = formGuide(matches, row.team_id);
              const qualifying = showCut && i < playoffBerths;
              return (
                <tr
                  key={row.team_id}
                  className={`border-t border-white/[0.05] transition-colors hover:bg-white/[0.03] ${
                    showCut && i === playoffBerths - 1
                      ? "border-b-2 border-b-jcc-gold/25"
                      : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-[13px] font-black tabular-nums"
                      style={
                        qualifying
                          ? {
                              background: "rgba(212,175,55,0.15)",
                              color: "#D4AF37",
                            }
                          : { color: "rgba(255,255,255,0.3)" }
                      }
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-1 h-6 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <TeamLogo
                        src={cfg?.logo}
                        alt={cfg?.name ?? row.team_id}
                        color={color}
                        fallback={cfg?.shortName ?? "?"}
                        className="w-7 h-7 object-contain shrink-0 hidden sm:block"
                      />
                      <span className="text-sm font-black text-white truncate">
                        <span className="sm:hidden">
                          {cfg?.shortName ?? row.team_id}
                        </span>
                        <span className="hidden sm:inline">
                          {cfg?.name ?? row.team_id}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-sm font-bold text-white/60 tabular-nums">
                    {row.played}
                  </td>
                  <td className="px-2 py-3 text-center text-sm font-black text-white tabular-nums">
                    {row.won}
                  </td>
                  <td className="px-2 py-3 text-center text-sm font-bold text-white/60 tabular-nums">
                    {row.tied}
                  </td>
                  <td className="px-2 py-3 text-center text-sm font-bold text-white/60 tabular-nums">
                    {row.lost}
                  </td>
                  <td className="px-2 py-3 text-center text-base font-black text-jcc-accent tabular-nums">
                    {row.points}
                  </td>
                  <td className="px-2 py-3 text-center text-[13px] font-mono font-bold tabular-nums text-white/70">
                    {row.nrr > 0 ? "+" : ""}
                    {row.nrr.toFixed(2)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {form.length === 0 ? (
                        <span className="text-xs text-white/25">—</span>
                      ) : (
                        form.map((f, j) => (
                          <span
                            key={j}
                            title={
                              f === "W" ? "Won" : f === "L" ? "Lost" : "Tied"
                            }
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${FORM_STYLE[f]}`}
                          >
                            {f}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5 border-t border-white/[0.06] bg-white/[0.01]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          2 pts a win · 1 a tie · NRR breaks ties · form newest first
        </p>
      </div>
    </div>
  );
}

// ── Legacy Archived Era Card ────────────────────────────────────────────────
function ArchivedEraCard({
  season,
  hasDetail = false,
}: {
  season: Season;
  hasDetail?: boolean;
}) {
  const teams = seasonTeamViews(season);
  const captainCols =
    teams.length >= 4
      ? "grid-cols-2 sm:grid-cols-4"
      : teams.length === 3
        ? "grid-cols-3"
        : "grid-cols-2";

  const card = (
    <motion.div
      variants={fadeUp}
      className={`group relative rounded-xl border border-white/[0.06] overflow-hidden p-6 transition-all duration-300 hover:border-white/15 bg-gradient-to-br from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] hover:shadow-[0_15px_35px_-10px_rgba(0,0,0,0.5)] ${hasDetail ? "cursor-pointer" : ""}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
      <div className="flex items-center justify-between mb-4 border-b border-white/[0.04] pb-3">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
            Archived Season · {teams.length} Teams
          </span>
        </div>
        <span className="text-[8px] font-black uppercase tracking-widest text-white/25 px-2 py-0.5 bg-white/5 border border-white/10 rounded">
          {season.season_label || "Legacy Era"}
        </span>
      </div>
      <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-jcc-accent transition-colors duration-300">
        {season.title}
      </h3>
      <div
        className={`grid ${captainCols} gap-4 mt-3 py-3 px-3 bg-white/[0.01] border border-white/[0.03] rounded-lg`}
      >
        {teams.map((t) => (
          <div key={t.id}>
            <span
              className="text-[8px] font-black uppercase tracking-widest"
              style={{ color: `${t.color}80` }}
            >
              {t.short} Cap
            </span>
            <p className="text-xs font-black text-white/80">
              {t.captain ?? "—"}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40 shrink-0">League</span>
          <span className="font-mono font-black text-white text-right flex flex-wrap justify-end gap-x-2">
            {teams.map((t) => (
              <span key={t.id} style={{ color: t.color }}>
                {t.short} {t.wins}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs border-b border-white/[0.04] pb-1.5">
          <span className="font-bold text-white/40 shrink-0">Playoffs</span>
          <span className="font-mono font-black text-white text-right flex flex-wrap justify-end gap-x-2">
            {teams.map((t) => (
              <span key={t.id} style={{ color: t.color }}>
                {t.short} {t.playoffWins}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="font-bold text-white/40">Total Matches</span>
          <span className="font-mono font-black text-jcc-accent">
            {season.total_matches_played} Matches
          </span>
        </div>
      </div>
      {season.notes && (
        <p className="mt-4 text-[10px] text-white/35 font-medium leading-relaxed italic border-t border-white/[0.04] pt-3">
          "{season.notes}"
        </p>
      )}
      {hasDetail && (
        <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-jcc-accent transition-colors duration-300">
          View Full Season
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
        </div>
      )}
    </motion.div>
  );

  return hasDetail ? (
    <Link href={`/seasons/${season.id}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

// ── Series Progression Timeline ───────────────────────────────────────────────
export function SeriesProgression({ series }: { series: FullSeries[] }) {
  const all = series.flatMap((s) =>
    s.matches.map((m) => ({ m, seriesNo: s.series_no })),
  );
  const ordered = all
    .filter(({ m }) => m.stage === "league" && (m.winner_id || m.is_tie))
    .sort(
      (a, b) =>
        (a.m.match_date ?? "").localeCompare(b.m.match_date ?? "") ||
        a.seriesNo - b.seriesNo ||
        a.m.match_no - b.m.match_no,
    );

  if (ordered.length === 0) return null;

  // Teams come from the matches themselves, so this chart tracks however many
  // sides the season fielded rather than a fixed three.
  const ids = [
    ...new Set(
      ordered.flatMap(({ m }) =>
        [m.team1_id, m.team2_id].filter((id): id is TeamId => !!id),
      ),
    ),
  ];

  const running: Record<string, number> = Object.fromEntries(
    ids.map((id) => [id, 0]),
  );
  const points = ordered.map(({ m, seriesNo }) => {
    if (m.winner_id && m.winner_id in running) running[m.winner_id]++;
    return {
      wins: { ...running }, // snapshot of the cumulative tally at this match
      seriesNo,
      matchNo: m.match_no,
      date: m.match_date,
      tie: m.is_tie && !m.winner_id,
    };
  });
  const last = points[points.length - 1];
  const shown = ids.filter((id) => (last.wins[id] ?? 0) > 0);
  const maxV = Math.max(...ids.map((id) => last.wins[id] ?? 0), 1);

  return (
    <div className="relative rounded-2xl border border-white/[0.08] overflow-hidden p-6 bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-jcc-accent" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.35em] text-white/50">
          Match-by-Match Progression
        </h3>
      </div>
      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-end gap-3 min-w-max px-0.5">
          {points.map((p, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 w-12 shrink-0"
            >
              <div className="w-full flex items-end justify-center gap-0.5 h-24">
                {shown.map((id) => (
                  <motion.div
                    key={id}
                    className="rounded-t"
                    style={{
                      width: `${Math.max(60 / shown.length, 16)}%`,
                      background: TEAMS[id].primary,
                      alignSelf: "flex-end",
                    }}
                    initial={{ height: 0 }}
                    whileInView={{
                      height: `${Math.max(((p.wins[id] ?? 0) / maxV) * 90, 6)}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.05,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>
              <span className="text-[8px] font-black text-white/45 leading-none tracking-wide">
                S{p.seriesNo}·M{p.matchNo}
              </span>
              <span className="text-[7px] text-white/25 leading-none">
                {p.date ? fmtDayMonth(p.date) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {shown.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: TEAMS[id].primary }}
            />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
              {TEAMS[id].name}
            </span>
          </div>
        ))}
        <span className="text-[8px] text-white/20 ml-auto">
          S = Series · M = Match · cumulative league wins
        </span>
      </div>
    </div>
  );
}

// ── 3-Way Scoreline ───────────────────────────────────────────────────────────

// ── Stats Leaderboards ────────────────────────────────────────────────────────
type StatsTab = "batting" | "bowling" | "mvp" | "fielding";

export type LeaderboardSet = {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  mvp: MVPRow[];
  fielding: FieldingRow[];
};

/**
 * One leaderboard entry, flattened out of whichever stat table is on screen so
 * the podium and the ranked list never have to know which tab they render.
 */
type LeaderEntry = {
  name: string;
  teamId?: string;
  /** The stat the board is ranked by — the big number. */
  headline: { label: string; value: React.ReactNode };
  /** Supporting stats, most interesting first (the list only shows a few). */
  stats: { label: string; value: React.ReactNode }[];
  /**
   * The ranked-on number, kept numeric so the board can spot level players.
   * The headline is already formatted for display and no use for comparing.
   */
  tieKey: number;
};

/**
 * How each board separates players level on the headline number, in the order
 * it tries them. Shown on the tie badge, because a reader looking at two rows
 * both saying "4" deserves to know what put one above the other.
 */
const TIEBREAK_RULE: Record<StatsTab, string> = {
  batting: "strike rate, then average, then name",
  bowling: "economy, then runs conceded, then name",
  mvp: "all-round balance, then runs, then name",
  fielding: "run outs, then stumpings, then name",
};

const fmt = (n: number | null | undefined, digits: number) =>
  n != null ? n.toFixed(digits) : "—";

/**
 * Dismissal counts come through as fractions (a run out is split between the
 * fielders named), so "3" stays "3" while a shared one shows its 3.5 or 3.33.
 * Two decimals is where a three-way split stops looking like a typo.
 */
const fmtCount = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

function toEntries(tab: StatsTab, set: LeaderboardSet): LeaderEntry[] {
  switch (tab) {
    case "batting":
      return set.batting.map((r) => ({
        name: r.player_name,
        teamId: r.team_id,
        headline: { label: "Runs", value: r.total_runs },
        tieKey: r.total_runs,
        stats: [
          { label: "SR", value: fmt(r.strike_rate, 1) },
          { label: "Avg", value: fmt(r.batting_average, 2) },
          { label: "HS", value: r.high_score },
          { label: "M", value: r.matches },
          { label: "Inn", value: r.innings },
          { label: "4s", value: r.fours },
          { label: "6s", value: r.sixes },
        ],
      }));
    case "bowling":
      return set.bowling.map((r) => ({
        name: r.player_name,
        teamId: r.team_id,
        headline: { label: "Wickets", value: r.total_wickets },
        tieKey: r.total_wickets,
        stats: [
          { label: "Econ", value: r.economy },
          { label: "Avg", value: fmt(r.bowling_average, 2) },
          { label: "Ov", value: r.total_overs },
          { label: "M", value: r.matches },
          { label: "Inn", value: r.innings },
          { label: "Runs", value: r.runs_conceded },
        ],
      }));
    case "mvp":
      return set.mvp.map((r) => ({
        name: r.player_name,
        teamId: r.team_id,
        headline: { label: "MVP", value: r.total_points.toFixed(1) },
        tieKey: r.total_points,
        stats: [
          { label: "Bat", value: fmt(r.batting_points, 1) },
          { label: "Bowl", value: fmt(r.bowling_points, 1) },
          { label: "Field", value: fmt(r.fielding_points, 1) },
          { label: "M", value: r.matches },
          { label: "Runs", value: r.total_runs },
          { label: "Wkts", value: r.total_wickets },
        ],
      }));
    case "fielding":
      return set.fielding.map((r) => ({
        name: r.player_name,
        teamId: r.team_id,
        headline: { label: "Dismissals", value: fmtCount(r.dismissals) },
        tieKey: r.dismissals,
        stats: [
          { label: "Ct", value: r.catches },
          { label: "St", value: r.stumpings },
          // Head count, not credit: a fielder who combined on two run outs was
          // in on 2, even though the headline only pays him 0.5 for each. The
          // dagger marks that gap — without it Kunwar Gaurav reads "RO 2" on a
          // headline of 5 and the missing point looks like a bug.
          {
            label: "RO",
            value:
              r.run_outs_involved - r.run_outs > 0.001 ? (
                <>
                  {r.run_outs_involved}
                  <span
                    className="text-[#D4AF37]/70 align-super text-[0.6em] ml-px"
                    title={`${fmtCount(r.run_outs)} credited — the rest were shared`}
                  >
                    †
                  </span>
                </>
              ) : (
                r.run_outs_involved
              ),
          },
        ],
      }));
  }
}

/** "SR 171.9" — the unit the supporting stats are rendered in everywhere. */
function StatChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
        {label}
      </span>
      <span className="text-[13px] font-black tabular-nums text-white/80">
        {value}
      </span>
    </div>
  );
}

function TeamTag({ teamId }: { teamId?: string }) {
  const team = teamId ? TEAMS[teamId as keyof typeof TEAMS] : undefined;
  if (!team) return null;
  return (
    <span
      className="text-[9px] font-black uppercase tracking-[0.18em] truncate"
      style={{ color: team.primary }}
    >
      {team.name}
    </span>
  );
}

const PODIUM_ORDER = ["#D4AF37", "#C8D2E0", "#B87333"] as const;

/**
 * "Tied" pill — the visible half of the tiebreak. Two rows both reading 4 look
 * like the board is picking an order at random; this says they are level on the
 * headline and names the rule that separated them.
 */
function TieBadge({ tab, value }: { tab: StatsTab; value: number }) {
  return (
    <span
      title={`Level on ${fmtCount(value)} — separated by ${TIEBREAK_RULE[tab]}`}
      className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-1.5 py-px text-[7px] font-black uppercase tracking-[0.15em] text-white/45"
    >
      Tied
    </span>
  );
}

/** Ranks 1–3, as portrait cards. The leader sits raised and gold-ringed. */
function PodiumCard({
  entry,
  rank,
  tab,
  tied,
}: {
  entry: LeaderEntry;
  rank: number;
  tab: StatsTab;
  tied: boolean;
}) {
  const color = PODIUM_ORDER[rank - 1];
  const lead = rank === 1;
  return (
    // Three stacked podium columns eat the whole phone screen, so below sm the
    // card lays itself out as one dense row — badge, face, name, headline — with
    // the stats strip underneath. From sm up it's the original centred column.
    <div
      className={`relative flex flex-col rounded-2xl border px-3 py-3 sm:px-4 sm:pt-7 sm:pb-4 transition-transform ${
        lead
          ? "border-jcc-accent/40 bg-jcc-accent/[0.06] shadow-[0_0_28px_-12px_rgba(212,175,55,0.55)] sm:-translate-y-2"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 sm:flex-col sm:gap-0 sm:text-center">
        <span
          className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-[10px] font-black text-jcc-blue sm:absolute sm:-top-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-7 sm:h-7 sm:text-[11px]"
          style={{ background: color }}
        >
          {tied ? `${rank}=` : rank}
        </span>
        <ScorecardFace
          name={entry.name}
          teamId={entry.teamId ?? null}
          size={128}
          className={`shrink-0 rounded-full overflow-hidden ring-2 ${lead ? "w-11 h-11 sm:w-16 sm:h-16 ring-jcc-accent/60" : "w-11 h-11 sm:w-14 sm:h-14 ring-white/10"}`}
        />
        <div className="min-w-0 flex-1 sm:flex-none sm:mt-3 sm:w-full">
          <p className="font-black text-white text-sm leading-tight truncate">
            {entry.name}
          </p>
          <div className="flex items-center gap-1.5 sm:justify-center">
            <TeamTag teamId={entry.teamId} />
            {tied && <TieBadge tab={tab} value={entry.tieKey} />}
          </div>
        </div>
        <div className="shrink-0 text-right sm:mt-3 sm:text-center">
          <p className="font-black tabular-nums leading-none text-2xl sm:text-[28px] text-[#D4AF37]">
            {entry.headline.value}
          </p>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30 mt-1">
            {entry.headline.label}
          </p>
        </div>
      </div>
      {entry.stats.length > 0 && (
        <div className="mt-2.5 pt-2.5 sm:mt-3 sm:pt-3 w-full border-t border-white/[0.06] flex flex-wrap justify-center gap-x-4 gap-y-1">
          {entry.stats.slice(0, 4).map((s) => (
            <StatChip key={s.label} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Ranks 4 and below — one dense row each, no horizontal scrolling. */
function LeaderRow({
  entry,
  rank,
  tab,
  tied,
}: {
  entry: LeaderEntry;
  rank: number;
  tab: StatsTab;
  tied: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-xl border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
      <span className="w-5 shrink-0 text-right font-black tabular-nums text-white/20 text-xs">
        {tied ? `${rank}=` : rank}
      </span>
      <ScorecardFace
        name={entry.name}
        teamId={entry.teamId ?? null}
        size={72}
        className="w-8 h-8 rounded-full overflow-hidden shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="font-black text-white text-[13px] leading-tight truncate">
          {entry.name}
        </p>
        <div className="flex items-center gap-1.5">
          <TeamTag teamId={entry.teamId} />
          {tied && <TieBadge tab={tab} value={entry.tieKey} />}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-5 shrink-0">
        {entry.stats.slice(0, 4).map((s) => (
          <StatChip key={s.label} {...s} />
        ))}
      </div>
      <div className="flex sm:hidden items-center gap-3 shrink-0">
        {entry.stats.slice(0, 2).map((s) => (
          <StatChip key={s.label} {...s} />
        ))}
      </div>
      <span className="w-12 shrink-0 text-right font-black tabular-nums text-[#D4AF37] text-base">
        {entry.headline.value}
      </span>
    </div>
  );
}

/**
 * What the fielding count is actually made of.
 *
 * "8 dismissals" hides the difference between eight catches and a season of
 * run outs, and the halves in the column need explaining the first time anyone
 * sees a 3.5 — so the board totals sit under the list with the rule that
 * produced them.
 */
function FieldingBreakdown({ rows }: { rows: FieldingRow[] }) {
  const total = (pick: (r: FieldingRow) => number) =>
    rows.reduce((sum, r) => sum + pick(r), 0);

  const parts = [
    { label: "Catches", value: total((r) => r.catches) },
    { label: "Stumpings", value: total((r) => r.stumpings) },
    { label: "Run outs", value: total((r) => r.run_outs) },
  ];

  return (
    <div className="mt-5 pt-4 border-t border-white/[0.06] px-2">
      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 mb-2.5">
        How the count breaks down
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-baseline gap-1.5">
            <span className="text-base font-black tabular-nums text-[#D4AF37]">
              {fmtCount(p.value)}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
              {p.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-white/25 mt-2.5 leading-relaxed">
        The RO column counts every run out a fielder was in on. The dismissals
        total pays for them: one off a single throw counts 1, and when two
        combine they take half each — no one gets to argue the throw was harder
        than the catch. <span className="text-[#D4AF37]/70">†</span> marks a
        fielder whose run outs were shared, so his RO count runs ahead of what
        the total credits him; the halves show up as a .5 down the table.
      </p>
    </div>
  );
}

export function StatsLeaderboards({
  season,
  career,
  seasonLabel = "This Season",
}: {
  /** One season's matches — league AND playoffs together, per the IPL cap convention. */
  season: LeaderboardSet;
  /** Every season the club has ever played. */
  career: LeaderboardSet;
  /** Names the season tab, e.g. "Season 3". */
  seasonLabel?: string;
}) {
  const [tab, setTab] = useState<StatsTab>("batting");
  const [scope, setScope] = useState<"season" | "career">("season");
  const set = scope === "season" ? season : career;
  const entries = toEntries(tab, set).slice(0, 10);
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Who shares their headline number with someone else on the board. Counted
  // across the whole top 10, not just the slice being drawn, so a player on the
  // podium level with someone in the chasing pack is still marked tied.
  const tiedKeys = new Set(
    entries
      .map((e) => e.tieKey)
      .filter((k, i, all) => all.indexOf(k) !== i),
  );
  const isTied = (e: LeaderEntry) => tiedKeys.has(e.tieKey);

  const tabs: { id: StatsTab; label: string; short: string }[] = [
    { id: "batting", label: "Batting", short: "Bat" },
    { id: "bowling", label: "Bowling", short: "Bowl" },
    { id: "mvp", label: "MVP", short: "MVP" },
    { id: "fielding", label: "Fielding", short: "Field" },
  ];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        {(["season", "career"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-all ${
              scope === s
                ? "bg-[#D4AF37] text-jcc-blue shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                : "text-white/30 hover:text-white/55 bg-white/[0.04] border border-white/[0.08]"
            }`}
          >
            {s === "season" ? seasonLabel : "Career History"}
          </button>
        ))}
        <span className="ml-auto text-[8px] text-white/20 font-bold">
          {scope === "season"
            ? "League + playoffs · the full season"
            : "All-time · every season the club has played"}
        </span>
      </div>
      <div className="flex border-b border-white/[0.08] mt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.id ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/30 hover:text-white/50"}`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-white/20 text-xs py-12">
          No data yet — import matches to see stats
        </p>
      ) : (
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 sm:pt-3">
            {podium.map((e, i) => (
              <PodiumCard
                key={e.name}
                entry={e}
                rank={i + 1}
                tab={tab}
                tied={isTied(e)}
              />
            ))}
          </div>
          {rest.length > 0 && (
            <div className="mt-6">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 px-2 mb-1">
                Chasing pack
              </p>
              {rest.map((e, i) => (
                <LeaderRow
                  key={e.name}
                  entry={e}
                  rank={i + 4}
                  tab={tab}
                  tied={isTied(e)}
                />
              ))}
            </div>
          )}
          {tab === "mvp" && (
            <p className="text-[9px] text-white/25 uppercase tracking-widest mt-5 px-2">
              MVP points · 10 runs = 1 pt · wickets priced by the batter taken · fielding counted
            </p>
          )}
          {tab === "fielding" && <FieldingBreakdown rows={set.fielding} />}
        </div>
      )}
    </div>
  );
}

// ── Section Heading ───────────────────────────────────────────────────────────
export function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="mb-6 border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] sm:tracking-[0.35em] text-jcc-accent">
          <span className="w-1 h-3.5 rounded-full bg-jcc-accent shrink-0" />
          {eyebrow}
        </span>
        <h2 className="mt-3 text-4xl sm:text-5xl font-black text-white tracking-tight">
          {title}
        </h2>
      </div>
      {aside && (
        <p className="text-sm text-white/50 font-bold max-w-xs sm:text-right">
          {aside}
        </p>
      )}
    </div>
  );
}

// ── Points Table ──────────────────────────────────────────────────────────────
function PointsTable({
  rows,
  compact = false,
}: {
  rows: SeriesStandingRow[];
  compact?: boolean;
}) {
  if (rows.length === 0) return null;
  const fmtNRR = (nrr: number) => `${nrr >= 0 ? "+" : ""}${nrr.toFixed(3)}`;
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table
        className={`w-full ${compact ? "max-w-md text-xs min-w-0 [&_th]:px-1.5 [&_td]:px-1.5" : "text-sm min-w-[360px] [&_th]:px-2.5 [&_td]:px-2.5"}`}
      >
        <thead>
          <tr className="text-[9px] text-jcc-accent/60 uppercase tracking-widest border-b border-white/[0.05]">
            <th className="text-left pb-2">Team</th>
            <th className="text-center pb-2 w-7">P</th>
            <th className="text-center pb-2 w-7">W</th>
            <th className="text-center pb-2 w-7">T</th>
            <th className="text-center pb-2 w-7">L</th>
            <th className="text-center pb-2 w-9">Pts</th>
            <th className="text-center pb-2 w-16">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color =
              TEAMS[r.team_id as keyof typeof TEAMS]?.primary ?? "#888";
            const name =
              TEAMS[r.team_id as keyof typeof TEAMS]?.name ?? r.team_id;
            return (
              <tr
                key={r.team_id}
                className={`border-b border-white/[0.03] ${i === 0 ? "bg-jcc-accent/[0.05] shadow-[inset_0_0_20px_rgba(212,175,55,0.08)]" : ""}`}
              >
                <td
                  className={`py-1.5 font-black ${compact ? "pr-1 truncate max-w-[110px]" : "pr-3"}`}
                  style={{ color }}
                >
                  {name}
                </td>
                <td className="py-1.5 text-center text-white/40">{r.played}</td>
                <td className="py-1.5 text-center font-black text-white">
                  {r.won}
                </td>
                <td className="py-1.5 text-center text-white/40">{r.tied}</td>
                <td className="py-1.5 text-center text-white/40">{r.lost}</td>
                <td className="py-1.5 text-center font-black text-[#D4AF37]">
                  {r.points}
                </td>
                <td className="py-1.5 text-center font-bold text-[10px]">
                  <span
                    className={
                      r.nrr >= 0 ? "text-jcc-accent/80" : "text-jcc-danger/70"
                    }
                  >
                    {fmtNRR(r.nrr)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Finals Trophy Cabinet ─────────────────────────────────────────────────────
function FinalsTrophyPanel({ rows }: { rows: SeriesStandingRow[] }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-6 h-full max-w-2xl mx-auto">
      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.4em] text-[#D4AF37]/70 mb-1">
        Playoffs · All Rounds
      </p>
      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mb-4">
        Trophy Cabinet
      </h3>
      {rows.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-8">
          No finals recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full text-sm min-w-[280px] [&_th]:px-2.5 [&_td]:px-2.5">
            <thead>
              <tr className="text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.05]">
                <th className="text-left pb-2">Team</th>
                <th className="text-center pb-2 w-12">M</th>
                <th className="text-center pb-2 w-12">W</th>
                <th className="text-left pb-2 pl-4">Trophies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const color =
                  TEAMS[r.team_id as keyof typeof TEAMS]?.primary ?? "#888";
                const name =
                  TEAMS[r.team_id as keyof typeof TEAMS]?.name ?? r.team_id;
                return (
                  <tr key={r.team_id} className="border-b border-white/[0.03]">
                    <td className="py-2 font-black pr-3" style={{ color }}>
                      {name}
                    </td>
                    <td className="py-2 text-center text-white/40">
                      {r.played}
                    </td>
                    <td className="py-2 text-center font-black text-white">
                      {r.won}
                    </td>
                    <td className="py-2 pl-4 text-base leading-none tracking-tight">
                      {r.won > 0 ? (
                        Array.from({ length: r.won }).map((_, i) => (
                          <span key={i}>🏆</span>
                        ))
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[9px] text-white/20 mt-4 font-bold">
        M = Playoff Matches · W = Playoff Wins · Trophies = 🏆 per win
      </p>
    </div>
  );
}

// ── Standings Panel ───────────────────────────────────────────────────────────
function StandingsPanel({
  label,
  sub,
  rows,
}: {
  label: string;
  sub: string;
  rows: SeriesStandingRow[];
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-6 h-full max-w-2xl mx-auto">
      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.4em] text-[#D4AF37]/70 mb-1">
        {sub}
      </p>
      <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mb-4">
        {label}
      </h3>
      {rows.length > 0 ? (
        <PointsTable rows={rows} />
      ) : (
        <p className="text-center text-white/30 text-sm py-8">
          No matches recorded yet.
        </p>
      )}
      <p className="text-[9px] text-white/20 mt-4 font-bold">
        P = Played · W = Won · T = Tied · L = Lost · Pts = Points (W×2, T×1) ·
        NRR = Net Run Rate (recorded matches only) · Ranked on points, NRR
        breaks ties
      </p>
    </div>
  );
}

export function SwipeableStandings({
  current,
  overall,
  finals,
  currentSeriesName,
}: {
  current: SeriesStandingRow[];
  overall: SeriesStandingRow[];
  finals: SeriesStandingRow[];
  currentSeriesName: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const TOTAL = 3;
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const hints = ["Swipe for all-time standings", "Swipe for trophy cabinet"];
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) =>
          setIdx(
            Math.round(
              e.currentTarget.scrollLeft / e.currentTarget.clientWidth,
            ),
          )
        }
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="snap-center shrink-0 w-full">
          <StandingsPanel
            label={
              currentSeriesName
                ? `League Standings — ${currentSeriesName}`
                : "League Standings"
            }
            sub="Points · NRR Tiebreak"
            rows={current}
          />
        </div>
        <div className="snap-center shrink-0 w-full">
          <StandingsPanel
            label="All-Time · Overall"
            sub="Every Week Combined"
            rows={overall}
          />
        </div>
        <div className="snap-center shrink-0 w-full">
          <FinalsTrophyPanel rows={finals} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 mt-4">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Panel ${i + 1}`}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: idx === i ? 22 : 8,
              background:
                idx === i
                  ? "#D4AF37"
                  : "color-mix(in srgb, var(--color-white) 22%, transparent)",
            }}
          />
        ))}
      </div>
      <AnimatePresence>
        {idx < TOTAL - 1 && (
          <motion.button
            key={idx}
            onClick={() => go(idx + 1)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
          >
            {hints[idx]}
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Per-Match Scorecard Card ──────────────────────────────────────────────────
const MOBILE_SHORT: Record<string, string> = {
  mavericks: "Mave",
  neurostrikers: "Neuro",
  outliers: "Outliers",
};
function teamShortMobile(id: string | null): string {
  if (!id) return "TBD";
  return MOBILE_SHORT[id] ?? TEAMS[id as keyof typeof TEAMS]?.name ?? id;
}

function teamName(id: string | null): string {
  if (!id) return "TBD";
  return TEAMS[id as keyof typeof TEAMS]?.name ?? id;
}

// Profile photos come from the same `players` rows the members page renders,
// but a scorecard row is several components deep — a context spares every one
// of them a prop it does not otherwise care about. Defaulting to {} keeps the
// scorecard working (initials avatars) wherever the map was not provided.
export const PlayerPhotoContext = createContext<PlayerPhotoMap>({});

/** A player's face, circle-cropped, falling back to a generated avatar. */
function ScorecardFace({
  name,
  teamId,
  size = 48,
  className = "w-7 h-7 rounded-full overflow-hidden",
}: {
  name: string;
  teamId: string | null;
  /** next/image width hint — raise it wherever the face is rendered large. */
  size?: number;
  className?: string;
}) {
  const photos = useContext(PlayerPhotoContext);
  return (
    <PlayerAvatar
      src={photoFor(photos, name)}
      name={name}
      team={teamId ? (TEAMS[teamId as keyof typeof TEAMS]?.name ?? null) : null}
      displaySize={size}
      className={className}
      treatment="natural"
    />
  );
}

/** "c Gourav Boss b Saurabh Charan", "run out (Vikas)", "retired hurt", … */
function dismissalText(b: BattingPerf): string {
  const out = b.dismissed_by ?? "?";
  switch (b.dismissal_type) {
    case "not_out":
      return "not out";
    case "did_not_bat":
      return "did not bat";
    case "caught":
      return `c ${b.caught_by ?? "?"} b ${out}`;
    // The fielders live in caught_by since the backfill, but older rows still
    // carry them in dismissed_by — runOutFielders reads whichever was used.
    case "run_out": {
      const fielders = runOutFielders(b);
      return `run out (${fielders.length > 0 ? fielders.join(" / ") : "?"})`;
    }
    case "stumped":
      return `st ${b.caught_by ?? "?"} b ${out}`;
    case "lbw":
      return `lbw b ${out}`;
    case "bowled":
      return `b ${out}`;
    // Retired hurt and hit wicket carry no bowler credit, so never print one.
    case "retired_hurt":
      return "retired hurt";
    case "hit_wicket":
      return `hit wicket b ${out}`;
    default:
      return "—";
  }
}

const rate = (num: number, den: number) =>
  den > 0 ? (num / den).toFixed(1) : "—";

/** Overs like "1.4" are 1⅔ overs, not 1.4 — balls must be counted properly. */
function oversToBalls(overs: number | string): number {
  const n = Number(overs);
  if (!Number.isFinite(n)) return 0;
  const whole = Math.floor(n);
  return whole * 6 + Math.round((n - whole) * 10);
}

/**
 * The full scorecard panel — both innings' batting and bowling tables plus the
 * result line and AI report. Shared by the match archive and the fixture list,
 * so a scorecard reads identically wherever it is opened from.
 */
function ScorecardDetails({ match }: { match: FullSeries["matches"][0] }) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const onPlayerClick = usePlayerClick();

  const captainOf = (teamId: string) =>
    teamId === match.team1_id
      ? match.team1_captain
      : teamId === match.team2_id
        ? match.team2_captain
        : null;
  const withCaptain = (name: string, teamId: string) =>
    captainOf(teamId) && name === captainOf(teamId) ? `${name} (C)` : name;

  const winner = match.winner_id
    ? (TEAMS[match.winner_id as keyof typeof TEAMS]?.name ?? match.winner_id)
    : null;
  const result = match.is_tie
    ? "Match tied"
    : winner
      ? `${winner} won${match.margin_value ? ` by ${match.margin_value} ${match.margin_type}` : ""}`
      : "Result pending";

  const tossTeam = match.toss_winner_id
    ? (TEAMS[match.toss_winner_id as keyof typeof TEAMS]?.name ??
      match.toss_winner_id)
    : null;

  return (
    <div className="border-t border-white/[0.05] px-4 py-4 space-y-4">
      {/* Date and venue already head the fixture row, so the scorecard only
          adds what the row cannot tell you. */}
      {tossTeam && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/50">
            Toss: {tossTeam}, elected to {match.toss_decision}
          </span>
        </div>
      )}

      {/* Each innings is a self-contained panel, so the two never have to be
          padded to a matching height with blank filler rows. */}
      <div className="grid lg:grid-cols-2 gap-3 items-start">
        {match.innings.map((inn) => {
          const teamColor =
            TEAMS[inn.batting_team_id as keyof typeof TEAMS]?.primary ?? "#888";
          const battingTeam =
            TEAMS[inn.batting_team_id as keyof typeof TEAMS]?.name ??
            inn.batting_team_id;
          const batted = inn.batting.filter(
            (b) => b.dismissal_type !== "did_not_bat",
          );
          const didNotBat = inn.batting.filter(
            (b) => b.dismissal_type === "did_not_bat",
          );
          const fow = (inn.fall_of_wickets ?? []) as FallOfWicket[];

          return (
            <div
              key={inn.innings_no}
              className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
            >
              <div
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-white/[0.06]"
                style={{
                  background: `linear-gradient(90deg, ${teamColor}1f, transparent)`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1 h-4 rounded-full shrink-0"
                    style={{ background: teamColor }}
                  />
                  <p className="text-sm font-black uppercase tracking-wide text-white truncate">
                    {battingTeam}
                  </p>
                </div>
                <p className="text-lg font-black text-white tabular-nums shrink-0">
                  {inn.total_runs}/{inn.total_wickets}
                  <span className="text-white/40 font-bold text-[11px] ml-1.5">
                    ({inn.total_overs} ov){inn.all_out ? " · all out" : ""}
                  </span>
                </p>
              </div>

              <div className="px-3.5 py-3 space-y-3">
                {/* The dismissal sits under the batter's name so the numeric
                    columns stay aligned instead of being squeezed by it. */}
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-white/25 border-b border-white/[0.06]">
                      <th className="text-left pb-2 font-black text-[10px] uppercase tracking-widest">
                        Batting
                      </th>
                      <th className="text-right pb-2 font-bold w-9">R</th>
                      <th className="text-right pb-2 font-bold w-9">B</th>
                      <th className="text-right pb-2 font-bold w-8">4s</th>
                      <th className="text-right pb-2 font-bold w-8">6s</th>
                      <th className="text-right pb-2 font-bold w-12">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batted.map((b, bi) => (
                      <tr
                        key={bi}
                        className="border-b border-white/[0.03] last:border-0 align-top"
                      >
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => onPlayerClick(b.player_name)}
                            className="flex items-center gap-2 min-w-0 text-left"
                          >
                            <ScorecardFace
                              name={b.player_name}
                              teamId={inn.batting_team_id}
                            />
                            <div className="min-w-0">
                              <span className="block font-black text-white/85 truncate">
                                {withCaptain(b.player_name, inn.batting_team_id)}
                              </span>
                              <span className="block text-[11px] text-white/35 truncate">
                                {dismissalText(b)}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td className="py-2 text-right font-black text-white tabular-nums">
                          {b.runs}
                        </td>
                        <td className="py-2 text-right text-white/45 tabular-nums">
                          {b.balls_faced ?? "—"}
                        </td>
                        <td className="py-2 text-right text-white/45 tabular-nums">
                          {b.fours}
                        </td>
                        <td className="py-2 text-right text-white/45 tabular-nums">
                          {b.sixes}
                        </td>
                        <td className="py-2 text-right text-white/30 tabular-nums">
                          {b.balls_faced
                            ? rate(b.runs * 100, b.balls_faced)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {didNotBat.length > 0 && (
                  <p className="text-[11px] text-white/30 leading-relaxed">
                    <span className="font-black text-white/35">
                      Did not bat:{" "}
                    </span>
                    {didNotBat
                      .map((b) =>
                        withCaptain(b.player_name, inn.batting_team_id),
                      )
                      .join(", ")}
                  </p>
                )}

                {fow.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/35">
                      Fall of wickets
                    </span>
                    {fow.map((f, i) => (
                      <span
                        key={i}
                        title={
                          f.player
                            ? `${f.player}${f.overs ? ` · ${f.overs} ov` : ""}`
                            : undefined
                        }
                        className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-white/50 tabular-nums"
                      >
                        {f.wkt}-{f.score}
                        {f.player && (
                          <span className="ml-1 font-medium text-white/30">
                            {f.player.split(" ")[0]}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="text-white/25 border-b border-white/[0.06]">
                      <th className="text-left pb-2 font-black text-[10px] uppercase tracking-widest">
                        Bowling
                      </th>
                      <th className="text-right pb-2 font-bold w-9">O</th>
                      <th className="text-right pb-2 font-bold w-8">M</th>
                      <th className="text-right pb-2 font-bold w-9">R</th>
                      <th className="text-right pb-2 font-bold w-8">W</th>
                      <th className="text-right pb-2 font-bold w-12">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inn.bowling.map((bw, bi) => (
                      <tr
                        key={bi}
                        className="border-b border-white/[0.03] last:border-0"
                      >
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => onPlayerClick(bw.player_name)}
                            className="flex items-center gap-2 min-w-0 text-left"
                          >
                            <ScorecardFace
                              name={bw.player_name}
                              teamId={inn.bowling_team_id}
                            />
                            <span className="font-black text-white/85 truncate">
                              {withCaptain(bw.player_name, inn.bowling_team_id)}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 text-right text-white/45 tabular-nums">
                          {bw.overs}
                        </td>
                        <td className="py-2 text-right text-white/30 tabular-nums">
                          {bw.maidens}
                        </td>
                        <td className="py-2 text-right text-white/45 tabular-nums">
                          {bw.runs_conceded}
                        </td>
                        <td className="py-2 text-right font-black text-white tabular-nums">
                          {bw.wickets}
                        </td>
                        <td className="py-2 text-right text-white/30 tabular-nums">
                          {rate(bw.runs_conceded * 6, oversToBalls(bw.overs))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dark bar with a gold edge — the result is the headline of the
          scorecard without the panel turning into a block of gold. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-[#D4AF37]/20 border-l-[3px] border-l-[#D4AF37] bg-[#D4AF37]/[0.06] pl-4 pr-6 py-3">
        <span className="text-sm font-black text-white">{result}</span>
        {match.player_of_match && (
          <button
            type="button"
            onClick={() => onPlayerClick(match.player_of_match!)}
            className="flex items-center gap-3 min-w-0 text-left"
          >
            <ScorecardFace
              name={match.player_of_match}
              teamId={match.winner_id}
              size={56}
              className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#D4AF37]/40"
            />
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#D4AF37]/70">
                <Star className="w-3 h-3 shrink-0 fill-[#D4AF37]/70 stroke-none" />
                MOTM
              </span>
              <span className="block text-base font-black text-white truncate">
                {match.player_of_match}
              </span>
            </div>
          </button>
        )}
      </div>

      {match.ai_analysis && (
        <div className="mt-2">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/70 hover:text-[#D4AF37] transition-colors mb-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showAnalysis ? "Hide" : "Show"} AI Match Analysis
          </button>
          <div
            style={{
              display: "grid",
              gridTemplateRows: showAnalysis ? "1fr" : "0fr",
              transition: "grid-template-rows 200ms ease-out",
            }}
          >
            <div className="overflow-hidden">
              <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-xl p-4">
                <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                  {match.ai_analysis}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchScorecardCard({ match }: { match: FullSeries["matches"][0] }) {
  const [open, setOpen] = useState(false);

  const winner = match.winner_id
    ? (TEAMS[match.winner_id as keyof typeof TEAMS]?.name ?? match.winner_id)
    : null;
  const result = match.is_tie
    ? "Match tied"
    : winner
      ? `${winner} won${match.margin_value ? ` by ${match.margin_value} ${match.margin_type}` : ""}`
      : "Result pending";

  return (
    <div className="border border-white/[0.07] rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-col gap-1.5 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25 shrink-0 sm:w-12">
            {match.stage === "league"
              ? `M${match.match_no}`
              : (STAGE_LABEL[match.stage] ?? match.stage).toUpperCase()}
          </span>
          <span className="flex-1 sm:flex-none min-w-0 truncate text-xs font-black text-white/70 sm:w-64">
            <span className="sm:hidden">{teamShortMobile(match.team1_id)}</span>
            <span className="hidden sm:inline">{teamName(match.team1_id)}</span>
            <span className="text-white/25 mx-1">vs</span>
            <span className="sm:hidden">{teamShortMobile(match.team2_id)}</span>
            <span className="hidden sm:inline">{teamName(match.team2_id)}</span>
          </span>
          <span className="shrink-0 flex items-center gap-1 sm:w-28">
            {match.innings.map((inn, i) => (
              <span
                key={inn.innings_no}
                className="text-xs font-black font-mono text-white/60 shrink-0"
              >
                {i > 0 && (
                  <span className="text-white/20 text-xs mx-0.5">·</span>
                )}
                {inn.total_runs}/{inn.total_wickets}
              </span>
            ))}
          </span>
          <span className="hidden sm:block sm:flex-1 min-w-0 truncate text-[10px] text-[#D4AF37] font-bold">
            {result}
          </span>
          {match.player_of_match && (
            <span className="hidden sm:flex items-center gap-1 shrink-0 sm:w-44 text-[10px] font-black text-jcc-gold/80">
              <Star className="w-3 h-3 shrink-0" /> {match.player_of_match}
            </span>
          )}
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0 ml-auto sm:ml-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0 ml-auto sm:ml-0" />
          )}
        </div>
        <div className="sm:hidden flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="text-[10px] text-[#D4AF37] font-bold">{result}</span>
          {match.player_of_match && (
            <span className="flex items-center gap-1 text-[10px] font-black text-jcc-gold/80">
              <Star className="w-3 h-3 shrink-0" />{" "}
              {match.player_of_match.split(" ")[0]}
            </span>
          )}
        </div>
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease-out",
        }}
      >
        <div className="overflow-hidden">
          <ScorecardDetails match={match} />
        </div>
      </div>
    </div>
  );
}

// ── Series (Week) Card ───────────────────────────────────────────────────────────
export function SeriesCard({ series }: { series: FullSeries }) {
  const [open, setOpen] = useState(false);
  const articles = (series.articles ?? []) as Array<{
    title: string;
    url: string;
  }>;

  const leagueMatches = series.matches.filter((m) => m.stage === "league");
  // Every non-league round of the week, in bracket order — a final week now has
  // an eliminator and a qualifier ahead of the final itself.
  const playoffMatches = series.matches
    .filter((m) => m.stage !== "league")
    .sort((a, b) => a.match_no - b.match_no);
  const leagueStandings = computeOverallStandings([series]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#D4AF37]/60 mb-1">
            {series.week_no != null
              ? `Week ${series.week_no}`
              : `Series #${series.series_no}`}
          </p>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">
            {series.name}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-white/25 font-bold">
            {series.started_at && (
              <span>{fmtMonthYear(series.started_at)}</span>
            )}
            {series.venue && <span>· {series.venue}</span>}
            <span>· {series.matches.length} matches</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-white/20" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/20" />
        )}
      </button>

      {articles.length > 0 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {articles.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-[#D4AF37]/80 transition-colors border border-white/[0.06] hover:border-[#D4AF37]/20 rounded-full px-3 py-1.5"
            >
              <Newspaper className="w-3 h-3" />
              {a.title}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease-out",
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-4 py-4 space-y-2">
            {series.notes && (
              <p className="text-[10px] text-white/30 italic px-1 pb-2">
                {series.notes}
              </p>
            )}
            {leagueStandings.length > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 mb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/25 mb-2">
                  League Standings
                </p>
                <PointsTable rows={leagueStandings} compact />
              </div>
            )}
            {leagueMatches.map((m) => (
              <MatchScorecardCard key={m.id} match={m} />
            ))}
            {playoffMatches.map((m) => (
              <div key={m.id}>
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/50">
                    {STAGE_LABEL[m.stage] ?? m.stage}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <MatchScorecardCard match={m} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fixture Schedule ──────────────────────────────────────────────────────────
// Fixtures are seeded before they're played, so this renders both the results
// already in and the weeks still to come, from the same series_matches rows.

function TeamPill({
  id,
  fallbackLabel,
}: {
  id: TeamId | null;
  fallbackLabel?: string;
}) {
  const cfg = id ? TEAMS[id] : null;
  if (!cfg) {
    return (
      <span className="text-[11px] font-black uppercase tracking-wide text-white/25 italic">
        {fallbackLabel ?? "TBD"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.primary }}
      />
      <span className="text-[11px] font-black text-white/80 truncate">
        <span className="sm:hidden">{cfg.shortName}</span>
        <span className="hidden sm:inline">{cfg.name}</span>
      </span>
    </span>
  );
}

const STAGE_LABEL: Record<string, string> = {
  eliminator: "Eliminator",
  qualifier: "Qualifier",
  final: "Final",
};

// Every fixture starts at the same slot, and match_date only carries a date —
// its time component is a storage artefact (UTC midnight reads back as 05:30
// AM in IST), so the schedule prints the club's fixed start time instead.
const MATCH_START_TIME = "07:30 PM";

function fmtMatchTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return MATCH_START_TIME;
}

function weekDateRange(w: FullSeries): string | null {
  const dates = w.matches
    .map((m) => m.match_date)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const first = dates[0] ?? (w.started_at ? new Date(w.started_at) : null);
  if (!first || Number.isNaN(first.getTime())) return null;
  const last = dates[dates.length - 1] ?? first;
  if (last.toDateString() === first.toDateString()) return fmtDayMonth(first);
  return `${fmtDayMonth(first)} – ${fmtDayMonth(last)}`;
}

/** Big crest + name, with a text placeholder for an unresolved bracket slot. */
function TeamSide({
  id,
  fallbackLabel,
  align = "left",
}: {
  id: TeamId | null;
  fallbackLabel?: string;
  align?: "left" | "right";
}) {
  const cfg = id ? TEAMS[id] : null;
  const rowDir = align === "right" ? "flex-row-reverse" : "flex-row";

  if (!cfg) {
    return (
      <div className={`flex items-center gap-3 min-w-0 flex-1 ${rowDir}`}>
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-dashed border-white/10 shrink-0" />
        <span className="text-sm font-black uppercase tracking-wide text-white/25 italic truncate">
          {fallbackLabel ?? "TBD"}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 flex-1 ${rowDir}`}>
      <Image
        src={cfg.logo}
        alt={cfg.name}
        width={72}
        height={72}
        className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 object-contain"
      />
      <span className="text-base sm:text-lg font-black text-white truncate">
        <span className="sm:hidden">{cfg.shortName}</span>
        <span className="hidden sm:inline">{cfg.name}</span>
      </span>
    </div>
  );
}

function ScheduleStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
      <div className="flex justify-center text-jcc-accent mb-2">{icon}</div>
      <div className="text-2xl sm:text-3xl font-black text-white tabular-nums leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold text-white/45">{label}</div>
    </div>
  );
}

function MatchRow({
  m,
  weekVenue,
}: {
  m: FullSeriesMatch;
  weekVenue: string | null;
}) {
  const decided = !!m.winner_id || m.is_tie;
  const venue = resolveVenue(m.venue, weekVenue);
  const winner = m.winner_id ? TEAMS[m.winner_id]?.name : null;
  const time = fmtMatchTime(m.match_date);
  const d = m.match_date ? new Date(m.match_date) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const [open, setOpen] = useState(false);

  // Only a played match has innings to show; upcoming fixtures stay inert.
  const hasScorecard = m.innings.length > 0;

  const row = (
    <div className="w-full px-4 py-3 text-left">
      {/* On mobile the date and status share one compact line and the teams get
          the full width below them; from sm up it's the classic three-column row. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 sm:grid-cols-[4rem_minmax(0,1fr)_13.5rem] sm:gap-4">
      {/* Date block */}
      <div className="col-start-1 row-start-1 flex sm:flex-col items-center sm:items-center gap-1.5 sm:gap-0 shrink-0 sm:border-r sm:border-white/[0.07] sm:pr-4">
        {valid ? (
          <>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
              {WEEKDAYS_LONG[d!.getDay()].slice(0, 3)}
            </span>
            <span className="text-lg sm:text-2xl font-black text-white leading-none tabular-nums">
              {d!.getDate()}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
              {MONTHS_SHORT[d!.getMonth()]}
            </span>
          </>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
            {m.stage === "league"
              ? `M${m.match_no}`
              : (STAGE_LABEL[m.stage] ?? m.stage)}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 flex items-center gap-2 sm:gap-3 min-w-0 sm:max-w-[34rem] sm:mx-auto sm:w-full">
        <TeamSide
          id={m.team1_id}
          fallbackLabel={
            m.team1_seed
              ? `Seed ${m.team1_seed}`
              : m.team1_from_match_no
                ? `Winner M${m.team1_from_match_no}`
                : undefined
          }
        />
        <span className="shrink-0 mx-1 sm:mx-3 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/40">
          vs
        </span>
        <TeamSide
          align="right"
          id={m.team2_id}
          fallbackLabel={
            m.team2_seed
              ? `Seed ${m.team2_seed}`
              : m.team2_from_match_no
                ? `Winner M${m.team2_from_match_no}`
                : undefined
          }
        />
      </div>

      {/* Status */}
      <div className="col-start-2 row-start-1 justify-self-end text-right sm:col-start-3 sm:row-start-1 shrink-0">
        {decided ? (
          <span className="text-[13px] font-black text-[#D4AF37]">
            {winner
              ? `${winner} won${
                  m.margin_value ? ` by ${m.margin_value} ${m.margin_type}` : ""
                }`
              : "Tied"}
          </span>
        ) : (
          <span className="inline-flex rounded-md border border-jcc-accent/25 bg-jcc-accent/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-jcc-accent/80">
            Upcoming
          </span>
        )}
        {hasScorecard && (
          <span className="mt-1.5 flex items-center justify-start gap-1 text-[10px] sm:justify-end font-black uppercase tracking-widest text-white/30">
            {open ? "Hide" : "Scorecard"}
            {open ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </span>
        )}
        </div>
      </div>

      {/* Time, venue and stage sit on their own line so the teams keep the
          full width of the row above them. */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-white/[0.07] pt-3.5">
        {time && (
          <span className="flex items-center gap-1.5 text-xs font-black text-white">
            <Clock className="w-3.5 h-3.5 shrink-0 text-jcc-accent/70" />
            {time}
          </span>
        )}
        <span
          className={`flex items-center gap-1.5 text-xs font-bold min-w-0 ${
            venue.status === "confirmed" ? "text-white/75" : "text-white/45"
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0 text-jcc-accent/70" />
          <span className="truncate">{venue.name}</span>
          {venue.status === "provisional" && (
            <span className="shrink-0 rounded border border-white/15 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-white/45">
              TBC
            </span>
          )}
        </span>
        {m.stage !== "league" && (
          <span className="text-[10px] font-black uppercase tracking-widest text-jcc-accent/85">
            {STAGE_LABEL[m.stage] ?? m.stage}
          </span>
        )}
        {m.player_of_match && (
          <span className="flex items-center gap-1.5 min-w-0 sm:ml-auto">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]/70">
              <Star className="w-3 h-3 shrink-0 fill-[#D4AF37]/70 stroke-none" />
              MOTM
            </span>
            <span className="text-xs font-black text-white truncate">
              {m.player_of_match}
            </span>
          </span>
        )}
      </div>
    </div>
  );

  if (!hasScorecard) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        {row}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full hover:bg-white/[0.04] transition-colors"
      >
        {row}
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 620ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(-6px)",
              transition:
                "opacity 460ms ease 120ms, transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <ScorecardDetails match={m} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FixtureSchedule({
  series,
  seasonLabel,
}: {
  series: FullSeries[];
  seasonLabel?: string;
}) {
  const weeks = series
    .filter((s) => s.week_no != null)
    .sort((a, b) => (a.week_no ?? 0) - (b.week_no ?? 0));

  const [activeWeek, setActiveWeek] = useState<number | null>(() => {
    // Land on the earliest week that still has an undecided match — the one
    // people are most likely looking for.
    const next = weeks.find((w) =>
      w.matches.some((m) => !m.winner_id && !m.is_tie),
    );
    return next?.week_no ?? weeks[0]?.week_no ?? null;
  });
  const [showPast, setShowPast] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  if (weeks.length === 0) return null;

  const totalMatches = weeks.reduce((n, w) => n + w.matches.length, 0);
  const teamCount = new Set(
    weeks.flatMap((w) =>
      w.matches.flatMap((m) =>
        [m.team1_id, m.team2_id].filter((t): t is TeamId => !!t),
      ),
    ),
  ).size;

  const current = weeks.find((w) => w.week_no === activeWeek) ?? weeks[0];
  const currentVenue = resolveVenue(null, current.venue);
  const visible = [...current.matches]
    .sort((a, b) => a.match_no - b.match_no)
    .filter((m) => showPast || !(m.winner_id || m.is_tie));

  const scrollTabs = (dir: 1 | -1) =>
    tabsRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.35em] text-jcc-accent">
            <span className="w-1 h-3.5 rounded-full bg-jcc-accent" />
            {seasonLabel ?? "Season"}
          </span>
          <h3 className="mt-3 text-4xl sm:text-5xl font-black text-white tracking-tight">
            Match Schedule
          </h3>
          <p className="mt-3 text-white/50 font-bold max-w-xs">
            Every ball counts. Follow your team, never miss a moment.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 lg:min-w-[26rem]">
          <ScheduleStat
            icon={<Calendar className="w-5 h-5" />}
            value={totalMatches}
            label="Total Matches"
          />
          <ScheduleStat
            icon={<CalendarDays className="w-5 h-5" />}
            value={weeks.length}
            label="Weeks"
          />
          <ScheduleStat
            icon={<Users className="w-5 h-5" />}
            value={teamCount}
            label="Teams"
          />
          <ScheduleStat
            icon={<Trophy className="w-5 h-5" />}
            value={1}
            label="Champion"
          />
        </div>
      </div>

      {/* ── Week tabs + fixtures ── */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/[0.06]">
          <button
            onClick={() => scrollTabs(-1)}
            aria-label="Earlier weeks"
            className="hidden sm:grid shrink-0 w-9 h-9 place-items-center rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={tabsRef}
            className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {weeks.map((w) => {
              const active = w.week_no === current.week_no;
              const range = weekDateRange(w);
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveWeek(w.week_no ?? null);
                    setShowAll(false);
                  }}
                  className={`shrink-0 rounded-xl border px-5 py-3 text-center transition-all ${
                    active
                      ? "border-jcc-accent/60 bg-jcc-accent/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <div
                    className={`text-[11px] font-black uppercase tracking-widest ${
                      active ? "text-jcc-accent" : "text-white/70"
                    }`}
                  >
                    {w.name}
                  </div>
                  {range && (
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">
                      {range}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollTabs(1)}
            aria-label="Later weeks"
            className="hidden sm:grid shrink-0 w-9 h-9 place-items-center rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-5 py-3.5">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-white/70 [&>*]:whitespace-nowrap">
            <span className="w-1 h-3 shrink-0 rounded-full bg-jcc-accent" />
            <span>{current.name}</span>
            {weekDateRange(current) && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-white/40">{weekDateRange(current)}</span>
              </>
            )}
            <span className="text-white/20">•</span>
            <span
              className={
                currentVenue.status === "confirmed"
                  ? "text-white/40"
                  : "text-white/25"
              }
            >
              {currentVenue.name}
              {currentVenue.status === "provisional" && " · TBC"}
            </span>
          </span>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="inline-flex items-center gap-2.5 group"
            aria-pressed={showPast}
          >
            <span className="text-[11px] font-bold text-white/50 group-hover:text-white/70 transition-colors">
              Show past matches
            </span>
            <span
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                showPast ? "bg-jcc-accent/70" : "bg-white/15"
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                  showPast ? "translate-x-5" : ""
                }`}
              />
            </span>
          </button>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {visible.length > 0 ? (
            visible.map((m) => (
              <MatchRow key={m.id} m={m} weekVenue={current.venue} />
            ))
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
              Every match this week has been played
            </div>
          )}
        </div>

        {/* Full season view — every week, in order, below the fold. */}
        {showAll && (
          <div className="border-t border-white/[0.06] px-4 py-4 space-y-6">
            {weeks
              .filter((w) => w.week_no !== current.week_no)
              .map((w) => (
                <div key={w.id}>
                  <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-widest text-white/50">
                    {w.name}
                    {weekDateRange(w) && (
                      <>
                        <span className="text-white/20">•</span>
                        <span className="text-white/30">
                          {weekDateRange(w)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    {[...w.matches]
                      .sort((a, b) => a.match_no - b.match_no)
                      .map((m) => (
                        <MatchRow key={m.id} m={m} weekVenue={w.venue} />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-jcc-accent/30 bg-jcc-accent/[0.06] px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-jcc-accent hover:bg-jcc-accent/[0.12] transition-colors"
          >
            <Calendar className="w-4 h-4" />
            {showAll
              ? "Hide full season schedule"
              : "View full season schedule"}
            {showAll ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Playoff Bracket ───────────────────────────────────────────────────────────
export function PlayoffBracket({
  series,
  standings,
}: {
  series: FullSeries[];
  standings: SeriesStandingRow[];
}) {
  const allMatches = series.flatMap((s) => s.matches);
  const bracketMatches = allMatches.filter((m) => m.stage !== "league");

  if (bracketMatches.length === 0) return null;

  // The bracket is seeded at the start of the season, so without a gate it sits
  // on the page reading "awaiting league table" for months. Seeds are only real
  // once every league match has a result — i.e. week 11 is concluded and its
  // scorecards are uploaded — so hide the whole card until then. Gating on the
  // match data rather than a date means it also stays hidden if a week runs
  // late or a scorecard hasn't been entered yet.
  const leagueMatches = allMatches.filter((m) => m.stage === "league");
  const leagueComplete =
    leagueMatches.length > 0 &&
    leagueMatches.every((m) => m.winner_id || m.is_tie);

  if (!leagueComplete) return null;

  const fixtures: ScheduledFixture[] = bracketMatches.map((m) => ({
    match_no: m.match_no,
    stage: m.stage,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    team1_seed: m.team1_seed,
    team2_seed: m.team2_seed,
    team1_from_match_no: m.team1_from_match_no,
    team2_from_match_no: m.team2_from_match_no,
  }));

  const results = new Map<number, TeamId | null>(
    bracketMatches.map((m) => [m.match_no, m.winner_id]),
  );

  const rounds = resolveBracket(fixtures, standings, results);
  const champion = rounds.find((r) => r.stage === "final")?.winner_id ?? null;

  return (
    <div className="mb-16 rounded-2xl border border-jcc-gold/20 overflow-hidden bg-gradient-to-b from-[var(--jcc-navy)] to-[var(--jcc-navy-light)]">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <Swords className="w-3.5 h-3.5 text-jcc-gold" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50">
          Final Week
        </h3>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-white/25">
          1st place goes straight to the final
        </span>
      </div>

      <div className="p-5 grid gap-3 sm:grid-cols-3">
        {rounds.map((r) => {
          const isFinal = r.stage === "final";
          return (
            <div
              key={r.match_no}
              className={`rounded-xl border p-4 ${
                isFinal
                  ? "border-jcc-gold/30 bg-jcc-gold/[0.04]"
                  : "border-white/[0.07] bg-white/[0.02]"
              }`}
            >
              <p
                className={`text-[9px] font-black uppercase tracking-[0.25em] mb-3 ${
                  isFinal ? "text-jcc-gold" : "text-white/35"
                }`}
              >
                {STAGE_LABEL[r.stage] ?? r.stage}
              </p>
              <div className="space-y-2">
                {[
                  { id: r.team1_id, label: r.team1_label },
                  { id: r.team2_id, label: r.team2_label },
                ].map((side, i) => {
                  const won = !!r.winner_id && side.id === r.winner_id;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                        won ? "bg-white/[0.07]" : "bg-white/[0.02]"
                      }`}
                    >
                      <TeamPill id={side.id} fallbackLabel={side.label} />
                      {won && (
                        <Trophy className="w-3 h-3 text-jcc-gold ml-auto shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {!r.team1_id && !r.team2_id && (
                <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/20">
                  Awaiting league table
                </p>
              )}
            </div>
          );
        })}
      </div>

      {champion && (
        <div className="px-5 py-4 border-t border-jcc-gold/20 bg-jcc-gold/[0.05] flex items-center justify-center gap-2">
          <Trophy className="w-4 h-4 text-jcc-gold" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-jcc-gold">
            {TEAMS[champion]?.name ?? champion} — Champions
          </span>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SeasonsPageClientProps {
  liveActiveSeason: Season | null;
  archivedSeasons: Season[];
  totalClubMatches: number;
  weeksPlayed: number;
  playersPool: PlayerPoolRow[];
  careerPool: PlayerPoolRow[];
  clubRoster: ClubRosterRow[];
  fullSeries: FullSeries[];
  activeSeasonSeries: FullSeries[];
  seasonLeaderboards: LeaderboardSet;
  careerLeaderboards: LeaderboardSet;
  playerPhotos: PlayerPhotoMap;
}

// ── Main Client Component ─────────────────────────────────────────────────────
export default function SeasonsPageClient({
  liveActiveSeason,
  archivedSeasons,
  totalClubMatches,
  weeksPlayed,
  playersPool,
  careerPool,
  clubRoster,
  fullSeries,
  activeSeasonSeries,
  seasonLeaderboards,
  careerLeaderboards,
  playerPhotos,
}: SeasonsPageClientProps) {
  const [poolOpen, setPoolOpen] = useState(false);

  // The current season's own table, separate from the all-time one below —
  // computeOverallStandings already filters to league matches and attaches NRR.
  const activeSeasonMatches = activeSeasonSeries.flatMap(
    (s) => s.matches as SeriesMatch[],
  );
  const activeSeasonStandings = computeOverallStandings(activeSeasonSeries);

  return (
    <PlayerCareerCardProvider clubRoster={clubRoster} careerLeaderboards={careerLeaderboards}>
    <PlayerPhotoContext.Provider value={playerPhotos}>
    <div className="min-h-screen page-top pb-20 relative overflow-hidden arena-bg theme-static-navy">
      <div className="arena-hatch z-0" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 mt-1">
        {/* ── Header ── */}
        <div className="mb-12 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-jcc-ball-red font-black">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-ball-red opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-ball-red" />
              </span>
              Community Captain Era History
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
            The <span className="text-gradient-cyan">Seasons</span>
          </h1>
          <p className="mt-4 text-white/60 text-lg font-black tracking-tight max-w-xl">
            "Every new captain pairing writes its own chapter."
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03]">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Club Stats
              </span>
              <span className="h-3 w-px bg-white/15" />
              <span className="font-mono font-black text-jcc-accent text-sm">
                {totalClubMatches}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Total Matches · All Eras
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03]">
              <span className="font-mono font-black text-jcc-accent text-sm">
                {weeksPlayed}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Weeks Played
              </span>
            </div>
            <button
              onClick={() => setPoolOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:border-jcc-accent/40 hover:bg-white/[0.06] transition-all"
            >
              <Users className="w-3.5 h-3.5 text-jcc-accent" />
              <span className="font-mono font-black text-jcc-accent text-sm">
                {playersPool.length}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Players Pool
              </span>
            </button>
          </div>
        </div>

        {/* ── Current Season ── */}
        <div className="mb-16">
          {liveActiveSeason ? (
            <SeasonHeader season={liveActiveSeason} />
          ) : (
            <div className="p-8 text-center text-white/40 border border-white/10 rounded-2xl bg-white/[0.02]">
              No active season found.
            </div>
          )}
        </div>

        {/* ── League Table — the season's primary view ── */}
        {liveActiveSeason && (
          <div className="mb-16">
            <SectionHeading
              eyebrow="Points · Net Run Rate · Form"
              title="League Table"
              aside="Live standings for the current season."
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <SeasonLeagueTable
                standings={activeSeasonStandings}
                matches={activeSeasonMatches}
                playoffBerths={liveActiveSeason.teams.length >= 4 ? 4 : 0}
              />
            </motion.div>
          </div>
        )}

        {/* ── Final Week Bracket ── */}
        {activeSeasonSeries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Margin lives on the card, not here — PlayoffBracket hides itself
                until the league is complete, and a wrapper margin would leave a
                64px hole behind it. */}
            <PlayoffBracket
              series={activeSeasonSeries}
              standings={activeSeasonStandings}
            />
          </motion.div>
        )}

        {/* ── Fixture Schedule ── */}
        {activeSeasonSeries.some((s) => s.week_no != null) && (
          <div className="mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <FixtureSchedule
                series={activeSeasonSeries}
                seasonLabel={
                  liveActiveSeason?.season_label ?? liveActiveSeason?.title
                }
              />
            </motion.div>
          </div>
        )}

        {/* ── Stats Leaderboards ── */}
        {fullSeries.length > 0 && (
          <div className="mb-16">
            <SectionHeading
              eyebrow="Batting · Bowling · MVP · Fielding"
              title="Player Stats"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <StatsLeaderboards
                season={seasonLeaderboards}
                career={careerLeaderboards}
                seasonLabel={liveActiveSeason?.season_label ?? "This Season"}
              />
            </motion.div>
          </div>
        )}

        {/* ── Archived Seasons ── */}
        <div className="mb-16">
          <SectionHeading
            eyebrow="Past Chapters"
            title="Archived Seasons"
            aside="Legacy captain pairs and their corresponding final scores."
          />
          {archivedSeasons.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT_CONFIG}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {archivedSeasons.map((season) => (
                <ArchivedEraCard
                  key={season.id}
                  season={season}
                  hasDetail={fullSeries.some((s) => s.season_id === season.id)}
                />
              ))}
            </motion.div>
          ) : (
            <div className="text-white/30 text-sm py-8 text-center border border-dashed border-white/10 rounded-xl">
              No archived seasons found.
            </div>
          )}
        </div>

        {/* ── Historic Progression Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <SeriesProgression series={activeSeasonSeries} />
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-jcc-accent/20 bg-gradient-to-br from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-8 text-center"
        >
          <Trophy className="w-8 h-8 text-jcc-gold mx-auto mb-3" />
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
            Be Part of the Next Chapter
          </h3>
          <p className="text-white/40 text-sm font-medium mb-5 max-w-sm mx-auto">
            Pick your side. Join the weekly ritual. Add your name to the season
            story.
          </p>
          <a
            href="/register"
            className="inline-flex items-center gap-2 btn-vibrant-blue text-sm font-black"
          >
            Register for Next Match
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      <PlayersPoolModal
        isOpen={poolOpen}
        onClose={() => setPoolOpen(false)}
        players={playersPool}
        seasonLabel={liveActiveSeason?.season_label ?? "This Season"}
        roster={clubRoster}
        careerPool={careerPool}
        photos={playerPhotos}
      />
    </div>
    </PlayerPhotoContext.Provider>
    </PlayerCareerCardProvider>
  );
}
