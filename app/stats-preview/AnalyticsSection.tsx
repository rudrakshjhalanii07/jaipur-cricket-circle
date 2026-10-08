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

const TABS = [
  ["boards", "Leaderboards"],
  ["xi", "JCC All-Time XI"],
  ["mom", "Player of the Match"],
  ["kings", "Death overs & dots"],
  ["teams", "Team DNA"],
  ["labels", "Achievements"],
  ["attendance", "Attendance"],
  ["chances", "Fewer chances"],
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
function ChancesTab({ rows, names, onOpenPlayer }: { rows: ChanceRow[]; names: string[]; onOpenPlayer: (p: number, card?: string) => void }) {
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
  const mSrShown = useMemo(() => {
    const v = rows.filter((c) => c.matches >= 3 && c.balls >= 15 && c.sr != null).map((c) => c.sr!).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }, [rows]);

  return (
    <div data-apanel>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-jcc-blue/80 pt-5">
        <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">Deserve more chances</h3>
        <span className={LABEL}>Efficient when used, used less than teammates · min 3 matches</span>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 text-sm text-jcc-text-muted">Nobody stands out as underused in this season.</p>
      ) : (
        <div className="mt-8 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {top.map(({ c, share }) => (
            <button key={c.p} data-arow onClick={() => onOpenPlayer(c.p, "chances")} className="group text-left">
              <div className="flex items-center gap-4">
                <Avatar name={names[c.p]} size={60} ring={teamByName(c.team)?.primary ?? "#A97824"} className="transition-transform duration-500 group-hover:scale-105" />
                <div className="min-w-0">
                  <p className={LABEL}>The case for</p>
                  <div className="truncate font-heading text-2xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[c.p]}</div>
                </div>
              </div>
              {c.sr != null && c.balls >= 15 && (
                <div className="mt-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-heading text-4xl font-bold tracking-[-0.04em] tabular-nums text-white">{f0(c.sr)}</span>
                    <span className={LABEL}>strike rate</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-14 font-mono text-[10px] uppercase text-jcc-text-muted">Him</span>
                      <span className="h-1.5 flex-1 rounded-full bg-jcc-navy-light"><span className="block h-full rounded-full bg-jcc-accent" style={{ width: `${share * 100}%` }} /></span>
                      <span className="w-10 text-right font-mono text-[11px] tabular-nums text-white">{f1(c.ballsPerMatch)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-14 font-mono text-[10px] uppercase text-jcc-text-muted">Team</span>
                      <span className="h-1.5 flex-1 rounded-full bg-jcc-navy-light"><span className="block h-full rounded-full bg-jcc-blue" style={{ width: "100%" }} /></span>
                      <span className="w-10 text-right font-mono text-[11px] tabular-nums text-white">{f1(c.teamBallsPerMatch)}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[12.5px] text-jcc-text-muted">balls faced a match</p>
                </div>
              )}
              {c.econ != null && c.bowlBalls >= 12 && (
                <div className="mt-6 flex items-center gap-5">
                  <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-jcc-navy-light)" strokeWidth="5" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#D4AF37" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * 18 * c.bowlShare) / 100} 200`} />
                  </svg>
                  <div>
                    <div className="font-heading text-4xl font-bold tracking-[-0.04em] tabular-nums text-white">{f2(c.econ)}</div>
                    <p className="text-[12.5px] text-jcc-text-muted">economy, bowls in {f0(c.bowlShare)}% of matches</p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-16">
          <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-2">
            <span className={LABEL}>Next in line · Nos. 4–{ranked.length}</span>
            <span className={LABEL}>Why</span>
          </div>
          <ol>
            {rest.map(({ c, share, bat, bowl }, i) => (
              <li key={c.p} data-arow>
                <button onClick={() => onOpenPlayer(c.p, "chances")} className="group relative grid w-full grid-cols-[32px_auto_minmax(0,1fr)] items-center gap-4 border-b border-jcc-border py-4 text-left md:grid-cols-[32px_auto_minmax(0,220px)_minmax(0,1fr)]">
                  <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-1 rounded-xl bg-jcc-navy opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative font-mono text-[11px] text-jcc-text-muted">{String(i + 4).padStart(2, "0")}</span>
                  <Avatar name={names[c.p]} size={40} ring={teamByName(c.team)?.primary ?? "#A97824"} className="relative" />
                  <span className="relative min-w-0">
                    <span className="block truncate font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-0.5">{names[c.p]}</span>
                    <span className="block font-mono text-[10.5px] text-jcc-text-muted">{c.team} · {c.matches} matches</span>
                  </span>
                  <span className="relative col-span-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-jcc-text-muted md:col-span-1 md:justify-end">
                    {bat > 0 && (
                      <span>
                        <b className="font-heading text-base text-white">SR {f0(c.sr)}</b> · faces {f1(c.ballsPerMatch)} balls a match, team {f1(c.teamBallsPerMatch)} ({f0(share * 100)}%)
                      </span>
                    )}
                    {bowl > 0 && (
                      <span>
                        <b className="font-heading text-base text-white">Econ {f2(c.econ)}</b> · bowls in {f0(c.bowlShare)}% of matches
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl font-mono text-[11px] leading-relaxed text-jcc-text-muted">
            Top 15. A batter qualifies with a strike rate above the league median ({f0(mSrShown)}) while facing under 80% of his team&apos;s balls a match; a bowler with an economy below the median while bowling in under 70% of matches. Ranked by how far above the median, times how far short of a full share.
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
}: {
  data: CardData;
  seasons: number[];
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

      {tab === "mom" && <MoMSection data={data} onOpenPlayer={onOpenPlayer} onOpenMatch={onOpenMatch} />}

      {tab === "labels" && (
        <AchievementsTab rows={L.badges} names={names} players={L.summary.players} onOpenPlayer={onOpenPlayer} />
      )}

      {tab === "attendance" && (
        <div data-apanel>
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
            A matchday is one date on the calendar, usually 3–4 matches; there have been {L.summary.matchdays} in this view. Team matches counts the matches his own side played. A match counts when the player batted, bowled or was named in a dismissal; CricHeroes doesn&apos;t list anyone who did none of those.
          </p>
        </div>
      )}

      {tab === "chances" && <ChancesTab rows={L.chances} names={names} onOpenPlayer={onOpenPlayer} />}
      </div>
    </div>
  );
}
