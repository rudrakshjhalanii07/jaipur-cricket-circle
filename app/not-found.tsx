"use client";

// 404: stumped. The ball comes in, the bails fly, the scoreboard reads 404.
// Tap the stumps to bowl again.

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Magnetic from "@/components/motion/Magnetic";
import { gsap, useGSAP, reduceMotion } from "@/components/motion/gsap";

export default function NotFound() {
  const root = useRef<HTMLElement>(null);
  const [take, setTake] = useState(0);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (reduceMotion()) return;
      gsap
        .timeline()
        .set(q("[data-bail]"), { x: 0, y: 0, rotate: 0, opacity: 1 })
        .fromTo(q("[data-ball]"), { x: -420, y: -160, opacity: 0, rotate: -360 }, { x: 0, y: 0, opacity: 1, rotate: 0, duration: 0.7, ease: "power2.in" })
        .to(q("[data-stumps]"), { x: 6, duration: 0.06, yoyo: true, repeat: 3, ease: "none" })
        .to(q("[data-bail='l']"), { x: -90, y: -140, rotate: -260, duration: 0.9, ease: "power3.out" }, "<")
        .to(q("[data-bail='r']"), { x: 110, y: -170, rotate: 300, duration: 0.9, ease: "power3.out" }, "<")
        .to(q("[data-bail]"), { y: 60, opacity: 0, duration: 0.6, ease: "power2.in" })
        .to(q("[data-ball]"), { x: 160, y: 30, opacity: 0, duration: 0.6, ease: "power2.out" }, "<-0.5")
        .fromTo(q("[data-digit]"), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.08 }, take ? 0.6 : 0.5);
    },
    { scope: root, dependencies: [take] },
  );

  return (
    <main ref={root} className="theme-static-dark print-grain relative flex min-h-svh items-center overflow-hidden bg-[#0B1424] px-5 py-32 md:px-10">
      <div aria-hidden className="pitch-grid absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-jcc-accent/15 blur-[140px]" />
      <div className="relative mx-auto grid w-full max-w-[88rem] items-center gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <p className="kicker text-jcc-accent">Error 404 · Out, stumped</p>
          <p aria-hidden className="mt-6 flex overflow-hidden font-heading text-[clamp(7rem,24vw,22rem)] font-extrabold leading-[0.78] tracking-[-0.08em]">
            {["4", "0", "4"].map((d, i) => (
              <span key={i} data-digit className={i === 1 ? "text-outline text-white/60" : "text-gold-foil"}>
                {d}
              </span>
            ))}
          </p>
          <h1 className="mt-8 font-heading text-4xl font-extrabold leading-[0.95] tracking-[-0.05em] text-white md:text-6xl">
            Stumped. This page has walked off.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/65">
            It isn&apos;t on the scorecard. The numbers you&apos;re after are probably in the stats.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Magnetic>
              <Link href="/stats" className="btn-gold group">
                Enter the stats
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:rotate-45" />
              </Link>
            </Magnetic>
            <Magnetic strength={0.25}>
              <Link href="/" className="btn-ghost">
                Back to home
              </Link>
            </Magnetic>
          </div>
        </div>

        <button type="button" onClick={() => setTake((t) => t + 1)} aria-label="Bowl again" className="relative mx-auto h-80 w-64 cursor-pointer">
          <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <ellipse cx="100" cy="250" rx="90" ry="8" fill="rgba(255,255,255,0.06)" />
            <g data-stumps>
              {[62, 100, 138].map((x) => (
                <rect key={x} x={x - 5} y={60} width="10" height="190" rx="4" fill="#F7F5EF" />
              ))}
            </g>
            <rect data-bail="l" x="58" y="50" width="44" height="8" rx="4" fill="#D4AF37" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            <rect data-bail="r" x="98" y="50" width="44" height="8" rx="4" fill="#D4AF37" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            <g data-ball style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <circle cx="100" cy="200" r="16" fill="#A3262A" />
              <path d="M 88 190 C 96 198, 96 206, 88 214 M 112 190 C 104 198, 104 206, 112 214" stroke="#F3C96A" strokeWidth="1.5" fill="none" strokeDasharray="2 3" />
            </g>
          </svg>
          <span className="kicker absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-white/45">Tap to bowl again</span>
        </button>
      </div>
    </main>
  );
}
