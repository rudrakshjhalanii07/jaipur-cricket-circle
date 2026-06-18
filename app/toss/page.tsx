"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Trophy } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TeamId = "mavericks" | "neurostrikers" | "outliers";
type Phase = "landing" | "selection" | "captains" | "result";

interface Team {
  id: TeamId;
  name: string;
  shortName: string;
  logo: string;
  captain: string;
  captainShort: string;
  jerseyNumber: number | null;
  primary: string;
  secondary: string;
  glow: string;
  tagline: string;
  patternType: "tribal" | "lightning" | "scratch";
}

// ─── Team Data ────────────────────────────────────────────────────────────────

const TEAMS: Record<TeamId, Team> = {
  mavericks: {
    id: "mavericks",
    name: "Mavericks",
    shortName: "MAV",
    logo: "/teams/mavericks-logo.png",
    captain: "Anil Rawat",
    captainShort: "ANIL",
    jerseyNumber: 4,
    primary: "#E8920A",
    secondary: "#0D0800",
    glow: "rgba(232, 146, 10, 0.55)",
    tagline: "Born To Dominate",
    patternType: "tribal",
  },
  neurostrikers: {
    id: "neurostrikers",
    name: "NeuroStrikers",
    shortName: "NS",
    logo: "/teams/neurostrikers-logo.png",
    captain: "Sagar Sharma",
    captainShort: "SAGAR",
    jerseyNumber: 1,
    primary: "#2563EB",
    secondary: "#05091A",
    glow: "rgba(37, 99, 235, 0.55)",
    tagline: "Beyond Fear",
    patternType: "lightning",
  },
  outliers: {
    id: "outliers",
    name: "The Outliers",
    shortName: "OUT",
    logo: "/teams/outliers-logo.png",
    captain: "Rudraksh Jhalani",
    captainShort: "RUDRA",
    jerseyNumber: 7,
    primary: "#0D9488",
    secondary: "#050F0D",
    glow: "rgba(13, 148, 136, 0.55)",
    tagline: "Against The Odds",
    patternType: "scratch",
  },
};

const TEAM_ORDER: TeamId[] = ["mavericks", "neurostrikers", "outliers"];

// ─── Logo with Fallback ───────────────────────────────────────────────────────

function TeamLogo({
  team,
  className = "",
}: {
  team: Team;
  className?: string;
}) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <span
        className="font-black text-2xl select-none"
        style={{ color: team.primary }}
      >
        {team.shortName}
      </span>
    );
  }
  return (
    <img
      src={team.logo}
      alt={team.name}
      className={className}
      onError={() => setError(true)}
    />
  );
}

// ─── Jersey Pattern SVGs ──────────────────────────────────────────────────────

function TribalPattern({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 200 280"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M160,0 L200,40 L180,120 L140,160 L160,220 L120,280 L80,240 L60,170 L80,100 L40,40 Z"
        fill={color}
        opacity="0.12"
      />
      <path
        d="M-10,60 L30,30 L70,80 L50,150 L10,180 Z"
        fill={color}
        opacity="0.08"
      />
      <circle cx="100" cy="100" r="50" fill="none" stroke={color} strokeWidth="1.5" opacity="0.1" />
      <circle cx="100" cy="100" r="70" fill="none" stroke={color} strokeWidth="1" opacity="0.06" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle
          key={i}
          cx={100 + 62 * Math.cos((i * Math.PI) / 4)}
          cy={100 + 62 * Math.sin((i * Math.PI) / 4)}
          r="3"
          fill={color}
          opacity="0.18"
        />
      ))}
      <path
        d="M80,200 Q100,180 120,200 Q140,220 120,240 Q100,260 80,240 Q60,220 80,200"
        fill={color}
        opacity="0.09"
      />
    </svg>
  );
}

