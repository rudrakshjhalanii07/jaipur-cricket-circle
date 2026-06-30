"use client";

import { useEffect, useRef } from "react";

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  /** Delay before the visible class is applied (ms) */
  delay?: number;
  /** Initial transform direction */
  direction?: "up" | "left" | "right" | "scale";
}

const DIRECTION_CLASS: Record<NonNullable<AnimateInProps["direction"]>, string> = {
  up: "",
  left: "anim-from-left",
  right: "anim-from-right",
  scale: "anim-scale-in",
};

export function AnimateIn({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (delay) {
          setTimeout(() => el.classList.add("anim-visible"), delay);
        } else {
          el.classList.add("anim-visible");
        }
        obs.disconnect();
      },
      { threshold: 0.1, rootMargin: "-60px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  const dirClass = DIRECTION_CLASS[direction];
  return (
    <div ref={ref} className={`anim-fade-up ${dirClass} ${className}`}>
      {children}
    </div>
  );
}
