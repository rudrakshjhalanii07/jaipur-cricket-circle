"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Trophy, Play, CheckCircle2,
  Lock, ChevronRight, Loader2, AlertCircle, X
} from "lucide-react";

import { TEAMS, TEAM_ORDER, type TeamId, type TeamConfig } from "@/lib/teams";
import {
  computeStandings, formatNRR,
  type TournamentMatch, type Tournament, type TeamStanding,
} from "@/lib/tournament";
import {
  fetchActiveTournament, fetchTournamentMatches,
} from "@/lib/tournament-data";

// ─── Admin password helper ────────────────────────────────────────────────────

function getAdminPassword(): string | null {
  return typeof window !== "undefined"
    ? sessionStorage.getItem("jcc_admin_password")
    : null;
}

async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/verify-password", {
      method: "POST",
      headers: { "x-admin-password": password },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Promise-based admin password gate. Any action that needs the admin password
// calls `ensurePassword()`: if a valid password is already cached it resolves
// immediately, otherwise a modal pops up and re-prompts until the correct
// password is entered (or the user cancels, resolving to null). No need to
// visit /admin first.
function useAdminPassword() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((pw: string | null) => void) | null>(null);

  const ensurePassword = useCallback(async (): Promise<string | null> => {
    const stored = getAdminPassword();
    if (stored && (await verifyAdminPassword(stored))) return stored;
    if (stored && typeof window !== "undefined") sessionStorage.removeItem("jcc_admin_password");
    setInput("");
    setError(null);
    setOpen(true);
    return new Promise<string | null>((resolve) => { resolverRef.current = resolve; });
  }, []);

  const close = useCallback((pw: string | null) => {
    setOpen(false);
    setVerifying(false);
    resolverRef.current?.(pw);
    resolverRef.current = null;
  }, []);

  const submit = useCallback(async () => {
    const pw = input.trim();
    if (!pw) { setError("Enter the admin password."); return; }
    setVerifying(true);
    setError(null);
    const ok = await verifyAdminPassword(pw);
    if (!ok) {
      // Wrong password — keep the modal open and loop.
      setVerifying(false);
      setError("Incorrect password. Try again.");
      setInput("");
      return;
    }
    if (typeof window !== "undefined") sessionStorage.setItem("jcc_admin_password", pw);
    close(pw);
  }, [input, close]);

  const passwordModal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="w-full max-w-sm bg-[#07040A] border border-white/10 rounded-3xl overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div className="w-9 h-9 rounded-xl bg-jcc-ball-red/15 flex items-center justify-center">
                <Lock className="w-4 h-4 text-jcc-ball-red" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Admin Access</h3>
                <p className="text-[10px] text-white/35 font-bold">Enter the admin password to continue</p>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="px-6 py-5 space-y-4"
            >
              <input
                type="password"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Admin password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm font-medium focus:outline-none focus:border-white/25 placeholder:text-white/20"
              />
              {error && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-jcc-ball-red">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => close(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-white/50 hover:text-white/80 hover:border-white/25 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-jcc-ball-red text-xs font-black uppercase tracking-widest text-white flex items-center justify-center gap-1.5 disabled:opacity-60 transition-opacity"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {verifying ? "Verifying" : "Unlock"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return { ensurePassword, passwordModal };
}

// ─── Seam decorations (re-used across phases) ─────────────────────────────────

function SeamDots() {
  return (
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
}

function SeamLines() {
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

// ─── Jersey Pattern SVGs ──────────────────────────────────────────────────────

function TribalPattern({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 280" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <path d="M160,0 L200,40 L180,120 L140,160 L160,220 L120,280 L80,240 L60,170 L80,100 L40,40 Z" fill={color} opacity="0.12" />
      <path d="M-10,60 L30,30 L70,80 L50,150 L10,180 Z" fill={color} opacity="0.08" />
      <circle cx="100" cy="100" r="50" fill="none" stroke={color} strokeWidth="1.5" opacity="0.1" />
      <circle cx="100" cy="100" r="70" fill="none" stroke={color} strokeWidth="1" opacity="0.06" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <circle key={i} cx={100 + 62 * Math.cos((i * Math.PI) / 4)} cy={100 + 62 * Math.sin((i * Math.PI) / 4)} r="3" fill={color} opacity="0.18" />
      ))}
    </svg>
  );
}

function LightningPattern({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 280" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <path d="M130,0 L90,110 L118,110 L78,280 L148,130 L118,130 Z" fill={color} opacity="0.14" />
      <path d="M155,0 L115,110 L143,110 L103,280 L173,130 L143,130 Z" fill={color} opacity="0.07" />
      <line x1="0" y1="140" x2="200" y2="140" stroke={color} strokeWidth="0.5" opacity="0.1" />
    </svg>
  );
}

