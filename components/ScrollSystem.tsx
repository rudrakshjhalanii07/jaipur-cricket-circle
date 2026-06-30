"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export const NAV_ROUTES = [
  { href: "/", label: "Home" },
  { href: "/chewvana-times", label: "Chewvana Times" },
  { href: "/members", label: "Members" },
  { href: "/rivalry", label: "Rivalry" },
  { href: "/tournament", label: "Tournament" },
  { href: "/register", label: "Register" },
  { href: "/profile", label: "Profile" },
  { href: "/about", label: "About" },
];

const CHARGE_TARGET = 4000;
const BOTTOM_THRESHOLD = 10; // px
const POST_NAV_IGNORE_MS = 800;
const TOUCH_MULTIPLIER = 2.5;

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
      setTimeout(() => router.push(NAV_ROUTES[nextIdx].href), 600);
    };
  }, [router]);

  // Stable event listener — all mutable state accessed via refs
  useEffect(() => {
    const handleDelta = (delta: number) => {
      if (Date.now() < ignoreUntilRef.current) return;
      if (transitioningRef.current) return;

      if (delta > 0) {
        const atBottom =
          window.scrollY + window.innerHeight >=
          scrollHeightRef.current - BOTTOM_THRESHOLD;
        if (!atBottom) return;
      }

      chargeRef.current = Math.max(0, Math.min(CHARGE_TARGET, chargeRef.current + delta));
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
