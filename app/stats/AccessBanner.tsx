"use client";

// The countdown a 14-day member sees on /stats. Dismissable for the visit; it
// comes back on the next load so the deadline is never a surprise.

import { useState } from "react";
import { Clock, X } from "lucide-react";

export default function AccessBanner({ daysLeft, endsAt }: { daysLeft: number; endsAt: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const day = new Date(endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-jcc-accent/40 bg-[#0D1728]/95 px-4 py-3 shadow-[0_12px_40px_-10px_rgba(13,23,40,0.6)] backdrop-blur-md">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-jcc-accent/15">
          <Clock className="h-4 w-4 text-jcc-accent" />
        </span>
        <p className="flex-1 text-xs leading-snug" style={{ color: "rgba(255,255,255,0.8)" }}>
          <b className="font-black" style={{ color: "#FFFFFF" }}>
            {daysLeft} {daysLeft === 1 ? "day" : "days"} of stats access left
          </b>{" "}
          — member access lasts 14 days from first login and ends on {day}.
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Dismiss" className="shrink-0 p-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
