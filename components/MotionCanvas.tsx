"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring, motion } from "framer-motion";

// ── Particle system ───────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  opacity: number;
}

const PARTICLE_COLORS = [
  "rgba(20,184,255,0.6)",   // accent blue
  "rgba(34,197,94,0.5)",    // turf green
  "rgba(255,215,0,0.4)",    // gold
  "rgba(255,255,255,0.25)", // white
];

function useParticles(count = 22): Particle[] {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const ps: Particle[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 1,
        duration: Math.random() * 12 + 8,
        delay: Math.random() * 10,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        opacity: Math.random() * 0.5 + 0.2,
      }));
      setParticles(ps);
    });
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return particles;
}

// ── Mouse parallax hook ───────────────────────────────────────────────────────
function useMouseParallax() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 30, damping: 30, mass: 0.8 });
  const smoothY = useSpring(mouseY, { stiffness: 30, damping: 30, mass: 0.8 });

  useEffect(() => {
    // Mouse parallax is a desktop-only flourish — skip the listener entirely on
    // touch / coarse-pointer devices to avoid needless main-thread work.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const handler = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseX.set(nx);
      mouseY.set(ny);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  return { smoothX, smoothY };
}

// ── Stadium sweep lights ──────────────────────────────────────────────────────
function StadiumSweep({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`absolute top-0 ${isLeft ? "left-0" : "right-0"} w-[45vw] h-[70vh] pointer-events-none`}
      style={{
        background: isLeft
          ? "conic-gradient(from 250deg at 0% 0%, transparent 0deg, rgba(20,184,255,0.07) 18deg, transparent 28deg)"
          : "conic-gradient(from 280deg at 100% 0%, transparent 0deg, rgba(20,184,255,0.06) 18deg, transparent 28deg)",
        filter: "blur(18px)",
      }}
    >
      <div
        className={`w-full h-full ${isLeft ? "animate-stadium-sweep-left" : "animate-stadium-sweep-right"}`}
        style={{
          background: isLeft
            ? "linear-gradient(160deg, rgba(20,184,255,0.12) 0%, transparent 60%)"
            : "linear-gradient(200deg, rgba(20,184,255,0.10) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MotionCanvas() {
  const particles = useParticles(18);
  const { smoothX, smoothY } = useMouseParallax();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Decorative-only background — defer mounting until the browser is idle so it
  // never competes with the hero for the critical first-paint path.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined;
    if (ric) {
      const id = ric(() => setReady(true));
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <div
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Stadium sweep lights */}
      <StadiumSweep side="left" />
      <StadiumSweep side="right" />

      {/* Parallax ambient blobs */}
      <motion.div
        className="absolute inset-0"
        style={{
          x: smoothX,
          y: smoothY,
        }}
      >
        {/* Primary radial glow — top center */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: "5%",
            left: "35%",
            width: "50vw",
            height: "40vh",
            background: "radial-gradient(ellipse, rgba(20,184,255,0.07) 0%, transparent 70%)",
            x: smoothX,
            y: smoothY,
            translateX: "-50%",
          }}
        />

        {/* Secondary green glow — bottom right */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            bottom: "15%",
            right: "10%",
            width: "30vw",
            height: "30vh",
            background: "radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%)",
            x: smoothX,
            y: smoothY,
            scale: 0.7,
          }}
        />
      </motion.div>

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-particle-rise"
          style={{
            left: `${p.x}%`,
            bottom: `${p.y % 30}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            filter: "blur(0.5px)",
          }}
        />
      ))}

      {/* Horizontal scan line — very subtle */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "40%",
          background: "linear-gradient(90deg, transparent 0%, rgba(20,184,255,0.06) 30%, rgba(20,184,255,0.06) 70%, transparent 100%)",
        }}
      />
    </div>
  );
}
