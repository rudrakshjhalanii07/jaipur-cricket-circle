"use client";

import { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import {
  ChevronRight,
  Users,
  CalendarCheck,
  ChevronDown,
} from "lucide-react";
import { fadeUp } from "@/lib/animations";
import { supabase } from "@/lib/supabase";

// ---- Detailed Stadium Floodlight Component ----
function StadiumFloodlight({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div
      className={`absolute top-0 ${
        isLeft ? "left-0" : "right-0"
      } w-[240px] sm:w-[320px] md:w-[400px] h-[350px] sm:h-[450px] md:h-[550px] pointer-events-none z-0`}
      aria-hidden="true"
    >
      <svg
        className={`w-full h-full ${
          isLeft ? "animate-light-beam-left" : "animate-light-beam-right"
        }`}
        viewBox="0 0 300 400"
        fill="none"
      >
        <defs>
          {/* Mast metal structure gradient */}
          <linearGradient id="mastMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          {/* Volumetric light beam gradient */}
          <linearGradient
            id={isLeft ? "leftBeamGrad" : "rightBeamGrad"}
            x1={isLeft ? "10%" : "90%"}
            y1="10%"
            x2={isLeft ? "70%" : "30%"}
            y2="100%"
          >
            <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#00C2FF" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#39FF88" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>
          {/* Bulb glow effect */}
          <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#00C2FF" stopOpacity="1" />
            <stop offset="60%" stopColor="#00C2FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Floodlight Beam */}
        <polygon
          points={
            isLeft
              ? "15,25 35,5 300,320 200,400"
              : "285,25 265,5 0,320 100,400"
          }
          fill={`url(#${isLeft ? "leftBeamGrad" : "rightBeamGrad"})`}
        />

        {/* Support Gantry Structure */}
        <path
          d={
            isLeft
              ? "M 10 50 L 50 10 M 15 5 L 45 45 M 25 5 L 25 55 M 10 25 L 50 25"
              : "M 290 50 L 250 10 M 285 5 L 255 45 M 275 5 L 275 55 M 290 25 L 250 25"
          }
          stroke="#475569"
          strokeWidth="1.5"
          opacity="0.3"
        />

        {/* Light Gantry Board (The Box) */}
        <rect
          x={isLeft ? "5" : "245"}
          y="5"
          width="50"
          height="50"
          rx="6"
          fill="url(#mastMetal)"
          stroke="#334155"
          strokeWidth="2"
          className="animate-light-pulse"
        />

        {/* Grid of Glowing LEDs */}
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => {
            const cx = (isLeft ? 12 : 252) + c * 11;
            const cy = 12 + r * 11;
            return (
              <g key={`${r}-${c}`} className="animate-light-pulse">
                <circle cx={cx} cy={cy} r="6" fill="url(#bulbGlow)" />
                <circle cx={cx} cy={cy} r="1.5" fill="#FFFFFF" />
              </g>
            );
          })
        )}

        {/* Volumetric Radial Glow on the entire panel */}
        <circle
          cx={isLeft ? "30" : "270"}
          cy="30"
          r="45"
          fill="url(#bulbGlow)"
          opacity="0.45"
          className="animate-light-pulse"
          style={{ animationDelay: "1s" }}
        />
      </svg>
    </div>
  );
}

