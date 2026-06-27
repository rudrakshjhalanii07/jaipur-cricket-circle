"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useScrollContext } from "./ScrollSystem";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { transitioning } = useScrollContext();

  // On the very first render (SSR + initial hydration) we must NOT gate the
  // content behind opacity:0 — framer-motion inlines that style into the
  // server HTML, making the LCP <h1> invisible until hydration finishes, which
  // tanks LCP. So skip the entrance animation on first paint (initial=false →
  // server HTML renders at opacity:1) and only enable the fade once mounted,
  // so subsequent client-side navigations still transition.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Wrapped in rAF to defer the state update out of the effect body (matches
    // the project's lint convention for set-state-in-effect).
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <motion.div
        key={pathname}
        initial={mounted ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>

      <AnimatePresence>
        {transitioning && (
          <motion.div
            className="fixed inset-0 z-[90] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            style={{ background: "var(--jcc-bg)" }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