function ScratchPattern({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 280" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <path d="M60,0 L120,70 M65,0 L125,70 M55,0 L115,70" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.12" />
      <path d="M30,80 L110,170 M35,75 L115,165 M25,85 L105,175" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.09" />
      <path d="M80,170 L160,250 M85,165 L165,245 M75,175 L155,255" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

// ─── TeamLogo with fallback ───────────────────────────────────────────────────

function TeamLogo({ team, className = "" }: { team: TeamConfig; className?: string }) {
  const [error, setError] = useState(false);
  if (error) return <span className="font-black text-2xl select-none" style={{ color: team.primary }}>{team.shortName}</span>;
  return <img src={team.logo} alt={team.name} className={className} onError={() => setError(true)} />;
}

// ─── Jersey Card (captain showcase) ──────────────────────────────────────────

function JerseyCard({ team, delay = 0 }: { team: TeamConfig; delay?: number }) {
  const Pattern = team.patternType === "tribal" ? TribalPattern : team.patternType === "lightning" ? LightningPattern : ScratchPattern;
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-4"
    >
      <div
        className="relative w-44 sm:w-52 aspect-[3/4] rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1"
        style={{
          background: `linear-gradient(155deg, ${team.secondary} 0%, ${team.primary}18 60%, ${team.secondary} 100%)`,
          border: `1px solid ${team.primary}33`,
          boxShadow: `0 0 50px ${team.glow}, 0 0 0 1px ${team.primary}18`,
        }}
      >
        <Pattern color={team.primary} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-5 rounded-b-lg opacity-60" style={{ background: `linear-gradient(to bottom, ${team.primary}88, transparent)` }} />
        {[0, 1].map((i) => (
          <div key={i} className="absolute rounded-full" style={{ width: 6, height: 6, background: `${team.primary}44`, border: `1px solid ${team.primary}66`, top: 14 + i * 12, left: "50%", transform: "translateX(-50%)" }} />
        ))}
        <div className="relative z-10 flex flex-col items-center gap-1.5 pt-6">
          <div className="px-2.5 py-0.5 rounded text-[9px] font-black tracking-[0.35em] uppercase" style={{ background: `${team.primary}22`, color: team.primary, border: `1px solid ${team.primary}44` }}>CAPTAIN</div>
          <span className="text-2xl sm:text-3xl font-black tracking-[0.15em] uppercase text-white" style={{ textShadow: `0 0 20px ${team.glow}` }}>{team.captainShort}</span>
          {team.jerseyNumber !== null ? (
            <span className="text-5xl sm:text-6xl font-black leading-none" style={{ color: team.primary, textShadow: `0 0 30px ${team.glow}, 0 2px 0 rgba(0,0,0,0.5)` }}>{team.jerseyNumber}</span>
          ) : (
            <span className="text-2xl font-black opacity-30 text-white">—</span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5 opacity-40" style={{ background: `linear-gradient(to right, transparent, ${team.primary}, transparent)` }} />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-sm leading-tight">{team.captain}</p>
        <p className="text-xs font-semibold mt-0.5 opacity-60" style={{ color: team.primary }}>{team.name}</p>
      </div>
    </motion.div>
  );
}

// ─── Coin components (unchanged from toss page) ───────────────────────────────

function CoinFace({ team, isBack }: { team: TeamConfig; isBack: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : undefined,
        background: "radial-gradient(circle at 32% 22%, #FFFACC 0%, #F9D020 14%, #D4940A 38%, #A06308 62%, #5C3A00 100%)",
        boxShadow: ["inset 0 10px 28px rgba(255,245,100,0.55)", "inset 0 -10px 28px rgba(0,0,0,0.65)", "inset 5px 0 16px rgba(255,200,40,0.28)", "inset -3px 0 10px rgba(0,0,0,0.25)"].join(", "),
      }}
    >
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "repeating-conic-gradient(rgba(122,82,0,0.22) 0deg, rgba(122,82,0,0.22) 3deg, transparent 3deg, transparent 8deg)", WebkitMask: "radial-gradient(circle, transparent 49%, black 50%, black 82%, transparent 83%)", mask: "radial-gradient(circle, transparent 49%, black 50%, black 82%, transparent 83%)" }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <circle cx={128} cy={128} r={122} fill="none" stroke="#3A1E00" strokeWidth={8} strokeDasharray="3 2.2" opacity={0.85} />
        <circle cx={128} cy={128} r={115} fill="none" stroke="#FFE066" strokeWidth={2} opacity={0.55} />
        <circle cx={128} cy={128} r={65} fill="#C98E08" opacity={0.18} />
        <circle cx={128} cy={128} r={63} fill="none" stroke="#FFE066" strokeWidth={2} opacity={0.55} />
      </svg>
      <div className="absolute w-[38%] h-[38%] rounded-full blur-xl opacity-30 pointer-events-none" style={{ background: team.primary }} />
      <div className="relative z-10 w-[43%] h-[43%] flex items-center justify-center" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 1px 4px rgba(50,25,0,0.9))" }}>
        <TeamLogo team={team} className="w-full h-full object-contain" />
      </div>
      <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse at 27% 14%, rgba(255,255,230,0.58) 0%, rgba(255,240,160,0.22) 28%, transparent 58%)" }} />
    </div>
  );
}

