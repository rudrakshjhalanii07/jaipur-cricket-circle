"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Gavel,
  Lock,
  Loader2,
  AlertCircle,
  Sparkles,
  Trophy,
} from "lucide-react";

import { TEAMS, TEAM_ORDER_ALL, type TeamId } from "@/lib/teams";
import type { AuctionExperienceProps } from "@/lib/auctionos/core/template";
import type {
  Auction,
  AuctionWallet,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  CaptainValuation,
} from "@/lib/auctionos/core/types";
import { liveEngine, type AuctionEngine } from "./engine";
import { formatLakhs, getNextBidIncrement } from "./rules";
import { getDiceBearUrl } from "@/lib/avatar";
import { SMOOTH_EASE } from "@/lib/animations";
import RollingNumber from "@/components/auctionos/RollingNumber";
import AuctionCountdown from "@/components/auctionos/AuctionCountdown";
import { AuctionOSMark, AuctionOSSeal, HeroBackdrop } from "@/components/auctionos/AuctionOSBrand";

const POLL_INTERVAL_MS = 4000;

// ─── Small metadata accessors — JCC stores role/image on the generic
// lot.metadata JSON blob rather than as typed columns. ─────────────────────

function lotRole(lot: AuctionLot): string {
  return (lot.metadata?.role as string | undefined) ?? "All-Rounder";
}

function lotImage(lot: AuctionLot): string | null {
  return (lot.metadata?.image as string | null | undefined) ?? null;
}

function teamKeyOf(wallets: AuctionWallet[], walletId: string | null): TeamId | null {
  if (!walletId) return null;
  const w = wallets.find((x) => x.id === walletId);
  return w ? (w.team_id as TeamId) : null;
}

function walletForTeam(wallets: AuctionWallet[], teamId: TeamId): AuctionWallet | undefined {
  return wallets.find((w) => w.team_id === teamId);
}

// captain_valuations is an append-only log (see AUCTIONOS.md) — "current"
// value is just the latest row per captain_id. fetchCaptainValuations()
// already orders newest-first, so the first hit per captain wins.
function latestValuationByCaptain(valuations: CaptainValuation[]): Map<string, CaptainValuation> {
  const map = new Map<string, CaptainValuation>();
  for (const v of valuations) {
    if (!map.has(v.captain_id)) map.set(v.captain_id, v);
  }
  return map;
}

// ─── Admin password gate (same pattern/sessionStorage key as the tournament
// page's local hook — unlocking on one admin page unlocks the other). ──────

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

