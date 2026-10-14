"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap, useGSAP } from "@/components/motion/gsap";

const LOADER_DURATION_MS = 2000;

/** Pages that skip the site intro: their own entrance, or admin tooling. */
const NO_LOADER = ["/stats", "/admin"];

/** Set once the intro has played, so it runs once per browser session. */
const SEEN_KEY = "jcc_intro_seen";

function introSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage blocked — the intro just plays on each load, as before.
  }
}

export default function LoaderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default false so SSR HTML never includes the overlay — the LCP element is
  // visible in the static HTML. The intro fires only on the client, on the
  // first full page load of a browser session (sessionStorage); client-side
  // route changes never remount this component.
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const curtain = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (NO_LOADER.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    if (introSeen()) return;
    // Marked inside the frame, so a StrictMode double-run (whose first frame is
    // cancelled) can't use the intro up without showing it.
    const id = requestAnimationFrame(() => {
      markIntroSeen();
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setLoading(true);
    });
    return () => cancelAnimationFrame(id);
    // Hard loads only: later client-side navigations must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 00 → 100, the wordmark rises, then the curtain lifts off the page.
  useGSAP(
    () => {
      if (!loading || !curtain.current) return;
      const q = gsap.utils.selector(curtain);
      const n = { v: 0 };
      gsap
        .timeline({ onComplete: () => setLoading(false) })
        .fromTo(q("[data-intro-word]"), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.06 }, 0)
        .to(n, { v: 100, duration: LOADER_DURATION_MS / 1000 - 0.6, ease: "power2.inOut", onUpdate: () => { if (count.current) count.current.textContent = String(Math.round(n.v)).padStart(2, "0"); } }, 0)
        .fromTo(q("[data-intro-bar]"), { scaleX: 0 }, { scaleX: 1, duration: LOADER_DURATION_MS / 1000 - 0.6, ease: "power2.inOut" }, 0)
        .to(q("[data-intro-inner]"), { yPercent: -30, opacity: 0, duration: 0.5, ease: "expo.in" })
        .to(curtain.current, { clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "expo.inOut" }, "-=0.25");
    },
    { dependencies: [loading] },
  );

  return (
    <>
      {loading && (
        <div
          ref={curtain}
          className="theme-static-dark fixed inset-0 z-[100] flex select-none items-end overflow-hidden bg-[#0B1424] px-5 pb-10 md:px-10 md:pb-14"
          style={{ clipPath: "inset(0 0 0% 0)" }}
        >
          <div aria-hidden className="pitch-grid absolute inset-0" />
          <div data-intro-inner className="relative w-full">
            <div className="flex items-end justify-between gap-6">
              <div>
                <img src="/jcc_logo.png" alt="" width={120} height={120} className="h-16 w-16 object-contain md:h-24 md:w-24" />
                <p className="mt-6 overflow-hidden font-heading text-4xl font-extrabold leading-none tracking-[-0.05em] text-white md:text-7xl">
                  <span data-intro-word className="inline-block">Every&nbsp;ball,</span>{" "}
                  <span data-intro-word className="inline-block text-white/40">counted.</span>
                </p>
              </div>
              <span ref={count} className="font-heading text-[22vw] font-extrabold leading-[0.75] tracking-[-0.05em] tabular-nums text-gold-foil md:text-[14vw]">
                00
              </span>
            </div>
            <div className="mt-8 h-px w-full bg-white/10">
              <div data-intro-bar className="h-full origin-left bg-jcc-accent" />
            </div>
          </div>
        </div>
      )}

      {/* Content renders immediately at full opacity so the LCP element paints
          right away — the intro overlay simply sits on top and lifts away. */}
      {children}
    </>
  );
}