// ---- Giant Cricket Ball Behind Typography ----
function GiantBackgroundBall() {
  return (
    <div
      className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] md:w-[650px] md:h-[650px] lg:w-[780px] lg:h-[780px] pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="w-full h-full opacity-[0.06] lg:opacity-[0.09]"
        viewBox="0 0 300 300"
        fill="none"
      >
        <defs>
          {/* Deep professional cricket ball leather shading */}
          <radialGradient id="ballShading" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FF4D4D" />
            <stop offset="35%" stopColor="#D91B1B" />
            <stop offset="75%" stopColor="#7A0000" />
            <stop offset="100%" stopColor="#2D0000" />
          </radialGradient>
          {/* 3D sphere shadow overlay */}
          <radialGradient id="sphereShadow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" stopOpacity="0" />
            <stop offset="100%" stopColor="#081826" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Ball main sphere */}
        <circle cx="150" cy="150" r="140" fill="url(#ballShading)" />

        {/* Spinning seam overlay group (only the seam rotates, keeping lighting static) */}
        <g
          className="animate-seam-rotate"
          style={{ transformOrigin: "150px 150px" }}
        >
          {/* Seam Center Ridge */}
          <path
            d="M 10 150 C 70 80, 230 80, 290 150"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeDasharray="6,4"
            fill="none"
            opacity="0.9"
          />
          <path
            d="M 10 150 C 70 220, 230 220, 290 150"
            stroke="#A00000"
            strokeWidth="3.5"
            strokeDasharray="6,4"
            fill="none"
            opacity="0.45"
          />

          {/* Seam Stitch Rows (Left & Right of Center Ridge) */}
          <path
            d="M 12 147 C 71 77, 229 77, 288 147"
            stroke="#EAEAEA"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            fill="none"
            opacity="0.75"
          />
          <path
            d="M 8 153 C 69 83, 231 83, 292 153"
            stroke="#EAEAEA"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            fill="none"
            opacity="0.75"
          />

          {/* Secondary stitch row for depth */}
          <path
            d="M 12 153 C 71 223, 229 223, 288 153"
            stroke="#900000"
            strokeWidth="1.5"
            strokeDasharray="2,3"
            fill="none"
            opacity="0.5"
          />
        </g>

        {/* 3D sphere shadow mask */}
        <circle cx="150" cy="150" r="140.5" fill="url(#sphereShadow)" />
      </svg>
    </div>
  );
}

