"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A carved stone screen in the manner of the Hawa Mahal and City Palace
 * jaalis: 8-point stars (a square over a diamond) with a rosette at the heart,
 * arms that run on into the next star, and a small diamond where four meet.
 *
 * Drawn as faint gold hairlines on a Royal Blue band, faded toward the edges,
 * with a slow pool of light drifting across it like sun through a palace
 * window. Sits behind content: give the parent `relative` and the content
 * `relative` too.
 *
 * Performance: the light used to move by tweening an SVG gradient's cx/cy,
 * which repainted the whole patterned, masked SVG on the main thread every
 * frame — it halved the frame rate of every page that had one. Now the pool
 * of light is a soft-edged window holding a brighter copy of the lattice: the
 * window slides one way and the lattice inside it slides back the other, so
 * the pattern stays put while the light moves. Both moves are transforms run
 * by the Web Animations API, so the compositor does them without repainting.
 */

/** Radius of the pool of light, as a fraction of the box (as the old r=0.32). */
const R = 0.32;
const D = 2 * R;

function Lattice({ id, weight, opacity, mask }: { id: string; weight: number; opacity: number; mask?: React.ReactNode }) {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full">
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
        {mask}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}p)`} mask={mask ? `url(#${id}m)` : undefined} opacity={opacity} />
    </svg>
  );
}

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
  const windowRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fx, fy] = fade.split(" ");
  const [x0, y0, x1, y1] = drift;

  useEffect(() => {
    const w = windowRef.current;
    const inner = innerRef.current;
    if (!w || !inner || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Window: moves by the drift, in units of its own size (D of the box).
    // Lattice inside: the same distance back, in units of the box.
    const opts: KeyframeAnimationOptions = { duration: 18000, easing: "ease-in-out", direction: "alternate", iterations: Infinity };
    const a = w.animate(
      [{ transform: "translate(0, 0)" }, { transform: `translate(${((x1 - x0) / D) * 100}%, ${((y1 - y0) / D) * 100}%)` }],
      opts,
    );
    const b = inner.animate(
      [{ transform: "translate(0, 0)" }, { transform: `translate(${-(x1 - x0) * 100}%, ${-(y1 - y0) * 100}%)` }],
      opts,
    );
    return () => {
      a.cancel();
      b.cancel();
    };
  }, [x0, y0, x1, y1]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* The faint screen, faded toward the edges. */}
      <Lattice
        id={`${id}a`}
        weight={weight}
        opacity={Math.min(1, 0.16 * intensity)}
        mask={
          <>
            <radialGradient id={`${id}af`} cx={fx} cy={fy} r="0.85">
              <stop offset="0" stopColor="#fff" stopOpacity="1" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id={`${id}am`}>
              <rect width="100%" height="100%" fill={`url(#${id}af)`} />
            </mask>
          </>
        }
      />
      {/* The pool of light: a soft window onto a brighter copy. */}
      <div
        ref={windowRef}
        className="absolute will-change-transform"
        style={{
          left: `${(x0 - R) * 100}%`,
          top: `${(y0 - R) * 100}%`,
          width: `${D * 100}%`,
          height: `${D * 100}%`,
          maskImage: "radial-gradient(closest-side, #000, transparent)",
          WebkitMaskImage: "radial-gradient(closest-side, #000, transparent)",
        }}
      >
        <div
          ref={innerRef}
          className="absolute will-change-transform"
          style={{ left: `${(-(x0 - R) / D) * 100}%`, top: `${(-(y0 - R) / D) * 100}%`, width: `${100 / D}%`, height: `${100 / D}%` }}
        >
          <Lattice id={`${id}b`} weight={weight} opacity={Math.min(1, 0.32 * intensity)} />
        </div>
      </div>
    </div>
  );
}