function useAdminPassword() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((pw: string | null) => void) | null>(null);

  const ensurePassword = useCallback(async (): Promise<string | null> => {
    const stored = getAdminPassword();
    if (stored && (await verifyAdminPassword(stored))) return stored;
    if (stored && typeof window !== "undefined")
      sessionStorage.removeItem("jcc_admin_password");
    setInput("");
    setError(null);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((pw: string | null) => {
    setOpen(false);
    setVerifying(false);
    resolverRef.current?.(pw);
    resolverRef.current = null;
  }, []);

  const submit = useCallback(async () => {
    const pw = input.trim();
    if (!pw) {
      setError("Enter the admin password.");
      return;
    }
    setVerifying(true);
    setError(null);
    const ok = await verifyAdminPassword(pw);
    if (!ok) {
      setVerifying(false);
      setError("Incorrect password. Try again.");
      setInput("");
      return;
    }
    if (typeof window !== "undefined")
      sessionStorage.setItem("jcc_admin_password", pw);
    close(pw);
  }, [input, close]);

  const passwordModal = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-jcc-blue/25 backdrop-blur-md px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="premium-card w-full max-w-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-jcc-border">
              <AuctionOSSeal className="w-10 h-10 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-jcc-text-primary">
                  Auctioneer Access
                </h3>
                <p className="text-[10px] text-jcc-text-muted font-bold">
                  Enter the admin password to continue
                </p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="px-6 py-5 space-y-4"
            >
              <input
                type="password"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Admin password"
                className="w-full bg-jcc-navy-light border border-jcc-border rounded-xl px-3.5 py-3 text-jcc-text-primary text-sm font-medium focus:outline-none focus:border-jcc-accent placeholder:text-jcc-text-muted/60"
              />
              {error && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-jcc-danger">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => close(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-jcc-border text-xs font-black uppercase tracking-widest text-jcc-text-muted hover:text-jcc-text-primary hover:border-jcc-accent/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-jcc-blue text-xs font-black uppercase tracking-widest text-white flex items-center justify-center gap-1.5 border border-jcc-accent disabled:opacity-60 transition-opacity"
                >
                  {verifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
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

// ─── Team crest with initials fallback (mirrors the tournament page's
// local TeamLogo — each immersive page keeps its own small copy). ──────────

function TeamLogo({ teamId, className = "" }: { teamId: TeamId; className?: string }) {
  const team = TEAMS[teamId];
  const [error, setError] = useState(false);
  if (error)
    return (
      <span className="font-black select-none" style={{ color: team.primary }}>
        {team.shortName}
      </span>
    );
  return (
    <img
      src={team.logo}
      alt={team.name}
      className={className}
      onError={() => setError(true)}
    />
  );
}

// Real member photo → the site's editorial portrait treatment; DiceBear
// illustration fallback → plain, no photo filter (per globals.css convention).
function PlayerPortrait({
  name,
  image,
  className = "",
}: {
  name: string;
  image: string | null | undefined;
  className?: string;
}) {
  if (image) {
    return (
      <div className={`portrait-frame group ${className}`}>
        <img src={image} alt={name} className="portrait-photo w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={className}>
      <img
        src={getDiceBearUrl(name)}
        alt={name}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// ─── Section eyebrow — the shared gold hairline + label used across the
// hall so every band reads with the same editorial rhythm. ─────────────────

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="h-px w-8 bg-jcc-border-bright" />
      <span className="text-jcc-accent-dark text-[10px] font-black tracking-[0.4em] uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-jcc-border-bright" />
    </div>
  );
}

// ─── Hammer sequence overlay ────────────────────────────────────────────────

type HammerPhase = "idle" | "going_once" | "going_twice" | "sold";

function HammerOverlay({
  phase,
  playerName,
  price,
  teamName,
}: {
  phase: HammerPhase;
  playerName: string | null;
  price: number | null;
  teamName: string | null;
}) {
  return (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[250] bg-jcc-navy-deep/96 backdrop-blur-md flex flex-col items-center justify-center gap-4"
        >
          <div className="stadium-glow pointer-events-none" />
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.94 }}
              transition={{ duration: 0.45, ease: SMOOTH_EASE }}
              className="text-center px-6 relative z-10"
            >
              {phase === "sold" ? (
                <>
                  <p className="text-jcc-accent-dark text-xs font-black tracking-[0.5em] uppercase mb-4">
                    {teamName}
                  </p>
                  <h2
                    className="text-[clamp(3rem,11vw,7.5rem)] font-black uppercase leading-none text-gradient-gold"
                    style={{ filter: "drop-shadow(0 8px 40px rgba(212,175,55,0.35))" }}
                  >
                    Sold
                  </h2>
                  <p className="score-number text-2xl sm:text-3xl text-jcc-accent-dark mt-5 font-black">
                    {formatLakhs(price ?? 0)}
                  </p>
                  <p className="text-jcc-text-muted text-sm mt-2 font-bold">{playerName}</p>
                </>
              ) : (
                <h2 className="text-[clamp(2.25rem,8vw,5rem)] font-black uppercase text-jcc-text-primary tracking-wide">
                  {phase === "going_once" ? "Going Once" : "Going Twice"}
                </h2>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Captain Desk ───────────────────────────────────────────────────────────

function CaptainDesk({
  teamId,
  purse,
  isLeading,
  canBid,
  cooldown,
  onRaisePaddle,
  hasCaptain,
  captainValue,
  previewBudget,
  previewCaptainValue,
}: {
  teamId: TeamId;
  purse: AuctionWallet | undefined;
  isLeading: boolean;
  canBid: boolean;
  cooldown: boolean;
  onRaisePaddle: () => void;
  hasCaptain: boolean;
  captainValue: number | null;
  previewBudget: number;
  previewCaptainValue: number | null;
}) {
  const team = TEAMS[teamId];
  const budgetChanges = previewBudget !== (purse?.budget_remaining ?? 0);
  return (
    <motion.div
      className={`id-card relative p-7 flex flex-col items-center gap-4 text-center transition-shadow duration-500 ${isLeading ? "shadow-[0_0_0_1px_rgba(212,175,55,0.55),0_18px_44px_-20px_rgba(212,175,55,0.5)]" : ""}`}
      style={{ borderColor: `${team.primary}70`, borderWidth: 2 }}
      animate={isLeading ? { y: -3 } : { y: 0 }}
      transition={{ duration: 0.5, ease: SMOOTH_EASE }}
    >
      <TeamLogo teamId={teamId} className="w-20 h-20 object-contain" />
      <p className="text-xs text-jcc-text-muted font-bold -mt-1">{team.captain}</p>
      <div className="w-full pt-2 border-t border-jcc-border grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">Purse Left</p>
          <p className="score-number text-lg font-black text-jcc-text-primary">
            {formatLakhs(purse?.budget_remaining ?? 0)}
          </p>
          {budgetChanges && (
            <p className="font-body text-xs font-bold text-jcc-accent-dark mt-0.5">
              → {formatLakhs(previewBudget)} if won
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">Squad</p>
          <p className="score-number text-lg font-black text-jcc-text-primary">{purse?.acquired_count ?? 0}</p>
        </div>
      </div>
      {hasCaptain && (
        <div className="w-full pt-2 border-t border-jcc-border">
          <p className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">
            <Crown className="w-3.5 h-3.5 text-jcc-accent-dark" /> Captain Value
          </p>
          <p className="score-number text-lg font-black text-jcc-accent-dark">
            {captainValue != null ? formatLakhs(captainValue) : "—"}
          </p>
          {previewCaptainValue != null && (
            <p className="font-body text-xs font-bold text-jcc-accent-dark mt-0.5">
              → {formatLakhs(previewCaptainValue)} if this sale completes
            </p>
          )}
        </div>
      )}
      <button
        onClick={onRaisePaddle}
        disabled={!canBid || isLeading || cooldown}
        className="auction-paddle w-full mt-1"
      >
        {cooldown && (
          <span
            className="auction-paddle-cooldown-ring"
            style={{ animationDuration: "1.5s" }}
          />
        )}
        {isLeading ? "Leading Bid" : "Raise Paddle"}
      </button>
    </motion.div>
  );
}

// ─── Main experience ────────────────────────────────────────────────────────

type ViewPhase = "hero" | "hall";

// `engine` is deliberately not part of the shared AuctionExperienceProps
// contract (lib/auctionos/core/template.ts) — it's how this template plugs
// in a transport, not a cross-template concern. Defaults to the real
// Supabase-backed engine; /auctionos/dev passes an in-memory mock instead.
interface JccAuctionExperienceProps extends AuctionExperienceProps {
  engine?: AuctionEngine;
}

export default function AuctionExperience({
  initialAuction,
  initialWallets,
  initialLots,
  initialCategories,
  engine = liveEngine,
}: JccAuctionExperienceProps) {
  const [season, setSeason] = useState<Auction | null>(initialAuction);
  const [participants, setParticipants] = useState<AuctionWallet[]>(initialWallets);
  const [lots, setLots] = useState<AuctionLot[]>(initialLots);
  // Auction creation has moved to the AuctionOS wizard (app/auctionos/new)
  // — this template's hall UI only bids in auctions already prepared
  // there, and the wizard assigns a real category_id per lot. Read here so
  // the next-bid preview can apply a category's bid_increment override,
  // matching what app/api/auctionos/bid/route.ts actually charges.
  const [categories, setCategories] = useState<AuctionCategory[]>(initialCategories);
  const [captains, setCaptains] = useState<AuctionCaptain[]>([]);
  const [captainValuations, setCaptainValuations] = useState<CaptainValuation[]>([]);
  const [view, setView] = useState<ViewPhase>("hero");
  const [mounted, setMounted] = useState(false);

  const [advancing, setAdvancing] = useState(false);
  const [cooldownTeams, setCooldownTeams] = useState<Record<string, boolean>>({});
  const [hammerPhase, setHammerPhase] = useState<HammerPhase>("idle");
  const [lastSoldSnapshot, setLastSoldSnapshot] = useState<AuctionLot | null>(null);

  const { ensurePassword, passwordModal } = useAdminPassword();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const refresh = useCallback(async () => {
    const snap = await engine.refresh();
    setSeason(snap.auction);
    setParticipants(snap.wallets);
    setLots(snap.lots);
    setCategories(snap.categories);
    setCaptains(snap.captains);
    setCaptainValuations(snap.captainValuations);
  }, [engine]);

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Hide the global navbar in the immersive hall view, like the tournament
  // page does for its captains/toss phases.
  useEffect(() => {
    const nav = document.querySelector("nav") as HTMLElement | null;
    if (!nav) return;
    nav.style.display = view === "hall" ? "none" : "";
    return () => {
      nav.style.display = "";
    };
  }, [view]);

  const valuationByCaptain = latestValuationByCaptain(captainValuations);

  const onBlockLot = lots.find((p) => p.status === "on_block") ?? null;
  const onBlockCategory = onBlockLot?.category_id
    ? categories.find((c) => c.id === onBlockLot.category_id) ?? null
    : null;
  const upcomingLots = lots.filter((p) => p.status === "upcoming");
  const soldLots = [...lots.filter((p) => p.status === "sold")].sort((a, b) =>
    (b.sold_at ?? "").localeCompare(a.sold_at ?? "")
  );
  const totalLots = lots.length;
  const resolvedCount = lots.filter((p) => p.status === "sold" || p.status === "unsold").length;
  const isComplete = season?.status === "completed" || (totalLots > 0 && resolvedCount === totalLots);

  // Resolves the admin password only when the engine actually needs one —
  // the mock engine does nothing off-browser, so /auctionos/dev never shows
  // this prompt. Returns `false` to mean "caller should bail", distinct
  // from a resolved `null` password on a no-auth engine.
  async function ensureEngineAuth(): Promise<string | null | false> {
    if (!engine.requiresAdminAuth) return null;
    const password = await ensurePassword();
    return password ?? false;
  }

  async function handleAdvance() {
    if (!season) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setAdvancing(true);
    await engine.advance(season.id, password);
    await refresh();
    setAdvancing(false);
  }

  async function handleRaisePaddle(teamId: TeamId) {
    if (!onBlockLot) return;
    const wallet = walletForTeam(participants, teamId);
    if (!wallet) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setCooldownTeams((c) => ({ ...c, [teamId]: true }));
    setTimeout(() => setCooldownTeams((c) => ({ ...c, [teamId]: false })), 1500);
    await engine.bid(onBlockLot.id, wallet.id, password);
    await refresh();
  }

  async function handleSold() {
    if (!onBlockLot || !onBlockLot.current_bid_wallet_id) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setLastSoldSnapshot(onBlockLot);
    setHammerPhase("going_once");
    setTimeout(() => setHammerPhase("going_twice"), 900);
    setTimeout(async () => {
      setHammerPhase("sold");
      await engine.sold(onBlockLot.id, password);
      await refresh();
      setTimeout(() => setHammerPhase("idle"), 1600);
    }, 1800);
  }

  async function handleUnsold() {
    if (!onBlockLot) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    await engine.unsold(onBlockLot.id, password);
    await refresh();
  }

  // ── Hero ─────────────────────────────────────────────────────────────────

  if (view === "hero") {
    // AuctionCountdown itself handles an already-elapsed target (shows all
    // zeros and fires onComplete once) — no need to compare against
    // Date.now() here, which would call an impure function during render.
    const countdownTarget =
      season?.status === "scheduled" && season.starts_at ? season.starts_at : null;

    return (
      <div className="min-h-screen bg-jcc-navy-deep flex flex-col items-center justify-center relative overflow-hidden page-top pb-16">
        <HeroBackdrop />

        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-jcc-text-muted hover:text-jcc-text-primary transition-colors text-xs font-black uppercase tracking-widest z-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>

        <motion.div
          className="flex flex-col items-center gap-9 text-center px-6 max-w-4xl w-full relative z-10"
          initial={mounted ? "hidden" : false}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: -16 }, visible: { opacity: 1, y: -60 } }}
            className="flex items-center gap-3"
          >
            <AuctionOSSeal className="w-9 h-9" />
            <span className="text-jcc-accent-dark text-[10px] font-black tracking-[0.5em] uppercase">
              Jaipur Cricket Circle
            </span>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.75 },
              visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 100, damping: 14 } },
            }}
            className="flex flex-col items-center leading-none gap-3 -mt-8"
          >
            <AuctionOSMark className="text-[clamp(3rem,13vw,9rem)] text-jcc-text-primary" />
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-jcc-border-bright" />
              <p className="text-jcc-text-muted text-[11px] sm:text-sm font-black tracking-[0.35em] uppercase">
                Live Auction Platform
              </p>
              <span className="h-px w-10 bg-jcc-border-bright" />
            </div>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            {countdownTarget ? (
              <AuctionCountdown target={countdownTarget} accentClassName="text-jcc-accent-dark" onComplete={refresh} />
            ) : (
              <p className="text-jcc-text-muted text-sm sm:text-base font-medium italic max-w-md">
                {!season
                  ? "The gavel rests. No auction is currently scheduled."
                  : season.status === "completed"
                    ? "The gavel has fallen for the last time this season."
                    : "The hall is ready whenever the auctioneer calls the room to order."}
              </p>
            )}
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            {season && (
              <button onClick={() => setView("hall")} className="btn-vibrant-blue">
                <Gavel className="w-4 h-4" />
                {season.status === "completed" ? "View Results" : "Enter Auction Hall"}
              </button>
            )}
          </motion.div>
        </motion.div>

        {passwordModal}
      </div>
    );
  }

  // ── Hall ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-jcc-navy-deep relative page-top-none pb-24">
      <div className="stadium-glow pointer-events-none opacity-70" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex items-center justify-between mb-10 pb-5 border-b border-jcc-border">
          <button
            onClick={() => setView("hero")}
            className="flex items-center gap-1.5 text-jcc-text-muted hover:text-jcc-text-primary transition-colors text-xs font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave Hall
          </button>
          <div className="flex items-center gap-2.5">
            <AuctionOSSeal className="w-7 h-7" />
            <AuctionOSMark className="text-lg text-jcc-text-primary hidden sm:block" />
          </div>
          {totalLots > 0 ? (
            <p className="score-number text-jcc-text-muted text-sm font-black uppercase tracking-widest">
              {resolvedCount} <span className="text-jcc-text-muted/50">of</span> {totalLots}{" "}
              <span className="text-jcc-text-muted/50">Lots</span>
            </p>
          ) : (
            <span className="w-8" />
          )}
        </div>

        {!season ? (
          <div className="flex flex-col items-center text-center gap-4 py-24">
            <AuctionOSSeal className="w-14 h-14" />
            <h2 className="text-2xl font-black uppercase text-jcc-text-primary">The Hall Awaits</h2>
            <p className="text-jcc-text-muted text-sm max-w-sm">
              No auction has been scheduled yet. An auctioneer needs to prepare the lot list before the room can open.
            </p>
          </div>
        ) : isComplete ? (
          <CompletedRecap lots={lots} participants={participants} />
        ) : !onBlockLot ? (
          <div className="flex flex-col items-center text-center gap-6 py-24">
            <Sparkles className="w-8 h-8 text-jcc-accent-dark" />
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-jcc-text-primary">
              The Captains Are Taking Their Seats
            </h2>
            <p className="text-jcc-text-muted text-sm max-w-sm">
              {upcomingLots.length} {upcomingLots.length === 1 ? "lot waits" : "lots wait"} to be called to the block.
            </p>
            <button onClick={handleAdvance} disabled={advancing} className="btn-vibrant-blue">
              {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
              Call First Lot
            </button>
          </div>
        ) : (
          <>
            <SpotlightStage
              lot={onBlockLot}
              category={onBlockCategory}
              participants={participants}
              captains={captains}
              valuationByCaptain={valuationByCaptain}
              cooldownTeams={cooldownTeams}
              onRaisePaddle={handleRaisePaddle}
              onSold={handleSold}
              onUnsold={handleUnsold}
            />
          </>
        )}

        {soldLots.length > 0 && (
          <div className="mt-16">
            <Eyebrow className="mb-5">Recent Signings</Eyebrow>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
              {soldLots.map((p) => {
                const teamId = teamKeyOf(participants, p.sold_wallet_id);
                const team = teamId ? TEAMS[teamId] : null;
                return (
                  <div key={p.id} className="flex flex-col items-center gap-3 shrink-0 w-36">
                    <PlayerPortrait
                      name={p.display_name}
                      image={lotImage(p)}
                      className="w-28 h-28 rounded-2xl overflow-hidden border border-jcc-border"
                    />
                    <div className="text-center">
                      <p className="text-jcc-text-primary font-bold text-sm leading-tight">{p.display_name}</p>
                      {team && (
                        <p className="text-xs font-black uppercase tracking-widest mt-1" style={{ color: team.primary }}>
                          {team.name}
                        </p>
                      )}
                      <p className="score-number text-jcc-accent-dark text-sm font-black mt-0.5">
                        {formatLakhs(p.sold_price ?? 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {season && (
          <div className="mt-16">
            <Eyebrow className="mb-6">Team Sheets</Eyebrow>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {TEAM_ORDER_ALL.map((teamId) => (
                <TeamSheet key={teamId} teamId={teamId} lots={lots} participants={participants} />
              ))}
            </div>
          </div>
        )}
      </div>

      <HammerOverlay
        phase={hammerPhase}
        playerName={lastSoldSnapshot?.display_name ?? null}
        price={lastSoldSnapshot?.current_bid ?? null}
        teamName={(() => {
          const teamId = teamKeyOf(participants, lastSoldSnapshot?.current_bid_wallet_id ?? null);
          return teamId ? TEAMS[teamId].name : null;
        })()}
      />
      {passwordModal}
    </div>
  );
}

// ─── Spotlight stage — the lot currently on the block ───────────────────

// If `teamId`'s captain sits in this lot's category, project what their
// captain_value would become should `previewBidAmount` be the winning bid —
// mirrors _auctionos_recalc_captain_valuation's own math (highest unreversed
// purchase in the team's category, halved) so this preview never disagrees
// with what the server would actually charge. Returns null when this team
// has no captain in this lot's category (nothing to project).
function projectCaptainValue({
  currentValue,
  category,
  captain,
  previewBidAmount,
}: {
  currentValue: number | null;
  category: AuctionCategory | null;
  captain: AuctionCaptain | undefined;
  previewBidAmount: number;
}): { newValue: number; delta: number } | null {
  if (!captain || !category || captain.category_id !== category.id) return null;
  const existingHighest = currentValue != null ? currentValue * 2 : 0;
  const newHighest = Math.max(existingHighest, previewBidAmount);
  const newValue = newHighest * 0.5;
  return { newValue, delta: newValue - (currentValue ?? 0) };
}

function SpotlightStage({
  lot,
  category,
  participants,
  captains,
  valuationByCaptain,
  cooldownTeams,
  onRaisePaddle,
  onSold,
  onUnsold,
}: {
  lot: AuctionLot;
  category: AuctionCategory | null;
  participants: AuctionWallet[];
  captains: AuctionCaptain[];
  valuationByCaptain: Map<string, CaptainValuation>;
  cooldownTeams: Record<string, boolean>;
  onRaisePaddle: (teamId: TeamId) => void;
  onSold: () => void;
  onUnsold: () => void;
}) {
  const currentBid = lot.current_bid ?? lot.base_price;
  // Mirrors app/api/auctionos/bid/route.ts's own increment resolution: a
  // category's organizer-set bid_increment (schema v4) wins over JCC's
  // tier ladder when set, so the preview here never disagrees with what
  // the server actually charges.
  const nextBid = currentBid + (category?.bid_increment ?? getNextBidIncrement(currentBid));
  const leadingTeamId = teamKeyOf(participants, lot.current_bid_wallet_id);
  const leadingTeam = leadingTeamId ? TEAMS[leadingTeamId] : null;

  return (
    <div>
      <div
        className="premium-card px-6 py-10 sm:px-10 flex flex-col items-center text-center gap-6 transition-colors duration-500"
        style={leadingTeam ? { backgroundColor: `${leadingTeam.primary}40` } : undefined}
      >
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-jcc-border-bright bg-jcc-accent/5 text-jcc-accent-dark text-[10px] font-black tracking-[0.3em] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-jcc-accent-dark animate-pulse" />
          On The Block
        </span>

        <div
          className="relative"
          style={{ filter: "drop-shadow(0 24px 60px rgba(18,35,63,0.18))" }}
        >
          <PlayerPortrait
            name={lot.display_name}
            image={lotImage(lot)}
            className="w-40 h-40 sm:w-52 sm:h-52 rounded-[2rem] overflow-hidden border border-jcc-border-bright"
          />
        </div>
        <div>
          <p className="text-jcc-accent-dark text-[10px] font-black tracking-[0.4em] uppercase mb-2">
            {lotRole(lot)} · Lot {lot.lot_order}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-jcc-text-primary">{lot.display_name}</h2>
        </div>

        <div className="flex items-center gap-10 sm:gap-16">
          <div>
            <p className="text-jcc-text-muted text-[9px] font-black tracking-widest uppercase mb-1">Base Price</p>
            <p className="score-number text-lg text-jcc-text-muted font-black">{formatLakhs(lot.base_price)}</p>
          </div>
          <div>
            <p className="text-jcc-text-muted text-[9px] font-black tracking-widest uppercase mb-1">Current Bid</p>
            <RollingNumber value={currentBid} format={formatLakhs} className="text-3xl sm:text-4xl text-jcc-accent-dark font-black score-number" />
          </div>
          {leadingTeamId && (
            <TeamLogo teamId={leadingTeamId} className="w-24 h-24 sm:w-28 sm:h-28 object-contain shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSold}
            disabled={!lot.current_bid_wallet_id}
            className="btn-vibrant-blue px-8 py-3 disabled:opacity-30"
          >
            Sold
          </button>
          <button
            onClick={onUnsold}
            className="btn-ghost px-8 py-3"
          >
            Unsold
          </button>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-5">
        {TEAM_ORDER_ALL.map((teamId) => {
          const purse = walletForTeam(participants, teamId);
          const isLeading = leadingTeamId === teamId;
          const canAfford = (purse?.budget_remaining ?? 0) >= nextBid;

          // "If I win this lot right now" preview: the leading team would
          // pay currentBid (what Sold actually charges); anyone else would
          // have to clear nextBid to take the lead in the first place.
          const captain = captains.find((c) => c.team_id === teamId);
          const currentCaptainValue = captain ? valuationByCaptain.get(captain.id)?.captain_value ?? null : null;
          const previewBidAmount = isLeading ? currentBid : nextBid;
          const captainPreview = projectCaptainValue({
            currentValue: currentCaptainValue,
            category,
            captain,
            previewBidAmount,
          });
          const previewBudget =
            (purse?.budget_remaining ?? 0) - previewBidAmount - (captainPreview?.delta ?? 0);

          return (
            <CaptainDesk
              key={teamId}
              teamId={teamId}
              purse={purse}
              isLeading={isLeading}
              canBid={canAfford}
              cooldown={!!cooldownTeams[teamId]}
              onRaisePaddle={() => onRaisePaddle(teamId)}
              hasCaptain={!!captain}
              captainValue={currentCaptainValue}
              previewBudget={previewBudget}
              previewCaptainValue={captainPreview && captainPreview.delta > 0 ? captainPreview.newValue : null}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Team sheet — honors-board style roster. Fixed 14 slots: the first 7
// (First XI) and the next 7 (Guest Players) fill in acquisition order as
// lots sell, regardless of category — empty slots stay visible with their
// serial number until a name lands there. ──────────────────────────────────

const TEAM_SHEET_SLOT_COUNT = 14;
const TEAM_SHEET_FIRST_XI_COUNT = 7;

function TeamSheet({
  teamId,
  lots,
  participants,
}: {
  teamId: TeamId;
  lots: AuctionLot[];
  participants: AuctionWallet[];
}) {
  const team = TEAMS[teamId];
  const squad = lots
    .filter((p) => p.status === "sold" && teamKeyOf(participants, p.sold_wallet_id) === teamId)
    .sort((a, b) => (a.sold_at ?? "").localeCompare(b.sold_at ?? ""));

  const slots = Array.from({ length: TEAM_SHEET_SLOT_COUNT }, (_, i) => squad[i] ?? null);

  return (
    <div
      className="rounded-[3rem] p-8 sm:p-10"
      style={{
        background: "var(--color-jcc-navy)",
        border: "1.5px solid color-mix(in srgb, var(--color-jcc-accent) 60%, transparent)",
      }}
    >
      <div className="flex items-center gap-4 mb-8">
        <TeamLogo teamId={teamId} className="w-12 h-12 object-contain shrink-0" />
        <h3
          className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-[0.08em]"
          style={{ color: team.primary }}
        >
          {team.name}
        </h3>
      </div>

      {slots.map((lot, i) => {
        const isSectionStart = i === 0 || i === TEAM_SHEET_FIRST_XI_COUNT;
        return (
          <div key={i}>
            {isSectionStart && (
              <p
                className={`text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${i === 0 ? "" : "mt-6"}`}
              >
                {i === 0 ? "First XI" : "Guest Players"}
              </p>
            )}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-4 min-w-0">
                <span className="score-number text-jcc-text-muted/50 text-sm w-6 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="font-bold text-sm sm:text-base uppercase tracking-wide truncate"
                  style={lot ? { color: team.primary } : undefined}
                >
                  {lot ? lot.display_name : ""}
                </span>
              </div>
              {lot && (
                <span className="score-number text-jcc-accent-dark text-xs font-black shrink-0 pl-3">
                  {formatLakhs(lot.sold_price ?? 0)}
                </span>
              )}
            </div>
            <div className="border-t border-jcc-border" />
          </div>
        );
      })}
    </div>
  );
}

// ─── Completion recap ───────────────────────────────────────────────────────

function CompletedRecap({ lots, participants }: { lots: AuctionLot[]; participants: AuctionWallet[] }) {
  const sold = lots.filter((p) => p.status === "sold");
  const topSignings = [...sold].sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0)).slice(0, 3);

  return (
    <div className="py-8">
      <div className="flex flex-col items-center text-center gap-4 mb-14">
        <Trophy className="w-9 h-9 text-jcc-accent-dark" />
        <h2 className="text-3xl sm:text-4xl font-black uppercase text-jcc-text-primary">The Gavel Rests</h2>
        <p className="text-jcc-text-muted text-sm max-w-md">
          {sold.length} {sold.length === 1 ? "player" : "players"} found a new home this season.
        </p>
      </div>

      {topSignings.length > 0 && (
        <div className="mb-14">
          <Eyebrow className="mb-6 max-w-md mx-auto">Marquee Signings</Eyebrow>
          <div className="flex justify-center gap-8 flex-wrap">
            {topSignings.map((p) => {
              const teamId = teamKeyOf(participants, p.sold_wallet_id);
              const team = teamId ? TEAMS[teamId] : null;
              return (
                <div key={p.id} className="flex flex-col items-center gap-3">
                  <PlayerPortrait
                    name={p.display_name}
                    image={lotImage(p)}
                    className="w-32 h-32 rounded-[1.5rem] overflow-hidden border border-jcc-border-bright"
                  />
                  <div className="text-center">
                    <p className="text-jcc-text-primary font-bold text-sm">{p.display_name}</p>
                    {team && (
                      <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: team.primary }}>
                        {team.name}
                      </p>
                    )}
                    <p className="score-number text-jcc-accent-dark text-sm font-black mt-1">
                      {formatLakhs(p.sold_price ?? 0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {TEAM_ORDER_ALL.map((teamId) => {
          const purse = walletForTeam(participants, teamId);
          const team = TEAMS[teamId];
          const spent = (purse?.budget_total ?? 0) - (purse?.budget_remaining ?? 0);
          return (
            <div key={teamId} className="id-card p-5 flex flex-col items-center gap-2 text-center">
              <TeamLogo teamId={teamId} className="w-12 h-12 object-contain" />
              <p className="font-heading font-black text-sm uppercase" style={{ color: team.primary }}>
                {team.shortName}
              </p>
              <div className="w-full pt-2 border-t border-jcc-border grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">Squad</p>
                  <p className="score-number text-sm font-black text-jcc-text-primary">{purse?.acquired_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">Spent</p>
                  <p className="score-number text-sm font-black text-jcc-text-primary">{formatLakhs(spent)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
