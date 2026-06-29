"use client";

import { useRouter, usePathname } from "next/navigation";
import { useScrollContext, NAV_ROUTES } from "./ScrollSystem";

export default function SectionProgress() {
  const { charge } = useScrollContext();
  const pathname = usePathname();
  const router = useRouter();
  const activeIdx = NAV_ROUTES.findIndex((r) => r.href === pathname);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch pointer-events-none"
      style={{ height: 3, gap: 2, padding: "0 2px" }}
    >
      {NAV_ROUTES.map(({ href, label }, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const fillPct = isPast ? 100 : isActive ? charge * 100 : 0;

        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            title={label}
            aria-label={`Go to ${label}`}
            className="flex-1 relative pointer-events-auto rounded-full overflow-hidden"
            style={{ background: "rgba(237,227,206,0.10)", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div
              className="absolute inset-y-0 left-0 right-0 rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--jcc-accent), var(--jcc-gold))",
                boxShadow: isActive && charge > 0.05 ? "0 0 6px var(--jcc-accent)" : "none",
                transform: `scaleX(${fillPct / 100})`,
                transformOrigin: "left",
                transition: isActive ? "none" : "transform 0.3s ease",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
