"use client";

import { useCallback, useEffect, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

type Choice = "Heads" | "Tails";
type TossPhase = "ready" | "flight" | "reveal";

const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

const DUST = [
  { left: "8%", top: "18%", size: 2, delay: 0.1, duration: 10 },
  { left: "16%", top: "72%", size: 1, delay: 1.4, duration: 13 },
  { left: "24%", top: "38%", size: 2, delay: 0.7, duration: 12 },
  { left: "36%", top: "12%", size: 1, delay: 2.1, duration: 15 },
  { left: "44%", top: "82%", size: 2, delay: 0.4, duration: 11 },
  { left: "57%", top: "22%", size: 1, delay: 1.8, duration: 14 },
  { left: "66%", top: "68%", size: 2, delay: 0.9, duration: 12 },
  { left: "78%", top: "34%", size: 1, delay: 2.6, duration: 16 },
  { left: "88%", top: "58%", size: 2, delay: 1.1, duration: 13 },
  { left: "93%", top: "20%", size: 1, delay: 0.2, duration: 15 },
];

function CoinFace({ side, flat = false }: { side: Choice; flat?: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{
        backfaceVisibility: flat ? undefined : "hidden",
        WebkitBackfaceVisibility: flat ? undefined : "hidden",
        transform: !flat && side === "Tails" ? "rotateY(180deg)" : undefined,
        background:
          "radial-gradient(circle at 50% 50%, #132442 0%, #132442 45%, #0c172b 72%, #07101f 100%)",
        boxShadow:
          "inset 0 0 0 12px #D4AF37, inset 0 0 0 15px rgba(255,255,255,0.12), inset 18px 20px 34px rgba(255,245,210,0.12), inset -22px -26px 42px rgba(0,0,0,0.56)",
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at 28% 18%, rgba(255,255,235,0.42) 0%, rgba(243,201,106,0.18) 28%, transparent 54%), linear-gradient(128deg, transparent 34%, rgba(255,255,255,0.16) 48%, transparent 62%)",
        }}
      />

      <svg className="absolute inset-[9%] h-[82%] w-[82%]" viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r="102" fill="none" stroke="#F3C96A" strokeWidth="1.5" opacity="0.7" />
        <circle cx="120" cy="120" r="87" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.48" />
        <circle cx="120" cy="120" r="70" fill="none" stroke="#F3C96A" strokeWidth="0.75" opacity="0.28" />
        <path
          d="M58 120c18-30 39-46 62-46s44 16 62 46c-18 30-39 46-62 46s-44-16-62-46Z"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="2"
          opacity="0.36"
        />
      </svg>

      <div className="relative z-10 flex translate-y-[2px] items-center justify-center">
        <Image
          src="/jcc_logo.png"
          alt="Jaipur Cricket Circle crest"
          width={168}
          height={168}
          priority
          className="h-28 w-28 object-contain opacity-90 sm:h-36 sm:w-36"
          style={{
            filter:
              "grayscale(1) sepia(0.6) saturate(1.4) brightness(1.2) drop-shadow(0 8px 14px rgba(0,0,0,0.52))",
          }}
        />
      </div>
      <span className="absolute bottom-[9%] z-10 rounded-full border border-[#F3C96A]/45 bg-[#07101f]/50 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.34em] text-[#FFF8E7]/90 shadow-[0_0_18px_rgba(212,175,55,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
        {side}
      </span>
    </div>
  );
}

