"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export const NAV_ROUTES = [
  { href: "/", label: "Home" },
  { href: "/boundary-banter", label: "Boundary Banter" },
  { href: "/members", label: "Members" },
  { href: "/seasons", label: "Seasons" },
  { href: "/tournament", label: "Tournament" },
  { href: "/register", label: "Register" },
  { href: "/profile", label: "Profile" },
  { href: "/about", label: "About" },
];

const CHARGE_TARGET = 4000;
const BOTTOM_THRESHOLD = 10; // px
const POST_NAV_IGNORE_MS = 800;
const TOUCH_MULTIPLIER = 2.5;
const BOTTOM_DWELL_MS = 200; // must sit at the bottom this long before charge starts filling
const MAX_DELTA_PER_EVENT = 150; // px — caps how much a single wheel/touch tick can contribute
const NAV_FALLBACK_MS = 5000; // safety unlock if the pathname never actually changes (e.g. a client redirect)

interface ScrollContextValue {
  charge: number;       // 0–1
  transitioning: boolean;
}

const ScrollContext = createContext<ScrollContextValue>({ charge: 0, transitioning: false });

export function useScrollContext() {
  return useContext(ScrollContext);
}

export default function ScrollSystem({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [charge, setCharge] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const chargeRef = useRef(0);
  const transitioningRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const touchStartYRef = useRef(0);
  const pathnameRef = useRef(pathname);
  const scrollHeightRef = useRef(0);
  const atBottomSinceRef = useRef(0);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Cache document height via ResizeObserver so wheel handler never forces a
  // layout reflow by reading scrollHeight on the hot path.
  useEffect(() => {
    const update = () => {
      scrollHeightRef.current = document.documentElement.scrollHeight;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  // Reset state on every route change
  useEffect(() => {
    chargeRef.current = 0;
    setCharge(0);
    transitioningRef.current = false;
    setTransitioning(false);
    ignoreUntilRef.current = Date.now() + POST_NAV_IGNORE_MS;
    atBottomSinceRef.current = 0;
  }, [pathname]);

  // Keep navigate function current without re-attaching wheel listeners
  const navigateRef = useRef<() => void>(() => {});
  useEffect(() => {
    navigateRef.current = () => {
      if (transitioningRef.current) return;
      const idx = NAV_ROUTES.findIndex((r) => r.href === pathnameRef.current);
      const nextIdx = idx === -1 ? 0 : (idx + 1) % NAV_ROUTES.length;
      transitioningRef.current = true;
      setTransitioning(true);
      ignoreUntilRef.current = Date.now() + 9999;
      setTimeout(() => {
        // Don't reset the lock here — router.push() is fire-and-forget and
        // the destination route (uncompiled in dev, or fetching data) can
        // take well over a second to actually land. Unlocking on a fixed
        // timer let pathnameRef go stale mid-navigation, so a scroll during
        // that gap was attributed to the page we just left, breaking every
        // hop after the first. The [pathname] reset effect below is the
        // real unlock — it only fires once usePathname() genuinely changes.
        router.push(NAV_ROUTES[nextIdx].href);
      }, 600);
      // Fallback safety unlock: if the pathname never actually changes (a
      // client-side redirect back to the same route, or a navigation that
      // otherwise never resolves), don't leave scroll input frozen for the
      // rest of the session.
      setTimeout(() => {
        if (!transitioningRef.current) return;
        chargeRef.current = 0;
        setCharge(0);
        transitioningRef.current = false;
        setTransitioning(false);
        ignoreUntilRef.current = Date.now() + POST_NAV_IGNORE_MS;
        atBottomSinceRef.current = 0;
      }, 600 + NAV_FALLBACK_MS);
    };
  }, [router]);

  // Stable event listener — all mutable state accessed via refs
  useEffect(() => {
    const handleDelta = (delta: number) => {
      if (Date.now() < ignoreUntilRef.current) return;
      if (transitioningRef.current) return;
      if (!NAV_ROUTES.some((r) => r.href === pathnameRef.current)) return;

      if (delta > 0) {
        const cachedAtBottom =
          window.scrollY + window.innerHeight >=
          scrollHeightRef.current - BOTTOM_THRESHOLD;
        if (!cachedAtBottom) {
          atBottomSinceRef.current = 0;
          return;
        }
        // The ResizeObserver cache can lag behind the real document height —
        // most visible on tall, section-heavy pages like the homepage, where
        // it briefly reads short right after mount/route-change and reads
        // every scroll near that stale bottom as "reached it". Once the cheap
        // cached check says we *might* be at the bottom, pay for one fresh
        // (reflow-inducing) read to confirm before starting the dwell timer —
        // this keeps the reflow off the hot path since it only runs in the
        // rare near-bottom branch, not on every wheel tick.
        const freshHeight = document.documentElement.scrollHeight;
        scrollHeightRef.current = freshHeight;
        const atBottom =
          window.scrollY + window.innerHeight >= freshHeight - BOTTOM_THRESHOLD;
        if (!atBottom) {
          atBottomSinceRef.current = 0;
          return;
        }
        if (atBottomSinceRef.current === 0) {
          atBottomSinceRef.current = Date.now();
        }
        // Must have been resting at the bottom for a beat before it counts —
        // stops a fling that merely lands on a still-loading (short) page
        // from instantly reading as "at bottom" and consuming its whole delta.
        if (Date.now() - atBottomSinceRef.current < BOTTOM_DWELL_MS) return;
      } else {
        atBottomSinceRef.current = 0;
      }

      const clampedDelta = Math.max(-MAX_DELTA_PER_EVENT, Math.min(MAX_DELTA_PER_EVENT, delta));
      chargeRef.current = Math.max(0, Math.min(CHARGE_TARGET, chargeRef.current + clampedDelta));
      setCharge(chargeRef.current / CHARGE_TARGET);

      if (chargeRef.current >= CHARGE_TARGET) {
        navigateRef.current();
      }
    };

    const onWheel = (e: WheelEvent) => handleDelta(e.deltaY);

    const onTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dy = (touchStartYRef.current - e.touches[0].clientY) * TOUCH_MULTIPLIER;
      touchStartYRef.current = e.touches[0].clientY;
      handleDelta(dy);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <ScrollContext.Provider value={{ charge, transitioning }}>
      {children}
    </ScrollContext.Provider>
  );
}
