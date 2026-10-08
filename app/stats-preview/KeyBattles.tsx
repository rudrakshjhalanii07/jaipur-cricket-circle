"use client";

import { useMemo, useRef, useState } from "react";
import { BATTLE_MIN_MEETINGS, fmtDate, keyBattles, type Battle, type CardData } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar, Portrait, usePhoto } from "./Avatar";
import { gsap, reduceMotion, useGSAP, whenSeen } from "./motion";
import Jaali from "@/components/Jaali";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const color = (team: string) => teamByName(team)?.primary ?? "#A97824";
/** The batter's side of the rope. Gold is the bowler's colour here, so a gold club (Mavericks) falls back to navy. */
const ropeColor = (team: string) => {
  const c = color(team).replace("#", "");
  const [r, g, bl] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const goldish = r > 180 && g > 130 && bl < 110;
  return goldish ? "#3B4E72" : color(team);
};
const first = (n: string) => n.split(" ")[0];

/**
 * The story of a rivalry, from the dismissals alone. "Strike" = the bowler got
 * him that innings; "survives" = he wasn't out to that bowler (he may have
 * fallen to someone else, or batted through).
 */
export function battleStory(b: Battle, names: string[]) {
  const bat = first(names[b.batter]);
  const bowl = first(names[b.bowler]);
  const last = b.meetings[b.meetings.length - 1];
  let streak = 0;
  for (let i = b.meetings.length - 1; i >= 0 && b.meetings[i].out === last.out; i--) streak++;
  const who = last.out ? bowl : bat;
  const headline =
    streak >= 2
      ? last.out
        ? `${bowl} has struck in the last ${streak}`
        : `${bat} has survived the last ${streak}`
      : `${who} has the last word`;
  const opener = b.meetings[0].out ? `${bowl} drew first blood` : `${bat} came through the first`;
  /** −1 (all batter) … +1 (all bowler). */
  const balance = (b.bowlerWins - b.batterWins) / b.meetings.length;
  const best = [...b.meetings].filter((m) => !m.out).sort((x, y) => y.runs - x.runs)[0];
  return { headline, opener, balance, bat, bowl, best, since: fmtDate(b.meetings[0].date) };
}

/**
 * The rope, built from the meetings: one segment for every innings he survived
 * the bowler (batter's colour, left) and one for every time the bowler struck
 * (gold, right). The knot sits exactly where the two sides meet.
 */
export function TugOfWar({ b, names, dark, compact }: { b: Battle; names: string[]; dark?: boolean; compact?: boolean }) {
  const { bat, bowl } = battleStory(b, names);
  const n = b.meetings.length;
  const pos = (100 * b.batterWins) / n;
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <span className="w-4 text-right font-heading text-lg font-bold tabular-nums text-white">{b.batterWins}</span>
        <div className="relative h-5 flex-1">
          <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-[3px]">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="h-full flex-1 -skew-x-[20deg]" style={{ background: i < b.batterWins ? ropeColor(b.batTeam) : "#D4AF37" }} />
            ))}
          </div>
          <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-jcc-navy shadow-[0_0_0_2px_#12233F]" style={{ left: `${pos}%` }} />
        </div>
        <span className="w-4 font-heading text-lg font-bold tabular-nums text-jcc-accent-dark">{b.bowlerWins}</span>
      </div>
    );
  }
  return (
    <div>
      <div className={`flex justify-between font-heading text-[12px] font-semibold italic tracking-tight ${dark ? "text-[#FCFBF8]/85" : "text-jcc-text-muted"}`}>
        <span>{bat} survived him · {b.batterWins}</span>
        <span>{bowl} struck · {b.bowlerWins}</span>
      </div>
      <div className="relative mt-3 h-7">
        <div className="absolute inset-x-0 top-1/2 flex h-2.5 -translate-y-1/2 gap-[3px]">
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className="h-full flex-1 -skew-x-[20deg]"
              style={{ background: i < b.batterWins ? ropeColor(b.batTeam) : "#D4AF37" }}
            />
          ))}
        </div>
        <span
          data-knot
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#FCFBF8] shadow-[0_0_0_3px_rgba(13,23,40,0.9),0_0_18px_rgba(212,175,55,0.7)] transition-[left] duration-1000 ease-out"
          style={{ left: `${pos}%` }}
        />
      </div>
    </div>
  );
}

