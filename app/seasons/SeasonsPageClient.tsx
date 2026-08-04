"use client";

import {
  useRef,
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
  Fragment,
} from "react";
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
  Crown,
  Hand,
  Search,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
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
  resolveMatchTime,
  type ScheduledFixture,
} from "@/lib/season-schedule";
import { TEAMS, type TeamId } from "@/lib/teams";
import {
  AUCTION_SEASON,
  AUCTION_SIGNINGS,
  type Signing,
} from "@/lib/auction-squads";
import { playerPhotoKeys, playerPhotoIndexKeys } from "@/lib/player-photos";
import PlayersPoolModal from "@/components/PlayersPoolModal";
import PlayerCareerCardProvider, {
  usePlayerClick,
} from "@/components/PlayerCareerCardProvider";

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
  /** Caveat on the win count — see SeasonTeam.note. */
  note: string | null;
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
      note: t.note ?? null,
    };
  });
}

// ── Season squads ─────────────────────────────────────────────────────────────
// A team's squad is the auction sheet first and the scorecards second.
//
// Reading it off the scorecards alone would list only whoever has played, and a
// signing yet to turn out would disappear. So each team lists everyone it
// bought, and the scorecards only supply the match counts beside the names.
//
// Guest is a tier of the auction, not a description of how someone came to play
// — the sheet sold its bottom bracket (25L base) as guests, and that is settled
// whether or not he has turned out yet. So a team's list is its squad first and
// its guests under a divider, both straight off the sheet. Players who appear in
// the season but were never bought at all are gathered separately as newcomers,
// with every team they have played for.

interface SquadMember {
  name: string;
  /** Matches in this season, from the scorecards. 0 for a signing yet to play. */
  matches: number;
  /** Bought into the 25L guest tier — see GUEST_BASE. */
  guest: boolean;
  /**
   * False for a signing the transcript settled as a non-member. Several are
   * first-name-only people who are NOT the similarly named member ("Madhav"
   * vs "Madhav Sharma"), so they must not be given his face.
   */
  member?: boolean;
  /** Leads the side — listed first, whatever his match count. */
  captain?: boolean;
  /** Boards this player tops this season — see seasonHonours. */
  honours?: Honour[];
  /** Newcomers only: every team he has played for this season. */
  teams?: TeamId[];
}

interface SeasonSquad {
  id: TeamId | "newcomers";
  members: SquadMember[];
}

// ── Honours ───────────────────────────────────────────────────────────────────
// The squad list marks whoever leads a board this season. Only the top of each
// — a squad card is a team sheet, not a second leaderboard, so second place
// belongs on the board below and nowhere else.

type Honour = "mvp" | "batting" | "bowling" | "fielding";

/**
 * The newcomers' pill colour — a violet that belongs to no side.
 *
 * It has to sit beside all four team glows without being mistaken for one, and
 * it can't be the page's gold either: that gold already means an honour on
 * these very cards. Violet is the one bright hue the club's palette leaves
 * unclaimed.
 */
const NEWCOMER_GLOW = "rgba(167, 139, 250, 0.55)";

/**
 * A team's glow at a chosen strength.
 *
 * TEAMS carries a `glow` per side — the halo its crest is lit with, already
 * tuned per team (the Vikings' is their crest's bronze, not the teal of their
 * primary). It arrives at one fixed opacity, so anything wanting the same
 * colour softer has to re-mix it rather than picking a different one.
 */
function teamGlow(rgba: string, alpha: number): string {
  const parts = rgba.match(/rgba?\(([^)]+)\)/)?.[1].split(",");
  if (!parts || parts.length < 3) return rgba;
  const [r, g, b] = parts.map((p) => p.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A bat and a ball, drawn here because lucide has no cricket in it. Both follow
 * its conventions — a 24 grid, currentColor, 2px round strokes — so they sit
 * beside Crown and Hand without looking borrowed from somewhere else.
 *
 * Kept simple on purpose: these render at 10px, where a splice, a grip and a
 * full ring of stitching all collapse into one grey smudge.
 */
function BatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Drawn upright, then tilted as one — a blade this long only fits the
          grid on the diagonal, and the handle has to stay glued to it. */}
      <g transform="rotate(35 12 12)">
        <path d="M12 2.8V8" />
        <rect x="9" y="8" width="6" height="13.2" rx="2.2" />
      </g>
    </svg>
  );
}

function BallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      {/* The two seams, each an S and the pair mirrored about the middle —
          drawn as one reflection of the other so neither leans. */}
      <path d="M8 4.6C12 8.5 6.5 13 9.5 19.6" />
      <path d="M16 4.6C12 8.5 17.5 13 14.5 19.6" />
    </svg>
  );
}

/**
 * The mark each honour wears, and what it means on hover — a name badged twice
 * would run out of room in the column if these were words, and four of them
 * across a card reads as noise. Ordered as they are rendered.
 */
const HONOURS: {
  id: Honour;
  Icon: LucideIcon | typeof BatIcon;
  title: string;
}[] = [
  { id: "mvp", Icon: Crown, title: "Most valuable player this season" },
  { id: "batting", Icon: BatIcon, title: "Most runs this season" },
  { id: "bowling", Icon: BallIcon, title: "Most wickets this season" },
  { id: "fielding", Icon: Hand, title: "Most dismissals this season" },
];

/**
 * Everyone who tops a board, keyed by the name the squad list shows.
 *
 * Players level at the top all count as first — the boards themselves rank ties
 * together rather than picking one on a tiebreak, and a badge that disagreed
 * with the board under it would just look like a bug.
 *
 * A board where the leader has nothing (nobody has taken a wicket yet) crowns
 * nobody: everyone would be level on zero, which is not a distinction.
 */
function seasonHonours(
  leaders: LeaderboardSet | undefined,
  nameFor: (name: string) => string,
): Map<string, Honour[]> {
  const honours = new Map<string, Honour[]>();
  if (!leaders) return honours;

  const crown = <T,>(
    id: Honour,
    rows: T[],
    name: (r: T) => string,
    score: (r: T) => number,
  ) => {
    // The boards arrive sorted, so the first row carries the number to beat.
    const best = rows.length > 0 ? score(rows[0]) : 0;
    if (best <= 0) return;
    for (const r of rows.filter((r) => score(r) === best)) {
      const key = nameFor(name(r));
      honours.set(key, [...(honours.get(key) ?? []), id]);
    }
  };

  crown(
    "mvp",
    leaders.mvp,
    (r) => r.player_name,
    (r) => r.total_points,
  );
  crown(
    "batting",
    leaders.batting,
    (r) => r.player_name,
    (r) => r.total_runs,
  );
  crown(
    "bowling",
    leaders.bowling,
    (r) => r.player_name,
    (r) => r.total_wickets,
  );
  crown(
    "fielding",
    leaders.fielding,
    (r) => r.player_name,
    (r) => r.dismissals,
  );
  return honours;
}

/**
 * Resolves a scorecard name onto the signing it belongs to.
 *
 * The two lists spell the same person differently: the sheet was transcribed in
 * full ("Sagar Sharma", "Rudraksh Jhalani") while a scorecard says whatever the
 * scorer typed ("Sagar", "Rudraksh"). Compared as strings they never meet, and
 * Season 3's regulars end up filed as newcomers while their signings sit on 0
 * matches — so the sheet is indexed and looked up exactly the way the roster is
 * in createRosterMatcher, most specific key first.
 *
 * A name two signings both answer to resolves to neither, and a scorecard name
 * carrying a surname the sheet doesn't have is a different person: "Raghav
 * Chaturvedi" is not the Vikings' "Raghav" unless someone says so in the JSON.
 */
