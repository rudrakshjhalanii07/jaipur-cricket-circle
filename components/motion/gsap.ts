"use client";

// One place that registers GSAP's plugins for the whole site. Import gsap and
// friends from here rather than from "gsap" directly, so a plugin is never
// used before it has been registered.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

export { gsap, ScrollTrigger, SplitText, useGSAP };

export const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fine pointer (mouse/trackpad) and motion allowed: the hover effects' audience. */
export const finePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches && !reduceMotion();