/** Each meeting as a slanted, dated beat of the story. */
function Chronicle({ b, names }: { b: Battle; names: string[] }) {
  const { bat, bowl } = battleStory(b, names);
  return (
    <ol className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto overscroll-x-contain px-6 pb-1">
      {b.meetings.map((m, i) => (
        <li key={i} data-beat className={`shrink-0 -skew-x-12 px-4 py-2 ${m.out ? "bg-jcc-accent text-jcc-seam" : "bg-[#FCFBF8]/10 text-[#FCFBF8] ring-1 ring-[#FCFBF8]/15"}`}>
          <div className="skew-x-12">
            <div className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${m.out ? "text-jcc-seam/70" : "text-[#FCFBF8]/60"}`}>{fmtDate(m.date)}</div>
            <div className="whitespace-nowrap font-heading text-[13px] font-semibold italic tracking-tight">
              {m.out ? `${bowl} strikes` : `${bat} survives`}
              <span className="ml-1.5 font-mono text-[10.5px] font-normal not-italic opacity-75">
                {m.runs}
                {m.notOut ? "*" : ""} ({m.balls})
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Halves charge in, the VS stamps down, the rope settles — once, on arrival. */
function useClash() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduceMotion()) return;
      const q = gsap.utils.selector(el);
      gsap.set(q("[data-slam=left]"), { xPercent: -30, autoAlpha: 0 });
      gsap.set(q("[data-slam=right]"), { xPercent: 30, autoAlpha: 0 });
      gsap.set(q("[data-vs]"), { scale: 3, rotate: -18, autoAlpha: 0 });
      gsap.set(q("[data-blade]"), { scaleY: 0 });
      gsap.set(q("[data-beat]"), { autoAlpha: 0, x: -20 });
      return whenSeen(el, () => {
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .to(q("[data-slam]"), { xPercent: 0, autoAlpha: 1, duration: 0.7, ease: "power4.out" })
          .to(q("[data-blade]"), { scaleY: 1, duration: 0.35, ease: "power3.in" }, 0.35)
          .to(q("[data-vs]"), { scale: 1, rotate: -8, autoAlpha: 1, duration: 0.55, ease: "back.out(3)" }, 0.5)
          .fromTo(el, { x: 0 }, { x: 4, duration: 0.05, repeat: 3, yoyo: true, ease: "none" }, 0.62)
          .to(q("[data-beat]"), { autoAlpha: 1, x: 0, stagger: 0.05, duration: 0.5 }, 0.8)
          .from(q("[data-knot]"), { scale: 0, duration: 0.6, ease: "back.out(4)" }, 0.9);
      }, 0.8);
    },
    { scope: ref },
  );
  return ref;
}

/** The featured rivalry: a diagonal face-off. */
function FaceOff({ b, names, onOpenPlayer }: { b: Battle; names: string[]; onOpenPlayer: (p: number) => void }) {
  const story = battleStory(b, names);
  const ref = useClash();
  const batPhoto = Boolean(usePhoto(names[b.batter]));
  const bowlPhoto = Boolean(usePhoto(names[b.bowler]));
  const sides = [
    { p: b.batter, team: b.batTeam, role: "With the bat", side: "left" as const, clip: "polygon(0 0, 60% 0, 44% 100%, 0 100%)" },
    { p: b.bowler, team: b.bowlTeam, role: "With the ball", side: "right" as const, clip: "polygon(60% 0, 100% 0, 100% 100%, 44% 100%)" },
  ];
  return (
    <div ref={ref} data-reveal className="theme-static-dark relative overflow-hidden rounded-[2rem] bg-jcc-blue-deep">
      <Jaali />
      <div className="relative h-[380px] md:h-[440px]">
        {sides.map((x) => (
          <div key={x.p} data-slam={x.side} className="absolute inset-0" style={{ clipPath: x.clip }}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(${x.side === "left" ? "110deg" : "250deg"}, color-mix(in srgb, ${color(x.team)} 60%, #0D1728) 0%, #0D1728 75%)` }} />
            <div className={`absolute inset-y-0 w-[56%] ${x.side === "left" ? "left-0" : "right-0"}`}>
              <Portrait name={names[x.p]} className={`absolute inset-0 ${x.side === "left" ? "-scale-x-100" : ""}`} />
            </div>
          </div>
        ))}
        {/* the blade along the cut */}
        <span
          data-blade
          aria-hidden
          className="absolute left-[52%] top-[-10%] h-[120%] w-[5px] origin-top -translate-x-1/2 bg-gradient-to-b from-jcc-accent-highlight via-jcc-accent to-jcc-accent-dark shadow-[0_0_24px_rgba(212,175,55,0.8)]"
          style={{ transform: "translateX(-50%) rotate(10.3deg)" }}
        />
        {sides.map((x) => (
          <button
            key={`n-${x.p}`}
            data-slam={x.side}
            onClick={() => onOpenPlayer(x.p)}
            className={`group absolute bottom-0 flex max-w-[48%] flex-col p-6 md:p-10 ${x.side === "left" ? "left-0 items-start text-left" : "right-0 items-end text-right"}`}
          >
            {!(x.p === b.batter ? batPhoto : bowlPhoto) && <Avatar name={names[x.p]} size={88} ring={color(x.team)} className="mb-5" />}
            <span className="-skew-x-12 bg-jcc-accent px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-jcc-seam">{x.role}</span>
            <span className="mt-2 font-heading text-4xl font-bold italic leading-[0.92] tracking-[-0.035em] text-[#FCFBF8] [text-shadow:0_4px_24px_rgba(0,0,0,0.55)] group-hover:text-jcc-accent-highlight md:text-[3.4rem]">
              {names[x.p]}
            </span>
            <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">{x.team}</span>
          </button>
        ))}
        <span
          data-vs
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 font-heading text-[6rem] font-bold italic leading-none tracking-[-0.06em] md:text-[8.5rem]"
          style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.7))", transform: "translate(-50%,-50%) rotate(-8deg)" }}
        >
          VS
        </span>
      </div>

      <div className="relative border-t-2 border-jcc-accent bg-jcc-blue-deep/95 px-6 pb-7 pt-6 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-heading text-2xl font-bold italic tracking-[-0.025em] text-[#FCFBF8] md:text-3xl">{story.headline}</h3>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">
            {b.meetings.length} meetings since {story.since} · {story.opener}
          </span>
        </div>
        <div className="mt-6">
          <TugOfWar b={b} names={names} dark />
        </div>
        <div className="mt-6">
          <Chronicle b={b} names={names} />
        </div>
      </div>
    </div>
  );
}