function LightningPattern({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 200 280"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <path d="M130,0 L90,110 L118,110 L78,280 L148,130 L118,130 Z" fill={color} opacity="0.14" />
      <path d="M155,0 L115,110 L143,110 L103,280 L173,130 L143,130 Z" fill={color} opacity="0.07" />
      <path d="M105,0 L65,110 L93,110 L53,280 L123,130 L93,130 Z" fill={color} opacity="0.07" />
      <line x1="0" y1="140" x2="200" y2="140" stroke={color} strokeWidth="0.5" opacity="0.1" />
      <line x1="0" y1="200" x2="200" y2="200" stroke={color} strokeWidth="0.5" opacity="0.07" />
    </svg>
  );
}

function ScratchPattern({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 200 280"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <path d="M60,0 L120,70 M65,0 L125,70 M55,0 L115,70" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.12" />
      <path d="M30,80 L110,170 M35,75 L115,165 M25,85 L105,175" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.09" />
      <path d="M80,170 L160,250 M85,165 L165,245 M75,175 L155,255" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.1" />
      <path d="M140,20 L200,80" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.08" />
      <path d="M0,100 L60,160" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

// ─── Pink Button Seam ─────────────────────────────────────────────────────────

function SeamLines() {
  // Two parallel diagonal lines running bottom-left → top-right, like a pink ball seam
  return (
    <>
      {(["calc(50% - 5px)", "calc(50% + 5px)"] as const).map((top, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: "-4rem",
            right: "-4rem",
            top,
            height: "1px",
            pointerEvents: "none",
            transform: "rotate(-12deg)",
            transformOrigin: "center",
            background:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 3px, transparent 3px, transparent 8px)",
          }}
        />
      ))}
    </>
  );
}

// ─── Coin Face ────────────────────────────────────────────────────────────────

function CoinFace({ team, isBack }: { team: Team; isBack: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : undefined,
        background:
          "radial-gradient(circle at 32% 22%, #FFFACC 0%, #F9D020 14%, #D4940A 38%, #A06308 62%, #5C3A00 100%)",
        boxShadow: [
          "inset 0 10px 28px rgba(255,245,100,0.55)",
          "inset 0 -10px 28px rgba(0,0,0,0.65)",
          "inset 5px 0 16px rgba(255,200,40,0.28)",
          "inset -3px 0 10px rgba(0,0,0,0.25)",
        ].join(", "),
      }}
    >
      {/* Sunburst rays — CSS conic-gradient, no trig, no SSR mismatch */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "repeating-conic-gradient(rgba(122,82,0,0.22) 0deg, rgba(122,82,0,0.22) 3deg, transparent 3deg, transparent 8deg)",
          WebkitMask:
            "radial-gradient(circle, transparent 49%, black 50%, black 82%, transparent 83%)",
          mask:
            "radial-gradient(circle, transparent 49%, black 50%, black 82%, transparent 83%)",
        }}
      />

      {/* SVG coin detail — circles only, no trig */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        {/* Milled/knurled outer rim */}
        <circle cx={128} cy={128} r={122} fill="none" stroke="#3A1E00" strokeWidth={8} strokeDasharray="3 2.2" opacity={0.85} />
        {/* Bright gold rim highlights */}
        <circle cx={128} cy={128} r={115} fill="none" stroke="#FFE066" strokeWidth={2} opacity={0.55} />
        <circle cx={128} cy={128} r={112} fill="none" stroke="#7A5200" strokeWidth={1} opacity={0.45} />
        <circle cx={128} cy={128} r={109} fill="none" stroke="#FFD700" strokeWidth={0.6} opacity={0.3} />

        {/* Logo platform */}
        <circle cx={128} cy={128} r={65} fill="#C98E08" opacity={0.18} />
        <circle cx={128} cy={128} r={63} fill="none" stroke="#FFE066" strokeWidth={2} opacity={0.55} />
        <circle cx={128} cy={128} r={59} fill="none" stroke="#7A5200" strokeWidth={1} opacity={0.35} />
      </svg>

      {/* Team-colour halo — makes each face distinguishable */}
      <div
        className="absolute w-[38%] h-[38%] rounded-full blur-xl opacity-30 pointer-events-none"
        style={{ background: team.primary }}
      />

      {/* Logo with deep emboss shadows */}
      <div
        className="relative z-10 w-[43%] h-[43%] flex items-center justify-center"
        style={{
          filter:
            "drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 1px 4px rgba(50,25,0,0.9))",
        }}
      >
        <TeamLogo team={team} className="w-full h-full object-contain" />
      </div>

      {/* Gloss specular — top-left reflection like a real coin */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 27% 14%, rgba(255,255,230,0.58) 0%, rgba(255,240,160,0.22) 28%, transparent 58%)",
        }}
      />
    </div>
  );
}

