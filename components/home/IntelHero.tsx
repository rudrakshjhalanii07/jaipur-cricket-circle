"use client";

// The home page's opening screen. Analytics lead: the headline sells what the
// club measures, the right-hand cards are this season's two caps, and the
// strip along the bottom is the career count from every scorecard.
//
// The headline rises in through CSS (.rise-line in globals.css), not GSAP, so
// it animates from the first paint and is never hidden waiting for script —
// it's the LCP element. GSAP adds everything around it: the seam drawing in,
// the cap cards dealing in and tilting with the pointer, the numbers counting
// and the scroll exit.

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Magnetic from "@/components/motion/Magnetic";
import { gsap, useGSAP, reduceMotion, finePointer } from "@/components/motion/gsap";
import { teamByName } from "@/lib/teams";
import { focusOf, focusStyle } from "@/lib/photo-focus";
import { CapsShare } from "./HomeShare";
import { daysToSeason4 } from "@/lib/season4";
import type { HomeIntel, IntelCap } from "@/lib/home-intel.server";

const CAPS = {
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
};
const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function Face({ name, photo, size, ring }: { name: string; photo: string | null; size: number; ring?: string }) {
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined };
  if (!photo) {
    return (
      <span
        aria-hidden
        className="inline-grid shrink-0 place-items-center rounded-full bg-jcc-blue-deep font-heading font-bold text-jcc-accent-highlight"
        style={{ ...style, fontSize: size * 0.36 }}
      >
        {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
      </span>
    );
  }
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full bg-jcc-navy-light" style={style}>
      <Image src={photo} alt={name} fill unoptimized sizes={`${size}px`} className="object-cover object-top" style={focusStyle(focusOf(photo))} />
    </span>
  );
}

function CapCard({ cap, kind, className = "" }: { cap: IntelCap; kind: keyof typeof CAPS; className?: string }) {
  const team = teamByName(cap.team);
  return (
    <div data-cap className={`relative overflow-hidden rounded-[26px] border border-white/12 bg-white/[0.06] p-5 backdrop-blur-xl will-change-transform md:p-6 ${className}`}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: CAPS[kind] }} />
      {team && (
        <Image src={team.logo} alt="" width={160} height={160} className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 object-contain opacity-[0.09]" />
      )}
      <div className="relative flex items-center justify-between">
        <span className="kicker text-white/70">{kind === "orange" ? "Orange Cap" : "Purple Cap"}</span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAPS[kind] }} />
      </div>
      <div className="relative mt-5 flex items-end gap-2">
        <span data-tick={cap.value} className="font-heading text-7xl font-bold leading-[0.8] tracking-[-0.045em] tabular-nums" style={{ backgroundImage: CAPS[kind], WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          {cap.value}
        </span>
        <span className="kicker pb-1 text-white/60">{cap.unit}</span>
      </div>
      <div className="relative mt-5 flex items-center gap-3">
        <Face name={cap.name} photo={cap.photo} size={40} ring={team?.primary ?? "#D4AF37"} />
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold tracking-[-0.03em] text-white">{cap.name}</p>
          <p className="truncate font-mono text-[10.5px] text-white/60">{cap.detail}</p>
        </div>
      </div>
    </div>
  );
}

/** A cricket ball's seam, drawn in on load and turned by the scroll. */
function Seam() {
  const left = "M 128 70 C 250 210, 250 390, 128 530";
  const right = "M 472 70 C 350 210, 350 390, 472 530";
  return (
    <svg data-seam viewBox="0 0 600 600" aria-hidden className="pointer-events-none absolute -right-[40%] top-[8%] w-[130vw] max-w-[1000px] opacity-40 will-change-transform md:-right-[12%] md:top-[-6%] md:w-[70vw] md:opacity-80" fill="none">
      <circle cx="300" cy="300" r="282" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
      <circle cx="300" cy="300" r="230" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
      {[left, right].map((d) => (
        <g key={d}>
          <path data-seam-draw d={d} stroke="#D4AF37" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          <path data-seam-stitch d={d} stroke="#F3C96A" strokeOpacity="0.35" strokeWidth="16" strokeDasharray="2 13" />
        </g>
      ))}
    </svg>
  );
}

