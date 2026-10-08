"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, Flip, useGSAP);

export { gsap, ScrollTrigger, Flip, useGSAP };

export const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once any part of `el` is above `line` (a fraction of the viewport height). */
export const isSeen = (el: Element, line = 0.92) => el.getBoundingClientRect().top < window.innerHeight * line;

/**
 * Runs `fn` the first time `el` comes within `line` (a fraction of the
 * viewport height) — or straight away if it is already there or above it.
 * Uses an IntersectionObserver, so it can't go stale when content above
 * changes height (tabs, show-all). Returns a cancel function.
 */
export function whenSeen(el: Element, fn: () => void, line = 0.92) {
  const io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting || e.boundingClientRect.top < 0) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: `0px 0px -${Math.round((1 - line) * 100)}% 0px` },
  );
  io.observe(el);
  return () => io.disconnect();
}

/**
 * A highlight that glides to whichever child of `box` has data-active="true".
 * "fill" covers the active item (segmented controls); "line" only tracks its
 * x/width (underline tabs — position the pill at the bottom in CSS).
 */
export function usePill<T extends HTMLElement = HTMLDivElement>(dep: unknown, mode: "fill" | "line" = "fill") {
  const box = useRef<T>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useGSAP(
    () => {
      const place = (instant: boolean) => {
        const b = box.current;
        const p = pill.current;
        if (!b || !p) return;
        const a = b.querySelector<HTMLElement>("[data-active='true']");
        if (!a) {
          gsap.to(p, { autoAlpha: 0, duration: 0.2 });
          return;
        }
        gsap.to(p, {
          x: a.offsetLeft,
          width: a.offsetWidth,
          ...(mode === "fill" ? { y: a.offsetTop, height: a.offsetHeight } : {}),
          autoAlpha: 1,
          duration: instant || reduceMotion() ? 0 : 0.6,
          ease: "expo.out",
          overwrite: true,
        });
      };
      place(!placed.current);
      placed.current = true;
      const snap = () => place(true);
      window.addEventListener("resize", snap);
      document.fonts?.ready.then(snap);
      return () => window.removeEventListener("resize", snap);
    },
    { dependencies: [dep] },
  );

  return { box, pill };
}

const commas =(s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * A number that counts up the first time it is seen, and tweens from the old
 * value to the new one when it changes (season switch). The server renders
 * the final value, so the markup is correct without JS. The tween writes the
 * text node React owns rather than replacing it, so React stays in sync.
 */
export function Counter({
  value,
  decimals = 0,
  comma = false,
  delay = 0,
}: {
  value: number;
  decimals?: number;
  comma?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** The value on screen once a tween has landed; null until the first count-up. */
  const shown = useRef<number | null>(null);
  const text = (n: number) => (comma ? commas(n.toFixed(decimals)) : n.toFixed(decimals));

  useGSAP(
    () => {
      const el = ref.current;
      const node = el?.firstChild;
      if (!el || !node) return;
      const from = shown.current;
      if (reduceMotion() || from === value) {
        node.nodeValue = text(value);
        shown.current = value;
        return;
      }

      // Only record a value once it has landed, so an effect that runs twice
      // (StrictMode, a quick season switch) starts from what is really shown.
      const o = { v: from ?? 0 };
      node.nodeValue = text(o.v);
      const tween = gsap.to(o, {
        v: value,
        duration: from == null ? 1.8 : 0.9,
        delay: from == null ? delay : 0,
        ease: "expo.out",
        paused: from == null,
        onUpdate: () => {
          node.nodeValue = text(o.v);
        },
        onComplete: () => {
          shown.current = value;
        },
      });
      if (from == null) return whenSeen(el, () => tween.play(), 0.95);
    },
    { dependencies: [value], revertOnUpdate: true },
  );

  return <span ref={ref}>{text(value)}</span>;
}
