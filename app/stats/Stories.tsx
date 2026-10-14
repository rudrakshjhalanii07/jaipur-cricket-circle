"use client";

// 01 · Stories — the numbers worth telling someone about, each one a card with
// its own share link (/stats#story-<id>), led by the season's scoring trend.
// Stories come from lib/scorecard-dashboard/stories.ts, the same engine the
// home page uses, so the two can never disagree.

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Share2 } from "lucide-react";
import type { CardData } from "@/lib/scorecard-dashboard/profile";
import { TONE, scoringTrend, statStories, type Story, type TrendPoint } from "@/lib/scorecard-dashboard/stories";
import { teamByName } from "@/lib/teams";
import { gradientStops, type ShareCardSpec } from "@/lib/share-card";
import { Avatar, usePhoto } from "./Avatar";
import { ShareSheet, type SheetCard } from "./ShareSheet";
import { JCC_CREST, SectionShare } from "./SectionShare";
import { gsap, reduceMotion, useGSAP, whenSeen } from "./motion";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";

const clip = (image: string) => ({ backgroundImage: image, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;

/** Opens the story as a 9:16 card, ready for WhatsApp Status or Instagram Stories. */
export function ShareButton({ story, dark, photo: given }: { story: Story; dark?: boolean; photo?: string | null }) {
  const [open, setOpen] = useState(false);
  // /stats provides photos through PhotoContext; the home page hands each story its own.
  const found = usePhoto(story.player);
  const photo = given ?? found;
  const team = teamByName(story.team);
  const spec = (): ShareCardSpec => ({
    kicker: story.kicker,
    title: story.headline,
    hero: { value: story.value, unit: story.unit, colors: gradientStops(TONE[story.tone]) },
    body: story.body,
    person: story.player ? { name: story.player, photo } : null,
    accent: team?.primary,
    teamLogo: team?.logo,
    team: story.team ?? undefined,
    footer: `${window.location.host}/stats`,
  });
  const text = () => `${story.headline} ${story.value} ${story.unit} — JCC Stats\n${window.location.origin}/stats#story-${story.id}`;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`Share: ${story.headline}`}
        className={`relative z-[2] inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
          dark ? "border-white/20 text-white/80 hover:border-jcc-accent hover:text-jcc-accent" : "border-jcc-blue/15 text-jcc-text-muted hover:border-jcc-blue hover:text-white"
        }`}
      >
        <Share2 size={12} />
        Share
      </button>
      {open && <ShareSheet cards={[{ id: story.id, label: story.kicker, spec: spec(), text: text() }]} fileBase={`jcc-${story.id}`} onClose={() => setOpen(false)} />}
    </>
  );
}