function createSigningMatcher() {
  const claims = new Map<string, Signing[]>();
  for (const s of AUCTION_SIGNINGS) {
    for (const k of playerPhotoIndexKeys(s.name)) {
      claims.set(k, [...(claims.get(k) ?? []), s]);
    }
  }
  return (name: string): Signing | null => {
    for (const k of playerPhotoKeys(name)) {
      const holders = claims.get(k);
      if (!holders) continue;
      return holders.length === 1 ? holders[0] : null;
    }
    return null;
  };
}

function seasonSquads(
  season: Season,
  players: PlayerPoolRow[],
  leaders?: LeaderboardSet,
): SeasonSquad[] | null {
  // The auction sheet belongs to one season; every other season falls back to
  // the plain scorecard-derived list.
  // Matched loosely against both names the season goes by, so a label typed as
  // "Season 3" or a title of "Season 3 · The Matrix" both find the sheet.
  const fromAuction = [season.season_label, season.title].some((s) =>
    (s ?? "").toLowerCase().includes(AUCTION_SEASON.toLowerCase()),
  );
  const teamIds = season.teams.map((t) => t.team_id);
  // The captain heads his list whether or not he has played the most — he is
  // the side, not its leading appearance-maker.
  const byMatches = (a: SquadMember, b: SquadMember) =>
    Number(b.captain ?? false) - Number(a.captain ?? false) ||
    b.matches - a.matches ||
    a.name.localeCompare(b.name);

  if (!fromAuction) {
    if (players.length === 0) return null;
    // Both lists are scorecard-derived here, so a board name is already the
    // name the squad shows.
    const honours = seasonHonours(leaders, (n) => n);
    return teamIds.map((id) => ({
      id,
      members: players
        .filter((p) => p.teams.includes(id))
        .map((p) => ({
          name: p.name,
          matches: p.matches,
          guest: false,
          honours: honours.get(p.name),
        }))
        .sort(byMatches),
    }));
  }

  const signingFor = createSigningMatcher();
  // The boards are scorecard-spelled and the squads are sheet-spelled, so a
  // leader is credited to the signing he resolves to — "Sagar" tops the runs
  // and the badge lands on Sagar Sharma. A leader nobody bought keeps his own
  // name and finds himself among the newcomers.
  const honours = seasonHonours(leaders, (n) => signingFor(n)?.name ?? n);
  // Appearances counted against the sheet, not against the spelling: two
  // scorecard variants of one signing are the same man, so they add up.
  const played = new Map<string, number>();
  const unbought: PlayerPoolRow[] = [];
  for (const p of players) {
    const s = signingFor(p.name);
    if (s) played.set(s.name, (played.get(s.name) ?? 0) + p.matches);
    else unbought.push(p);
  }

  const squads: SeasonSquad[] = teamIds.map((id) => {
    const signed = AUCTION_SIGNINGS.filter((s) => s.teamId === id).map((s) => ({
      name: s.name,
      matches: played.get(s.name) ?? 0,
      guest: s.guest,
      member: s.member,
      captain: s.captain,
      honours: honours.get(s.name),
    }));
    return {
      id,
      members: [
        ...signed.filter((s) => !s.guest).sort(byMatches),
        ...signed.filter((s) => s.guest).sort(byMatches),
      ],
    };
  });

  const newcomers = unbought
    .map((p) => ({
      name: p.name,
      matches: p.matches,
      guest: false,
      honours: honours.get(p.name),
      teams: p.teams.filter((t): t is TeamId => teamIds.includes(t as TeamId)),
    }))
    .sort(byMatches);

  return newcomers.length > 0
    ? [...squads, { id: "newcomers", members: newcomers }]
    : squads;
}

