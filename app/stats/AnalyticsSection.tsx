"use client";

import { useMemo, useRef, useState } from "react";
import {
  f0,
  f1,
  f2,
  leaderboardRows,
  leagueInsights,
  type CardData,
} from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import AchievementsTab from "./achievements";
import { gsap, reduceMotion, useGSAP, usePill } from "./motion";
import { Avatar } from "./Avatar";
import AllTimeXI from "./AllTimeXI";
import TeamDNA from "./TeamDNA";
import { useNewcomers } from "./Newcomers";
import BoardsTab from "./BoardsTab";
import KingsTab from "./KingsTab";
import MoMSection from "./MoMSection";
import CaptainsTab from "./CaptainsTab";
import { buildCaptains, captainAwards } from "./captains";
import type { CaptaincyRow } from "@/lib/scorecard-dashboard/captaincy.server";
import { GREEN, ORANGE, PURPLE, SectionShare, listCard, playerRow, statCard, usePhotoOf } from "./SectionShare";

const TABS = [
  ["boards", "Leaderboards"],
  ["xi", "JCC All-Time XI"],
  ["captains", "Captains"],
  ["mom", "Player of the Match"],
  ["kings", "Death overs & dots"],
  ["teams", "Team DNA"],
  ["labels", "Achievements"],
  ["attendance", "Attendance"],
] as const;
type TabKey = (typeof TABS)[number][0];


const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";

