"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useScrollContext } from "./ScrollSystem";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { transitioning } = useScrollContext();

  return (
    <>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
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
