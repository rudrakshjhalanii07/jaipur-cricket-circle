"use client";

// A gold dot and a trailing ring in place of the pointer. The ring swells over
// anything clickable. Desktop only: hidden in CSS on coarse pointers and under
// reduced motion, and never mounted there either.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap, finePointer } from "./gsap";

const CLICKABLE = "a, button, [role='button'], [role='tab'], summary, label, select, input[type='submit']";

export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const pathname = usePathname();
  // The auction hall and admin tools keep the system cursor.
  const off = pathname.startsWith("/auctionos") || pathname.startsWith("/admin");

  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(finePointer()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!on || off || !dot.current || !ring.current) return;
    const d = dot.current;
    const r = ring.current;
    const dx = gsap.quickTo(d, "x", { duration: 0.12, ease: "power3.out" });
    const dy = gsap.quickTo(d, "y", { duration: 0.12, ease: "power3.out" });
    const rx = gsap.quickTo(r, "x", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(r, "y", { duration: 0.5, ease: "power3.out" });
    gsap.set([d, r], { opacity: 0 });
    let shown = false;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!shown) {
        gsap.set([d, r], { x: e.clientX, y: e.clientY });
        gsap.to([d, r], { opacity: 1, duration: 0.3 });
        shown = true;
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
      const hot = (e.target as Element | null)?.closest?.(CLICKABLE) ? "true" : "false";
      if (d.dataset.hover !== hot) d.dataset.hover = r.dataset.hover = hot;
    };
    const hide = () => {
      gsap.to([d, r], { opacity: 0, duration: 0.3 });
      shown = false;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
    };
  }, [on, off]);

  if (!on || off) return null;
  return (
    <>
      <div ref={ring} aria-hidden className="jcc-cursor-ring" />
      <div ref={dot} aria-hidden className="jcc-cursor" />
    </>
  );
}