/** Scorebook tally: four strokes and a bar through them for every five, then a faint trail for the matchdays missed. */
function Tally({ n, of }: { n: number; of: number }) {
  const groups = Math.ceil(of / 5);
  const W = 26;
  return (
    <svg viewBox={`0 0 ${groups * W} 18`} className="h-[18px] w-full max-w-[280px]" preserveAspectRatio="xMinYMid meet" aria-label={`${n} of ${of} matchdays`}>
      {Array.from({ length: groups }, (_, g) => {
        const filled = Math.max(0, Math.min(5, n - g * 5));
        const slots = Math.min(5, of - g * 5);
        const x0 = g * W + 2;
        return (
          <g key={g}>
            {Array.from({ length: Math.min(4, slots) }, (_, k) => (
              <line key={k} x1={x0 + k * 4.5} y1={2} x2={x0 + k * 4.5 + 0.6} y2={16} stroke={k < Math.min(4, filled) ? "#12233F" : "rgba(18,35,63,0.14)"} strokeWidth="1.6" strokeLinecap="round" />
            ))}
            {slots === 5 && (
              <line x1={x0 - 2} y1={13} x2={x0 + 15.5} y2={4} stroke={filled === 5 ? "#A97824" : "rgba(18,35,63,0.14)"} strokeWidth="1.6" strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

type ChanceRow = ReturnType<typeof leagueInsights>["chances"][number];

/**
 * Who has earned more of the bat or the ball. The flagged cases (efficient
 * and clearly underused, from profile.ts) come first; everyone else with 3+
 * matches follows, ranked by the same idea measured against the league
 * median: how much better than the median they are, times how far short of
 * a full share they get.
 */
export function ChancesTab({ rows, names, onOpenPlayer }: { rows: ChanceRow[]; names: string[]; onOpenPlayer: (p: number, card?: string) => void }) {
  const ranked = useMemo(() => {
    const median = (xs: number[]) => {
      const v = [...xs].sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : 0;
    };
    const pool = rows.filter((c) => c.matches >= 3);
    const mSr = median(pool.filter((c) => c.balls >= 15 && c.sr != null).map((c) => c.sr!));
    const mEcon = median(pool.filter((c) => c.bowlBalls >= 12 && c.econ != null).map((c) => c.econ!));
    return pool
      .map((c) => {
        const share = c.teamBallsPerMatch ? Math.min(1, c.ballsPerMatch / c.teamBallsPerMatch) : 1;
        const bat = c.balls >= 15 && c.sr != null && c.sr > mSr && share < 0.8 ? (c.sr / mSr - 1) * (1 - share) : 0;
        const bowl = c.bowlBalls >= 12 && c.econ != null && c.econ < mEcon && c.bowlShare < 70 ? (mEcon / c.econ - 1) * (1 - c.bowlShare / 100) : 0;
        const flagged = c.underusedBat || c.underusedBowl;
        return { c, share, bat, bowl, score: (flagged ? 10 : 0) + Math.max(bat, bowl), flagged };
      })
      .filter((x) => x.flagged || x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [rows]);

  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const photoOf = usePhotoOf();
  const shareGems = () => [
    // All of them on one card first, then each player's case.
    listCard({
      id: "gems-all",
      label: "All hidden gems",
      kicker: "Hidden gems · deserve more chances",
      title: "The case for more chances",
      rows: ranked.slice(0, 6).map(({ c }) => {
        const useBat = c.sr != null && c.balls >= 15;
        return playerRow(names[c.p], useBat ? `SR ${f0(c.sr)}` : `Econ ${f2(c.econ)}`, useBat ? `${f1(c.ballsPerMatch)} balls a match (team ${f1(c.teamBallsPerMatch)})` : `bowls in ${f0(c.bowlShare)}% of matches`, photoOf(names[c.p]), c.team);
      }),
      hash: "gems",
    }),
    ...top.map(({ c }) => {
      const name = names[c.p];
      const bat = c.sr != null && c.balls >= 15;
      return statCard({
        id: `gem-${c.p}`,
        label: name,
        kicker: "Hidden gem · deserves more chances",
        title: `The case for ${name}`,
        value: bat ? f0(c.sr) : f2(c.econ),
        unit: bat ? "strike rate" : "economy",
        colors: bat ? ORANGE : PURPLE,
        body: bat ? `More with the bat than a fair share of it: ${f1(c.ballsPerMatch)} balls a match, where the team averages ${f1(c.teamBallsPerMatch)}.` : `Tight with the ball, yet bowls in only ${f0(c.bowlShare)}% of matches.`,
        facts: [
          bat ? { label: "Balls a match", value: f1(c.ballsPerMatch) } : { label: "Bowls in", value: `${f0(c.bowlShare)}%` },
          bat ? { label: "Team average", value: f1(c.teamBallsPerMatch) } : { label: "Overs a match", value: f1(c.oversPerMatch) },
          c.econ != null && c.bowlBalls >= 12 && bat ? { label: "Economy", value: f2(c.econ) } : { label: "Matches", value: String(c.matches) },
        ],
        name,
        photo: photoOf(name),
        team: c.team,
        hash: "gems",
      });
    }),
  ];
  const mSrShown = useMemo(() => {
    const v = rows.filter((c) => c.matches >= 3 && c.balls >= 15 && c.sr != null).map((c) => c.sr!).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }, [rows]);

  return (
    <div data-apanel>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-jcc-blue/80 pt-5">
        <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">Deserve more chances</h3>
        <span className="flex flex-wrap items-center gap-3">
          <span className={LABEL}>Efficient when used, used less than teammates · min 3 matches</span>
          {top.length > 0 && <SectionShare build={shareGems} fileBase="jcc-hidden-gems" />}
        </span>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 text-sm text-jcc-text-muted">Nobody stands out as underused in this season.</p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {top.map(({ c, share }, i) => {
            const color = teamByName(c.team)?.primary ?? "#A97824";
            const bat = c.sr != null && c.balls >= 15;
            const bowl = c.econ != null && c.bowlBalls >= 12;
            const missing = Math.max(0, c.teamBallsPerMatch - c.ballsPerMatch);
            return (
              <button
                key={c.p}
                data-arow
                onClick={() => onOpenPlayer(c.p, "chances")}
                className="group relative overflow-hidden rounded-[28px] bg-[#FFFFFF] p-6 text-left shadow-[0_24px_60px_-36px_rgba(18,35,63,0.45)] ring-1 ring-jcc-blue/10 transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_34px_70px_-34px_rgba(18,35,63,0.55)]"
              >
                {/* A gem-cut edge along the top, and a sheen on hover */}
                <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundImage: i === 0 ? "linear-gradient(90deg,#F3C96A,#D4AF37,#A97824)" : bat ? "linear-gradient(90deg,#F59E0B,#EA580C)" : "linear-gradient(90deg,#A78BFA,#7C3AED)" }} />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#FFFFFF]/70 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <Avatar name={names[c.p]} size={64} ring={color} className="transition-transform duration-500 group-hover:scale-105" />
                    <div className="min-w-0">
                      <p className={LABEL}>The case for</p>
                      <div className="truncate font-heading text-2xl font-bold tracking-[-0.03em] text-white">{names[c.p]}</div>
                      <p className="mt-0.5 font-mono text-[10.5px]" style={{ color }}>{c.team}</p>
                    </div>
                  </div>
                  {/* The gem, with its rank */}
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center">
                    <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full drop-shadow-[0_6px_10px_rgba(169,120,36,0.35)]" aria-hidden>
                      <defs>
                        <linearGradient id={`gem-${c.p}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor={i === 0 ? "#FBE7A6" : "#F4F1EA"} />
                          <stop offset="0.55" stopColor={i === 0 ? "#D4AF37" : "#D9D3C4"} />
                          <stop offset="1" stopColor={i === 0 ? "#8E6417" : "#A39A86"} />
                        </linearGradient>
                      </defs>
                      <polygon points="24,3 44,17 24,45 4,17" fill={`url(#gem-${c.p})`} />
                      <polygon points="24,3 32,17 24,45 16,17" fill="#FFFFFF" opacity="0.28" />
                      <polyline points="4,17 44,17" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1" fill="none" />
                    </svg>
                    <span className="relative mt-[-6px] font-heading text-sm font-extrabold text-[#0B1424]">{i + 1}</span>
                  </span>
                </div>

                {bat && (
                  <div className="mt-7">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-6xl font-extrabold leading-none tracking-[-0.05em] tabular-nums" style={{ backgroundImage: "linear-gradient(135deg,#F59E0B,#EA580C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                        {f0(c.sr)}
                      </span>
                      <span className={LABEL}>strike rate</span>
                    </div>
                    {/* Usage: what they get, against what the team gets, the gap hatched */}
                    <div className="mt-5">
                      <div className="relative h-3 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,rgba(234,88,12,0.18)_0_5px,transparent_5px_10px)] ring-1 ring-[#EA580C]/20">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] transition-[width] duration-700" style={{ width: `${Math.max(4, share * 100)}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-jcc-text-muted">
                        <span><b className="text-white">{f1(c.ballsPerMatch)}</b> balls a match</span>
                        <span>team <b className="text-white">{f1(c.teamBallsPerMatch)}</b></span>
                      </div>
                      {missing > 0.5 && (
                        <p className="mt-3 rounded-xl bg-[#EA580C]/[0.07] px-3 py-2 text-[12.5px] text-[#B4440A]">
                          <b>{f1(missing)} balls a match</b> they&apos;re not getting
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {bowl && (
                  <div className={`flex items-center gap-5 ${bat ? "mt-5 border-t border-jcc-blue/10 pt-5" : "mt-7"}`}>
                    <div className="relative h-20 w-20 shrink-0">
                      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden>
                        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth="5" strokeDasharray="2 2.5" />
                        <circle cx="22" cy="22" r="18" fill="none" stroke="url(#gem-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * 18 * c.bowlShare) / 100} 200`} />
                        <defs>
                          <linearGradient id="gem-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A78BFA" /><stop offset="1" stopColor="#7C3AED" /></linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold text-white">{f0(c.bowlShare)}%</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-heading text-4xl font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ backgroundImage: "linear-gradient(135deg,#A78BFA,#7C3AED)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{f2(c.econ)}</span>
                        <span className={LABEL}>economy</span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-jcc-text-muted">bowls in only {f0(c.bowlShare)}% of matches</p>
                    </div>
                  </div>
                )}

                <p className="mt-6 flex items-center justify-between border-t border-jcc-blue/10 pt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-jcc-text-muted">
                  <span>{c.matches} matches</span>
                  <span className="text-jcc-accent-dark transition-transform duration-300 group-hover:translate-x-1">Open card →</span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-16">
          <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-2">
            <span className={LABEL}>Next in line · Nos. 4–{ranked.length}</span>
            <span className={LABEL}>Bar = their share of the chances</span>
          </div>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(({ c, share, bat, bowl }, i) => {
              const color = teamByName(c.team)?.primary ?? "#A97824";
              // Lead with whichever case is stronger; the other rides along as a note.
              const lead = bat >= bowl && bat > 0 ? "bat" : "bowl";
              const pct = lead === "bat" ? share * 100 : c.bowlShare;
              return (
                <li key={c.p} data-arow>
                  <button
                    onClick={() => onOpenPlayer(c.p, "chances")}
                    className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#FFFFFF] p-5 text-left ring-1 ring-jcc-blue/10 transition-[transform,box-shadow] duration-400 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(18,35,63,0.5)]"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: lead === "bat" ? "linear-gradient(180deg,#F59E0B,#EA580C)" : "linear-gradient(180deg,#A78BFA,#7C3AED)" }} />
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono text-[11px] tabular-nums text-jcc-text-muted">{String(i + 4).padStart(2, "0")}</span>
                      <Avatar name={names[c.p]} size={44} ring={color} className="transition-transform duration-500 group-hover:scale-105" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold tracking-tight text-white">{names[c.p]}</span>
                        <span className="block font-mono text-[10.5px]" style={{ color }}>{c.team} · {c.matches} m</span>
                      </span>
                      <span className="text-right">
                        <span
                          className="block font-heading text-3xl font-extrabold leading-none tracking-[-0.04em] tabular-nums"
                          style={{ backgroundImage: lead === "bat" ? "linear-gradient(135deg,#F59E0B,#EA580C)" : "linear-gradient(135deg,#A78BFA,#7C3AED)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                        >
                          {lead === "bat" ? f0(c.sr) : f2(c.econ)}
                        </span>
                        <span className={`${LABEL} mt-1 block`}>{lead === "bat" ? "strike rate" : "economy"}</span>
                      </span>
                    </div>
                    {/* How much of a share they get */}
                    <div className="mt-5">
                      <div className="h-2 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,rgba(18,35,63,0.08)_0_4px,transparent_4px_8px)] ring-1 ring-jcc-blue/10">
                        <span
                          className="block h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: lead === "bat" ? "linear-gradient(90deg,#F59E0B,#EA580C)" : "linear-gradient(90deg,#A78BFA,#7C3AED)" }}
                        />
                      </div>
                      <p className="mt-2 text-[12px] leading-snug text-jcc-text-muted">
                        {lead === "bat"
                          ? <>Faces <b className="text-white">{f1(c.ballsPerMatch)}</b> balls a match, team <b className="text-white">{f1(c.teamBallsPerMatch)}</b></>
                          : <>Bowls in only <b className="text-white">{f0(c.bowlShare)}%</b> of matches</>}
                      </p>
                      {lead === "bat" && bowl > 0 && <p className="mt-1 font-mono text-[10.5px] text-[#7C3AED]">Also: econ {f2(c.econ)} in {f0(c.bowlShare)}% of matches</p>}
                      {lead === "bowl" && bat > 0 && <p className="mt-1 font-mono text-[10.5px] text-[#C2410C]">Also: SR {f0(c.sr)} on {f1(c.ballsPerMatch)} balls a match</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 max-w-3xl font-mono text-[11px] leading-relaxed text-jcc-text-muted">
            Top 15. A batter qualifies with a strike rate above the league median ({f0(mSrShown)}) while facing under 80% of their team&apos;s balls a match; a bowler with an economy below the median while bowling in under 70% of matches. Ranked by how far above the median, times how far short of a full share.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsSection({
  data,
  seasons,
  onOpenPlayer,
  onOpenMatch,
  captaincy = [],
}: {
  data: CardData;
  seasons: number[];
  captaincy?: CaptaincyRow[];
  onOpenPlayer: (p: number, card?: string) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>("boards");
  const { box: tabBox, pill: tabPill } = usePill(tab, "line");
  const body = useRef<HTMLDivElement>(null);
  const lastTab = useRef<TabKey | null>(null);

  const rows = useMemo(() => leaderboardRows(data, seasons), [data, seasons]);
  // Season 3 newcomers, tagged in the attendance register when Season 3 is in view.
  const { fresh } = useNewcomers(data);
  const showNew = seasons.includes(3);
  const newIds = useMemo(() => new Set(showNew ? fresh.map((n) => n.p) : []), [fresh, showNew]);
  const [registerPick, setRegister] = useState<"all" | "new">("all");
  const register = showNew ? registerPick : "all";
  const L = useMemo(() => leagueInsights(data, seasons), [data, seasons]);
  const names = data.players;
  const captainBadges = useMemo(
    () => captainAwards(buildCaptains(data, seasons, captaincy)).map((a) => ({ p: a.p, team: a.team, label: a.label, tone: a.tone, why: a.why })),
    [data, seasons, captaincy],
  );
  const photoOf = usePhotoOf();
  const shareAttendance = () => {
    const top = L.attendance.slice(0, 3);
    return [
      listCard({
        id: "register",
        label: "Attendance",
        kicker: "Attendance · turned up every time",
        title: "The ever-presents",
        rows: L.attendance.slice(0, 8).map((a) => playerRow(names[a.p], `${a.matchdays}/${a.ofMatchdays}`, `${a.present} of ${a.team}'s ${a.teamMatches} matches`, photoOf(names[a.p]), a.team)),
        hash: "analytics",
      }),
      ...top.map((a, i) =>
        statCard({
          id: `present-${a.p}`,
          label: names[a.p],
          kicker: i === 0 ? "Attendance · ever-present" : `Attendance · No. ${i + 1}`,
          title: a.matchdays === a.ofMatchdays ? `${names[a.p]} never missed a matchday` : `${names[a.p]} keeps turning up`,
          value: `${a.matchdays}/${a.ofMatchdays}`,
          unit: "matchdays",
          colors: GREEN,
          facts: [{ label: "Matches", value: String(a.present) }, { label: "Attendance", value: `${a.pct}%` }, { label: "Team", value: a.team }],
          name: names[a.p],
          photo: photoOf(names[a.p]),
          team: a.team,
          hash: "analytics",
        }),
      ),
    ];
  };

  // Tab, discipline, metric or season change: deal the new list in.
  useGSAP(
    () => {
      const prev = lastTab.current;
      lastTab.current = tab;
      if (prev === null || reduceMotion()) return;
      const q = gsap.utils.selector(body);
      if (prev !== tab) gsap.from(body.current, { autoAlpha: 0, y: 20, duration: 0.7, ease: "expo.out" });
      gsap.from(q("[data-apanel]"), { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.06, ease: "expo.out" });
      gsap.from(q("[data-arow]").slice(0, 24), { autoAlpha: 0, x: -16, duration: 0.6, stagger: 0.025, ease: "expo.out" });
    },
    { dependencies: [tab, seasons], scope: body },
  );

  return (
    <div>
      <div className="mb-12 border-b border-jcc-border">
        <div ref={tabBox} role="tablist" aria-label="Analytics" className="no-scrollbar relative flex gap-7 overflow-x-auto md:gap-9">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              data-active={tab === k}
              onClick={() => setTab(k)}
              className={`relative whitespace-nowrap pb-4 pt-1 text-[15px] font-semibold tracking-tight transition-colors duration-300 ${tab === k ? "text-white" : "text-jcc-text-muted hover:text-white"}`}
            >
              {l}
            </button>
          ))}
          <span ref={tabPill} aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-jcc-accent" style={{ opacity: 0 }} />
        </div>
      </div>

      <div ref={body}>
      {tab === "boards" && <BoardsTab rows={rows} names={names} onOpenPlayer={onOpenPlayer} seasons={seasons} />}

      {tab === "kings" && <KingsTab rows={rows} names={names} onOpenPlayer={onOpenPlayer} />}

      {tab === "teams" && <TeamDNA teams={L.teams} names={names} onOpenPlayer={onOpenPlayer} />}

      {tab === "xi" && <AllTimeXI data={data} onOpenPlayer={onOpenPlayer} />}

      {tab === "captains" && <CaptainsTab data={data} seasons={seasons} captaincy={captaincy} onOpenPlayer={onOpenPlayer} />}

      {tab === "mom" && <MoMSection data={data} onOpenPlayer={onOpenPlayer} onOpenMatch={onOpenMatch} />}

      {tab === "labels" && (
        <AchievementsTab rows={L.badges} names={names} players={L.summary.players} onOpenPlayer={onOpenPlayer} multiSeason={seasons.length > 1} captainBadges={captainBadges} />
      )}

      {tab === "attendance" && (
        <div data-apanel>
          <div className="mb-6 flex justify-end">
            <SectionShare build={shareAttendance} fileBase="jcc-attendance" />
          </div>
          {/* The ever-present: top three */}
          <div className="grid border-y border-jcc-blue/80 sm:grid-cols-3">
            {L.attendance.slice(0, 3).map((a, i) => (
              <button
                key={a.p}
                data-arow
                onClick={() => onOpenPlayer(a.p, "chances")}
                className={`group flex items-center gap-5 py-8 text-left sm:flex-col sm:items-start ${i ? "border-t border-jcc-border sm:border-l sm:border-t-0 sm:pl-8" : "sm:pr-8"}`}
              >
                <Avatar name={names[a.p]} size={i === 0 ? 84 : 68} ring={i === 0 ? "#D4AF37" : teamByName(a.team)?.primary ?? "#A97824"} className="transition-transform duration-500 group-hover:scale-105" />
                <div>
                  <p className={LABEL}>{i === 0 ? "Ever-present" : `No. ${i + 1}`}</p>
                  <div className="mt-1 font-heading text-2xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[a.p]}</div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">{a.matchdays}</span>
                    <span className="font-heading text-2xl font-bold text-jcc-text-muted">/{a.ofMatchdays}</span>
                    <span className="ml-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-jcc-text-muted">matchdays</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* The register */}
          <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
            <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">The register</h3>
            <div className="flex flex-wrap items-center gap-4">
              {showNew && (
                <div className="inline-flex rounded-full bg-jcc-navy p-1 shadow-[0_10px_30px_-20px_rgba(18,35,63,0.5)]">
                  {(["all", "new"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setRegister(k)}
                      aria-pressed={register === k}
                      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold tracking-tight transition-colors duration-300 ${register === k ? "bg-jcc-blue text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
                    >
                      {k === "all" ? "Everyone" : `Newcomers · ${L.attendance.filter((a) => newIds.has(a.p)).length}`}
                    </button>
                  ))}
                </div>
              )}
              <span className={LABEL}>One stroke per matchday, tallied in fives</span>
            </div>
          </div>
          <div className="mt-6 hidden grid-cols-[44px_minmax(0,1fr)_minmax(0,1.2fr)_96px_88px] gap-4 border-b border-jcc-blue/80 pb-3 md:grid">
            {["", "Player", "Matchdays", "Team matches", "Present"].map((h, i) => (
              <span key={h || i} className={`${LABEL} ${i >= 3 ? "text-right" : ""}`}>{h}</span>
            ))}
          </div>
          <ol>
            {L.attendance.filter((a) => register === "all" || newIds.has(a.p)).map((a, i) => (
              <li key={a.p} data-arow>
                <button
                  onClick={() => onOpenPlayer(a.p, "chances")}
                  className="group relative grid w-full grid-cols-[44px_minmax(0,1fr)_88px] items-center gap-4 border-b border-jcc-border py-3.5 text-left md:grid-cols-[44px_minmax(0,1fr)_minmax(0,1.2fr)_96px_88px]"
                >
                  <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-0.5 rounded-xl bg-jcc-navy opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative font-mono text-xs text-jcc-text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="relative flex min-w-0 items-center gap-3">
                    <Avatar name={names[a.p]} size={36} ring={teamByName(a.team)?.primary ?? "#A97824"} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold tracking-tight text-white">{names[a.p]}</span>
                        {newIds.has(a.p) && (
                          <span className="shrink-0 rounded-full bg-jcc-accent/20 px-2 py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-jcc-accent-dark">New in S3</span>
                        )}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-jcc-text-muted">
                        {a.team}
                        {a.guest > 0 && ` · +${a.guest} as guest for ${a.guestTeams.join(", ")}`}
                      </span>
                    </span>
                  </span>
                  <span className="relative col-span-3 row-start-2 md:col-span-1 md:row-start-auto">
                    <Tally n={a.matchdays} of={a.ofMatchdays} />
                  </span>
                  <span className="relative hidden text-right font-mono text-sm tabular-nums text-jcc-text-muted md:block">
                    <b className="font-semibold text-white">{a.present}</b>/{a.teamMatches}
                  </span>
                  <span className="relative text-right font-heading text-2xl font-bold tabular-nums tracking-tight text-white">
                    {a.matchdays}
                    <span className="text-base text-jcc-text-muted">/{a.ofMatchdays}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl font-mono text-[11px] leading-relaxed text-jcc-text-muted">
            A matchday is one date on the calendar, usually 3–4 matches; there have been {L.summary.matchdays} in this view. Team matches counts the matches their own side played. A match counts when the player batted, bowled or was named in a dismissal; CricHeroes doesn&apos;t list anyone who did none of those.
          </p>
        </div>
      )}

      </div>
    </div>
  );
}