// ---- Premium Bat and Stumps SVG Composition ----
function BatAndStumpsComposition() {
  return (
    <svg
      className="w-full h-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] filter"
      viewBox="0 0 340 400"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* Wood Texture Gradient for Stumps */}
        <linearGradient id="stumpWoodGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C68A4C" />
          <stop offset="25%" stopColor="#E5AB75" />
          <stop offset="50%" stopColor="#F5D0A9" />
          <stop offset="75%" stopColor="#C68A4C" />
          <stop offset="100%" stopColor="#8C5824" />
        </linearGradient>

        {/* Cyan Cyber Glow paint for the bat decals */}
        <linearGradient id="cyberGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#39FF88" />
        </linearGradient>

        {/* Bat Wood texture */}
        <linearGradient id="batWoodGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D99B59" />
          <stop offset="35%" stopColor="#F4C28D" />
          <stop offset="70%" stopColor="#D99B59" />
          <stop offset="100%" stopColor="#A66829" />
        </linearGradient>

        {/* Bat Handle rubber grip */}
        <linearGradient id="gripGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Ground grass reflection */}
        <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(8,24,38,0.9)" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ground shadows underneath stumps */}
      <ellipse cx="170" cy="350" rx="120" ry="12" fill="url(#groundShadow)" opacity="0.9" />
      <ellipse cx="140" cy="355" rx="80" ry="8" fill="rgba(0,194,255,0.15)" filter="blur(8px)" />

      {/* ============================================================
         THE THREE WICKETS (STUMPS)
         ============================================================ */}
      
      {/* Left Stump */}
      <g>
        {/* Base shadow */}
        <ellipse cx="105" cy="345" rx="10" ry="4" fill="rgba(0,0,0,0.5)" />
        {/* Wood body */}
        <rect x="98" y="100" width="14" height="245" rx="4" fill="url(#stumpWoodGrad)" />
        {/* Specular highlight lines */}
        <line x1="102" y1="102" x2="102" y2="343" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        <line x1="110" y1="102" x2="110" y2="343" stroke="#00C2FF" strokeWidth="0.8" opacity="0.25" />
      </g>

      {/* Middle Stump */}
      <g>
        {/* Base shadow */}
        <ellipse cx="170" cy="345" rx="10" ry="4" fill="rgba(0,0,0,0.5)" />
        {/* Wood body */}
        <rect x="163" y="90" width="14" height="255" rx="4" fill="url(#stumpWoodGrad)" />
        {/* Specular highlights */}
        <line x1="167" y1="92" x2="167" y2="343" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        <line x1="175" y1="92" x2="175" y2="343" stroke="#39FF88" strokeWidth="0.8" opacity="0.2" />
      </g>

      {/* Right Stump */}
      <g>
        {/* Base shadow */}
        <ellipse cx="235" cy="345" rx="10" ry="4" fill="rgba(0,0,0,0.5)" />
        {/* Wood body */}
        <rect x="228" y="100" width="14" height="245" rx="4" fill="url(#stumpWoodGrad)" />
        {/* Specular highlights */}
        <line x1="232" y1="102" x2="232" y2="343" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        <line x1="240" y1="102" x2="240" y2="343" stroke="#00C2FF" strokeWidth="0.8" opacity="0.25" />
      </g>

      {/* ============================================================
         THE TWO BAILS
         ============================================================ */}
      
      {/* Left Bail */}
      <g>
        <rect x="94" y="84" width="70" height="9" rx="3" fill="url(#stumpWoodGrad)" />
        <line x1="96" y1="86" x2="162" y2="86" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.4" />
        <ellipse cx="94" cy="88.5" rx="2" ry="4" fill="#8C5824" />
        <ellipse cx="164" cy="88.5" rx="2" ry="4" fill="#8C5824" />
      </g>

      {/* Right Bail */}
      <g>
        <rect x="168" y="84" width="70" height="9" rx="3" fill="url(#stumpWoodGrad)" />
        <line x1="170" y1="86" x2="236" y2="86" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.4" />
        <ellipse cx="168" cy="88.5" rx="2" ry="4" fill="#8C5824" />
        <ellipse cx="238" cy="88.5" rx="2" ry="4" fill="#8C5824" />
      </g>

      {/* ============================================================
         THE LEANING CRICKET BAT
         ============================================================ */}
      
      {/* Bat group rotated and translated for realistic composition */}
      <g transform="rotate(-15, 170, 200) translate(25, -25)">
        {/* Bat Drop Shadow on Stumps (drawn manually behind bat blade) */}
        <rect x="106" y="110" width="46" height="230" rx="6" fill="rgba(8,24,38,0.6)" filter="blur(8px)" />

        {/* Bat Handle (Grip) */}
        <rect x="121" y="5" width="14" height="105" rx="4" fill="url(#gripGrad)" stroke="#090d16" strokeWidth="1" />
        {/* Grip wrapping details (ridges) */}
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={i}
            x1="122"
            y1={10 + i * 5}
            x2="134"
            y2={10 + i * 5}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
        ))}
        {/* Handle wrap tape top */}
        <rect x="120" y="5" width="16" height="6" fill="#00C2FF" opacity="0.9" />

        {/* Bat Shoulders (Connection between handle and blade) */}
        <path
          d="M 103 125 C 105 110, 120 110, 122 110 L 134 110 C 136 110, 151 110, 153 125 Z"
          fill="url(#batWoodGrad)"
        />

        {/* Bat Blade */}
        <rect x="103" y="123" width="50" height="215" rx="7" fill="url(#batWoodGrad)" />

        {/* Wood grain curves */}
        <path d="M 108 135 Q 112 200, 108 315" stroke="#A66829" strokeWidth="1" opacity="0.3" fill="none" />
        <path d="M 118 140 Q 124 220, 120 325" stroke="#A66829" strokeWidth="1" opacity="0.25" fill="none" />
        <path d="M 132 140 Q 136 210, 134 320" stroke="#A66829" strokeWidth="1" opacity="0.2" fill="none" />
        <path d="M 144 135 Q 148 205, 146 315" stroke="#A66829" strokeWidth="1" opacity="0.3" fill="none" />

        {/* Cyan Decals (Cyber Stripes) */}
        <rect x="120" y="130" width="16" height="175" fill="url(#cyberGlow)" opacity="0.8" />
        {/* White brand lettering inside decal */}
        <text
          x="128"
          y="220"
          fill="#081826"
          fontSize="9"
          fontWeight="900"
          textAnchor="middle"
          transform="rotate(-90, 128, 220)"
          letterSpacing="2"
        >
          JAIPUR
        </text>

        {/* Specular edge highlights */}
        <line x1="106" y1="126" x2="106" y2="330" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.4" />
        <line x1="150" y1="126" x2="150" y2="330" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />

        {/* Sweet spot impact circular reflection */}
        <circle cx="128" cy="275" r="22" fill="#00C2FF" opacity="0.1" filter="blur(6px)" />
      </g>
    </svg>
  );
}

