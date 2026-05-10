"use client";

import { motion } from "framer-motion";

/* ============================================================
   Cricket-themed decorative SVG components
   All pure CSS/SVG — no external images or heavy libraries
   ============================================================ */

// ---- Floating Cricket Ball ----
export function FloatingCricketBall({
  size = 48,
  className = "",
  delay = 0,
}: {
  size?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 1.2, ease: "easeOut" }}
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className="animate-drift"
      >
        {/* Ball body */}
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="url(#ballGrad)"
          stroke="rgba(200,60,60,0.15)"
          strokeWidth="0.5"
        />
        {/* Seam line - primary */}
        <path
          d="M 8 24 C 16 14, 32 14, 40 24"
          stroke="rgba(180,60,60,0.25)"
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 8 24 C 16 34, 32 34, 40 24"
          stroke="rgba(180,60,60,0.25)"
          strokeWidth="0.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Seam stitches */}
        {[13, 18, 23, 28, 33].map((x) => (
          <line
            key={x}
            x1={x}
            y1="19"
            x2={x + 1}
            y2="21"
            stroke="rgba(180,60,60,0.2)"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
        ))}
        <defs>
          <radialGradient id="ballGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#FF4D4D" />
            <stop offset="100%" stopColor="#800000" />
          </radialGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

// ---- Pitch Divider ----
export function PitchDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`pitch-divider ${className}`} aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="url(#pitchGlow)"
          strokeWidth="1"
        />
        <defs>
          <linearGradient id="pitchGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="var(--jcc-cyan)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ---- Stump Accent ----
export function StumpAccent({
  className = "",
  color = "var(--jcc-turf)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {[20, 26, 20].map((h, i) => (
        <div
          key={i}
          className="rounded-t-sm"
          style={{
            width: 3,
            height: h,
            background: color,
            opacity: 0.2 + i * 0.1,
          }}
        />
      ))}
      {/* Bail */}
      <div
        className="absolute -top-[2px] rounded-full"
        style={{
          width: 14,
          height: 2,
          background: color,
          opacity: 0.25,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}

// ---- Scoreboard Pill ----
export function ScoreboardPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      className="stat-pill"
    >
      {icon && <span className="text-jcc-blue">{icon}</span>}
      <span className="stat-value">{value}</span>
      <span className="text-jcc-muted text-[11px]">{label}</span>
    </motion.div>
  );
}

// ---- Light Rays ----
export function LightRays({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {[
        { left: "15%", height: "60%", delay: "0s", opacity: 0.15 },
        { left: "35%", height: "45%", delay: "2s", opacity: 0.1 },
        { left: "55%", height: "55%", delay: "1s", opacity: 0.2 },
        { left: "75%", height: "40%", delay: "3s", opacity: 0.1 },
        { left: "90%", height: "50%", delay: "1.5s", opacity: 0.15 },
      ].map((ray, i) => (
        <div
          key={i}
          className="light-ray"
          style={{
            left: ray.left,
            height: ray.height,
            opacity: ray.opacity,
            animationDelay: ray.delay,
            background: i % 2 === 0 ? "linear-gradient(180deg, var(--jcc-cyan), transparent)" : "linear-gradient(180deg, var(--jcc-electric), transparent)"
          }}
        />
      ))}
    </div>
  );
}

// ---- Dot Grid Background ----
export function DotGrid({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 dot-pattern opacity-40 pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}

// ---- Floating Particles ----
// Deterministic particle positions to avoid impure Math.random in render
const PARTICLE_PRESETS = [
  { left: "12%", size: 4, duration: 10, delay: 0.5 },
  { left: "28%", size: 5, duration: 14, delay: 2.0 },
  { left: "42%", size: 3, duration: 9, delay: 1.2 },
  { left: "56%", size: 6, duration: 16, delay: 3.5 },
  { left: "68%", size: 4, duration: 11, delay: 0.8 },
  { left: "78%", size: 5, duration: 13, delay: 4.0 },
  { left: "35%", size: 3, duration: 18, delay: 2.5 },
  { left: "85%", size: 4, duration: 12, delay: 1.8 },
];

const PARTICLE_COLORS = [
  "rgba(0, 210, 255, 0.3)",
  "rgba(91, 140, 255, 0.2)",
  "rgba(57, 255, 136, 0.15)",
];

export function FloatingParticles({
  count = 8,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {PARTICLE_PRESETS.slice(0, count).map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: p.left,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            background: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
