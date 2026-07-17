"use client";

import { useEffect, useState } from "react";

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { diff, days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

// Live day/hr/min/sec countdown to a target timestamp. Calls onComplete once
// when the target is reached (guarded so it fires exactly once).
export default function AuctionCountdown({
  target,
  onComplete,
  accentClassName = "text-jcc-accent",
}: {
  target: string;
  onComplete?: () => void;
  /** Digit color class — defaults to the JCC template's accent token. */
  accentClassName?: string;
}) {
  const targetMs = new Date(target).getTime();
  const [remaining, setRemaining] = useState(() => getRemaining(targetMs));

  useEffect(() => {
    let fired = false;
    const interval = setInterval(() => {
      const next = getRemaining(targetMs);
      setRemaining(next);
      if (next.diff <= 0 && !fired) {
        fired = true;
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs, onComplete]);

  const units = [
    { label: "Days", value: remaining.days },
    { label: "Hours", value: remaining.hours },
    { label: "Minutes", value: remaining.minutes },
    { label: "Seconds", value: remaining.seconds },
  ];

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center">
            <span className={`score-number tabular-nums text-[clamp(2.25rem,7vw,4.5rem)] font-black leading-none ${accentClassName}`}>
              {pad(u.value)}
            </span>
            <span className="mt-2 text-[10px] sm:text-xs font-black tracking-[0.35em] uppercase text-white/40">
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="text-2xl sm:text-4xl font-black text-white/15 -mt-4">:</span>
          )}
        </div>
      ))}
    </div>
  );
}
