"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CricketBall = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28">
    <defs>
      <radialGradient id="cb-base" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="color-mix(in srgb, var(--jcc-accent) 55%, white)" />
        <stop offset="50%" stopColor="var(--jcc-accent)" />
        <stop offset="100%" stopColor="color-mix(in srgb, var(--jcc-accent) 50%, black)" />
      </radialGradient>
      <filter id="cb-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <circle cx="14" cy="14" r="13" fill="url(#cb-base)" filter="url(#cb-glow)" />
    {/* Seam curves */}
    <path d="M 2 14 C 6 8, 22 8, 26 14" stroke="rgba(237,227,206,0.85)" strokeWidth="1" fill="none" strokeLinecap="round" />
    <path d="M 2 14 C 6 20, 22 20, 26 14" stroke="rgba(237,227,206,0.85)" strokeWidth="1" fill="none" strokeLinecap="round" />
    {/* Seam stitches */}
    {[5, 9, 13, 15, 19, 23].map((x) => (
      <line key={x} x1={x} y1="10" x2={x} y2="12.5" stroke="rgba(237,227,206,0.55)" strokeWidth="0.75" strokeLinecap="round" />
    ))}
    {[5, 9, 13, 15, 19, 23].map((x) => (
      <line key={`b${x}`} x1={x} y1="15.5" x2={x} y2="18" stroke="rgba(237,227,206,0.55)" strokeWidth="0.75" strokeLinecap="round" />
    ))}
  </svg>
);