// ─── Jersey Card ──────────────────────────────────────────────────────────────

function JerseyCard({ team, delay = 0 }: { team: Team; delay?: number }) {
  const Pattern =
    team.patternType === "tribal"
      ? TribalPattern
      : team.patternType === "lightning"
        ? LightningPattern
        : ScratchPattern;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-4"
    >
      {/* Jersey back card */}
      <div
        className="relative w-44 sm:w-52 aspect-[3/4] rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1"
        style={{
          background: `linear-gradient(155deg, ${team.secondary} 0%, ${team.primary}18 60%, ${team.secondary} 100%)`,
          border: `1px solid ${team.primary}33`,
          boxShadow: `0 0 50px ${team.glow}, 0 0 0 1px ${team.primary}18`,
        }}
      >
        <Pattern color={team.primary} />

        {/* Collar strip */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-5 rounded-b-lg opacity-60"
          style={{ background: `linear-gradient(to bottom, ${team.primary}88, transparent)` }}
        />

        {/* Button placeholders */}
        {[0, 1].map((i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 6,
              height: 6,
              background: `${team.primary}44`,
              border: `1px solid ${team.primary}66`,
              top: 14 + i * 12,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 pt-6">
          {/* CAPTAIN badge */}
          <div
            className="px-2.5 py-0.5 rounded text-[9px] font-black tracking-[0.35em] uppercase"
            style={{
              background: `${team.primary}22`,
              color: team.primary,
              border: `1px solid ${team.primary}44`,
            }}
          >
            CAPTAIN
          </div>

          {/* Player name */}
          <span
            className="text-2xl sm:text-3xl font-black tracking-[0.15em] uppercase text-white"
            style={{ textShadow: `0 0 20px ${team.glow}` }}
          >
            {team.captainShort}
          </span>

          {/* Jersey number */}
          {team.jerseyNumber !== null ? (
            <span
              className="text-5xl sm:text-6xl font-black leading-none"
              style={{
                color: team.primary,
                textShadow: `0 0 30px ${team.glow}, 0 2px 0 rgba(0,0,0,0.5)`,
              }}
            >
              {team.jerseyNumber}
            </span>
          ) : (
            <span className="text-2xl font-black opacity-30 text-white">—</span>
          )}
        </div>

        {/* Bottom team stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5 opacity-40"
          style={{ background: `linear-gradient(to right, transparent, ${team.primary}, transparent)` }}
        />
      </div>

      {/* Caption below card */}
      <div className="text-center">
        <p className="text-white font-bold text-sm leading-tight">{team.captain}</p>
        <p
          className="text-xs font-semibold mt-0.5 opacity-60"
          style={{ color: team.primary }}
        >
          {team.name}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Coin Toss Component ──────────────────────────────────────────────────────

function CoinToss({
  teamA,
  teamB,
  onResult,
}: {
  teamA: Team;
  teamB: Team;
  onResult: (winner: TeamId) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [winner, setWinner] = useState<Team | null>(null);
  const [hasFlipped, setHasFlipped] = useState(false);

  // Auto-flip on mount — no manual confirmation needed
  useEffect(() => {
    const t = setTimeout(() => flip(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flip() {
    if (isFlipping || hasFlipped) return;
    setIsFlipping(true);

    const winnerTeam = Math.random() < 0.5 ? teamA : teamB;
    // teamA is at face (0° modulo 360°), teamB is at back (180° modulo 360°)
    const winnerIsA = winnerTeam.id === teamA.id;
    const spins = 6 + Math.floor(Math.random() * 3); // 6–8 full rotations
    const finalRotation = spins * 360 + (winnerIsA ? 0 : 180);

    setRotation(finalRotation);

    // Show result after animation completes
    setTimeout(() => {
      setWinner(winnerTeam);
      setHasFlipped(true);
      setIsFlipping(false);
      onResult(winnerTeam.id);
    }, 3600);
  }

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Coin */}
      <div style={{ perspective: "1200px" }} className="relative">
        {/* Permanent gold ambient glow */}
        <div
          className="absolute -inset-6 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle, #F5C418, #8B5E00)" }}
        />

        {/* Winner team glow — fades in on top of gold glow */}
        <AnimatePresence>
          {winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.55, scale: 1 }}
              className="absolute -inset-8 rounded-full blur-2xl pointer-events-none"
              style={{ background: winner.primary }}
            />
          )}
        </AnimatePresence>

        {/* Shadow under coin — golden tint */}
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-44 h-5 rounded-full blur-xl opacity-50"
          style={{
            background: isFlipping
              ? "#6B4A00"
              : winner
                ? winner.primary
                : "#C98E08",
          }}
        />

        {/* The coin */}
        <motion.div
          className="relative w-52 h-52 sm:w-64 sm:h-64"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: rotation }}
          transition={{
            duration: isFlipping ? 3.4 : 0,
            ease: [0.15, 0.05, 0.05, 1.0],
            type: "tween",
          }}
        >
          <CoinFace team={teamA} isBack={false} />
          <CoinFace team={teamB} isBack={true} />
        </motion.div>
      </div>

      {/* Team labels */}
      <div className="flex items-center gap-6 text-xs font-black tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: teamA.primary }} />
          <span style={{ color: teamA.primary }}>{teamA.name}</span>
        </div>
        <span className="text-white/20">·</span>
        <div className="flex items-center gap-2">
          <span style={{ color: teamB.primary }}>{teamB.name}</span>
          <div className="w-2 h-2 rounded-full" style={{ background: teamB.primary }} />
        </div>
      </div>

      {/* Flipping indicator */}
      {isFlipping && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/40 text-xs font-black tracking-[0.4em] uppercase"
        >
          Flipping...
        </motion.p>
      )}

      {/* Result */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <div
              className="px-10 py-7 rounded-3xl border"
              style={{
                background: `linear-gradient(135deg, ${winner.secondary}, ${winner.primary}22)`,
                borderColor: `${winner.primary}44`,
                boxShadow: `0 0 60px ${winner.glow}`,
              }}
            >
              <Trophy
                className="w-9 h-9 mx-auto mb-3"
                style={{ color: winner.primary }}
              />
              <p className="text-white/50 text-[10px] font-black tracking-[0.4em] uppercase mb-1.5">
                Won The Toss
              </p>
              <h3
                className="text-4xl sm:text-5xl font-black uppercase tracking-wide"
                style={{
                  color: winner.primary,
                  textShadow: `0 0 40px ${winner.glow}`,
                }}
              >
                {winner.name}
              </h3>
              <p className="text-white/30 text-sm mt-2 font-medium italic">
                &ldquo;{winner.tagline}&rdquo;
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TossPage() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [selected, setSelected] = useState<TeamId[]>([]);
  const [winner, setWinner] = useState<TeamId | null>(null);
  const proceedRef = useRef<HTMLButtonElement>(null);

  const teamA = selected[0] ? TEAMS[selected[0]] : null;
  const teamB = selected[1] ? TEAMS[selected[1]] : null;

  // Auto-scroll to proceed button when 2 teams are picked
  useEffect(() => {
    if (selected.length === 2) {
      // Let AnimatePresence add the button first, then scroll
      const t = setTimeout(() => {
        proceedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [selected.length]);

  function toggleTeam(id: TeamId) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function reset() {
    setSelected([]);
    setWinner(null);
    setPhase("landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetToFlip() {
    setWinner(null);
    setPhase("captains");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Seam decoration shared across phases
  const SeamDots = () => (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-1.5 pt-6 opacity-20 pointer-events-none">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="w-0.5 h-5 rounded-full bg-[#EDE3CE]"
          style={{ transform: `rotate(${8 + i * 2}deg)` }}
        />
      ))}
    </div>
  );

  // ── Landing ────────────────────────────────────────────────────────────────
  if (phase === "landing") {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden">
        <SeamDots />

        {/* Background atmosphere */}
        <div
          className="absolute top-1/4 left-1/3 w-[480px] h-[480px] rounded-full blur-[140px] opacity-[0.18] pointer-events-none"
          style={{ background: "#E8537E" }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-[360px] h-[360px] rounded-full blur-[120px] opacity-[0.12] pointer-events-none"
          style={{ background: "#2563EB" }}
        />

        {/* Back to home */}
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>

        <motion.div
          className="flex flex-col items-center gap-8 text-center px-6"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.18 } } }}
        >
          {/* Pre-label */}
          <motion.span
            variants={{ hidden: { opacity: 0, y: -16 }, visible: { opacity: 1, y: 0 } }}
            className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase"
          >
            Jaipur Cricket Circle
          </motion.span>

          {/* Main title */}
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.75 },
              visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 100, damping: 14 } },
            }}
            className="flex flex-col items-center leading-none"
          >
            <h1
              className="text-[clamp(5rem,18vw,11rem)] font-black uppercase tracking-tight text-white"
              style={{ textShadow: "0 0 100px rgba(232,83,126,0.35), 0 0 40px rgba(232,83,126,0.15)" }}
            >
              THE
            </h1>
            <h1
              className="text-[clamp(5rem,18vw,11rem)] font-black uppercase tracking-tight"
              style={{
                color: "#E8537E",
                textShadow: "0 0 80px rgba(232,83,126,0.7), 0 0 160px rgba(232,83,126,0.3)",
              }}
            >
              TOSS
            </h1>
          </motion.div>

          {/* Decorative coin — golden IPL-style */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            className="relative flex items-center justify-center"
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center relative overflow-hidden"
              style={{
                background: "radial-gradient(circle at 32% 22%, #FFFACC 0%, #F9D020 14%, #D4940A 38%, #A06308 62%, #5C3A00 100%)",
                boxShadow: [
                  "0 0 60px rgba(245,196,24,0.65)",
                  "0 0 120px rgba(200,140,8,0.3)",
                  "inset 0 8px 20px rgba(255,245,100,0.5)",
                  "inset 0 -8px 20px rgba(0,0,0,0.65)",
                ].join(", "),
              }}
            >
              {/* Sunburst via conic-gradient — no trig, no SSR mismatch */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: "13px",
                  background:
                    "repeating-conic-gradient(rgba(122,82,0,0.18) 0deg, rgba(122,82,0,0.18) 2deg, transparent 2deg, transparent 10deg)",
                }}
              />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96">
                {/* Milled rim — pure circle geometry, no trig */}
                <circle cx={48} cy={48} r={45} fill="none" stroke="#3A1E00" strokeWidth={4} strokeDasharray="2.2 1.8" opacity={0.9} />
                <circle cx={48} cy={48} r={41} fill="none" stroke="#FFE066" strokeWidth={1} opacity={0.6} />
                <circle cx={48} cy={48} r={39} fill="none" stroke="#7A5200" strokeWidth={0.6} opacity={0.4} />
                {/* Logo platform rings */}
                <circle cx={48} cy={48} r={22} fill="#C98E08" opacity={0.2} />
                <circle cx={48} cy={48} r={21} fill="none" stroke="#FFE066" strokeWidth={1.5} opacity={0.55} />
              </svg>
              {/* Cricket symbol */}
              <span className="relative z-10 text-2xl select-none" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}>
                🏏
              </span>
              {/* Gloss */}
              <div className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 27% 14%, rgba(255,255,230,0.55) 0%, transparent 55%)" }}
              />
            </div>
            <div
              className="absolute inset-[-10px] rounded-full border border-yellow-400/20 animate-spin"
              style={{ animationDuration: "9s" }}
            />
            <div
              className="absolute inset-[-22px] rounded-full border border-yellow-600/10 animate-spin"
              style={{ animationDuration: "14s", animationDirection: "reverse" }}
            />
          </motion.div>

          {/* Tagline */}
          <motion.p
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            className="text-white/35 text-sm font-medium tracking-widest max-w-xs"
          >
            The coin decides. The team delivers.
          </motion.p>

          {/* Teams preview chips */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
            className="flex gap-3 flex-wrap justify-center"
          >
            {TEAM_ORDER.map((id) => {
              const t = TEAMS[id];
              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                  style={{
                    background: `${t.primary}1A`,
                    border: `1.5px solid ${t.primary}55`,
                    boxShadow: `0 0 18px ${t.primary}28`,
                  }}
                >
                  {/* Team logo */}
                  <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: `${t.primary}22` }}>
                    <TeamLogo team={t} className="w-full h-full object-contain" />
                  </div>
                  <span
                    className="text-xs font-black uppercase tracking-widest"
                    style={{
                      color: "#FFFFFF",
                      textShadow: `0 0 12px ${t.primary}, 0 0 24px ${t.primary}88`,
                    }}
                  >
                    {t.name}
                  </span>
                </div>
              );
            })}
          </motion.div>

          {/* CTA */}
          <motion.button
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            onClick={() => { setPhase("selection"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="relative overflow-hidden px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white"
            style={{
              background: "linear-gradient(135deg, #E8537E, #B83060)",
              boxShadow: "0 8px 36px rgba(232,83,126,0.45)",
            }}
          >
            <SeamLines />
            Begin The Toss
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Selection ──────────────────────────────────────────────────────────────
  if (phase === "selection") {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden px-4 pt-32 pb-24">
        <SeamDots />

        {/* Back to landing */}
        <button
          onClick={() => setPhase("landing")}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px] opacity-[0.1] pointer-events-none"
          style={{ background: "#E8537E" }}
        />

        <motion.div
          className="w-full max-w-5xl flex flex-col items-center gap-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
              Step 1 of 3
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              Select Two Teams
            </h2>
            <p className="text-white/35 text-sm font-medium min-h-[1.5rem]">
              {selected.length === 0 && "Pick the first team for the toss"}
              {selected.length === 1 && "Now pick the second team"}
              {selected.length === 2 && "Ready — bring out the captains"}
            </p>
          </div>

          {/* Team cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {TEAM_ORDER.map((id, i) => {
              const team = TEAMS[id];
              const isSelected = selected.includes(id);
              const isDisabled = !isSelected && selected.length >= 2;
              const selOrder = selected.indexOf(id) + 1;

              return (
                <motion.button
                  key={id}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: isDisabled ? 0.38 : 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  onClick={() => !isDisabled && toggleTeam(id)}
                  whileHover={!isDisabled ? { scale: 1.02, y: -4 } : {}}
                  whileTap={!isDisabled ? { scale: 0.98 } : {}}
                  disabled={isDisabled}
                  className="relative flex flex-col items-center gap-5 p-6 rounded-2xl border text-center w-full transition-all duration-300"
                  style={{
                    background: isSelected
                      ? `linear-gradient(155deg, ${team.secondary}, ${team.primary}22)`
                      : "rgba(255,255,255,0.025)",
                    borderColor: isSelected ? `${team.primary}66` : "rgba(255,255,255,0.07)",
                    boxShadow: isSelected
                      ? `0 0 50px ${team.glow}, 0 0 0 1px ${team.primary}33`
                      : "none",
                  }}
                >
                  {/* Selection badge */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-black"
                      style={{ background: team.primary }}
                    >
                      {selOrder}
                    </motion.div>
                  )}

                  {/* Logo */}
                  <div
                    className="w-28 h-28 rounded-2xl flex items-center justify-center p-3 overflow-hidden"
                    style={{
                      background: `${team.primary}10`,
                      border: `1px solid ${team.primary}22`,
                    }}
                  >
                    <TeamLogo team={team} className="w-full h-full object-contain" />
                  </div>

                  {/* Info */}
                  <div>
                    <h3
                      className="font-black text-xl uppercase tracking-wider leading-tight"
                      style={{
                        color: "#FFFFFF",
                        textShadow: `0 0 18px ${team.primary}, 0 0 36px ${team.primary}99, 0 2px 4px rgba(0,0,0,0.9)`,
                      }}
                    >
                      {team.name}
                    </h3>
                    <p
                      className="text-xs font-bold mt-1.5 tracking-widest uppercase"
                      style={{ color: team.primary, opacity: 0.9 }}
                    >
                      {team.tagline}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Proceed button */}
          <AnimatePresence>
            {selected.length === 2 && (
              <motion.button
                ref={proceedRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={() => { setPhase("captains"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="relative overflow-hidden px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white"
                style={{
                  background: "linear-gradient(135deg, #E8537E, #B83060)",
                  boxShadow: "0 8px 36px rgba(232,83,126,0.45)",
                }}
              >
                <SeamLines />
                Bring Out The Captains →
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  // ── Captains ───────────────────────────────────────────────────────────────
  if (phase === "captains" && teamA && teamB) {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden px-4 pt-32 pb-24">
        <SeamDots />

        {/* Back to team selection */}
        <button
          onClick={() => setPhase("selection")}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {/* Dual team glows */}
        <div
          className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full blur-[130px] opacity-20 pointer-events-none"
          style={{ background: teamA.primary }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-[130px] opacity-20 pointer-events-none"
          style={{ background: teamB.primary }}
        />

        <motion.div
          className="w-full max-w-3xl flex flex-col items-center gap-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
              Step 2 of 3
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              The Captains
            </h2>
          </div>

          {/* Captain jerseys */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 w-full">
            <JerseyCard team={teamA} delay={0.15} />

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 16 }}
              className="flex flex-col items-center"
            >
              <span className="text-6xl font-black text-white/8 uppercase select-none">
                vs
              </span>
            </motion.div>

            <JerseyCard team={teamB} delay={0.3} />
          </div>

          {/* Next: coin flip */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            onClick={() => { setPhase("result"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="relative overflow-hidden px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white"
            style={{
              background: "linear-gradient(135deg, #E8537E, #B83060)",
              boxShadow: "0 8px 40px rgba(232,83,126,0.5)",
            }}
          >
            <SeamLines />
            Proceed to Coin Flip →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Result (coin flip) ─────────────────────────────────────────────────────
  if (phase === "result" && teamA && teamB) {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden px-4 pt-32 pb-24">
        <SeamDots />

        {/* Winner glow (revealed after toss) */}
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 30%, ${TEAMS[winner].glow} 0%, transparent 65%)`,
            }}
          />
        )}

        <motion.div
          className="w-full max-w-2xl flex flex-col items-center gap-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
              Step 3 of 3
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              {winner ? "Toss Result" : "The Coin Flip"}
            </h2>
          </div>

          {/* Coin toss */}
          <CoinToss
            teamA={teamA}
            teamB={teamB}
            onResult={(w) => setWinner(w)}
          />

          {/* Post-result actions */}
          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-3"
              >
                <button
                  onClick={resetToFlip}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-white/50 border border-white/10 hover:border-white/25 hover:text-white/80 transition-all duration-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Flip Again
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-white/50 border border-white/10 hover:border-white/25 hover:text-white/80 transition-all duration-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Start Toss Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return null;
}