function StoryCard({ story, big, onOpen }: { story: Story; big?: boolean; onOpen?: () => void }) {
  const ring = teamByName(story.team)?.primary ?? "#D4AF37";
  const dark = big;
  return (
    <div
      id={`story-${story.id}`}
      data-story
      className={`group relative flex scroll-mt-28 flex-col overflow-hidden rounded-[28px] text-left transition-[transform,box-shadow] duration-500 hover:-translate-y-1 ${
        dark
          ? "theme-static-dark print-grain bg-jcc-blue p-7 shadow-[0_40px_80px_-40px_rgba(13,23,40,0.7)] md:p-10 lg:col-span-2 lg:row-span-2"
          : "border border-jcc-blue/10 bg-jcc-navy p-6 shadow-[0_24px_50px_-36px_rgba(18,35,63,0.45)] hover:shadow-[0_30px_60px_-30px_rgba(18,35,63,0.5)] md:p-7"
      }`}
    >
      {dark && <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-jcc-accent/20 blur-[90px]" />}
      {onOpen && story.player && (
        <button type="button" onClick={onOpen} aria-label={`Open ${story.player}'s cards`} className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jcc-accent" />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE[story.tone] }} />
          <span className={LABEL}>{story.kicker}</span>
        </span>
        <ShareButton story={story} dark={dark} />
      </div>
      <div className={`relative flex items-end gap-3 ${dark ? "mt-10 md:mt-16" : "mt-8"}`}>
        <span
          className={`font-heading font-bold leading-[0.8] tracking-[-0.06em] tabular-nums ${dark ? "text-[6.5rem] md:text-[11rem]" : "text-6xl md:text-7xl"}`}
          style={clip(TONE[story.tone])}
        >
          {story.value}
        </span>
        <span className={`${LABEL} pb-2`}>{story.unit}</span>
      </div>
      <p className={`relative font-heading font-bold leading-[1.02] tracking-[-0.035em] text-white ${dark ? "mt-8 text-3xl md:text-5xl" : "mt-6 text-xl md:text-2xl"}`}>{story.headline}</p>
      <p className={`relative mt-3 leading-relaxed text-jcc-text-muted ${dark ? "max-w-xl text-base" : "text-[13.5px]"}`}>{story.body}</p>
      {story.player && (
        <div className="relative mt-auto flex items-center justify-between gap-3 pt-7">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={story.player} size={dark ? 44 : 32} ring={ring} />
            <span className="truncate text-sm font-semibold tracking-tight text-white">{story.player}</span>
          </span>
          {onOpen && (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition duration-300 ${dark ? "border-white/20 group-hover:border-jcc-accent group-hover:bg-jcc-accent group-hover:text-jcc-blue" : "border-jcc-blue/15 group-hover:border-jcc-blue group-hover:bg-jcc-blue group-hover:text-[#FCFBF8]"}`}>
              <ArrowUpRight size={17} className="transition-transform duration-300 group-hover:rotate-45" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trend chart ─────────────────────────────────────────────────────────────
// One series per chart (two small multiples rather than a dual axis), a
// recessive grid, the peak labelled directly and a crosshair tooltip.

const W = 640;
const H = 240;
const PAD = { l: 34, r: 14, t: 18, b: 30 };

function TrendChart({ id, title, points, value, fmt, unit, scope }: { id: string; title: string; points: TrendPoint[]; value: (t: TrendPoint) => number; fmt: (n: number) => string; unit: string; scope: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const vals = points.map(value);
  const max = Math.max(...vals) * 1.12 || 1;
  const step = (W - PAD.l - PAD.r) / Math.max(1, points.length - 1);
  const x = (i: number) => PAD.l + i * step;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(vals.length - 1).toFixed(1)},${H - PAD.b} L${PAD.l},${H - PAD.b} Z`;
  const peak = vals.indexOf(Math.max(...vals));
  const ticks = [0, 0.5, 1].map((f) => Math.round((max / 1.12) * f));
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const last = vals[vals.length - 1] ?? 0;

  // The chart as a story card: the latest figure up top, the season's line under it.
  const share = (): SheetCard[] => {
    const lastLabel = points[points.length - 1]?.label ?? "";
    const spec: ShareCardSpec = {
      kicker: `Season trend · ${scope}`,
      title,
      hero: { value: fmt(last), unit: `${unit}, ${lastLabel}`, colors: ["#F3C96A", "#A97824"] },
      chart: { values: vals, labels: points.map((p) => p.label), fmt },
      facts: [
        { label: "Season avg", value: fmt(mean) },
        { label: "Peak", value: `${fmt(vals[peak])} · ${points[peak]?.label ?? ""}` },
        { label: "Matchdays", value: String(points.length) },
      ],
      emblem: JCC_CREST,
      byline: "JCC Stats",
      team: "Jaipur Cricket Circle",
      footer: `${window.location.host}/stats`,
    };
    const text = `${title}: ${fmt(last)} ${unit} on ${lastLabel} (season avg ${fmt(mean)}, peak ${fmt(vals[peak])}) — JCC Stats\n${window.location.origin}/stats#trend-${id}`;
    return [{ id: `trend-${id}`, label: title, spec, text }];
  };

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduceMotion()) return;
      const path = el.querySelector<SVGPathElement>("[data-line]");
      const fill = el.querySelector("[data-area]");
      const dots = el.querySelectorAll("[data-dot]");
      if (!path) return;
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.set(fill, { opacity: 0 });
      gsap.set(dots, { scale: 0, transformOrigin: "center" });
      return whenSeen(el, () => {
        gsap.timeline({ defaults: { ease: "power3.inOut" } })
          .to(path, { strokeDashoffset: 0, duration: 1.8 })
          .to(fill, { opacity: 1, duration: 1 }, 0.6)
          .to(dots, { scale: 1, duration: 0.5, stagger: 0.04, ease: "back.out(3)" }, 0.5);
      }, 0.85);
    },
    { scope: ref, dependencies: [points] },
  );

  return (
    <div ref={ref} id={`trend-${id}`} className="relative scroll-mt-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className={LABEL}>{title}</p>
            <SectionShare build={share} fileBase={`jcc-trend-${id}`} />
          </div>
          <p className="mt-2 font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">
            {fmt(last)} <span className="align-middle text-base font-semibold tracking-tight text-jcc-text-muted">{unit}, latest</span>
          </p>
        </div>
        <p className="pb-1 text-right font-mono text-[11px] text-jcc-text-muted">
          season avg <b className="font-semibold text-white">{fmt(mean)}</b>
          <br />
          {last >= mean ? "▲ above" : "▼ below"} average
        </p>
      </div>
      <div className="relative mt-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${title}: ${points.map((p, i) => `${p.label} ${fmt(vals[i])}`).join(", ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(18,35,63,0.08)" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#667085">{t}</text>
            </g>
          ))}
          <path data-area d={area} fill="rgba(18,35,63,0.06)" />
          <path data-line d={line} fill="none" stroke="#12233F" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(18,35,63,0.3)" strokeDasharray="3 4" />}
          {vals.map((v, i) => (
            <circle key={i} data-dot cx={x(i)} cy={y(v)} r={i === peak || i === hover ? 5.5 : 3.5} fill={i === peak ? "#D4AF37" : "#12233F"} stroke="#FFFFFF" strokeWidth="2" />
          ))}
          <text x={x(peak)} y={y(vals[peak]) - 12} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)" fill="#12233F">
            peak {fmt(vals[peak])}
          </text>
          {points.map((p, i) =>
            i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0 ? (
              <text key={p.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fontFamily="var(--font-mono)" fill="#667085">
                {p.label}
              </text>
            ) : null,
          )}
          {/* Hit targets: a full-height column per point, wider than the mark. */}
          {points.map((p, i) => (
            <rect key={p.date} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-jcc-blue px-3 py-2 text-center shadow-[0_12px_30px_-10px_rgba(13,23,40,0.6)]"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(vals[hover]) / H) * 100}%`, marginTop: -12 }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {points[hover].label} · {points[hover].matches} matches
            </p>
            <p className="font-heading text-lg font-bold tabular-nums" style={{ color: "#FFFFFF" }}>
              {fmt(vals[hover])} {unit}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Stories({ data, seasons, scope = "", onOpenPlayer }: { data: CardData; seasons: number[]; scope?: string; onOpenPlayer: (p: number) => void }) {
  const stories = useMemo(() => statStories(data, seasons), [data, seasons]);
  const trend = useMemo(() => scoringTrend(data, seasons), [data, seasons]);
  const grid = useRef<HTMLDivElement>(null);

  // Season switch: re-deal the cards.
  useGSAP(
    () => {
      if (reduceMotion() || !grid.current) return;
      const cards = grid.current.querySelectorAll("[data-story]");
      gsap.set(cards, { autoAlpha: 0, y: 60, rotateX: -12, transformPerspective: 900 });
      return whenSeen(grid.current, () =>
        void gsap.to(cards, { autoAlpha: 1, y: 0, rotateX: 0, duration: 1.1, ease: "expo.out", stagger: 0.07, clearProps: "transform" }),
      0.9);
    },
    { scope: grid, dependencies: [stories] },
  );

  const [lead, ...rest] = stories;
  return (
    <div>
      {trend.length >= 3 && (
        <div className="grid gap-12 border-y border-jcc-blue/80 py-10 md:grid-cols-2 md:gap-16 md:py-14">
          <TrendChart id="first-innings" scope={scope} title="Average first-innings total, by matchday" points={trend} value={(t) => t.avgFirst} fmt={(n) => n.toFixed(0)} unit="runs" />
          <TrendChart id="sixes" scope={scope} title="Sixes per match, by matchday" points={trend} value={(t) => t.sixes} fmt={(n) => n.toFixed(1)} unit="sixes" />
        </div>
      )}
      {lead && (
        <div ref={grid} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mt-16 md:gap-5">
          <StoryCard story={lead} big onOpen={lead.p != null ? () => onOpenPlayer(lead.p!) : undefined} />
          {rest.map((s) => (
            <StoryCard key={s.id} story={s} onOpen={s.p != null ? () => onOpenPlayer(s.p!) : undefined} />
          ))}
        </div>
      )}
      <p className="mt-8 max-w-3xl font-mono text-[11px] leading-relaxed text-jcc-text-muted">
        Rates need at least 30 balls. Wicket phases are read from the over each wicket fell in: overs 1–2 are the powerplay, the last two are the death.
      </p>
    </div>
  );
}
