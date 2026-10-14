"use client";

// The site's scroll choreography. Wrap a page (or a run of server-rendered
// sections) and mark elements up — the markup stays on the server and this one
// client island animates it.
//
//   data-reveal            rises and fades in when it scrolls into view
//   data-reveal-stagger    its direct children do the same, one after another
//   data-split             headline: words rise out of a mask, one by one
//   data-split="chars"     … letter by letter (short display lines only)
//   data-count             counts up to its own number ("1,284", "75+", "4.2")
//   data-parallax="0.2"    drifts against the scroll (fraction of its height)
//   data-panel             a band that grows from an inset rounded panel
//   data-draw              SVG paths trace themselves in
//   data-wipe              an image/plate unveiled by a clip-path wipe
//   data-bar               a bar that grows from its start (data-origin=right flips it)
//   data-skew              leans into fast scrolling, settles when it stops
//   data-rail              desktop: pins, and vertical scroll drives the
//                          [data-rail-track] inside it sideways
//
// Everything uses explicit end states (fromTo / clearProps) so a re-run can
// never strand an element half-hidden, and everything is skipped under
// prefers-reduced-motion.

import { useRef } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP, reduceMotion } from "@/components/motion/gsap";

export default function RevealMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reduceMotion()) return;
      const q = gsap.utils.selector(root);
      const cleanups: (() => void)[] = [];

      for (const el of q("[data-reveal]")) {
        gsap.fromTo(
          el,
          { y: 48, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: "expo.out", clearProps: "transform,opacity", scrollTrigger: { trigger: el, start: "top 90%", once: true } },
        );
      }

      for (const group of q("[data-reveal-stagger]")) {
        gsap.fromTo(
          group.children,
          { y: 40, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "expo.out",
            stagger: 0.07,
            clearProps: "transform,opacity",
            scrollTrigger: { trigger: group, start: "top 88%", once: true },
          },
        );
      }

      // Headlines split once the display font has landed, so lines break
      // where they will finally sit. autoSplit re-splits on resize.
      const splits = q("[data-split]");
      if (splits.length) {
        let alive = true;
        document.fonts.ready.then(() => {
          if (!alive) return;
          for (const el of splits) {
            const chars = (el as HTMLElement).dataset.split === "chars";
            const st = SplitText.create(el, {
              type: chars ? "words,chars" : "words",
              mask: chars ? "chars" : "words",
              autoSplit: true,
              onSplit: (self) =>
                gsap.fromTo(
                  chars ? self.chars : self.words,
                  { yPercent: 110, rotate: chars ? 0 : 4 },
                  {
                    yPercent: 0,
                    rotate: 0,
                    duration: chars ? 1 : 1.15,
                    ease: "expo.out",
                    stagger: chars ? 0.022 : 0.06,
                    scrollTrigger: { trigger: el, start: "top 88%", once: true },
                  },
                ),
            });
            cleanups.push(() => st.revert());
          }
        });
        cleanups.push(() => {
          alive = false;
        });
      }

      for (const el of q("[data-count]")) {
        const text = el.textContent ?? "";
        const m = text.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
        if (!m) continue;
        const [, pre, num, post] = m;
        const decimals = num.includes(".") ? num.split(".")[1].length : 0;
        const comma = num.includes(",");
        const target = Number(num.replace(/,/g, ""));
        const fmt = (n: number) => {
          const s = n.toFixed(decimals);
          return comma ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s;
        };
        const state = { n: 0 };
        el.textContent = `${pre}${fmt(0)}${post}`;
        gsap.to(state, {
          n: target,
          duration: 1.8,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
          onUpdate: () => {
            el.textContent = `${pre}${fmt(state.n)}${post}`;
          },
        });
      }

      for (const el of q("[data-parallax]")) {
        const amount = Number((el as HTMLElement).dataset.parallax) || 0.2;
        gsap.fromTo(
          el,
          { yPercent: amount * 50 },
          { yPercent: -amount * 100, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
        );
      }

      for (const el of q("[data-panel]")) {
        gsap.fromTo(
          el,
          { clipPath: "inset(6% 4% 0% 4% round 48px)" },
          { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 30%", scrub: 0.5 } },
        );
      }

      for (const el of q("[data-wipe]")) {
        gsap.fromTo(
          el,
          { clipPath: "inset(0 0 100% 0)", scale: 1.08 },
          { clipPath: "inset(0 0 0% 0)", scale: 1, duration: 1.6, ease: "expo.inOut", clearProps: "clipPath,transform", scrollTrigger: { trigger: el, start: "top 85%", once: true } },
        );
      }

      for (const el of q("[data-bar]")) {
        gsap.fromTo(
          el,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: (el as HTMLElement).dataset.origin === "right" ? "right center" : "left center",
            duration: 1.5,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          },
        );
      }

      for (const svg of q("[data-draw]")) {
        const paths = svg.querySelectorAll<SVGGeometryElement>("path, line, circle, ellipse, rect, polyline");
        paths.forEach((p) => {
          const len = p.getTotalLength();
          gsap.fromTo(
            p,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", scrollTrigger: { trigger: svg, start: "top 85%", once: true } },
          );
        });
      }

      // One velocity reader for every leaning headline.
      const skews = q("[data-skew]");
      if (skews.length) {
        const set = gsap.quickTo(skews, "skewY", { duration: 0.6, ease: "power3.out" });
        const clamp = gsap.utils.clamp(-6, 6);
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => set(clamp(self.getVelocity() / -400)),
        });
      }

      // Horizontal rails pin on wide screens only; phones keep a native swipe.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        for (const rail of q("[data-rail]")) {
          const track = rail.querySelector<HTMLElement>("[data-rail-track]");
          if (!track) continue;
          const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 48);
          gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: { trigger: rail, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
          });
        }
      });

      // Content that grows after load (tabs, images) keeps triggers honest.
      let pending: gsap.core.Tween | undefined;
      const ro = new ResizeObserver(() => {
        pending?.kill();
        pending = gsap.delayedCall(0.3, () => ScrollTrigger.refresh());
      });
      if (root.current) ro.observe(root.current);

      return () => {
        ro.disconnect();
        mm.revert();
        cleanups.forEach((c) => c());
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