/** A smaller rivalry card: navy, two team colours slashing in from the sides. */
function RivalryCard({ b, names, onOpenPlayer }: { b: Battle; names: string[]; onOpenPlayer: (p: number) => void }) {
  const story = battleStory(b, names);
  const ref = useClash();
  return (
    <div ref={ref} data-reveal className="theme-static-dark relative overflow-hidden rounded-3xl bg-jcc-blue-deep ring-1 ring-[#FCFBF8]/10">
      <div data-slam="left" aria-hidden className="pointer-events-none absolute inset-0" style={{ clipPath: "polygon(0 0, 52% 0, 40% 100%, 0 100%)", background: `linear-gradient(110deg, color-mix(in srgb, ${color(b.batTeam)} 48%, #0D1728), #0D1728 80%)` }} />
      <div data-slam="right" aria-hidden className="pointer-events-none absolute inset-0" style={{ clipPath: "polygon(52% 0, 100% 0, 100% 100%, 40% 100%)", background: `linear-gradient(250deg, color-mix(in srgb, ${color(b.bowlTeam)} 48%, #0D1728), #0D1728 80%)` }} />
      <span data-blade aria-hidden className="absolute left-1/2 top-[-6%] h-[34%] w-[3px] origin-top bg-gradient-to-b from-jcc-accent-highlight to-jcc-accent-dark shadow-[0_0_16px_rgba(212,175,55,0.7)]" style={{ transform: "translateX(-50%) rotate(12deg)" }} />
      <div className="relative p-6">
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <button data-slam="left" onClick={() => onOpenPlayer(b.batter)} className="col-start-1 row-start-1 group flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Avatar name={names[b.batter]} size={52} ring={color(b.batTeam)} className="transition-transform duration-300 group-hover:scale-110" />
            <span className="min-w-0 max-w-full text-left">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight">Bat</span>
              <span className="block truncate pr-1 font-heading text-lg font-bold italic leading-tight text-[#FCFBF8] group-hover:text-jcc-accent-highlight">{names[b.batter]}</span>
            </span>
          </button>
          <span
            data-vs
            aria-hidden
            className="pointer-events-none col-start-2 row-start-1 px-1 font-heading text-3xl font-bold italic leading-none"
            style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.7))", transform: "rotate(-8deg)" }}
          >
            VS
          </span>
          <button data-slam="right" onClick={() => onOpenPlayer(b.bowler)} className="col-start-3 row-start-1 group flex min-w-0 flex-col items-end gap-2 sm:flex-row-reverse sm:items-center sm:gap-3">
            <Avatar name={names[b.bowler]} size={52} ring={color(b.bowlTeam)} className="transition-transform duration-300 group-hover:scale-110" />
            <span className="min-w-0 max-w-full text-right">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight">Ball</span>
              <span className="block truncate pr-1 font-heading text-lg font-bold italic leading-tight text-[#FCFBF8] group-hover:text-jcc-accent-highlight">{names[b.bowler]}</span>
            </span>
          </button>
        </div>
        <p className="mt-6 font-heading text-xl font-bold italic leading-tight tracking-tight text-[#FCFBF8]">{story.headline}</p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#FCFBF8]/70">
          {b.meetings.length} meetings since {story.since} · {story.opener}
        </p>
        <div className="mt-5">
          <TugOfWar b={b} names={names} dark />
        </div>
        <div className="mt-5">
          <Chronicle b={b} names={names} />
        </div>
      </div>
    </div>
  );
}

