"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOADER_DURATION_MS = 2000;

export default function LoaderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default false so SSR HTML never includes the overlay — LCP element is
  // immediately visible in the static HTML. The intro fires only on the
  // client, on every full page load/reload (this component only remounts
  // on a hard navigation, not client-side route changes within the app).
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), LOADER_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none"
            style={{ background: "var(--jcc-bg)" }}
          >
            <motion.img
              src="/jcc_logo.png"
              alt="Jaipur Cricket Circle"
              width={280}
              height={280}
              className="object-contain"
              style={{
                width: 280,
                height: 280,
                filter:
                  "drop-shadow(0 6px 22px color-mix(in srgb, var(--jcc-accent) 35%, transparent))",
              }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            />

            {/* JCC — gold, luxury display serif */}
            <motion.span
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
              style={{
                marginTop: 14,
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "2.75rem",
                letterSpacing: "0.08em",
                color: "var(--jcc-accent)",
              }}
            >
              JCC
            </motion.span>

            {/* Glowing progress bar, timed to the loader's full duration */}
            <div
              className="mt-8"
              style={{
                width: 160,
                height: 2,
                borderRadius: 2,
                background: "var(--jcc-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  background:
                    "linear-gradient(90deg, var(--jcc-accent), var(--jcc-gold))",
                  boxShadow: "0 0 10px var(--jcc-accent)",
                  transformOrigin: "left",
                  animation: `loader-progress ${LOADER_DURATION_MS}ms linear forwards`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content renders immediately at full opacity so the LCP element paints
          right away — the intro overlay simply sits on top and fades out. */}
      {children}
    </>
  );
}