// ── Season header — identity, dates, captains ─────────────────────────────────
export function SeasonHeader({
  season,
  archived = false,
  players = [],
  leaders,
}: {
  season: Season;
  archived?: boolean;
  /** This season's scorecard pool — who turned out, and for whom. */
  players?: PlayerPoolRow[];
  /** This season's boards, for the honours badges in the squad lists. */
  leaders?: LeaderboardSet;
}) {
  const teams = seasonTeamViews(season);
  // Which squad is open, if any. One at a time: the point is to look one team
  // up, not to unroll the whole club under the scoreboard.
  const [openSquad, setOpenSquad] = useState<TeamId | "newcomers" | null>(null);
  const onPlayerClick = usePlayerClick();
  const squads = seasonSquads(season, players, leaders);
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

      {/* The per-team win counts already sit above each crest, so the footer
          only carries what the cards don't say. */}
      <div className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="px-6 py-4 flex flex-col justify-center">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            Total Matches Played
          </span>
          <span className="text-lg font-black text-jcc-accent mt-1">
            {season.total_matches_played} Recorded{" "}
            <span className="text-white/30 font-bold text-sm">[League]</span>
          </span>
        </div>

        {/* One pill per team in the season, plus newcomers when the season
            has any. Sizes are deliberately generous — this is a list people
            read down, not a stat strip. */}
        {squads && (
          <div className="px-6 pb-5 border-t border-white/[0.06] pt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
                Full Squads
              </span>
              {/* Everyone the season has on its books. Nobody is on two lists —
                  a man is on the sheet of the one team that bought him, or he
                  is a newcomer — so the pills add up without double counting. */}
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">
                ·{" "}
                <span className="font-mono text-[11px] tabular-nums text-jcc-accent/70">
                  {squads.reduce((n, s) => n + s.members.length, 0)}
                </span>{" "}
                Players
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {squads.map((squad) => {
                const open = openSquad === squad.id;
                const cfg =
                  squad.id === "newcomers" ? null : TEAMS[squad.id as TeamId];
                const glow = cfg?.glow ?? NEWCOMER_GLOW;
                return (
                  <button
                    key={squad.id}
                    onClick={() => setOpenSquad(open ? null : squad.id)}
                    aria-expanded={open}
                    className="group inline-flex items-center gap-2.5 rounded-full border py-2 pl-4 pr-3 transition-all duration-200 hover:-translate-y-px"
                    style={{
                      // Border, fill and light all come off the team's glow
                      // rather than its primary. Two of the four primaries are
                      // structural darks — the Vikings' fjord teal, the
                      // Outliers' bottle green — which over a navy panel turn
                      // grey at any alpha low enough to sit behind text. The
                      // glow is the bright side of the same identity, so it
                      // stays that team's colour when it is this faint.
                      // At rest the colour is just enough to name the team; the
                      // lit-up treatment is reserved for the pill you opened,
                      // so one pill glowing means something in a row of four.
                      borderColor: teamGlow(glow, open ? 0.85 : 0.22),
                      background: teamGlow(glow, open ? 0.16 : 0.04),
                      boxShadow: open
                        ? `inset 0 0 18px ${teamGlow(glow, 0.45)}, 0 6px 20px -10px ${teamGlow(glow, 0.9)}`
                        : `inset 0 0 10px ${teamGlow(glow, 0.1)}`,
                    }}
                  >
                    <span
                      className="text-[11px] font-black uppercase tracking-widest transition-colors"
                      style={{ color: teamGlow(glow, open ? 1 : 0.6) }}
                    >
                      {squad.id === "newcomers"
                        ? "Newcomers"
                        : (cfg?.name ?? squad.id)}
                    </span>
                    <span
                      className="min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] font-black tabular-nums leading-none"
                      style={{
                        background: teamGlow(glow, open ? 0.22 : 0.07),
                        color: teamGlow(glow, open ? 1 : 0.45),
                      }}
                    >
                      {squad.members.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {squads
              .filter((squad) => squad.id === openSquad)
              .map((squad) => {
                const newcomers = squad.id === "newcomers";
                const cfg = newcomers ? null : TEAMS[squad.id as TeamId];
                // Where the squad ends and the 25L guest tier begins.
                const firstGuest = squad.members.findIndex((m) => m.guest);
                return (
                  <div
                    key={squad.id}
                    className="mt-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">
                      {newcomers ? "Newcomers" : (cfg?.name ?? squad.id)} ·{" "}
                      {squad.members.length}{" "}
                      {squad.members.length === 1 ? "player" : "players"}
                    </p>
                    {squad.members.length === 0 ? (
                      <p className="text-xs text-white/25">
                        Nobody recorded for this team yet.
                      </p>
                    ) : (
                      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                        {squad.members.map((m, i) => (
                          <Fragment key={m.name}>
                            {/* The guest list is a different thing from the
                                squad, so it gets a line of its own — and it
                                spans the grid so it reads as one divider
                                rather than one per column. */}
                            {i === firstGuest && firstGuest > 0 && (
                              <div className="col-span-full mt-3 mb-1.5 flex items-center gap-2.5">
                                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">
                                  Guests
                                </span>
                                <span className="h-px flex-1 bg-white/[0.08]" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => onPlayerClick(m.name)}
                              className="flex w-full min-w-0 items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                            >
                              <ScorecardFace
                                name={m.name}
                                teamId={newcomers ? null : (squad.id as TeamId)}
                                photo={m.member !== false}
                                size={96}
                                className="w-10 h-10 shrink-0 rounded-full overflow-hidden"
                              />
                              <span className="min-w-0 flex-1">
                                {/* The captain's name carries the gold and the
                                    (C) after it — the mark sits tight to the
                                    name so a long one truncates around it
                                    instead of pushing it off the row. */}
                                <span
                                  className={`flex min-w-0 items-baseline gap-1 text-sm font-black ${
                                    m.captain
                                      ? "text-jcc-accent"
                                      : "text-white/90"
                                  }`}
                                >
                                  <span className="truncate">{m.name}</span>
                                  {m.captain && (
                                    <span
                                      className="shrink-0 text-[10px] font-black tracking-wider text-jcc-accent/70"
                                      title="Captain"
                                    >
                                      (C)
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5">
                                  {/* A newcomer's line says who he has turned
                                      out for; everyone else's says how much. */}
                                  {m.teams && m.teams.length > 0 ? (
                                    m.teams.map((t) => (
                                      <TeamTag key={t} teamId={t} />
                                    ))
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">
                                      {m.matches === 0
                                        ? "Yet to play"
                                        : `${m.matches} ${m.matches === 1 ? "match" : "matches"}`}
                                    </span>
                                  )}
                                </span>
                              </span>
                              {/* Boards he tops, ranged right so the badges
                                  line up down the column instead of trailing a
                                  name of whatever length. Fixed order, so a man
                                  who leads two reads the same on every card. */}
                              {m.honours && m.honours.length > 0 && (
                                <span className="flex shrink-0 items-center gap-1">
                                  {HONOURS.filter((h) =>
                                    m.honours?.includes(h.id),
                                  ).map(({ id, Icon, title }) => (
                                    <span
                                      key={id}
                                      title={title}
                                      aria-label={title}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-jcc-accent/30 bg-jcc-accent/10"
                                    >
                                      <Icon className="h-[16px] w-[16px] text-jcc-accent-highlight" />
                                    </span>
                                  ))}
                                </span>
                              )}
                              {m.teams && (
                                <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/30">
                                  {m.matches}
                                </span>
                              )}
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
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

      {/* Phones fit the standings but not the form strip alongside them, so
          below sm the form drops to a second line under each team and the table
          stops scrolling sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full sm:min-w-[500px] text-left">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-white/45">
              <th className="px-2 sm:px-3 py-2.5 w-8">#</th>
              <th className="px-2 sm:px-3 py-2.5">Team</th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums">
                P
              </th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums">
                W
              </th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums">
                T
              </th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums">
                L
              </th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums text-jcc-accent/70">
                Pts
              </th>
              <th className="px-1.5 sm:px-2 py-2.5 text-center tabular-nums">
                NRR
              </th>
              <th className="hidden sm:table-cell px-3 py-2.5 text-right">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const cfg = TEAMS[row.team_id];
              const color = cfg?.primary ?? "#888";
              const form = formGuide(matches, row.team_id);
              const qualifying = showCut && i < playoffBerths;
              // The playoff cut is drawn under the team's last line, which on a
              // phone is its form strip rather than its stats.
              const cut = showCut && i === playoffBerths - 1;
              const formStrip =
                form.length === 0 ? (
                  <span className="text-xs text-white/25">—</span>
                ) : (
                  form.map((f, j) => (
                    <span
                      key={j}
                      title={f === "W" ? "Won" : f === "L" ? "Lost" : "Tied"}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${FORM_STYLE[f]}`}
                    >
                      {f}
                    </span>
                  ))
                );
              return (
                <Fragment key={row.team_id}>
                  <tr
                    className={`border-t border-white/[0.05] transition-colors hover:bg-white/[0.03] ${
                      cut ? "sm:border-b-2 sm:border-b-jcc-gold/25" : ""
                    }`}
                  >
                    <td className="px-2 sm:px-3 pt-3 pb-1.5 sm:pb-3">
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
                    <td className="px-2 sm:px-3 pt-3 pb-1.5 sm:pb-3">
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
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-sm font-bold text-white/60 tabular-nums">
                      {row.played}
                    </td>
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-sm font-black text-white tabular-nums">
                      {row.won}
                    </td>
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-sm font-bold text-white/60 tabular-nums">
                      {row.tied}
                    </td>
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-sm font-bold text-white/60 tabular-nums">
                      {row.lost}
                    </td>
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-base font-black text-jcc-accent tabular-nums">
                      {row.points}
                    </td>
                    <td className="px-1.5 sm:px-2 pt-3 pb-1.5 sm:pb-3 text-center text-[13px] font-mono font-bold tabular-nums text-white/70">
                      {row.nrr > 0 ? "+" : ""}
                      {row.nrr.toFixed(2)}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {formStrip}
                      </div>
                    </td>
                  </tr>
                  <tr
                    className={`sm:hidden ${
                      cut ? "border-b-2 border-b-jcc-gold/25" : ""
                    }`}
                  >
                    <td colSpan={8} className="px-2 pb-3.5">
                      <div className="flex items-center justify-end gap-1.5 pr-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
                          Form
                        </span>
                        <span className="flex items-center gap-1">
                          {formStrip}
                        </span>
                      </div>
                    </td>
                  </tr>
                </Fragment>
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

  // One row per team, in the order the season declared them.
  //
  // Deliberately NOT sorted by wins, and deliberately no bar comparing them:
  // a season's teams did not all play the same number of matches (the Outliers
  // joined Season 2 halfway through), and `season.teams` carries no per-team
  // played count to normalise against. Ranking 5 wins below 12 would be a
  // standing the data cannot support. The wins are shown as a count each, and
  // the league table on the season page is where they get compared.
  const standings = teams.map((t) => ({
    ...t,
    total: t.wins + t.playoffWins,
  }));

  const card = (
    <motion.div
      variants={fadeUp}
      className={`group relative rounded-2xl border border-white/[0.06] overflow-hidden p-6 sm:p-7 transition-all duration-300 hover:border-white/15 bg-gradient-to-br from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] hover:shadow-[0_15px_35px_-10px_rgba(0,0,0,0.5)] ${hasDetail ? "cursor-pointer" : ""}`}
    >
      {/* The hairline carries the season's own team colours, so two archived
          cards side by side are told apart before either title is read. */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-70"
        style={{
          background: `linear-gradient(90deg, ${standings.map((t) => t.color).join(", ")})`,
        }}
      />

      {/* Title and the season's headline number share the top line: the card
          answers "which season" and "how big was it" in one glance. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <History className="w-3 h-3 text-white/30" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35">
              Archived · {teams.length} Teams
            </span>
          </div>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white uppercase tracking-tight group-hover:text-jcc-accent transition-colors duration-300">
            {season.title}
          </h3>
          <span className="mt-1.5 inline-block text-[8px] font-black uppercase tracking-[0.2em] text-white/30 px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded-full">
            {season.season_label || "Legacy Era"}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black tabular-nums leading-none text-3xl sm:text-4xl text-jcc-accent">
            {season.total_matches_played}
          </p>
          <p className="mt-1 text-[8px] font-black uppercase tracking-[0.25em] text-white/30">
            Matches
          </p>
        </div>
      </div>

      {/* One line per team, finishing order down the card: badge, captain, and
          the win count as a bar so the margin is visible without arithmetic.
          The old card split league and playoff wins into two number rows that
          made you match column to column to work out who actually won. */}
      <div className="mt-5 space-y-2.5">
        {standings.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
          >
            <TeamLogo
              src={t.logo}
              alt={t.label}
              color={t.color}
              fallback={t.short}
              className="w-7 h-7 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[9px] font-black uppercase tracking-[0.2em] truncate"
                style={{ color: t.color }}
              >
                {t.label}
              </p>
              <p className="text-xs font-black text-white/80 truncate">
                {t.captain ?? "—"}
              </p>
              {/* Left of the count and wrapping freely: the caveat has to be
                  readable in full, or it isn't doing its job. */}
              {t.note && (
                <p className="mt-1 text-[9px] font-medium italic leading-snug text-white/35">
                  {t.note}
                </p>
              )}
            </div>
            <div className="w-24 sm:w-28 shrink-0">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="font-black tabular-nums text-white text-base leading-none">
                  {t.total}
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-white/30">
                  Wins
                </span>
              </div>
              <p className="mt-1.5 text-[8px] font-black uppercase tracking-widest text-white/25 text-right tabular-nums">
                {t.wins} Lg · {t.playoffWins} PO
              </p>
            </div>
          </div>
        ))}
      </div>

      {season.notes && (
        <p className="mt-4 text-[10px] text-white/35 font-medium leading-relaxed italic">
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
  stats: {
    label: string;
    value: React.ReactNode;
    emphasis?: "pill" | "gilded";
  }[];
  /**
   * The ranked-on number, kept numeric so the board can spot level players.
   * The headline is already formatted for display and no use for comparing.
   */
  tieKey: number;
  /**
   * Every comparable number this player has on this board, keyed by metric id.
   * The chips above are chosen and formatted for reading; this is the same
   * data left raw, so sorting and the minimums filter can work on any of them
   * without re-deriving anything from the source row. `null` is "no figure" —
   * an average with no dismissals, a strike rate with no balls — and always
   * sorts and filters out rather than counting as a zero.
   */
  values: Record<string, number | null>;
};

/**
 * A stat you can sort or filter the board by.
 *
 * `better` is which end of the scale is good, and it does two jobs: it points
 * the default sort the right way, and it decides whether the threshold box
 * asks for a minimum (runs, wickets) or a maximum (economy, bowling average).
 * Asking for "at least 6.0 economy" would be exactly backwards.
 */
type Metric = {
  key: string;
  label: string;
  digits?: number;
  better: "high" | "low";
};

/** Sortable/filterable stats per board, headline stat first. */
const METRICS: Record<StatsTab, Metric[]> = {
  batting: [
    { key: "runs", label: "Runs", better: "high" },
    { key: "sr", label: "Strike rate", digits: 1, better: "high" },
    { key: "avg", label: "Average", digits: 2, better: "high" },
    { key: "hs", label: "High score", better: "high" },
    { key: "fours", label: "Fours", better: "high" },
    { key: "sixes", label: "Sixes", better: "high" },
    { key: "balls", label: "Balls faced", better: "high" },
    { key: "matches", label: "Matches", better: "high" },
    { key: "innings", label: "Innings", better: "high" },
  ],
  bowling: [
    { key: "wickets", label: "Wickets", better: "high" },
    { key: "econ", label: "Economy", digits: 2, better: "low" },
    { key: "avg", label: "Average", digits: 2, better: "low" },
    { key: "overs", label: "Overs", digits: 1, better: "high" },
    { key: "conceded", label: "Runs conceded", better: "low" },
    { key: "matches", label: "Matches", better: "high" },
    { key: "innings", label: "Innings", better: "high" },
  ],
  mvp: [
    { key: "points", label: "MVP points", digits: 1, better: "high" },
    { key: "bat", label: "Batting points", digits: 1, better: "high" },
    { key: "bowl", label: "Bowling points", digits: 1, better: "high" },
    { key: "field", label: "Fielding points", digits: 1, better: "high" },
    { key: "runs", label: "Runs", better: "high" },
    { key: "wickets", label: "Wickets", better: "high" },
    { key: "dismissals", label: "Dismissals", digits: 2, better: "high" },
    { key: "matches", label: "Matches", better: "high" },
  ],
  fielding: [
    { key: "dismissals", label: "Dismissals", digits: 2, better: "high" },
    { key: "catches", label: "Catches", better: "high" },
    { key: "stumpings", label: "Stumpings", better: "high" },
    { key: "runouts", label: "Run outs", better: "high" },
  ],
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
        values: {
          runs: r.total_runs,
          sr: r.strike_rate,
          avg: r.batting_average,
          hs: r.high_score,
          fours: r.fours,
          sixes: r.sixes,
          balls: r.balls_faced,
          matches: r.matches,
          innings: r.innings,
        },
        stats: [
          { label: "SR", value: fmt(r.strike_rate, 1) },
          { label: "Avg", value: fmt(r.batting_average, 2) },
          { label: "HS", value: r.high_score, emphasis: "gilded" as const },
          { label: "M", value: r.matches },
          { label: "Inn", value: r.innings, emphasis: "pill" as const },
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
        values: {
          wickets: r.total_wickets,
          econ: r.economy,
          avg: r.bowling_average,
          overs: r.total_overs,
          conceded: r.runs_conceded,
          matches: r.matches,
          innings: r.innings,
        },
        stats: [
          { label: "Econ", value: r.economy },
          { label: "Avg", value: fmt(r.bowling_average, 2) },
          { label: "Ov", value: r.total_overs, emphasis: "gilded" as const },
          { label: "M", value: r.matches },
          { label: "Inn", value: r.innings, emphasis: "pill" as const },
          { label: "Runs", value: r.runs_conceded },
        ],
      }));
    case "mvp":
      return set.mvp.map((r) => ({
        name: r.player_name,
        teamId: r.team_id,
        headline: { label: "MVP", value: r.total_points.toFixed(1) },
        tieKey: r.total_points,
        values: {
          points: r.total_points,
          bat: r.batting_points,
          bowl: r.bowling_points,
          field: r.fielding_points,
          runs: r.total_runs,
          wickets: r.total_wickets,
          dismissals: r.fielding_dismissals,
          matches: r.matches,
        },
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
        // Run outs sort and filter on involvement, the same number the RO
        // column shows — searching for "3 run outs" should find the man who
        // was in on three, not the 1.5 the split credits him.
        values: {
          dismissals: r.dismissals,
          catches: r.catches,
          stumpings: r.stumpings,
          runouts: r.run_outs_involved,
        },
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

/**
 * "SR 171.9" — the unit the supporting stats are rendered in everywhere.
 *
 * Five bare numbers in a row read as one undifferentiated run, so two of them
 * are lifted out, each a different way so they stay distinguishable:
 *
 *   pill   — innings, the number that reframes the others. 50 runs means
 *            something else at 2 innings than at 4. Neutral and square-ish.
 *   gilded — the player's own peak: a batter's highest score, a bowler's
 *            overs. A soft gold capsule with the figure lit from within. Round
 *            where the pill is square and warm where it is grey, so the two
 *            never read as the same emphasis.
 */
function StatChip({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: "pill" | "gilded";
}) {
  const gilded = emphasis === "gilded";
  return (
    <div
      className={`flex items-baseline gap-1 ${
        emphasis === "pill"
          ? "rounded-md border border-white/[0.09] bg-white/[0.04] px-1.5 py-0.5"
          : gilded
            ? "rounded-full border border-[#D4AF37]/25 px-2 py-0.5"
            : ""
      }`}
      style={
        gilded
          ? {
              // Warmth pooled at the bottom of the capsule rather than filling
              // it flat — the figure sits in the light instead of on a swatch.
              background:
                "linear-gradient(180deg, rgba(212,175,55,0.03) 0%, rgba(212,175,55,0.14) 100%)",
              boxShadow: "inset 0 0 12px -6px rgba(212,175,55,0.55)",
            }
          : undefined
      }
    >
      <span
        className={`text-[10px] font-black uppercase tracking-widest ${
          gilded
            ? "text-[#D4AF37]/55"
            : emphasis
              ? "text-white/40"
              : "text-white/30"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-[13px] font-black tabular-nums ${gilded ? "text-[#F0D479]" : "text-white/80"}`}
        style={
          gilded ? { textShadow: "0 0 10px rgba(212,175,55,0.45)" } : undefined
        }
      >
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

/** Names those three colours where the phone podium stacks them vertically. */
const MEDAL_LABEL = ["Gold", "Silver", "Bronze"] as const;

/**
 * Supporting stats shown per player. Five, so that matches and innings both
 * make the cut on batting and bowling — "50 runs in 4 matches" reads very
 * differently once you know he batted twice.
 */
const PODIUM_CHIPS = 5;

/** Rows a page of the leaderboard shows. First entry is the default. */
const PAGE_SIZES = [10, 15, 25] as const;

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

/**
 * The podium row: three cards to a screen, the rest a scroll to the right.
 *
 * Nothing on screen would otherwise admit the extra cards exist, so a slider
 * sits under the strip — its thumb sized to the share of the row you can see
 * and tracking where you are. It appears only when there is somewhere to go,
 * so the usual three-card podium is left alone. The native bar is hidden in
 * favour of it; two scrollbars saying the same thing is one too many.
 */
function PodiumStrip({
  children,
  count,
}: {
  children: React.ReactNode;
  /** Re-measures when the board changes under it — tab, page, page size. */
  count: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ visible, at }, setScroll] = useState({ visible: 1, at: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const room = el.scrollWidth - el.clientWidth;
      setScroll({
        visible: el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1,
        at: room > 0 ? el.scrollLeft / room : 0,
      });
    };
    measure();
    // Width changes with the viewport, not just with the card count.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [count]);

  const scrollable = visible < 0.99;

  return (
    <>
      {/* pt-5 leaves room for the rank disc above each card — overflow-x
          would otherwise crop it. */}
      <div
        ref={ref}
        className="flex gap-3 sm:gap-4 pt-5 pb-1 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {scrollable && (
        <div className="mt-2 h-1 w-full max-w-[220px] mx-auto rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#D4AF37]/70 transition-[margin] duration-150"
            style={{
              width: `${visible * 100}%`,
              // Pushed along the track by however far through the scroll we are.
              marginLeft: `${at * (1 - visible) * 100}%`,
            }}
          />
        </div>
      )}
    </>
  );
}

/** Ranks 1–3, as portrait cards. The leader sits raised and gold-ringed. */
function PodiumCard({
  entry,
  rank,
  tab,
  tied,
  fill = false,
}: {
  entry: LeaderEntry;
  rank: number;
  tab: StatsTab;
  tied: boolean;
  /** Phone layout only: a rank held by one player fills the width instead of
      sitting in a scroller with nothing to scroll to. */
  fill?: boolean;
}) {
  const color = PODIUM_ORDER[rank - 1];
  const lead = rank === 1;
  return (
    // Three stacked podium columns eat the whole phone screen, so below sm the
    // card lays itself out as one dense row — badge, face, name, headline — with
    // the stats strip underneath. From sm up it's the original centred column.
    //
    // Exactly three to a screen, whatever the count: each card is a third of
    // the strip minus the two gaps, and never shrinks. A fourth player does not
    // squeeze the first three thinner, he waits one scroll to the right. Phones
    // get one card at a time — a third of a phone is not a card.
    <div
      className={`snap-start shrink-0 ${fill ? "w-full" : "w-[78vw]"} sm:w-[calc((100%-2rem)/3)] relative flex flex-col rounded-2xl border px-3 py-3 sm:px-4 sm:pt-7 sm:pb-4 transition-transform ${
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
          {rank}
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
          <div className="mt-1 flex items-center gap-1.5 sm:justify-center">
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
          {entry.stats.slice(0, PODIUM_CHIPS).map((s, i) => (
            <Fragment key={s.label}>
              {/* Break where the list rows break: rates on the first line, the
                  volume stats on the second, rather than wherever the card
                  happens to run out of width. */}
              {i === 3 && <span className="basis-full" />}
              <StatChip {...s} />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Page size and page controls, shown under every leaderboard. The board opens
 * on the top 10 and the whole squad is a click away, so a player outside the
 * podium can still find himself.
 */
function Pagination({
  total,
  page,
  pageSize,
  pageCount,
  onPageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  onPageSize: (n: number) => void;
  onPage: (n: number) => void;
}) {
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const arrow =
    "grid place-items-center w-7 h-7 rounded-full border border-white/[0.08] text-white/50 transition-colors enabled:hover:text-[#D4AF37] enabled:hover:border-[#D4AF37]/40 disabled:opacity-25";

  return (
    <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 px-2">
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/25">
          Show
        </span>
        {PAGE_SIZES.map((n) => (
          <button
            key={n}
            onClick={() => onPageSize(n)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums transition-all ${
              n === pageSize
                ? "bg-[#D4AF37] text-jcc-blue"
                : "text-white/35 bg-white/[0.04] border border-white/[0.08] hover:text-white/60"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold tabular-nums text-white/35">
          {first}–{last} of {total}
        </span>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
          className={arrow}
        >
          ‹
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
          className={arrow}
        >
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * Search, sort and thresholds for the board below.
 *
 * The board answers "who leads" well and "where do I come" badly: a player
 * outside the top ten had to page until his own name turned up, and there was
 * no way to ask a question the default order doesn't answer — who struck
 * fastest, who was most economical, who did it in the fewest innings.
 *
 * So: a name search, a sort over every comparable stat on the board, and a
 * threshold per stat. Thresholds are one-sided by design — a minimum where
 * high is good and a maximum where low is, so "econ 6" always means "no worse
 * than 6" and there is nothing to get backwards. The qualifier case (best
 * strike rate among players with 30+ balls) falls out of combining the two.
 *
 * On a phone everything stacks full width and the thresholds stay folded away
 * behind a button, so the default board is one line of chrome, not five.
 */
function BoardControls({
  metrics,
  teams,
  query,
  onQuery,
  sortKey,
  onSortKey,
  sortDir,
  onSortDir,
  teamFilter,
  onTeamFilter,
  thresholds,
  onThresholds,
  activeCount,
  onClear,
}: {
  metrics: Metric[];
  teams: string[];
  query: string;
  onQuery: (v: string) => void;
  sortKey: string;
  onSortKey: (v: string) => void;
  sortDir: "desc" | "asc";
  onSortDir: (v: "desc" | "asc") => void;
  teamFilter: string[];
  onTeamFilter: (v: string[]) => void;
  thresholds: Record<string, number>;
  onThresholds: (v: Record<string, number>) => void;
  activeCount: number;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const filterCount = teamFilter.length + Object.keys(thresholds).length;
  // Every control sits inside one bar, so none of them carries a border of
  // its own — they are segments of a single object, not four pills adrift on
  // the panel.
  const segment =
    "h-9 rounded-full bg-transparent text-white text-xs font-bold focus:outline-none transition-colors";

  const setThreshold = (key: string, raw: string) => {
    const next = { ...thresholds };
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n)) delete next[key];
    else next[key] = n;
    onThresholds(next);
  };

  return (
    // Air under the tab row, so the controls read as their own band rather
    // than something hanging off the bottom of the tabs.
    <div className="px-4 pt-5">
      {/* One bar the width of the board, rather than a scatter of capsules
          with an arbitrary hole on the left. Search takes the slack; sorting
          and filtering sit at the far end where the columns they act on are.
          On a phone the bar stacks into two rows but stays one object. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 p-1.5 rounded-2xl sm:rounded-full border border-white/[0.08] bg-white/[0.04] focus-within:border-white/[0.14] transition-colors">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Search players</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search a player…"
            className={`${segment} w-full pl-9 pr-3 placeholder:text-white/25 placeholder:font-medium`}
          />
          <Search
            aria-hidden
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
          />
        </label>

        {/* A hairline instead of a gap: it separates the two halves without
            breaking the bar into pieces again. */}
        <div
          aria-hidden
          className="hidden sm:block w-px h-5 bg-white/[0.10] mx-1"
        />

        <div className="flex items-center gap-1 border-t sm:border-t-0 border-white/[0.06] pt-1 sm:pt-0">
          {/* Native select, so a phone gets its own wheel rather than a menu
              that has to be scrolled inside an already-scrolling page. */}
          <label className="flex-1 sm:flex-none sm:w-40">
            <span className="sr-only">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => onSortKey(e.target.value)}
              // Matching pads either side of the centred label, so the chevron
              // doesn't drag it off centre.
              className={`${segment} w-full appearance-none text-center pl-7 pr-7 bg-[right_0.6rem_center] bg-no-repeat cursor-pointer hover:bg-white/[0.05]`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
              }}
            >
              {metrics.map((m) => (
                // Rendered on a navy panel, but the open list is drawn by the
                // OS in its own colours — so the options carry their own.
                <option key={m.key} value={m.key} className="bg-[#0f1c33]">
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => onSortDir(sortDir === "desc" ? "asc" : "desc")}
            aria-label={
              sortDir === "desc" ? "Sort ascending" : "Sort descending"
            }
            title={sortDir === "desc" ? "Highest first" : "Lowest first"}
            className={`${segment} shrink-0 grid place-items-center w-9 text-white/60 hover:text-[#D4AF37] hover:bg-white/[0.05]`}
          >
            {sortDir === "desc" ? (
              <ArrowDown className="w-3.5 h-3.5" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Filters is the one control that opens something, so it is the one
              control that reads as a button inside the bar. */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`${segment} shrink-0 flex items-center gap-1.5 px-3.5 ${
              filterCount > 0 || open
                ? "bg-[#D4AF37]/15 text-[#D4AF37]"
                : "bg-white/[0.05] text-white/70 hover:text-white"
            }`}
          >
            Filters
            {filterCount > 0 && (
              <span className="grid place-items-center min-w-4 h-4 px-1 rounded-full bg-[#D4AF37] text-jcc-blue text-[9px] tabular-nums">
                {filterCount}
              </span>
            )}
          </button>

          {activeCount > 0 && (
            <button
              onClick={onClear}
              className="shrink-0 h-9 px-2.5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/60"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
          {teams.length > 1 && (
            <div className="pb-3 border-b border-white/[0.06]">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/25 mb-1.5">
                Teams
              </p>
              <div className="flex flex-wrap gap-1.5">
                {teams.map((id) => {
                  const on = teamFilter.includes(id);
                  const team = TEAMS[id as keyof typeof TEAMS];
                  return (
                    <button
                      key={id}
                      onClick={() =>
                        onTeamFilter(
                          on
                            ? teamFilter.filter((t) => t !== id)
                            : [...teamFilter, id],
                        )
                      }
                      className={`px-3 h-8 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                        on
                          ? "border-transparent text-jcc-blue"
                          : "border-white/[0.08] bg-white/[0.04] text-white/40 hover:text-white/70"
                      }`}
                      style={
                        on
                          ? { background: team?.primary ?? "#D4AF37" }
                          : undefined
                      }
                    >
                      {team?.name ?? id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/25 mb-1.5">
              Thresholds · leave blank to ignore
            </p>
            {/* Two columns on a phone, so the list of stats doesn't turn into
                a screenful of near-empty rows — and four on a wide screen,
                because three stretched the cells until the label and its box
                sat at opposite ends of the column looking unrelated. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {metrics.map((m) => {
                const on = thresholds[m.key] != null;
                return (
                  // Each stat is one bordered field rather than a label and a
                  // box that happen to share a row: whatever the column width,
                  // the number is visibly attached to the stat it limits.
                  <label
                    key={m.key}
                    className={`flex items-center gap-1.5 h-9 pl-2.5 pr-1 rounded-lg border bg-white/[0.03] transition-colors focus-within:border-[#D4AF37]/50 ${
                      on ? "border-[#D4AF37]/30" : "border-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-wider ${on ? "text-white/70" : "text-white/40"}`}
                    >
                      {m.label}
                    </span>
                    <span className="shrink-0 text-[8px] font-black uppercase text-white/25">
                      {m.better === "high" ? "min" : "max"}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={thresholds[m.key] ?? ""}
                      onChange={(e) => setThreshold(m.key, e.target.value)}
                      className="w-11 h-7 shrink-0 rounded-md bg-white/[0.06] text-center text-xs font-black tabular-nums text-white focus:outline-none"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Everyone below the podium — one dense row each, no horizontal scrolling.
 *
 * A row can still hold a podium rank: when a tie makes the podium too crowded
 * to draw, the whole rank comes down here. Those rows wear the same filled
 * medal disc the podium cards use, so a 3rd place spread across six players
 * still reads as 3rd place.
 */
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
  const medal = PODIUM_ORDER[rank - 1];
  return (
    // On a phone the row wraps onto two lines — who and how many on the first,
    // the supporting stats on the second, indented under the name. One line
    // could only fit them by cutting every name down to an initial.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 px-2 rounded-xl border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors sm:flex-nowrap sm:gap-y-0">
      {/* Same footprint with or without the disc, so faces stay in one column. */}
      {medal ? (
        <span
          className="w-5 h-5 shrink-0 grid place-items-center rounded-full font-black tabular-nums text-[10px] text-jcc-blue"
          style={{ background: medal }}
        >
          {rank}
        </span>
      ) : (
        <span className="w-5 shrink-0 text-right font-black tabular-nums text-white/20 text-xs">
          {rank}
        </span>
      )}
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
        {/* A hair of air under the name so the team doesn't sit on it. */}
        <div className="mt-1 flex items-center gap-1.5">
          <TeamTag teamId={entry.teamId} />
          {tied && <TieBadge tab={tab} value={entry.tieKey} />}
        </div>
      </div>
      {/* order-2 + basis-full pushes this onto its own line below sm; the
          padding lines it up with the name rather than the rank disc. */}
      <div className="order-2 basis-full flex flex-wrap items-center gap-x-5 gap-y-2 pl-[4.75rem] sm:order-none sm:basis-auto sm:flex-nowrap sm:gap-y-0 sm:shrink-0 sm:pl-0">
        {entry.stats.slice(0, PODIUM_CHIPS).map((s, i) => (
          <Fragment key={s.label}>
            {/* The rate stats read as one line and the volume ones as another,
                rather than however many happen to fit before the edge. */}
            {i === 3 && <span className="basis-full sm:hidden" />}
            <StatChip {...s} />
          </Fragment>
        ))}
      </div>
      <span className="order-1 w-12 shrink-0 text-right font-black tabular-nums text-[#D4AF37] text-base sm:order-none">
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
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(METRICS.batting[0].key);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const set = scope === "season" ? season : career;

  const metrics = METRICS[tab];
  const metric = metrics.find((m) => m.key === sortKey) ?? metrics[0];
  const defaultDir = metric.better === "high" ? "desc" : "asc";

  // The board arrives sorted the way the tab ranks it, tiebreaks and all, so
  // the headline stat in its own direction is left exactly as it came — only a
  // sort the source order can't already express does any work here.
  const sorted = useMemo(() => {
    const all = toEntries(tab, set);
    if (metric.key === metrics[0].key && sortDir === defaultDir) return all;
    return all
      .map((e, i) => ({ e, i }))
      .sort((a, b) => {
        const av = a.e.values[metric.key];
        const bv = b.e.values[metric.key];
        // No figure is not a bad figure — an average with no dismissals goes
        // to the bottom either way round rather than winning the ascending sort.
        if (av == null || bv == null) {
          if (av == null && bv == null) return a.i - b.i;
          return av == null ? 1 : -1;
        }
        // Level on the sorted stat falls back to the board's own order, so the
        // tab's tiebreaks still decide it.
        return av === bv ? a.i - b.i : sortDir === "desc" ? bv - av : av - bv;
      })
      .map(({ e }) => ({
        ...e,
        // Ranking and the big number follow whatever the board is sorted by,
        // otherwise a strike-rate sort shows a column of runs down the side
        // that has nothing to do with the order the rows are in.
        tieKey: e.values[metric.key] ?? Number.NEGATIVE_INFINITY,
        headline: {
          label: metric.label,
          value:
            e.values[metric.key] == null
              ? "—"
              : metric.digits != null
                ? e.values[metric.key]!.toFixed(metric.digits)
                : fmtCount(e.values[metric.key]!),
        },
      }));
  }, [tab, set, metric, metrics, sortDir, defaultDir]);

  // Who shares their headline number with someone else. Computed over the whole
  // list before any slicing — a player level with someone two pages down is
  // still tied, and paging through must not change who is marked.
  const tiedKeys = new Set(
    sorted.map((e) => e.tieKey).filter((k, i, keys) => keys.indexOf(k) !== i),
  );
  const isTied = (e: LeaderEntry) => tiedKeys.has(e.tieKey);

  // Dense ranking: everyone level on the headline holds the same rank, and the
  // next number along is the next distinct score rather than the next row. Six
  // players tied behind a 1st and a 2nd are all 3rd, and whoever follows is
  // 4th — no gaps. The list is already sorted, so distinct keys come in order.
  //
  // Ranks come off the full board, never the filtered one: a search for your
  // own name should tell you that you are 14th, not that you are 1st of the
  // one row that matched.
  const rankByKey = new Map<number, number>();
  for (const e of sorted) {
    if (!rankByKey.has(e.tieKey)) rankByKey.set(e.tieKey, rankByKey.size + 1);
  }
  const rankOf = (e: LeaderEntry) => rankByKey.get(e.tieKey)!;

  const needle = query.trim().toLowerCase();
  const narrowed =
    needle !== "" ||
    teamFilter.length > 0 ||
    Object.keys(thresholds).length > 0;
  const all = sorted.filter((e) => {
    if (needle && !e.name.toLowerCase().includes(needle)) return false;
    if (teamFilter.length > 0 && !teamFilter.includes(e.teamId ?? ""))
      return false;
    return metrics.every((m) => {
      const limit = thresholds[m.key];
      if (limit == null) return true;
      const v = e.values[m.key];
      if (v == null) return false;
      return m.better === "high" ? v >= limit : v <= limit;
    });
  });

  /** Every team with a player on this board, in the club's own order. */
  const teamsOnBoard = Object.keys(TEAMS).filter((id) =>
    sorted.some((e) => e.teamId === id),
  );

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  // Guards a stale page after switching to a tab with fewer players.
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const entries = all.slice(start, start + pageSize);

  // The podium holds whole ranks rather than the top three rows, so a tie for
  // 2nd puts everyone who earned it on a card instead of promoting one and
  // dropping the rest into the list.
  //
  // Side by side, that means ranks 1-3 only while they fit three cards. Once a
  // tie pushes it past three the wide podium keeps ranks 1-2 and rank 3 goes to
  // the list, where it keeps its bronze disc (see LeaderRow) — a six-way tie
  // for 3rd can't be drawn across three columns.
  //
  // The phone podium has no such limit: it stacks the ranks, so bronze gets its
  // own row and its own scroller however many players share it.
  //
  // A narrowed board has no podium at all. Three medal cards over a filtered
  // list would be claiming a podium the filter invented — the top of "Vikings
  // with 20+ runs" is nobody's gold medal. Filtered rows keep their real rank
  // number instead, which is the honest version of the same information.
  const upTo = (r: number) => entries.filter((e) => rankOf(e) <= r);
  const podium = current === 0 && !narrowed ? upTo(3) : [];
  const podiumWide = podium.length > 3 ? upTo(2) : podium;
  // One "chasing pack" per layout, since the two podiums can hold a rank apart.
  const rest = entries.slice(podium.length);
  const restWide = entries.slice(podiumWide.length);

  // The phone podium, grouped by rank. `entries` is already sorted, so the
  // groups come out gold, silver, bronze.
  const podiumRanks: [rank: number, group: LeaderEntry[]][] = [];
  for (const e of podium) {
    const r = rankOf(e);
    const group = podiumRanks.find(([rank]) => rank === r);
    if (group) group[1].push(e);
    else podiumRanks.push([r, [e]]);
  }

  // Any control that reshapes the list sends you back to the front of it.
  const reset =
    <T,>(apply: (v: T) => void) =>
    (v: T) => {
      apply(v);
      setPage(0);
    };

  // Each board has its own stats, so the sort and the thresholds can't survive
  // a tab change — "min economy 6" means nothing on the batting board. The name
  // search does survive: looking yourself up on one board and then the next is
  // the whole point of it.
  const changeTab = (id: StatsTab) => {
    setTab(id);
    setSortKey(METRICS[id][0].key);
    setSortDir(METRICS[id][0].better === "high" ? "desc" : "asc");
    setThresholds({});
    setPage(0);
  };

  const changeSort = (key: string) => {
    setSortKey(key);
    setSortDir(
      (metrics.find((m) => m.key === key) ?? metrics[0]).better === "high"
        ? "desc"
        : "asc",
    );
    setPage(0);
  };

  const clearAll = () => {
    setQuery("");
    setTeamFilter([]);
    setThresholds({});
    changeSort(metrics[0].key);
  };

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
            onClick={() => reset(setScope)(s)}
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
            onClick={() => changeTab(t.id)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.id ? "text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/30 hover:text-white/50"}`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {sorted.length > 0 && (
        <BoardControls
          metrics={metrics}
          teams={teamsOnBoard}
          query={query}
          onQuery={reset(setQuery)}
          sortKey={metric.key}
          onSortKey={changeSort}
          sortDir={sortDir}
          onSortDir={reset(setSortDir)}
          teamFilter={teamFilter}
          onTeamFilter={reset(setTeamFilter)}
          thresholds={thresholds}
          onThresholds={reset(setThresholds)}
          activeCount={
            (narrowed ? 1 : 0) +
            (metric.key !== metrics[0].key || sortDir !== defaultDir ? 1 : 0)
          }
          onClear={clearAll}
        />
      )}

      {sorted.length === 0 ? (
        <p className="text-center text-white/20 text-xs py-12">
          No data yet — import matches to see stats
        </p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-white/35 text-xs font-bold">
            No player on this board matches that.
          </p>
          <button
            onClick={clearAll}
            className="mt-3 px-4 h-8 rounded-full border border-[#D4AF37]/40 text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          {podium.length > 0 && (
            <>
              {/* Tablet and up: the three columns side by side, as before. */}
              <div className="hidden sm:block">
                <PodiumStrip count={podiumWide.length}>
                  {podiumWide.map((e) => (
                    <PodiumCard
                      key={e.name}
                      entry={e}
                      rank={rankOf(e)}
                      tab={tab}
                      tied={isTied(e)}
                    />
                  ))}
                </PodiumStrip>
              </div>
              {/* Phones: gold, then silver, then bronze, stacked down the page.
                  Swiping sideways through three unrelated ranks hid two of them;
                  now the only sideways scroll is within a rank several players
                  are tied on. */}
              <div className="sm:hidden space-y-4 pt-2">
                {podiumRanks.map(([rank, group]) => (
                  <div key={rank}>
                    <p className="mb-1 px-1 text-[8px] font-black uppercase tracking-[0.3em] text-white/25">
                      {MEDAL_LABEL[rank - 1] ?? `Rank ${rank}`}
                      {group.length > 1 && ` · ${group.length} tied`}
                    </p>
                    {group.length === 1 ? (
                      // Matches PodiumStrip's own pt-5, so a solo rank and a
                      // tied one sit at the same height under their label.
                      <div className="pt-5">
                        <PodiumCard
                          entry={group[0]}
                          rank={rank}
                          tab={tab}
                          tied={isTied(group[0])}
                          fill
                        />
                      </div>
                    ) : (
                      <PodiumStrip count={group.length}>
                        {group.map((e) => (
                          <PodiumCard
                            key={e.name}
                            entry={e}
                            rank={rank}
                            tab={tab}
                            tied={isTied(e)}
                          />
                        ))}
                      </PodiumStrip>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Rank 3 sits on the phone podium but can be in the wide layout's
              list, so each layout gets the pack its own podium left behind. */}
          {[
            { rows: restWide, only: "hidden sm:block" },
            { rows: rest, only: "sm:hidden" },
          ].map(({ rows, only }) =>
            rows.length === 0 ? null : (
              <div
                key={only}
                className={`${only} ${podium.length > 0 ? "mt-6" : ""}`}
              >
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 px-2 mb-1">
                  {podium.length > 0
                    ? "Chasing pack"
                    : narrowed
                      ? `${all.length} of ${sorted.length} players · ranks are off the full board`
                      : `Players ${start + 1}–${start + rows.length}`}
                </p>
                {rows.map((e) => (
                  <LeaderRow
                    key={e.name}
                    entry={e}
                    rank={rankOf(e)}
                    tab={tab}
                    tied={isTied(e)}
                  />
                ))}
              </div>
            ),
          )}
          {tab === "mvp" && (
            <p className="text-[9px] text-white/25 uppercase tracking-widest mt-5 px-2">
              MVP points · 10 runs = 1 pt · wickets priced by the batter taken ·
              fielding counted
            </p>
          )}
          {tab === "fielding" && <FieldingBreakdown rows={set.fielding} />}
          <Pagination
            total={all.length}
            page={current}
            pageSize={pageSize}
            pageCount={pageCount}
            onPageSize={(n) => reset(setPageSize)(n)}
            onPage={setPage}
          />
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
  className = "w-7 h-7 shrink-0 rounded-full overflow-hidden",
  photo = true,
}: {
  name: string;
  teamId: string | null;
  /** next/image width hint — raise it wherever the face is rendered large. */
  size?: number;
  className?: string;
  /**
   * Set false when the name is known NOT to belong to any `players` row. The
   * lookup falls back to a lone first name, so a non-member called "Madhav"
   * would otherwise wear Madhav Sharma's face.
   */
  photo?: boolean;
}) {
  const photos = useContext(PlayerPhotoContext);
  return (
    <PlayerAvatar
      src={photo ? photoFor(photos, name) : null}
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
  /** `${innings_no}-${row}` of the batter whose dismissal is opened out, if any.
      Only one at a time — the point is to read one long line, not to unfold the
      whole card. */
  const [openDismissal, setOpenDismissal] = useState<string | null>(null);
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
                    {batted.map((b, bi) => {
                      const rowKey = `${inn.innings_no}-${bi}`;
                      const open = openDismissal === rowKey;
                      return (
                        <tr
                          key={bi}
                          className="border-b border-white/[0.03] last:border-0 align-top"
                        >
                          <td className="py-2 pr-2">
                            <div className="flex w-full min-w-0 items-start gap-2">
                              <button
                                type="button"
                                onClick={() => onPlayerClick(b.player_name)}
                                className="shrink-0"
                                aria-label={`${b.player_name} career stats`}
                              >
                                <ScorecardFace
                                  name={b.player_name}
                                  teamId={inn.batting_team_id}
                                />
                              </button>
                              {/* Tapping the name opens the profile; tapping the
                                dismissal opens the row out so the full names
                                can wrap instead of being cut off. */}
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => onPlayerClick(b.player_name)}
                                  className={`block w-full text-left font-black text-white/85 ${
                                    open ? "break-words" : "truncate"
                                  }`}
                                >
                                  {withCaptain(
                                    b.player_name,
                                    inn.batting_team_id,
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenDismissal(open ? null : rowKey)
                                  }
                                  aria-expanded={open}
                                  className={`block w-full text-left text-[11px] text-white/35 ${
                                    open
                                      ? "break-words text-white/55"
                                      : "truncate"
                                  }`}
                                >
                                  {dismissalText(b)}
                                </button>
                              </div>
                            </div>
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
                      );
                    })}
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
                            className="flex w-full min-w-0 items-center gap-2 text-left"
                          >
                            <ScorecardFace
                              name={bw.player_name}
                              teamId={inn.bowling_team_id}
                            />
                            <span className="min-w-0 truncate font-black text-white/85">
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

/** The badge an unbooked slot or ground wears, so both read the same way. */
function TbcTag() {
  return (
    <span className="shrink-0 rounded border border-white/15 px-1.5 py-px text-[9px] font-black uppercase tracking-widest text-white/45">
      TBC
    </span>
  );
}

function MatchRow({
  m,
  weekVenue,
  weekStart,
}: {
  m: FullSeriesMatch;
  weekVenue: string | null;
  /** The week's first-match slot, 24h "HH:MM", or null while unscheduled. */
  weekStart: string | null;
}) {
  const decided = !!m.winner_id || m.is_tie;
  const venue = resolveVenue(m.venue, weekVenue);
  const winner = m.winner_id ? TEAMS[m.winner_id]?.name : null;
  const time = resolveMatchTime(weekStart, m.match_no);
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
                    m.margin_value
                      ? ` by ${m.margin_value} ${m.margin_type}`
                      : ""
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
        {/* Neither the slot nor the ground is guessed at: an unbooked week says
            so, in the same place a booked one would have said when and where. */}
        <span
          className={`flex items-center gap-1.5 text-xs ${
            time ? "font-black text-white" : "font-bold text-white/45"
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 text-jcc-accent/70" />
          {time ?? <TbcTag />}
        </span>
        <span
          className={`flex items-center gap-1.5 text-xs font-bold min-w-0 ${
            venue.name ? "text-white/75" : "text-white/45"
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0 text-jcc-accent/70" />
          {venue.name ? (
            <span className="truncate">{venue.name}</span>
          ) : (
            <TbcTag />
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
  const visible = [...current.matches].sort((a, b) => a.match_no - b.match_no);

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
              className={currentVenue.name ? "text-white/40" : "text-white/25"}
            >
              {currentVenue.name ?? "Venue TBC"}
            </span>
          </span>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {visible.length > 0 ? (
            visible.map((m) => (
              <MatchRow
                key={m.id}
                m={m}
                weekVenue={current.venue}
                weekStart={current.start_time}
              />
            ))
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
              No matches scheduled this week
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
                        <MatchRow
                          key={m.id}
                          m={m}
                          weekVenue={w.venue}
                          weekStart={w.start_time}
                        />
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
    <PlayerCareerCardProvider
      clubRoster={clubRoster}
      careerLeaderboards={careerLeaderboards}
    >
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
                <SeasonHeader
                  season={liveActiveSeason}
                  players={playersPool}
                  leaders={seasonLeaderboards}
                />
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
                    seasonLabel={
                      liveActiveSeason?.season_label ?? "This Season"
                    }
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
                      hasDetail={fullSeries.some(
                        (s) => s.season_id === season.id,
                      )}
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
                Pick your side. Join the weekly ritual. Add your name to the
                season story.
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