function CoinToss({ teamA, teamB, onResult }: { teamA: TeamConfig; teamB: TeamConfig; onResult: (winner: TeamId) => void }) {
  const [rotation, setRotation] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [winner, setWinner] = useState<TeamConfig | null>(null);
  const [hasFlipped, setHasFlipped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => flip(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flip() {
    if (isFlipping || hasFlipped) return;
    setIsFlipping(true);
    const winnerTeam = Math.random() < 0.5 ? teamA : teamB;
    const winnerIsA = winnerTeam.id === teamA.id;
    const spins = 6 + Math.floor(Math.random() * 3);
    const finalRotation = spins * 360 + (winnerIsA ? 0 : 180);
    setRotation(finalRotation);
    setTimeout(() => {
      setWinner(winnerTeam);
      setHasFlipped(true);
      setIsFlipping(false);
      onResult(winnerTeam.id);
    }, 3600);
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <div style={{ perspective: "1200px" }} className="relative">
        <div className="absolute -inset-6 rounded-full blur-2xl opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle, #F5C418, #8B5E00)" }} />
        <AnimatePresence>
          {winner && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 0.55, scale: 1 }} className="absolute -inset-8 rounded-full blur-2xl pointer-events-none" style={{ background: winner.primary }} />
          )}
        </AnimatePresence>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-44 h-5 rounded-full blur-xl opacity-50" style={{ background: isFlipping ? "#6B4A00" : winner ? winner.primary : "#C98E08" }} />
        <motion.div
          className="relative w-52 h-52 sm:w-64 sm:h-64"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: rotation }}
          transition={{ duration: isFlipping ? 3.4 : 0, ease: [0.15, 0.05, 0.05, 1.0], type: "tween" }}
        >
          <CoinFace team={teamA} isBack={false} />
          <CoinFace team={teamB} isBack={true} />
        </motion.div>
      </div>

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

      {isFlipping && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/40 text-xs font-black tracking-[0.4em] uppercase">
          Flipping...
        </motion.p>
      )}

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <div className="px-10 py-7 rounded-3xl border" style={{ background: `linear-gradient(135deg, ${winner.secondary}, ${winner.primary}22)`, borderColor: `${winner.primary}44`, boxShadow: `0 0 60px ${winner.glow}` }}>
              <Trophy className="w-9 h-9 mx-auto mb-3" style={{ color: winner.primary }} />
              <p className="text-white/50 text-[10px] font-black tracking-[0.4em] uppercase mb-1.5">Won The Toss</p>
              <h3 className="text-4xl sm:text-5xl font-black uppercase tracking-wide" style={{ color: winner.primary, textShadow: `0 0 40px ${winner.glow}` }}>{winner.name}</h3>
              <p className="text-white/30 text-sm mt-2 font-medium italic">&ldquo;{winner.tagline}&rdquo;</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Match Scorecard Card ─────────────────────────────────────────────────────

