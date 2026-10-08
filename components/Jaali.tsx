"use client";

import { useId, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A carved stone screen in the manner of the Hawa Mahal and City Palace
 * jaalis: 8-point stars (a square over a diamond) with a rosette at the heart,
 * arms that run on into the next star, and a small diamond where four meet.
 *
 * Drawn as faint gold hairlines on a Royal Blue band, faded toward the edges,
 * with a slow pool of light drifting across it like sun through a palace
 * window. Sits behind content: give the parent `relative` and the content
 * `relative` too.
 */
export default function Jaali({
  className = "",
  fade = "0.72 0.3",
  intensity = 1,
  weight = 1,
  drift = [0.8, 0.2, 0.2, 0.8],
}: {
  className?: string;
  fade?: string;
  /** Multiplies the pattern's opacity; 1 is the stats page's faint default. */
  intensity?: number;
  /** Multiplies the line thickness. */
  weight?: number;
  /** Path of the drifting light, as fractions of the box: [fromX, fromY, toX, toY]. */
  drift?: [number, number, number, number];
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const light = useRef<SVGRadialGradientElement>(null);
  const [fx, fy] = fade.split(" ");

  useGSAP(() => {
    if (reduceMotion() || !light.current) return;
    const [x0, y0, x1, y1] = drift;
    gsap.fromTo(light.current, { attr: { cx: x0, cy: y0 } }, { attr: { cx: x1, cy: y1 }, duration: 18, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }, { dependencies: drift });

  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <defs>
        <pattern id={`${id}p`} width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="scale(1.35)">
          <g fill="none" stroke="#D4AF37" strokeWidth={0.7 * weight} strokeLinejoin="round">
            {/* the star: a square over a diamond */}
            <rect x="16" y="16" width="24" height="24" />
            <path d="M28 11 L45 28 L28 45 L11 28 Z" />
            {/* rosette */}
            <circle cx="28" cy="28" r="5" />
            <circle cx="28" cy="28" r="1.4" fill="#D4AF37" />
            {/* arms into the neighbouring stars */}
            <path d="M28 0 V11 M28 45 V56 M0 28 H11 M45 28 H56" />
            {/* quarter-diamonds; four tiles make one where the arms cross */}
            <path d="M7 0 L0 7 M49 0 L56 7 M56 49 L49 56 M0 49 L7 56" />
          </g>
        </pattern>
        <radialGradient id={`${id}f`} cx={fx} cy={fy} r="0.85">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}m`}>
          <rect width="100%" height="100%" fill={`url(#${id}f)`} />
        </mask>
        <radialGradient ref={light} id={`${id}l`} cx={drift[0]} cy={drift[1]} r="0.32">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}lm`}>
          <rect width="100%" height="100%" fill={`url(#${id}l)`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}p)`} mask={`url(#${id}m)`} opacity={Math.min(1, 0.16 * intensity)} />
      <rect width="100%" height="100%" fill={`url(#${id}p)`} mask={`url(#${id}lm)`} opacity={Math.min(1, 0.32 * intensity)} />
    </svg>
  );
}
