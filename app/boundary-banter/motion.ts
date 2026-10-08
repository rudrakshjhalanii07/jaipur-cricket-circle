"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

export const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Runs `fn` the first time `el` comes within `line` (a fraction of the
 * viewport height), or straight away if it is already there or above it.
 * An IntersectionObserver rather than a ScrollTrigger, so it can't go stale
 * as more weeks are appended below. Returns a cancel function.
 */
export function whenSeen(el: Element, fn: () => void, line = 0.9) {
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
 * Calls `cb` once the site's intro loader (LoaderWrapper, shown on every hard
 * load) has gone, so an entrance isn't spent underneath it. The loader mounts
 * in a passive effect after ours run, hence the short wait before looking.
 * Returns a cancel function.
 */
export function afterLoader(cb: () => void) {
  const present = () => !!document.querySelector('div.fixed > img[src="/jcc_logo.png"]');
  let mo: MutationObserver | undefined;
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    mo?.disconnect();
    cb();
  };
  const t = window.setTimeout(() => {
    if (!present()) return fire();
    mo = new MutationObserver(() => !present() && fire());
    mo.observe(document.body, { childList: true, subtree: true });
  }, 80);
  return () => {
    done = true;
    window.clearTimeout(t);
    mo?.disconnect();
  };
}