/** Compact strip for the player deck: the meetings as dots. */
export function MeetingStrip({ b, size = 14 }: { b: Battle; size?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`${b.bowlerWins} dismissals in ${b.meetings.length} meetings`}>
      {b.meetings.map((m, i) => (
        <span
          key={i}
          title={`${fmtDate(m.date)} · ${m.out ? "out to him" : "survived him"} · ${m.runs}${m.notOut ? "*" : ""} (${m.balls})`}
          className={`grid place-items-center rounded-full font-mono text-[8.5px] font-bold ${m.out ? "bg-jcc-accent text-jcc-seam" : "bg-jcc-blue text-[#FCFBF8]"}`}
          style={{ width: size, height: size }}
        >
          {size >= 18 ? (m.out ? "W" : m.runs) : ""}
        </span>
      ))}
    </div>
  );
}

export default function KeyBattles({ data, seasons, onOpenPlayer }: { data: CardData; seasons: number[]; onOpenPlayer: (p: number) => void }) {
  const battles = useMemo(() => keyBattles(data, seasons), [data, seasons]);
  const [showAll, setShowAll] = useState(false);
  const names = data.players;
  const [lead, ...others] = battles;
  const cards = others.slice(0, 4);
  const rest = others.slice(4);

  if (!lead) return <p className="text-sm text-jcc-text-muted">No hot battles between headline players in this view yet.</p>;

  return (
    <div>
      <FaceOff b={lead} names={names} onOpenPlayer={onOpenPlayer} />

      {cards.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {cards.map((b) => (
            <RivalryCard key={`${b.batter}-${b.bowler}`} b={b} names={names} onOpenPlayer={onOpenPlayer} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-12">
          <div className="border-b border-jcc-blue/80 pb-2">
            <span className={LABEL}>More battles · {battles.length} in all</span>
          </div>
          <ol className="grid gap-x-12 lg:grid-cols-2">
            {(showAll ? rest : rest.slice(0, 6)).map((b) => {
              const story = battleStory(b, names);
              return (
                <li key={`${b.batter}-${b.bowler}`} data-row className="border-b border-jcc-border py-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,200px)_minmax(0,1fr)] items-center gap-4">
                    <button onClick={() => onOpenPlayer(b.batter)} className="group flex min-w-0 items-center gap-2.5 text-left">
                      <Avatar name={names[b.batter]} size={40} ring={color(b.batTeam)} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-semibold tracking-tight text-white group-hover:underline">{names[b.batter]}</span>
                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-jcc-text-muted">Bat</span>
                      </span>
                    </button>
                    <TugOfWar b={b} names={names} compact />
                    <button onClick={() => onOpenPlayer(b.bowler)} className="group flex min-w-0 flex-row-reverse items-center gap-2.5 text-right">
                      <Avatar name={names[b.bowler]} size={40} ring={color(b.bowlTeam)} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-semibold tracking-tight text-white group-hover:underline">{names[b.bowler]}</span>
                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-jcc-text-muted">Ball</span>
                      </span>
                    </button>
                  </div>
                  <p className="mt-3 text-center text-[13px] text-jcc-text-muted">
                    <span className="font-heading font-semibold italic text-white">{story.headline}</span> · {b.meetings.length} meetings since {story.since}
                  </p>
                </li>
              );
            })}
          </ol>
          {rest.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-white underline-offset-4 hover:underline">
              {showAll ? "Show fewer" : `Show all ${rest.length}`}
            </button>
          )}
        </div>
      )}

      <p className="mt-10 max-w-3xl font-mono text-[11px] leading-relaxed text-jcc-text-muted">
        A meeting is an innings where one bowled and the other batted. &ldquo;Strikes&rdquo; means the bowler got him that innings; &ldquo;survives&rdquo; means he wasn&apos;t out to that bowler &mdash; he may have batted through or fallen to someone else. Scores in the chronicle are his whole innings; the scorecards don&apos;t say which balls came from which bowler. Battles shown: top-15 run-scorers against top-15 wicket-takers, met {BATTLE_MIN_MEETINGS}+ times, the bowler striking in 30&ndash;70% of them.
      </p>
    </div>
  );
}
