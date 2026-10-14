"use client";

// The floating trophy, pointed at /stats — leaderboards, the points table and
// every player card. It wears the same look as FloatingMatchButton, whose
// registration panel is parked while /register is hidden; that component is
// left untouched so it can come back with registration.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

export default function FloatingStatsButton() {
  const pathname = usePathname();
  // No point offering the page you're already on.
  if (pathname === "/stats" || pathname?.startsWith("/stats/")) return null;

  return (
    <div className="group fixed bottom-20 right-4 z-50 sm:bottom-24 sm:right-6">
      {/* Label slides out on hover (desktop) so the trophy says where it goes. */}
      <span className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-full border border-jcc-accent/30 bg-jcc-navy px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-jcc-blue opacity-0 shadow-lg transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
        Stats &amp; standings
      </span>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        whileTap={{ scale: 0.97 }}
      >
        <Link
          href="/stats"
          aria-label="Stats and standings"
          className="theme-static-dark relative flex h-12 w-12 items-center justify-center rounded-full border bg-jcc-blue shadow-[0_6px_20px_rgba(18,35,63,0.28)] transition-shadow duration-500 ease-out hover:shadow-[0_10px_30px_rgba(212,175,55,0.35)] sm:h-14 sm:w-14"
          style={{ borderColor: "color-mix(in srgb, var(--color-jcc-accent) 40%, transparent)" }}
        >
          <Trophy className="h-5 w-5 text-jcc-accent transition-transform duration-300 group-hover:scale-110 sm:h-6 sm:w-6" />
        </Link>
      </motion.div>
    </div>
  );
}