export default function IntelHero({ intel }: { intel: HomeIntel | null }) {
  const root = useRef<HTMLElement>(null);
  const season4Days = daysToSeason4();

  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(root);

      q("[data-seam-draw]").forEach((p) => {
        const len = (p as unknown as SVGPathElement).getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.6, ease: "power2.inOut", delay: 0.2 });
      });
      gsap.fromTo(q("[data-seam-stitch]"), { opacity: 0 }, { opacity: 1, duration: 1.4, delay: 1.3, stagger: 0.15 });
      gsap.fromTo(q("[data-cap]"), { y: 90, rotate: (i: number) => (i ? 8 : -8), opacity: 0 }, { y: 0, rotate: (i: number) => (i ? 3 : -3), opacity: 1, duration: 1.5, ease: "expo.out", stagger: 0.14, delay: 0.45 });
      gsap.fromTo(q("[data-kpi]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.7 });
      gsap.fromTo(q("[data-kpi-rule]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.6, ease: "expo.inOut", delay: 0.5 });

      // Numbers count from zero while they deal in.
      for (const el of q("[data-tick]")) {
        const target = Number((el as HTMLElement).dataset.tick);
        const comma = (el as HTMLElement).dataset.comma === "1";
        const o = { v: 0 };
        gsap.to(o, {
          v: target,
          duration: 2.2,
          delay: 0.8,
          ease: "expo.out",
          onUpdate: () => {
            el.textContent = comma ? commas(Math.round(o.v)) : String(Math.round(o.v));
          },
        });
      }

      // Scroll exit: the ball turns, the copy lifts and dims, the cards part.
      const exit = { trigger: root.current, start: "top top", end: "bottom top", scrub: true };
      gsap.to(q("[data-seam]"), { rotate: 70, yPercent: 20, ease: "none", scrollTrigger: exit });
      gsap.to(q("[data-hero-copy]"), { yPercent: -18, opacity: 0.1, ease: "none", scrollTrigger: { ...exit, start: "20% top" } });
      gsap.to(q("[data-cap-stack]"), { yPercent: -30, ease: "none", scrollTrigger: exit });

      // Cards lean toward the pointer.
      if (finePointer()) {
        const stack = q("[data-cap-stack]")[0] as HTMLElement | undefined;
        if (stack) {
          const rx = gsap.quickTo(stack, "rotationX", { duration: 0.8, ease: "power3.out" });
          const ry = gsap.quickTo(stack, "rotationY", { duration: 0.8, ease: "power3.out" });
          gsap.set(stack, { transformPerspective: 1000 });
          const move = (e: PointerEvent) => {
            ry((e.clientX / window.innerWidth - 0.5) * 14);
            rx((e.clientY / window.innerHeight - 0.5) * -10);
          };
          window.addEventListener("pointermove", move, { passive: true });
          return () => window.removeEventListener("pointermove", move);
        }
      }
    },
    { scope: root },
  );

  const kpis = intel
    ? [
        { label: "Matches scored", value: intel.career.matches },
        { label: "Runs", value: intel.career.runs, comma: true },
        { label: "Wickets", value: intel.career.wickets },
        { label: "Sixes", value: intel.career.sixes },
        { label: "Players tracked", value: intel.career.players },
      ]
    : [];

  return (
    <section ref={root} className="theme-static-dark print-grain relative isolate flex min-h-svh flex-col overflow-hidden bg-[#0B1424]">
      <div aria-hidden className="pitch-grid absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 h-[34rem] w-[34rem] rounded-full bg-[#3B6FC4]/30 blur-[140px]" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-40 h-[36rem] w-[36rem] rounded-full bg-jcc-accent/15 blur-[140px]" />
      <Seam />

      <div className="relative mx-auto flex w-full max-w-[88rem] flex-1 flex-col px-5 pt-32 md:px-10 md:pt-40">
        <div className="grid flex-1 items-center gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)]">
          <div data-hero-copy>
            <div className="rise-fade flex flex-wrap items-center gap-3" style={{ "--d": "0.05s" } as React.CSSProperties}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/80">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jcc-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-jcc-accent" />
                </span>
                JCC Intelligence · {intel?.seasonLabel ?? "Season 3"} data
              </span>
              {season4Days >= 0 && (
                <Link
                  href="/profile"
                  suppressHydrationWarning
                  className="group inline-flex items-center gap-2 rounded-full bg-jcc-accent px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#0D1728] transition-colors hover:bg-jcc-accent-highlight"
                >
                  <span suppressHydrationWarning>{season4Days === 0 ? "Season 4 starts tonight" : `Season 4 · ${season4Days} days`}</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>

            <h1 className="mt-10 font-heading text-[clamp(3rem,7.4vw,8.5rem)] font-extrabold leading-[0.84] tracking-[-0.045em] text-white">
              <span className="rise-mask"><span className="rise-line">Every ball.</span></span>
              <span className="rise-mask"><span className="rise-line text-white/35">Every player.</span></span>
              <span className="rise-mask">
                <span className="rise-line">
                  <span className="text-gold-foil">Decoded</span>
                  <span className="text-jcc-accent">.</span>
                </span>
              </span>
            </h1>

            <p className="rise-fade mt-10 max-w-xl text-base leading-relaxed text-white/70 md:text-lg" style={{ "--d": "0.45s" } as React.CSSProperties}>
              Jaipur Cricket Circle turns every weekend scorecard into rankings, rivalries and stories.
              {intel && (
                <>
                  {" "}
                  {intel.career.matches} matches and {commas(intel.career.runs)} runs so far — every one of them counted.
                </>
              )}
            </p>

            <div className="rise-fade mt-10 flex flex-wrap items-center gap-4" style={{ "--d": "0.6s" } as React.CSSProperties}>
              <Magnetic>
                <Link href="/stats" className="btn-gold group">
                  Enter the stats
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.25}>
                <Link href="/profile" className="btn-ghost">
                  Join the Circle
                </Link>
              </Magnetic>
            </div>
          </div>

          {intel?.orange && intel.purple && (
            <div data-cap-stack className="relative mx-auto hidden w-full max-w-sm lg:block">
              <CapCard cap={intel.orange} kind="orange" className="-rotate-3" />
              <CapCard cap={intel.purple} kind="purple" className="ml-10 mt-4 rotate-3" />
              <div className="mt-6 flex justify-center">
                <CapsShare orange={intel.orange} purple={intel.purple} season={intel.seasonLabel} dark />
              </div>
            </div>
          )}
        </div>

        {kpis.length > 0 && (
          <dl className="relative mt-16 grid grid-cols-2 pb-10 sm:grid-cols-3 md:mt-20 lg:grid-cols-5">
            <span data-kpi-rule aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/15" />
            {kpis.map((k) => (
              <div key={k.label} data-kpi className="py-6 pr-4 md:py-8">
                <dt className="kicker text-white/55">{k.label}</dt>
                <dd data-tick={k.value} data-comma={k.comma ? "1" : undefined} className="mt-3 font-heading text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white md:text-6xl">
                  {k.comma ? commas(k.value) : k.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
