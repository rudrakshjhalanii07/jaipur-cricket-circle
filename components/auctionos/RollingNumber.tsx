"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";

// Restrained odometer-style bid counter: the displayed number tweens toward
// the new value (no per-digit flip theatrics) with a brief glow pulse on
// change — reads as a quiet, prestige "the number just moved", not a
// gambling/slot-machine effect. `format` and `glowClassName` are supplied by
// the template so this stays currency/theme-agnostic.
export default function RollingNumber({
  value,
  format,
  className = "",
  glowShadow = "0 0 24px rgba(212,175,55,0.55)",
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  glowShadow?: string;
}) {
  const [displayed, setDisplayed] = useState(value);
  const [pulseKey, setPulseKey] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;
    const from = prevValue.current;
    prevValue.current = value;
    const controls = animate(from, value, {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplayed(v),
    });
    setPulseKey((k) => k + 1);
    return () => controls.stop();
  }, [value]);

  return (
    <motion.span
      key={pulseKey}
      initial={{ textShadow: glowShadow }}
      animate={{ textShadow: "0 0 0 rgba(212,175,55,0)" }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={`score-number tabular-nums ${className}`}
    >
      {format(Math.round(displayed))}
    </motion.span>
  );
}