export default function HeroSection() {
  const [isMobile, setIsMobile] = useState(true);
  const [stats, setStats] = useState({
    activePlayers: "–",
    sundayGames: "–",
    sundaysActive: "–",
    communityLove: "∞"
  });

  useEffect(() => {
    async function loadDynamicStats() {
      try {
        const { data: dbPlayers, error: playersError } = await supabase
          .from("players")
          .select("id")
          .eq("approval_status", "approved")
          .eq("is_active", true);

        if (playersError) throw playersError;

        const { data: rivalrySeasons } = await supabase
          .from("rivalry_seasons")
          .select("total_matches_played");

        const activeCount = dbPlayers ? dbPlayers.length : 0;
        const totalMatches = rivalrySeasons
          ? rivalrySeasons.reduce((sum: number, s: any) => sum + (s.total_matches_played || 0), 0)
          : 0;

        setStats({
          activePlayers: `${activeCount}+`,
          sundayGames: `${totalMatches}+`,
          sundaysActive: `${totalMatches}+`,
          communityLove: "∞"
        });
      } catch (err) {
        console.error("Error loading dynamic hero section stats:", err);
      }
    }
    loadDynamicStats();
  }, []);

  // Parallax Motion Values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for lag-free cinematic feel
  const springConfig = { damping: 45, stiffness: 180, mass: 1 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  // Parallax layer transformations (Desktop Only)
  const bgX = useTransform(springX, [-0.5, 0.5], ["-8px", "8px"]);
  const bgY = useTransform(springY, [-0.5, 0.5], ["-8px", "8px"]);

  const ballX = useTransform(springX, [-0.5, 0.5], ["-16px", "16px"]);
  const ballY = useTransform(springY, [-0.5, 0.5], ["-16px", "16px"]);

  const textX = useTransform(springX, [-0.5, 0.5], ["-10px", "10px"]);
  const textY = useTransform(springY, [-0.5, 0.5], ["-10px", "10px"]);

  const compX = useTransform(springX, [-0.5, 0.5], ["-35px", "35px"]);
  const compY = useTransform(springY, [-0.5, 0.5], ["-35px", "35px"]);
  const compRotate = useTransform(springX, [-0.5, 0.5], [-2, 2]);

  useEffect(() => {
    // Wrap state update in requestAnimationFrame to prevent synchronous setState ESLint error
    requestAnimationFrame(() => {
      setIsMobile(window.innerWidth < 1024);
    });

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const xVal = (e.clientX - rect.left) / width - 0.5;
    const yVal = (e.clientY - rect.top) / height - 0.5;
    mouseX.set(xVal);
    mouseY.set(yVal);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-[95vh] flex items-center justify-center overflow-hidden hero-gradient"
    >
      {/* Cinematic Ambient Overlays */}
      <div className="hero-overlay z-10" />
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-[0.18] pointer-events-none z-0" />

      {/* ============================================================
         BACKGROUND LAYERS (Stadium Lights, Fog, Huge Ball)
         ============================================================ */}
      <motion.div
        style={{ x: !isMobile ? bgX : 0, y: !isMobile ? bgY : 0 }}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      >
        {/* Floodlights in top-left & top-right corners */}
        <StadiumFloodlight side="left" />
        <StadiumFloodlight side="right" />

        {/* Volumetric Fog Banks */}
        <div className="absolute bottom-0 left-0 right-0 h-[220px] pointer-events-none opacity-40 mix-blend-screen filter blur-xl">
          <svg className="w-full h-full animate-fog-drift" viewBox="0 0 1000 200" fill="none">
            <path
              d="M -100 150 Q 200 40, 500 130 T 1100 140 L 1100 250 L -100 250 Z"
              fill="rgba(0, 194, 255, 0.15)"
            />
            <path
              d="M -50 120 Q 300 20, 650 110 T 1150 100 L 1150 250 L -50 250 Z"
              fill="rgba(57, 255, 136, 0.08)"
            />
          </svg>
        </div>

        {/* Ambient Stadium Light Rays & Dot Pattern */}
        <div className="absolute inset-0 dot-pattern opacity-[0.12] pointer-events-none" />
      </motion.div>

      {/* Large Low-Opacity Seam-Rotating Cricket Ball (Layer 2) */}
      <motion.div
        style={{ x: !isMobile ? ballX : 0, y: !isMobile ? ballY : 0 }}
        className="absolute inset-0 w-full h-full pointer-events-none z-0 flex items-center justify-center"
      >
        <GiantBackgroundBall />
      </motion.div>

      {/* Fine Glowing Atmospheric Dust Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => {
          const delay = (i * 0.4).toFixed(1);
          const duration = (8 + (i % 5) * 3).toFixed(1);
          const left = `${(i * 4) % 96 + 2}%`;
          const size = `${2 + (i % 3)}px`;
          const colors = [
            "rgba(0, 194, 255, 0.25)",
            "rgba(57, 255, 136, 0.2)",
            "rgba(255, 184, 0, 0.15)",
          ];
          return (
            <div
              key={i}
              className="particle"
              style={{
                left,
                bottom: "-10px",
                width: size,
                height: size,
                background: colors[i % colors.length],
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                filter: "blur(0.5px)",
              }}
            />
          );
        })}
      </div>

      {/* ============================================================
         CONTENT GRID (Split Screen Desktop / Stacks Mobile)
         ============================================================ */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-48 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT SIDE: Cinematic Text & Action Buttons.
             Entrance uses CSS animations (not framer variants) so the LCP
             heading is present and painting at first paint, independent of JS
             hydration. The wrapper keeps the desktop mouse parallax. */}
          <motion.div
            style={{ x: !isMobile ? textX : 0, y: !isMobile ? textY : 0 }}
            className="lg:col-span-7 text-center lg:text-left flex flex-col justify-center"
          >
            {/* Status Badge */}
            <div className="mb-8 hero-enter hero-enter-d1">
              <div className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-accent opacity-45" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-jcc-accent" />
                </span>
                <span className="text-[10px] font-extrabold text-white/80 tracking-[0.25em] uppercase">
                  Est. 2025 • Jaipur&apos;s Elite Cricket Community
                </span>
              </div>
            </div>

            {/* Redesigned Bold Sports Title — LCP element, paints at first paint */}
            <h1
              className="hero-enter text-[2.75rem] sm:text-[4.5rem] md:text-[5.5rem] lg:text-[5.75rem] xl:text-[7rem] font-[950] text-white font-[var(--font-heading)] tracking-[-0.04em] leading-[0.82] mb-6 uppercase"
            >
              <span className="block mb-1 sm:mb-2">JAIPUR</span>
              <span className="block text-gradient-cyan mb-1 sm:mb-2">CRICKET</span>
              <span className="block">CIRCLE</span>
            </h1>

            {/* Redesigned Tagline (Premium Quote Style) */}
            <div className="relative mt-4 max-w-xl mx-auto lg:mx-0 hero-enter hero-enter-d2">
              <div className="pl-6 border-l-2 border-jcc-accent text-left">
                <blockquote className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white italic tracking-wide leading-tight">
                  &ldquo;Sunday isn&apos;t a day. <br />
                  It&apos;s <span className="text-gradient-cyan">match day</span>.&rdquo;
                </blockquote>
                <p className="mt-3 text-sm font-semibold tracking-wider text-jcc-text-muted uppercase">
                  Jaipur&apos;s premier social brotherhood built on weekly competition.
                </p>
              </div>
            </div>

            {/* Improved Premium CTA Buttons */}
            <div
              className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 hero-enter hero-enter-d3"
            >
              <Link
                href="/register"
                className="w-full sm:w-auto btn-vibrant-blue group text-sm font-black relative overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-jcc-accent to-jcc-green opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <CalendarCheck className="w-4.5 h-4.5" />
                  REGISTER FOR SUNDAY
                  <ChevronRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link
                href="/members"
                className="w-full sm:w-auto btn-ghost group text-sm font-black"
              >
                <Users className="w-4.5 h-4.5 text-jcc-accent group-hover:scale-110 transition-transform" />
                VIEW SQUAD
              </Link>
            </div>
          </motion.div>

          {/* RIGHT SIDE: Floating Interactive Bat & Stumps Composition */}
          <motion.div
            style={{
              x: !isMobile ? compX : 0,
              y: !isMobile ? compY : 0,
              rotate: !isMobile ? compRotate : 0,
            }}
            className="lg:col-span-5 flex items-center justify-center pointer-events-none z-10"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1.2, ease: "easeOut" }}
              className="w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px] lg:max-w-[440px] aspect-[4/5] flex items-center justify-center animate-slow-float"
            >
              <BatAndStumpsComposition />
            </motion.div>
          </motion.div>

        </div>

        {/* ============================================================
           BOTTOM STATS STRIP — Sports Dashboard Style
           ============================================================ */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
          className="relative z-20 mt-16 sm:mt-24 pt-8 border-t border-white/5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-jcc-accent">Season Registry</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-jcc-green opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-jcc-green" />
                </span>
                <h4 className="text-white/60 font-bold text-[10px] uppercase tracking-wider">Live Stats</h4>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { emoji: "👥", label: "Active Members", value: stats.activePlayers, color: "from-jcc-accent/20 to-transparent", border: "border-jcc-accent/20", textColor: "text-jcc-accent" },
              { emoji: "🏆", label: "Matches Played", value: stats.sundayGames, color: "from-yellow-400/20 to-transparent", border: "border-yellow-400/20", textColor: "text-yellow-400" },
              { emoji: "📅", label: "Sundays Active", value: stats.sundaysActive, color: "from-orange-500/20 to-transparent", border: "border-orange-500/20", textColor: "text-orange-400" },
              { emoji: "❤️", label: "Community Love", value: stats.communityLove, color: "from-jcc-green/20 to-transparent", border: "border-jcc-green/20", textColor: "text-jcc-green" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`group relative overflow-hidden rounded-xl bg-gradient-to-b ${stat.color} border ${stat.border} p-4 cursor-default hover:scale-[1.03] transition-all duration-300 hover:shadow-lg`}
              >
                <div className="text-2xl mb-2">{stat.emoji}</div>
                <div className={`text-xl font-black ${stat.textColor}`}>{stat.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Bouncing scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20"
      >
        <ChevronDown className="w-4.5 h-4.5 text-jcc-accent animate-bounce" />
      </motion.div>
    </section>
  );
}