export default function LoaderWrapper({ children }: { children: React.ReactNode }) {
  // Default false so SSR HTML never includes the overlay — LCP element is
  // immediately visible in the static HTML.  The intro fires only on the
  // client, only on the first visit of the session.
  const [loading, setLoading] = useState(false);
  const [ballActive, setBallActive] = useState(false);
  const [impacted, setImpacted] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    // Skip intro entirely if already seen this session.
    if (sessionStorage.getItem("jcc_intro_seen")) return;

    setLoading(true);

    const t1 = setTimeout(() => setBallActive(true), 80);
    const t2 = setTimeout(() => setImpacted(true), 260);
    const t3 = setTimeout(() => setShowLogo(true), 320);
    const t4 = setTimeout(() => {
      setLoading(false);
      sessionStorage.setItem("jcc_intro_seen", "1");
    }, 600);

    return () => {
      [t1, t2, t3, t4].forEach(clearTimeout);
    };
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
            {/* Subtle cricket field pattern */}
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }}>
              <svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
                <ellipse cx="200" cy="250" rx="188" ry="188" fill="none" stroke="var(--jcc-seam)" strokeWidth="1.5" />
                <ellipse cx="200" cy="250" rx="118" ry="118" fill="none" stroke="var(--jcc-seam)" strokeWidth="1" />
                <rect x="175" y="70" width="50" height="360" fill="none" stroke="var(--jcc-green)" strokeWidth="1.2" rx="2" />
                <line x1="175" y1="250" x2="225" y2="250" stroke="var(--jcc-seam)" strokeWidth="1" />
                <ellipse cx="200" cy="258" rx="25" ry="9" fill="none" stroke="var(--jcc-seam)" strokeWidth="0.8" />
              </svg>
            </div>

            {/* Ambient accent glow */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: 520,
                height: 520,
                background: "radial-gradient(circle, var(--jcc-accent) 0%, transparent 68%)",
                filter: "blur(90px)",
              }}
              animate={{ opacity: impacted ? 0.22 : 0.07, scale: impacted ? 1.12 : 1 }}
              transition={{ duration: 0.35 }}
            />

            {/* ── SCENE ── */}
            {/* 240×200 scene container; all children absolutely positioned within */}
            <div className="relative flex-shrink-0" style={{ width: 240, height: 200 }}>

              {/* Impact burst ring — expands and fades on wicket */}
              <AnimatePresence>
                {impacted && (
                  <motion.div
                    key="burst"
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 64, height: 64,
                      top: "50%", left: "50%",
                      marginTop: -32, marginLeft: -32,
                      border: "2px solid var(--jcc-accent)",
                    }}
                    initial={{ scale: 0.2, opacity: 0.95 }}
                    animate={{ scale: 4.5, opacity: 0 }}
                    exit={{}}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              {/* Second, faster inner burst */}
              <AnimatePresence>
                {impacted && (
                  <motion.div
                    key="burst2"
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 40, height: 40,
                      top: "50%", left: "50%",
                      marginTop: -20, marginLeft: -20,
                      background: "var(--jcc-accent)",
                    }}
                    initial={{ scale: 0.1, opacity: 0.55 }}
                    animate={{ scale: 3, opacity: 0 }}
                    exit={{}}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              {/* ── STUMPS SVG (120×130, centered, at bottom) ── */}
              <svg
                className="absolute bottom-0 left-1/2 -translate-x-1/2"
                width="120"
                height="130"
                viewBox="0 0 120 130"
                overflow="visible"
              >
                {/* Ground shadow ellipse */}
                <ellipse cx="60" cy="125" rx="54" ry="5" fill="rgba(0,0,0,0.2)" />
                {/* Crease line */}
                <line x1="0" y1="120" x2="120" y2="120" stroke="var(--jcc-seam)" strokeWidth="1.5" strokeOpacity="0.28" />

                {/* Three stumps — rise from crease with spring bounce */}
                {[20, 60, 100].map((cx, i) => (
                  <motion.rect
                    key={i}
                    x={cx - 5}
                    y={24}
                    width={10}
                    height={96}
                    rx={4}
                    fill="var(--jcc-text-soft)"
                    style={{ transformBox: "fill-box", transformOrigin: "bottom center" }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: 0.08 + i * 0.12,
                      duration: 0.6,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                  />
                ))}

                {/* Bail 1 — leg to mid stump */}
                <motion.rect
                  x="14" y="18" width="52" height="8" rx="3.5"
                  fill="var(--jcc-text-soft)"
                  style={{ transformBox: "fill-box", transformOrigin: "center center" }}
                  initial={{ opacity: 0 }}
                  animate={
                    impacted
                      ? { opacity: [1, 0], y: -58, x: -28, rotate: 145 }
                      : { opacity: 1, y: 0, x: 0, rotate: 0 }
                  }
                  transition={
                    impacted
                      ? { duration: 0.45, ease: [0.22, 0, 0.36, 1] }
                      : { delay: 0.48, duration: 0.22 }
                  }
                />

                {/* Bail 2 — mid to off stump */}
                <motion.rect
                  x="54" y="18" width="52" height="8" rx="3.5"
                  fill="var(--jcc-text-soft)"
                  style={{ transformBox: "fill-box", transformOrigin: "center center" }}
                  initial={{ opacity: 0 }}
                  animate={
                    impacted
                      ? { opacity: [1, 0], y: -68, x: 38, rotate: -118 }
                      : { opacity: 1, y: 0, x: 0, rotate: 0 }
                  }
                  transition={
                    impacted
                      ? { duration: 0.42, ease: [0.22, 0, 0.36, 1] }
                      : { delay: 0.52, duration: 0.22 }
                  }
                />
              </svg>

              {/* ── CRICKET BALL — swing in from upper-right ── */}
              {/*
                Container: 240×200
                SVG: 120px wide, left edge at (240-120)/2 = 60px
                Off stump center: x=100 in SVG → 160px from container left
                Ball (28px): left = 160-14 = 146px → right = 240-146-28 = 66px
                Bail top: SVG y=18, SVG at bottom → 200-130+18 = 88px from top
                Ball centered at bail: top = 88-14 = 74px
                Initial transform: x=180 (right), y=-114 (above) puts ball at:
                  left = 146+180 = 326px (off right edge), top = 74-114 = -40px (above)
              */}
              <AnimatePresence>
                {ballActive && !impacted && (
                  <motion.div
                    key="ball"
                    className="absolute pointer-events-none"
                    style={{ right: 66, top: 74 }}
                    initial={{ x: 180, y: -114, rotate: 0 }}
                    animate={{ x: 0, y: 0, rotate: 500 }}
                    exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
                    transition={{
                      x: { duration: 0.76, ease: [0.55, 0, 0.65, 0.85] },
                      y: { duration: 0.76, ease: [0.18, 0, 0.42, 1] },
                      rotate: { duration: 0.76, ease: "linear" },
                    }}
                  >
                    <CricketBall size={28} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Speed lines trailing the ball */}
              <AnimatePresence>
                {ballActive && !impacted && (
                  <motion.svg
                    key="speedlines"
                    className="absolute pointer-events-none"
                    style={{ right: 4, top: 22, overflow: "visible" }}
                    width="72"
                    height="44"
                    viewBox="0 0 72 44"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.75, 0.75, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.76, times: [0, 0.12, 0.75, 1] }}
                  >
                    {[6, 16, 25, 33].map((y, i) => (
                      <line
                        key={y}
                        x1={8 + i * 5}
                        y1={y}
                        x2={68}
                        y2={y}
                        stroke="var(--jcc-accent)"
                        strokeWidth={1.6 - i * 0.32}
                        strokeOpacity={0.85 - i * 0.18}
                        strokeLinecap="round"
                      />
                    ))}
                  </motion.svg>
                )}
              </AnimatePresence>
            </div>

            {/* ── LOGO ── */}
            <AnimatePresence>
              {showLogo && (
                <motion.div
                  key="logo"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6 text-center"
                >
                  {/* JCC — each letter drops in like a stump being planted */}
                  <div className="flex items-end justify-center" style={{ gap: 2 }}>
                    {"JCC".split("").map((letter, i) => (
                      <motion.span
                        key={i}
                        style={{
                          fontSize: "3.75rem",
                          lineHeight: 0.85,
                          color: "var(--jcc-accent)",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 900,
                          letterSpacing: "-0.03em",
                          display: "block",
                        }}
                        initial={{ y: -72, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: i * 0.1,
                          duration: 0.58,
                          ease: [0.34, 1.56, 0.64, 1],
                        }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.52 }}
                    transition={{ delay: 0.42, duration: 0.55 }}
                    style={{
                      fontSize: "0.6rem",
                      letterSpacing: "0.38em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginTop: 7,
                      color: "var(--jcc-text-soft)",
                    }}
                  >
                    Jaipur Cricket Circle
                  </motion.p>

                  {/* Glowing progress bar */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.58, duration: 0.4 }}
                    className="flex items-center justify-center mt-5"
                  >
                    <div
                      style={{
                        width: 108,
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
                          background: "linear-gradient(90deg, var(--jcc-accent), var(--jcc-gold))",
                          boxShadow: "0 0 10px var(--jcc-accent)",
                          transformOrigin: "left",
                          animation: "loader-progress 0.6s linear forwards",
                        }}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content renders immediately at full opacity so the LCP element paints
          right away — the intro overlay simply sits on top and fades out. */}
      {children}
    </>
  );
}