function MatchCard({
  match,
  matchIndex,
  tournament,
  allMatches,
  onStartToss,
  onEnterResult,
}: {
  match: TournamentMatch;
  matchIndex: number;
  tournament: Tournament;
  allMatches: TournamentMatch[];
  onStartToss: (match: TournamentMatch) => void;
  onEnterResult: (match: TournamentMatch) => void;
}) {
  const t1 = match.team1_id ? TEAMS[match.team1_id] : null;
  const t2 = match.team2_id ? TEAMS[match.team2_id] : null;

  // Determine if this match is locked
  const prevMatch = matchIndex > 0 ? allMatches[matchIndex - 1] : null;
  const isLocked = prevMatch ? prevMatch.status !== "completed" : false;

  const isFinal = match.stage === "final";
  const isTBD = !match.team1_id || !match.team2_id;

  function scoreLabel(
    runs: number | null, wickets: number | null, overs: number | null,
    allOut: boolean, teamId: TeamId | null
  ): string {
    if (runs === null) return "—";
    const suffix = allOut ? "" : ` (${overs})`;
    return `${runs}/${wickets}${suffix}`;
  }

  const winnerTeam = match.winner_id ? TEAMS[match.winner_id] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: matchIndex * 0.1, type: "spring", stiffness: 160, damping: 20 }}
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background: match.status === "completed"
          ? `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`
          : isTBD
            ? "rgba(255,255,255,0.015)"
            : `linear-gradient(135deg, ${t1?.primary ?? "#fff"}08, ${t2?.primary ?? "#fff"}08)`,
        borderColor: match.status === "completed"
          ? "rgba(255,255,255,0.08)"
          : isLocked || isTBD
            ? "rgba(255,255,255,0.05)"
            : `rgba(255,255,255,0.12)`,
      }}
    >
      {/* Match header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/30">
            {isFinal ? "Final" : `Match ${match.match_no}`}
          </span>
          {isFinal && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              Final
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {match.status === "completed" && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400/70" />
          )}
          {isLocked && match.status === "scheduled" && (
            <Lock className="w-3 h-3 text-white/20" />
          )}
          <span className={`text-[9px] font-black tracking-widest uppercase ${match.status === "completed" ? "text-green-400/60" : match.status === "toss_done" ? "text-yellow-400/60" : isLocked || isTBD ? "text-white/15" : "text-white/30"}`}>
            {match.status === "completed" ? "Done" : match.status === "toss_done" ? "Toss Done" : isTBD ? "TBD" : isLocked ? "Locked" : "Scheduled"}
          </span>
        </div>
      </div>

      {/* Teams row */}
      <div className="px-5 py-5">
        {isTBD ? (
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                <span className="text-white/20 text-xs font-black">TBD</span>
              </div>
              <span className="text-white/20 text-xs font-black">Finalist 1</span>
            </div>
            <span className="text-white/10 font-black text-lg">vs</span>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                <span className="text-white/20 text-xs font-black">TBD</span>
              </div>
              <span className="text-white/20 text-xs font-black">Finalist 2</span>
            </div>
          </div>
        ) : (
          <div className="flex items-stretch gap-3">
            {/* Team 1 */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `${t1?.primary}18`, border: `1px solid ${t1?.primary}30` }}>
                {t1 && <TeamLogo team={t1} className="w-8 h-8 object-contain" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-center leading-tight" style={{ color: t1?.primary ?? "#fff" }}>{t1?.shortName}</span>
              {match.status === "completed" && (
                <span className="text-white font-black text-base leading-tight">
                  {scoreLabel(match.team1_runs, match.team1_wickets, match.team1_overs, match.team1_all_out, match.team1_id)}
                </span>
              )}
            </div>

            {/* VS / result */}
            <div className="flex flex-col items-center justify-center gap-1 min-w-[60px]">
              {match.status === "completed" && winnerTeam ? (
                <div className="text-center">
                  <p className="text-[8px] font-black tracking-widest uppercase text-white/30 mb-0.5">Winner</p>
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: winnerTeam.primary }}>{winnerTeam.shortName}</p>
                  {match.margin_type && match.margin_value !== null && (
                    <p className="text-[9px] text-white/30 mt-0.5">
                      by {match.margin_value} {match.margin_type}
                    </p>
                  )}
                  {match.super_over && (
                    <p className="text-[8px] text-yellow-400/60 mt-0.5">Super Over</p>
                  )}
                </div>
              ) : match.status === "completed" && match.is_tie ? (
                <span className="text-yellow-400/60 text-xs font-black">Tied</span>
              ) : (
                <span className="text-white/10 font-black text-lg">vs</span>
              )}
              {match.status === "toss_done" && match.toss_winner_id && (
                <div className="text-center mt-1">
                  <p className="text-[8px] font-black tracking-widest uppercase" style={{ color: TEAMS[match.toss_winner_id].primary }}>
                    {TEAMS[match.toss_winner_id].shortName} won toss
                  </p>
                  <p className="text-[8px] text-white/30 capitalize">{match.toss_decision}s first</p>
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `${t2?.primary}18`, border: `1px solid ${t2?.primary}30` }}>
                {t2 && <TeamLogo team={t2} className="w-8 h-8 object-contain" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-center leading-tight" style={{ color: t2?.primary ?? "#fff" }}>{t2?.shortName}</span>
              {match.status === "completed" && (
                <span className="text-white font-black text-base leading-tight">
                  {scoreLabel(match.team2_runs, match.team2_wickets, match.team2_overs, match.team2_all_out, match.team2_id)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action button */}
      {!isTBD && (
        <div className="px-5 pb-5">
          {match.status === "scheduled" && !isLocked && (
            <button
              onClick={() => onStartToss(match)}
              className="relative overflow-hidden w-full py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #E8537E, #B83060)", boxShadow: "0 6px 24px rgba(232,83,126,0.35)" }}
            >
              <SeamLines />
              <Play className="w-3.5 h-3.5" />
              Start Toss — Match {match.match_no}
            </button>
          )}
          {match.status === "toss_done" && (
            <button
              onClick={() => onEnterResult(match)}
              className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] text-white/90 border border-white/15 hover:border-white/30 transition-colors flex items-center justify-center gap-2"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Enter Result
            </button>
          )}
          {isLocked && match.status === "scheduled" && (
            <div className="w-full py-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest text-white/15 border border-white/5">
              Complete Match {match.match_no - 1} First
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Points Table ─────────────────────────────────────────────────────────────

function PointsTable({ standings, finalistIds }: { standings: TeamStanding[]; finalistIds?: TeamId[] }) {
  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400/60" />
        <span className="text-[10px] font-black tracking-[0.4em] uppercase text-white/40">Points Table</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">#</th>
              <th className="text-left px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">Team</th>
              <th className="text-center px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">P</th>
              <th className="text-center px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">W</th>
              <th className="text-center px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">L</th>
              <th className="text-center px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">Pts</th>
              <th className="text-center px-3 py-3 text-[9px] font-black tracking-widest uppercase text-white/25">NRR</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const team = TEAMS[s.team_id];
              const isFinalist = finalistIds?.includes(s.team_id);
              return (
                <tr
                  key={s.team_id}
                  className="border-b border-white/5 last:border-0"
                  style={{ background: isFinalist ? `${team.primary}08` : undefined }}
                >
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-white/40" : "text-white/20"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: `${team.primary}18` }}>
                        <TeamLogo team={team} className="w-5 h-5 object-contain" />
                      </div>
                      <div>
                        <span className="font-black text-white/80 text-[11px]">{team.shortName}</span>
                        {isFinalist && (
                          <span className="ml-1.5 text-[8px] font-black tracking-widest uppercase text-yellow-400/70">Final</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3.5 text-white/40 font-bold">{s.played}</td>
                  <td className="text-center px-3 py-3.5 text-white/60 font-bold">{s.won}</td>
                  <td className="text-center px-3 py-3.5 text-white/40 font-bold">{s.lost}</td>
                  <td className="text-center px-3 py-3.5">
                    <span className="font-black text-white/90">{s.points}</span>
                  </td>
                  <td className="text-center px-3 py-3.5">
                    <span className={`font-bold text-[11px] ${s.nrr >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                      {formatNRR(s.nrr)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Result Form ──────────────────────────────────────────────────────────────

function ResultForm({
  match,
  tournament,
  onClose,
  onSubmitted,
  ensurePassword,
}: {
  match: TournamentMatch;
  tournament: Tournament;
  onClose: () => void;
  onSubmitted: () => void;
  ensurePassword: () => Promise<string | null>;
}) {
  const t1 = match.team1_id ? TEAMS[match.team1_id] : null;
  const t2 = match.team2_id ? TEAMS[match.team2_id] : null;

  const [winnerId, setWinnerId] = useState<TeamId | "tie">(match.team1_id ?? "tie");
  const [marginType, setMarginType] = useState<"runs" | "wickets">("runs");
  const [marginValue, setMarginValue] = useState("");
  const [t1Runs, setT1Runs] = useState("");
  const [t1Wickets, setT1Wickets] = useState("");
  const [t1Overs, setT1Overs] = useState("");
  const [t1AllOut, setT1AllOut] = useState(false);
  const [t2Runs, setT2Runs] = useState("");
  const [t2Wickets, setT2Wickets] = useState("");
  const [t2Overs, setT2Overs] = useState("");
  const [t2AllOut, setT2AllOut] = useState(false);
  const [superOverPlayed, setSuperOverPlayed] = useState(false);
  const [soT1Runs, setSoT1Runs] = useState("");
  const [soT2Runs, setSoT2Runs] = useState("");
  const [soWinnerId, setSoWinnerId] = useState<TeamId>(match.team1_id ?? "mavericks");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTie = winnerId === "tie";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const password = await ensurePassword();
    if (!password) return;
    setSubmitting(true);

    const body = {
      match_id: match.id,
      tournament_id: match.tournament_id,
      winner_id: isTie ? null : winnerId as TeamId,
      margin_type: isTie ? null : marginType,
      margin_value: isTie ? null : parseInt(marginValue) || null,
      is_tie: isTie,
      team1_runs: parseInt(t1Runs) || 0,
      team1_wickets: parseInt(t1Wickets) || 0,
      team1_overs: parseFloat(t1Overs) || 0,
      team1_all_out: t1AllOut,
      team2_runs: parseInt(t2Runs) || 0,
      team2_wickets: parseInt(t2Wickets) || 0,
      team2_overs: parseFloat(t2Overs) || 0,
      team2_all_out: t2AllOut,
      ...(superOverPlayed && isTie
        ? { super_over: { team1_runs: parseInt(soT1Runs) || 0, team2_runs: parseInt(soT2Runs) || 0, winner_id: soWinnerId } }
        : {}),
    };

    try {
      const res = await fetch("/api/tournament/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save result");
        setSubmitting(false);
        return;
      }
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-medium focus:outline-none focus:border-white/25 placeholder:text-white/20";
  const labelCls = "text-[9px] font-black tracking-[0.3em] uppercase text-white/30 mb-1.5 block";

  function InningsRow({ teamId, runs, setRuns, wickets, setWickets, overs, setOvers, allOut, setAllOut }: {
    teamId: TeamId | null; runs: string; setRuns: (v: string) => void;
    wickets: string; setWickets: (v: string) => void;
    overs: string; setOvers: (v: string) => void;
    allOut: boolean; setAllOut: (v: boolean) => void;
  }) {
    const team = teamId ? TEAMS[teamId] : null;
    return (
      <div className="rounded-xl border border-white/8 p-4" style={{ background: team ? `${team.primary}06` : undefined }}>
        <div className="flex items-center gap-2 mb-3">
          {team && <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center" style={{ background: `${team.primary}20` }}><TeamLogo team={team} className="w-4 h-4 object-contain" /></div>}
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: team?.primary ?? "#fff" }}>{team?.name ?? "TBD"} innings</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Runs</label>
            <input type="number" min="0" placeholder="0" value={runs} onChange={(e) => setRuns(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Wickets</label>
            <input type="number" min="0" max="10" placeholder="0" value={wickets} onChange={(e) => setWickets(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Overs (e.g. 9.4)</label>
            <input type="number" min="0" step="0.1" placeholder="10.0" value={overs} onChange={(e) => setOvers(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={allOut} onChange={(e) => setAllOut(e.target.checked)} className="w-4 h-4 rounded accent-white/60" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/35">All Out</span>
        </label>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        className="w-full max-w-lg bg-[#07040A] border border-white/10 rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 sticky top-0 bg-[#07040A] z-10">
          <div>
            <p className="text-[9px] font-black tracking-[0.4em] uppercase text-white/30">
              {match.stage === "final" ? "Final" : `Match ${match.match_no}`}
            </p>
            <h3 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">Enter Result</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Innings */}
          <InningsRow teamId={match.team1_id} runs={t1Runs} setRuns={setT1Runs} wickets={t1Wickets} setWickets={setT1Wickets} overs={t1Overs} setOvers={setT1Overs} allOut={t1AllOut} setAllOut={setT1AllOut} />
          <InningsRow teamId={match.team2_id} runs={t2Runs} setRuns={setT2Runs} wickets={t2Wickets} setWickets={setT2Wickets} overs={t2Overs} setOvers={setT2Overs} allOut={t2AllOut} setAllOut={setT2AllOut} />

          {/* Winner */}
          <div>
            <label className={labelCls}>Winner</label>
            <div className="grid grid-cols-3 gap-2">
              {([match.team1_id, match.team2_id, "tie"] as const).map((id) => {
                const team = id && id !== "tie" ? TEAMS[id as TeamId] : null;
                const isSelected = winnerId === id;
                return (
                  <button
                    key={id ?? "tie"}
                    type="button"
                    onClick={() => setWinnerId(id ?? "tie")}
                    className="py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200"
                    style={{
                      borderColor: isSelected ? (team?.primary ?? "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.08)",
                      background: isSelected ? (team ? `${team.primary}15` : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.03)",
                      color: isSelected ? (team?.primary ?? "#fff") : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {id === "tie" ? "Tie" : team?.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Margin (only if not tie) */}
          {!isTie && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Margin Type</label>
                <div className="flex gap-2">
                  {(["runs", "wickets"] as const).map((mt) => (
                    <button key={mt} type="button" onClick={() => setMarginType(mt)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all" style={{ borderColor: marginType === mt ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)", background: marginType === mt ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", color: marginType === mt ? "#fff" : "rgba(255,255,255,0.3)" }}>
                      {mt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Margin</label>
                <input type="number" min="1" placeholder="e.g. 4" value={marginValue} onChange={(e) => setMarginValue(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Super over (only if tie) */}
          {isTie && (
            <div className="rounded-xl border border-white/8 p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={superOverPlayed} onChange={(e) => setSuperOverPlayed(e.target.checked)} className="w-4 h-4 rounded accent-yellow-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Super Over Played</span>
              </label>
              {superOverPlayed && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>{t1?.shortName} Super Over</label>
                      <input type="number" min="0" placeholder="0" value={soT1Runs} onChange={(e) => setSoT1Runs(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>{t2?.shortName} Super Over</label>
                      <input type="number" min="0" placeholder="0" value={soT2Runs} onChange={(e) => setSoT2Runs(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Super Over Winner</label>
                    <div className="flex gap-2">
                      {([match.team1_id, match.team2_id] as TeamId[]).map((id) => {
                        const team = TEAMS[id];
                        return (
                          <button key={id} type="button" onClick={() => setSoWinnerId(id)} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all" style={{ borderColor: soWinnerId === id ? team.primary : "rgba(255,255,255,0.08)", background: soWinnerId === id ? `${team.primary}15` : "rgba(255,255,255,0.03)", color: soWinnerId === id ? team.primary : "rgba(255,255,255,0.3)" }}>
                            {team.shortName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="relative overflow-hidden w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E8537E, #B83060)", boxShadow: "0 8px 36px rgba(232,83,126,0.45)" }}
          >
            <SeamLines />
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? "Saving..." : "Save Result"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageView =
  | "landing"
  | "schedule"
  | "captains"      // toss step 1
  | "toss"          // toss step 2 (coin flip)
  | "result_form";  // enter match result

export default function TournamentPage() {
  const [view, setView] = useState<PageView>("landing");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [oversInput, setOversInput] = useState("10");
  const [activeTossMatch, setActiveTossMatch] = useState<TournamentMatch | null>(null);
  const [tossWinnerId, setTossWinnerId] = useState<TeamId | null>(null);
  const [savingToss, setSavingToss] = useState(false);
  const [tossError, setTossError] = useState<string | null>(null);
  const [resultMatch, setResultMatch] = useState<TournamentMatch | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { ensurePassword, passwordModal } = useAdminPassword();

  const load = useCallback(async () => {
    setLoading(true);
    const t = await fetchActiveTournament();
    if (t) {
      const m = await fetchTournamentMatches(t.id);
      setTournament(t);
      setMatches(m);
      setView("schedule");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Hide the global navbar in immersive tournament phases (captains / toss)
  useEffect(() => {
    const nav = document.querySelector("nav") as HTMLElement | null;
    if (!nav) return;
    const immersive = view === "captains" || view === "toss";
    nav.style.display = immersive ? "none" : "";
    return () => { nav.style.display = ""; };
  }, [view]);

  // Derived standings
  const standings = tournament
    ? computeStandings(matches, tournament.overs_per_innings)
    : null;

  const leagueComplete = matches.filter((m) => m.stage === "league").every((m) => m.status === "completed");
  const finalMatch = matches.find((m) => m.stage === "final");
  const finalistIds = leagueComplete && finalMatch?.team1_id && finalMatch?.team2_id
    ? [finalMatch.team1_id, finalMatch.team2_id] as TeamId[]
    : undefined;

  // ── Start tournament ────────────────────────────────────────────────────────

  async function handleStartTournament() {
    const password = await ensurePassword();
    if (!password) return;
    setStarting(true);
    setStartError(null);

    const weekLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      const res = await fetch("/api/tournament/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ week_label: weekLabel, overs_per_innings: parseInt(oversInput) || 10 }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStartError(data.error ?? "Failed to start tournament");
        setStarting(false);
        return;
      }
      await load();
    } catch {
      setStartError("Network error. Please try again.");
      setStarting(false);
    }
  }

  // ── Toss flow ───────────────────────────────────────────────────────────────

  function handleStartToss(match: TournamentMatch) {
    setActiveTossMatch(match);
    setTossWinnerId(null);
    setTossError(null);
    setView("captains");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleTossResult(winnerId: TeamId) {
    setTossWinnerId(winnerId);
  }

  async function saveToss(decision: "bat" | "bowl") {
    if (!activeTossMatch || !tossWinnerId) return;
    const password = await ensurePassword();
    if (!password) return;
    setSavingToss(true);
    setTossError(null);
    try {
      const res = await fetch("/api/tournament/toss", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ match_id: activeTossMatch.id, toss_winner_id: tossWinnerId, toss_decision: decision }),
      });
      if (!res.ok) {
        const data = await res.json();
        setTossError(data.error ?? "Failed to save toss");
        setSavingToss(false);
        return;
      }
      await load();
      setView("schedule");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setTossError("Network error.");
      setSavingToss(false);
    }
  }

  // ── Result flow ─────────────────────────────────────────────────────────────

  function handleEnterResult(match: TournamentMatch) {
    setResultMatch(match);
  }

  async function handleCancelTournament() {
    if (!tournament) return;
    const password = await ensurePassword();
    if (!password) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/tournament/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ tournament_id: tournament.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error ?? "Failed to cancel tournament");
        setCancelling(false);
        return;
      }
      setTournament(null);
      setMatches([]);
      setShowCancelConfirm(false);
      setView("landing");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setCancelError("Network error. Please try again.");
      setCancelling(false);
    }
  }

  async function handleResultSubmitted() {
    setResultMatch(null);
    await load();
  }

  // ── Landing ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
      </div>
    );
  }

  if (view === "landing") {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden">
        <SeamDots />

        {/* Atmosphere */}
        <div className="absolute top-1/4 left-1/3 w-[480px] h-[480px] rounded-full blur-[140px] opacity-[0.1] pointer-events-none" style={{ background: "#E8537E" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[380px] h-[380px] rounded-full blur-[120px] opacity-[0.08] pointer-events-none" style={{ background: "#3B6FC4" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.06] pointer-events-none" style={{ background: "#1A7A5E" }} />

        <Link href="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs font-black uppercase tracking-widest">
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>

        <motion.div
          className="flex flex-col items-center gap-10 text-center px-6 max-w-3xl w-full"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
        >
          <motion.span
            variants={{ hidden: { opacity: 0, y: -16 }, visible: { opacity: 1, y: 0 } }}
            className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase"
          >
            Jaipur Cricket Circle
          </motion.span>

          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.75 }, visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 100, damping: 14 } } }}
            className="flex flex-col items-center leading-none"
          >
            <h1 className="text-[clamp(3rem,13vw,9rem)] font-black uppercase tracking-tight text-white" style={{ textShadow: "0 0 100px rgba(232,83,126,0.25)" }}>
              THE
            </h1>
            <h1
              className="text-[clamp(3rem,13vw,9rem)] font-black uppercase tracking-tight"
              style={{ color: "#E8537E", textShadow: "0 0 80px rgba(232,83,126,0.65), 0 0 160px rgba(232,83,126,0.25)" }}
            >
              TOURNAMENT
            </h1>
          </motion.div>

          {/* Three team cards */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="grid grid-cols-3 gap-3 sm:gap-5 w-full"
          >
            {TEAM_ORDER.map((id) => {
              const t = TEAMS[id];
              return (
                <div
                  key={id}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl border"
                  style={{ background: `${t.primary}0A`, borderColor: `${t.primary}33`, boxShadow: `0 0 30px ${t.primary}18` }}
                >
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `${t.primary}18`, border: `1px solid ${t.primary}30` }}>
                    <TeamLogo team={t} className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
                  </div>
                  <div>
                    <p className="font-black text-[11px] sm:text-sm uppercase tracking-wider text-white/90">{t.name}</p>
                    <p className="text-[9px] font-semibold tracking-widest uppercase mt-0.5 opacity-60" style={{ color: t.primary }}>{t.tagline}</p>
                  </div>
                  <div className="w-full pt-2 border-t border-white/5">
                    <p className="text-[8px] font-black tracking-[0.3em] uppercase text-white/25 mb-0.5">Captain</p>
                    <p className="text-[10px] font-bold text-white/60">{t.captain}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Overs input + start */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="flex flex-col items-center gap-4 w-full max-w-xs"
          >
            <div className="w-full">
              <label className="text-[9px] font-black tracking-[0.4em] uppercase text-white/30 mb-2 block text-center">Overs Per Innings</label>
              <input
                type="number"
                min="1"
                max="50"
                value={oversInput}
                onChange={(e) => setOversInput(e.target.value)}
                className="w-full text-center bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl focus:outline-none focus:border-white/25"
              />
            </div>
            {startError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 w-full">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs font-medium">{startError}</p>
              </div>
            )}
            <motion.button
              onClick={handleStartTournament}
              disabled={starting}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="relative overflow-hidden px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white flex items-center gap-2 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #E8537E, #B83060)", boxShadow: "0 8px 36px rgba(232,83,126,0.45)" }}
            >
              <SeamLines />
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              {starting ? "Scheduling Your Matches..." : "Start Tournament"}
            </motion.button>
          </motion.div>
        </motion.div>
        {passwordModal}
      </div>
    );
  }

  // ── Schedule view ────────────────────────────────────────────────────────────

  if (view === "schedule") {
    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] relative overflow-hidden">
        <SeamDots />

        <div className="absolute top-1/4 left-1/4 w-[500px] h-[300px] rounded-full blur-[150px] opacity-[0.07] pointer-events-none" style={{ background: "#E8537E" }} />

        <div className="max-w-2xl mx-auto px-4 pt-36 pb-24">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs font-black uppercase tracking-widest">
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>

          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
                  {tournament?.week_label} · {tournament?.overs_per_innings} overs
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mt-1">Match Schedule</h1>
              </div>
              {tournament?.status !== "completed" && (
                <button
                  onClick={() => { setShowCancelConfirm(true); setCancelError(null); }}
                  className="flex-shrink-0 mt-1 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/25 border border-white/8 hover:border-red-500/30 hover:text-red-400/70 transition-all duration-200"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Inline cancel confirm */}
            <AnimatePresence>
              {showCancelConfirm && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 rounded-2xl border border-red-500/20 p-4"
                  style={{ background: "rgba(239,68,68,0.05)" }}
                >
                  <p className="text-white/70 text-sm font-semibold mb-1">Reset this tournament?</p>
                  <p className="text-white/30 text-xs mb-4">All match data and results for this week will be permanently deleted. This cannot be undone.</p>
                  {cancelError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-xs font-medium">{cancelError}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelTournament}
                      disabled={cancelling}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {cancelling ? "Resetting..." : "Yes, Reset"}
                    </button>
                    <button
                      onClick={() => { setShowCancelConfirm(false); setCancelError(null); }}
                      disabled={cancelling}
                      className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white/35 border border-white/8 hover:text-white/60 hover:border-white/20 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Match cards */}
          <div className="space-y-3 mb-10">
            {matches.map((match, idx) => (
              <MatchCard
                key={match.id}
                match={match}
                matchIndex={idx}
                tournament={tournament!}
                allMatches={matches}
                onStartToss={handleStartToss}
                onEnterResult={handleEnterResult}
              />
            ))}
          </div>

          {/* Points table */}
          {standings && <PointsTable standings={standings} finalistIds={finalistIds} />}

          {/* Champion banner */}
          {tournament?.status === "completed" && tournament.champion_team_id && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-2xl border border-yellow-500/30 p-6 text-center"
              style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.02))" }}
            >
              <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-[9px] font-black tracking-[0.5em] uppercase text-yellow-400/60 mb-1">Tournament Champion</p>
              <h2 className="text-2xl font-black uppercase tracking-wide" style={{ color: TEAMS[tournament.champion_team_id as TeamId]?.primary }}>
                {TEAMS[tournament.champion_team_id as TeamId]?.name}
              </h2>
            </motion.div>
          )}
        </div>

        {/* Result form modal */}
        <AnimatePresence>
          {resultMatch && tournament && (
            <ResultForm
              match={resultMatch}
              tournament={tournament}
              onClose={() => setResultMatch(null)}
              onSubmitted={handleResultSubmitted}
              ensurePassword={ensurePassword}
            />
          )}
        </AnimatePresence>
        {passwordModal}
      </div>
    );
  }

  // ── Captains (toss step 1) ───────────────────────────────────────────────────

  if (view === "captains" && activeTossMatch) {
    const t1 = activeTossMatch.team1_id ? TEAMS[activeTossMatch.team1_id] : null;
    const t2 = activeTossMatch.team2_id ? TEAMS[activeTossMatch.team2_id] : null;
    if (!t1 || !t2) return null;

    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden px-4 py-16">
        <SeamDots />
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full blur-[130px] opacity-20 pointer-events-none" style={{ background: t1.primary }} />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-[130px] opacity-20 pointer-events-none" style={{ background: t2.primary }} />

        <button onClick={() => setView("schedule")} className="absolute top-5 left-5 flex items-center gap-1.5 text-white/20 hover:text-white/50 transition-colors text-[10px] font-black uppercase tracking-widest">
          <ArrowLeft className="w-3 h-3" />
          Exit
        </button>

        <motion.div className="w-full max-w-3xl flex flex-col items-center gap-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
              {activeTossMatch.stage === "final" ? "Final" : `Match ${activeTossMatch.match_no}`}
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">Welcome, Captains</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 w-full">
            <JerseyCard team={t1} delay={0.15} />
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 180, damping: 16 }}>
              <span className="text-6xl font-black text-white/8 uppercase select-none">vs</span>
            </motion.div>
            <JerseyCard team={t2} delay={0.3} />
          </div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            onClick={() => { setView("toss"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="relative overflow-hidden px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] text-white"
            style={{ background: "linear-gradient(135deg, #E8537E, #B83060)", boxShadow: "0 8px 40px rgba(232,83,126,0.5)" }}
          >
            <SeamLines />
            Proceed to Coin Flip →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Toss (coin flip, step 2) ─────────────────────────────────────────────────

  if (view === "toss" && activeTossMatch) {
    const t1 = activeTossMatch.team1_id ? TEAMS[activeTossMatch.team1_id] : null;
    const t2 = activeTossMatch.team2_id ? TEAMS[activeTossMatch.team2_id] : null;
    if (!t1 || !t2) return null;

    return (
      <div className="theme-static-dark min-h-screen bg-[#07040A] flex flex-col items-center justify-center relative overflow-hidden px-4 py-16">
        <SeamDots />

        {tossWinnerId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 30%, ${TEAMS[tossWinnerId].glow} 0%, transparent 65%)` }} />
        )}

        <button onClick={() => setView("captains")} className="absolute top-5 left-5 flex items-center gap-1.5 text-white/20 hover:text-white/50 transition-colors text-[10px] font-black uppercase tracking-widest">
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>

        <motion.div className="w-full max-w-2xl flex flex-col items-center gap-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-jcc-accent text-[10px] font-black tracking-[0.5em] uppercase">
              {activeTossMatch.stage === "final" ? "Final" : `Match ${activeTossMatch.match_no}`}
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              {tossWinnerId ? "Toss Result" : "The Coin Flip"}
            </h2>
          </div>

          <CoinToss teamA={t1} teamB={t2} onResult={handleTossResult} />

          {/* Post-toss: choose bat/bowl then save */}
          <AnimatePresence>
            {tossWinnerId && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-4 w-full max-w-sm"
              >
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-white/40">
                  {TEAMS[tossWinnerId].name} elects to...
                </p>
                <div className="flex gap-3 w-full">
                  {(["bat", "bowl"] as const).map((dec) => (
                    <button
                      key={dec}
                      onClick={() => saveToss(dec)}
                      disabled={savingToss}
                      className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-[0.15em] border transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
                      style={{ borderColor: `${TEAMS[tossWinnerId].primary}50`, background: `${TEAMS[tossWinnerId].primary}10`, color: TEAMS[tossWinnerId].primary }}
                    >
                      {savingToss ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : dec}
                    </button>
                  ))}
                </div>
                {tossError && (
                  <p className="text-red-400 text-xs font-medium">{tossError}</p>
                )}
                <button
                  onClick={() => { setView("schedule"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-white/40 border border-white/8 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Go to Match Schedule
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {passwordModal}
      </div>
    );
  }

  return null;
}