function PremiumCoin({
  phase,
  result,
  onLanded,
}: {
  phase: TossPhase;
  result: Choice | null;
  onLanded: () => void;
}) {
  const controls = useAnimationControls();
  const finalRotation = result === "Tails" ? 2340 : 2160;

  // The flip is driven by a plain motion value (spin, in degrees) rather than a
  // 3D `rotateY` + `backface-visibility` pair. That older approach depended on
  // `preserve-3d` surviving through the coin's transform stack — which some
  // browsers get wrong mid-flip, hiding both faces and leaving only the bare
  // gold edge disc visible. Here a single flat face is squashed horizontally
  // (scaleX = |cos(spin)|) and its content is swapped Heads<->Tails each time
  // the coin turns edge-on, so a fully designed face is always showing.
  const spin = useMotionValue(0);
  const flipScaleX = useTransform(spin, (deg) =>
    Math.max(0.05, Math.abs(Math.cos((deg * Math.PI) / 180))),
  );
  const [flightSide, setFlightSide] = useState<Choice>("Heads");

  useMotionValueEvent(spin, "change", (deg) => {
    const normalized = ((deg % 360) + 360) % 360;
    const facingBack = normalized > 90 && normalized < 270;
    setFlightSide(facingBack ? "Tails" : "Heads");
  });

  useEffect(() => {
    if (phase !== "flight") {
      spin.set(0);
      return;
    }

    const flip = animate(spin, finalRotation, {
      duration: 2.7,
      ease: [0.15, 0.05, 0.05, 1.0],
    });

    controls
      .start({
        y: [0, 10, -292, -330, -70, 0, -16, 0],
        scale: [1, 0.94, 1.03, 1.02, 1, 0.98, 1.01, 1],
        rotateX: [0, -7, 22, 13, 4, 0, 0, 0],
        transition: {
          duration: 4.2,
          times: [0, 0.08, 0.34, 0.48, 0.72, 0.88, 0.94, 1],
          ease: "easeInOut",
        },
      })
      .then(onLanded)
      .catch(() => undefined);

    return () => flip.stop();
  }, [controls, finalRotation, onLanded, phase, spin]);

  return (
    <div className="relative h-[15.5rem] sm:h-[19rem] w-full flex items-center justify-center">
      <motion.div
        className="absolute bottom-10 h-4 w-48 rounded-full bg-black/38 blur-xl"
        animate={{
          opacity: phase === "flight" ? [0.42, 0.12, 0.34, 0.5] : 0.42,
          scaleX: phase === "flight" ? [1, 0.52, 0.84, 1.05] : 1,
        }}
        transition={{ duration: phase === "flight" ? 4.2 : 3, ease: EASE_PREMIUM }}
      />

      {/* Drop-shadow lives on this wrapper so it tracks the coin as a whole
          without interfering with the inner flip squash. */}
      <div
        className="relative h-56 w-56 sm:h-72 sm:w-72"
        style={{ filter: "drop-shadow(0 34px 44px rgba(0,0,0,0.38)) drop-shadow(0 0 44px rgba(212,175,55,0.18))" }}
      >
        <motion.div
          aria-label="Jaipur Cricket Circle ceremonial toss coin"
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0, y: 24 }}
          animate={
            phase === "flight"
              ? controls
              : {
                  opacity: 1,
                  y: [0, -10, 0],
                  rotateX: 0,
                  scale: 1,
                  transition: {
                    y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
                    opacity: { duration: 0.9, ease: EASE_PREMIUM },
                  },
                }
          }
        >
          {/*
            Inner wrapper carries the horizontal-squash flip so the edge disc,
            face and sheen all compress together into a thin gold edge as the
            coin turns — never a full plain-gold disc.
          */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ scaleX: phase === "flight" ? flipScaleX : 1 }}
          >
            <div
              className="absolute inset-[-2px] rounded-full"
              style={{
                background: "linear-gradient(90deg, #8A611D, #F3C96A 36%, #60400E 72%, #D4AF37)",
              }}
            />
            <CoinFace
              side={phase === "flight" ? flightSide : phase === "reveal" && result ? result : "Heads"}
              flat
            />
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  "linear-gradient(115deg, transparent 22%, rgba(255,255,255,0.34) 44%, rgba(243,201,106,0.22) 50%, transparent 68%)",
                mixBlendMode: "screen",
              }}
              animate={{ x: ["-135%", "135%"], opacity: [0, 0.8, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.8, ease: EASE_PREMIUM }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default function TossPage() {
  const [choice, setChoice] = useState<Choice>("Heads");
  const [phase, setPhase] = useState<TossPhase>("ready");
  const [result, setResult] = useState<Choice | null>(null);

  const isBusy = phase === "flight";
  const surroundingOpacity = phase === "ready" ? 1 : phase === "reveal" ? 0.34 : 0.16;

  function beginToss() {
    if (isBusy) return;
    setResult(Math.random() < 0.5 ? "Heads" : "Tails");
    setPhase("flight");
  }

  function resetToss() {
    setResult(null);
    setPhase("ready");
  }

  const handleCoinLanded = useCallback(() => setPhase("reveal"), []);

  return (
    <section
      className="theme-static-dark relative min-h-screen overflow-hidden px-5 pt-28 pb-16 text-white sm:px-8"
      style={{
        isolation: "isolate",
        background: "linear-gradient(178deg, #1B3663 0%, #12233F 46%, #0F1D36 100%)",
      }}
    >
      {/* Royal Blue deepens as the coin takes the stage. */}
      <motion.div
        className="absolute inset-0 bg-[#0D1728] pointer-events-none"
        animate={{ opacity: phase === "ready" ? 0 : 0.34 }}
        transition={{ duration: 1.2, ease: EASE_PREMIUM }}
      />

      {/* Ceremonial ripple — concentric gold rings spreading out from the coin,
          echoing the milled edge of the crest. This is the page's signature
          motif; nothing else on the site uses it. */}
      <svg
        className="absolute left-1/2 top-[36%] h-[190vmax] w-[190vmax] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 1000 1000"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: 13 }, (_, ring) => (
          <circle
            key={ring}
            cx="500"
            cy="500"
            r={44 + ring * 36}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={ring % 3 === 0 ? 1.1 : 0.5}
            opacity={Math.max(0.04, 0.3 - ring * 0.021)}
          />
        ))}
      </svg>

      {/* Two broad floodlight beams raking in from the wings. */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          background:
            "conic-gradient(from 196deg at 18% -12%, transparent 0deg, rgba(243,201,106,0.11) 12deg, transparent 26deg), conic-gradient(from 118deg at 82% -12%, transparent 0deg, rgba(243,201,106,0.09) 13deg, transparent 27deg)",
        }}
      />

      {/* Warm pool of light on the coin, cooling into Royal Blue at the rim. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_42%_at_50%_36%,rgba(243,201,106,0.14),transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_128%_86%_at_50%_42%,transparent_40%,rgba(13,23,40,0.82)_100%)]" />

      {DUST.map((particle, index) => (
        <motion.span
          key={index}
          aria-hidden
          className="absolute rounded-full bg-[#F3C96A]/45 shadow-[0_0_18px_rgba(243,201,106,0.5)]"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
          }}
          animate={{ y: [-10, 14, -10], opacity: [0.14, 0.58, 0.14] }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-11rem)] w-full max-w-5xl flex-col items-center justify-center">
        <motion.div
          className="w-full text-center"
          animate={{ opacity: surroundingOpacity, filter: phase === "ready" ? "blur(0px)" : "blur(1px)" }}
          transition={{ duration: 1.1, ease: EASE_PREMIUM }}
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_PREMIUM }}
            className="mt-10 mb-6 text-[10px] font-black uppercase tracking-[0.32em] text-[#D4AF37]"
          >
            Jaipur Cricket Circle
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.08, ease: EASE_PREMIUM }}
            className="font-heading text-[clamp(4rem,12vw,9rem)] font-semibold normal-case leading-[0.86] tracking-normal text-[#FFF8E7]"
            style={{ textShadow: "0 28px 70px rgba(0,0,0,0.44), 0 0 46px rgba(212,175,55,0.13)" }}
          >
            Match Toss
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.18, ease: EASE_PREMIUM }}
            className="mx-auto mt-5 max-w-xl text-base font-medium leading-8 text-[#FFF8E7]/72 sm:text-lg"
          >
            Every great contest begins with a single call.
          </motion.p>
        </motion.div>

        <motion.div
          className="relative my-3 w-full sm:my-5"
          animate={{ y: phase === "flight" ? -24 : 0 }}
          transition={{ duration: 4.2, ease: EASE_PREMIUM }}
        >
          <PremiumCoin phase={phase} result={result} onLanded={handleCoinLanded} />
        </motion.div>

        <AnimatePresence mode="popLayout">
          {phase !== "reveal" && (
            <motion.div
              className="flex w-full flex-col items-center gap-5"
              initial={{ opacity: 1 }}
              animate={{ opacity: surroundingOpacity, y: phase === "ready" ? 0 : 12 }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.3, ease: EASE_PREMIUM } }}
              transition={{ duration: 1, ease: EASE_PREMIUM }}
            >
              <div className="grid w-full max-w-sm grid-cols-2 rounded-full border border-[#D4AF37]/26 bg-white/[0.045] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                {(["Heads", "Tails"] as const).map((option) => {
                  const selected = choice === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setChoice(option)}
                      className="relative rounded-full px-7 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition disabled:cursor-not-allowed"
                      style={{
                        color: selected ? "#FFF8E7" : "rgba(255,248,231,0.58)",
                        border: selected ? "1px solid rgba(243,201,106,0.72)" : "1px solid transparent",
                        background: selected ? "rgba(212,175,55,0.09)" : "transparent",
                        boxShadow: selected ? "0 0 28px rgba(212,175,55,0.18), inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={beginToss}
                disabled={isBusy}
                className="group relative inline-flex min-w-56 items-center justify-center overflow-hidden rounded-full border border-[#D4AF37] bg-[#D4AF37] px-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#132442] shadow-[0_22px_52px_rgba(0,0,0,0.28),0_0_34px_rgba(212,175,55,0.22)] transition duration-500 hover:-translate-y-0.5 hover:border-[#F3C96A] hover:bg-[#F3C96A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.48),transparent)] transition-transform duration-1000 group-hover:translate-x-full" />
                <span className="relative">Begin Toss</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "reveal" && result && (
            <motion.div
              className="mx-auto flex w-full max-w-xl flex-col items-center text-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
            >
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.04, ease: EASE_PREMIUM }}
                className="text-[10px] font-black uppercase tracking-[0.34em] text-[#D4AF37]"
              >
                The Coin Decides
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 18, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18, mass: 0.8, delay: 0.09 }}
                className="mt-3 font-heading text-6xl font-semibold normal-case leading-none tracking-normal text-[#FFF8E7] sm:text-7xl"
              >
                {result}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: EASE_PREMIUM }}
                className="mt-4 text-sm font-semibold text-[#FFF8E7]/55"
              >
                {choice === result ? "The call stands." : "The call falls away."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3, ease: EASE_PREMIUM }}
                className="mt-8 flex w-full flex-col justify-center gap-3 sm:flex-row"
              >
                <button
                  type="button"
                  onClick={resetToss}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37]/55 bg-white/[0.055] px-7 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-[#FFF8E7] shadow-[0_18px_44px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-500 hover:-translate-y-0.5 hover:border-[#F3C96A]"
                >
                  <RefreshCw className="h-4 w-4 text-[#D4AF37]" />
                  Toss Again
                </button>
                <Link
                  href="/tournament"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37] bg-[#D4AF37] px-7 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-[#132442] shadow-[0_20px_48px_rgba(0,0,0,0.24)] transition duration-500 hover:-translate-y-0.5 hover:bg-[#F3C96A]"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
