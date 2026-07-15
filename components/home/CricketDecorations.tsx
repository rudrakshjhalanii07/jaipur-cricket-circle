"use client";

/* ============================================================
   Cricket-themed decorative SVG components
   All pure CSS/SVG — no external images or heavy libraries
   ============================================================ */

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
            <stop offset="50%" stopColor="var(--jcc-accent)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
