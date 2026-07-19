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
  Undo2,
} from "lucide-react";

import type { AuctionExperienceProps } from "@/lib/auctionos/core/template";
import type {
  Auction,
  AuctionWallet,
  AuctionWalletKind,
  AuctionLot,
  AuctionCategory,
  AuctionCaptain,
  AuctionTeam,
  CaptainValuation,
} from "@/lib/auctionos/core/types";
import { liveEngine, type AuctionEngine } from "./engine";
import { formatLakhs, getNextBidIncrement } from "./rules";
import { withCaptainBonus } from "@/lib/auctionos/core/reserve";
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

// A wallet/captain carries team identity as EITHER team_id (legacy global
// `teams` table, still used by the /auctionos/dev mock) XOR auction_team_id
// (wizard-created auction_teams row) — never both (see AUCTIONOS.md's
// AuctionWallet doc comment). This is the one place that picks whichever
// side is actually set, so every other lookup in this file works off a
// single opaque team-id string, matching an AuctionTeam.id from `teams`.
function entityTeamKey(entity: Pick<AuctionWallet, "team_id" | "auction_team_id">): string | null {
  return entity.auction_team_id ?? entity.team_id ?? null;
}

function teamKeyOf(wallets: AuctionWallet[], walletId: string | null): string | null {
  if (!walletId) return null;
  const w = wallets.find((x) => x.id === walletId);
  return w ? entityTeamKey(w) : null;
}

function walletsForTeam(wallets: AuctionWallet[], teamId: string): AuctionWallet[] {
  return wallets.filter((w) => entityTeamKey(w) === teamId);
}

// A category's wallet_kind_id says which wallet a purchase in it debits —
// a team with multiple wallet kinds (e.g. Wallet A for MVP/Regular, Wallet
// B for Guest) must never be charged against the wrong one. Categories
// with no wallet_kind_id set (organizer didn't split wallets) fall back to
// the team's first wallet, matching the single-wallet-per-team behavior
// this template originally shipped with.
function walletForTeamKind(
  wallets: AuctionWallet[],
  teamId: string,
  walletKindId: string | null | undefined
): AuctionWallet | undefined {
  const teamWallets = walletsForTeam(wallets, teamId);
  if (!walletKindId) return teamWallets[0];
  return teamWallets.find((w) => w.wallet_kind_id === walletKindId) ?? teamWallets[0];
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

// Verifies against THIS auction's own wizard-generated admin password
// (auctions.admin_password_hash), not the legacy site-wide ADMIN_PASSWORD —
// /api/auctionos/resolve-admin resolves a password to whichever auction it
// belongs to, so a match only counts if it resolves to the auction we're
// actually in.
async function verifyAdminPassword(auctionId: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auctionos/resolve-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return false;
    const { auction_id } = await res.json();
    return auction_id === auctionId;
  } catch {
    return false;
  }
}

function useAdminPassword(auctionId: string | undefined) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((pw: string | null) => void) | null>(null);

  const ensurePassword = useCallback(async (): Promise<string | null> => {
    const stored = getAdminPassword();
    if (auctionId && stored && (await verifyAdminPassword(auctionId, stored))) return stored;
    if (stored && typeof window !== "undefined")
      sessionStorage.removeItem("jcc_admin_password");
    setInput("");
    setError(null);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [auctionId]);

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
    if (!auctionId) return;
    setVerifying(true);
    setError(null);
    const ok = await verifyAdminPassword(auctionId, pw);
    if (!ok) {
      setVerifying(false);
      setError("Incorrect password. Try again.");
      setInput("");
      return;
    }
    if (typeof window !== "undefined")
      sessionStorage.setItem("jcc_admin_password", pw);
    close(pw);
  }, [input, close, auctionId]);

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
                  className="flex-1 btn-vibrant-blue px-4! py-2.5! text-xs disabled:opacity-60"
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

function TeamLogo({ team, className = "" }: { team: AuctionTeam; className?: string }) {
  const [error, setError] = useState(false);
  if (error || !team.logo_url)
    return (
      <span className="font-black select-none" style={{ color: team.primary_color ?? undefined }}>
        {team.short_name ?? team.name}
      </span>
    );
  return (
    <img
      src={team.logo_url}
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

// "allotted" plays instead of "sold" when a lot resolved through
// auctionos_mark_unsold's forced-allotment path or an organizer's manual
// auctionos_resolve_blocked_lot pick, rather than being won by bidding —
// see handleUnsold below.
type HammerPhase = "idle" | "sold" | "allotted";

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
              <div>
                <p className="text-jcc-accent-dark text-xs font-black tracking-[0.5em] uppercase mb-4">
                  {teamName}
                </p>
                <h2
                  className="text-[clamp(3rem,11vw,7.5rem)] font-black uppercase leading-none text-gradient-gold"
                  style={{ filter: "drop-shadow(0 8px 40px rgba(212,175,55,0.35))" }}
                >
                  {phase === "allotted" ? "Allotted" : "Sold"}
                </h2>
                <p className="score-number text-2xl sm:text-3xl text-jcc-accent-dark mt-5 font-black">
                  {formatLakhs(price ?? 0)}
                </p>
                <p className="text-jcc-text-muted text-sm mt-2 font-bold">{playerName}</p>
                {phase === "allotted" && (
                  <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest mt-3">
                    Quota completion — no bid placed
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Looped-lot toast ───────────────────────────────────────────────────────
// Deliberately lightweight (not a full-screen takeover like HammerOverlay) —
// a quota category can loop the same handful of unsold lots several times
// in a row, and a heavy modal every time would be exhausting rather than
// informative. See AUCTION_RULES.md's "Category quota" section.

// A failed admin action (advance/bid/sold/unsold/undo/resolve) surfaces
// here instead of failing silently — see postAdmin()'s error throw in
// engine.ts and the actionError state in AuctionExperience. Dismissible
// because some failures (e.g. "wallet cannot afford this bid") need the
// organizer to read them, not just glance past an auto-clearing toast.
function ActionErrorToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: SMOOTH_EASE }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[240] px-5 py-3 rounded-full flex items-center gap-2.5 max-w-lg"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-jcc-danger, #b91c1c) 92%, black)",
            border: "1.5px solid color-mix(in srgb, white 25%, transparent)",
            boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)",
          }}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#fff] shrink-0" />
          <p className="text-[#fff] text-xs font-bold">{message}</p>
          <button onClick={onDismiss} className="text-[#fff]/70 hover:text-[#fff] text-xs font-black shrink-0">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LoopedToast({ playerName }: { playerName: string | null }) {
  return (
    <AnimatePresence>
      {playerName && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: SMOOTH_EASE }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[240] px-5 py-3 rounded-full flex items-center gap-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-jcc-navy) 92%, transparent)",
            border: "1.5px solid color-mix(in srgb, var(--color-jcc-accent) 55%, transparent)",
            boxShadow: "0 12px 32px -12px rgba(0,0,0,0.5)",
          }}
        >
          <Undo2 className="w-3.5 h-3.5 text-jcc-accent-dark shrink-0" />
          <p className="text-jcc-text-primary text-xs font-bold">
            <span className="text-jcc-text-muted">Unsold —</span> {playerName}{" "}
            <span className="text-jcc-text-muted">returns to the pool</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Auction finale overlay ─────────────────────────────────────────────────
// Fires once, the moment the auctioneer advances past the last lot and the
// season flips to "completed" — a brief curtain-call before the room settles
// into CompletedRecap underneath.

function AuctionFinaleOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[260] bg-jcc-navy-deep/97 backdrop-blur-md flex flex-col items-center justify-center gap-5"
        >
          <div className="stadium-glow pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="text-center px-6 relative z-10"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.7, ease: SMOOTH_EASE, delay: 0.1 }}
              className="flex justify-center mb-5"
            >
              <Trophy className="w-14 h-14 text-jcc-accent-dark" style={{ filter: "drop-shadow(0 8px 30px rgba(212,175,55,0.45))" }} />
            </motion.div>
            <h2
              className="text-[clamp(2.25rem,8vw,5rem)] font-black uppercase leading-none text-gradient-gold"
              style={{ filter: "drop-shadow(0 8px 40px rgba(212,175,55,0.35))" }}
            >
              Auction Complete
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-jcc-text-muted text-sm sm:text-base mt-5 font-bold max-w-md mx-auto"
            >
              Every seat is filled. Every purse is spent. Four squads walk out of the hall tonight.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Category announcement overlay ─────────────────────────────────────────
// Fires once per category transition (including the very first category of
// a fresh auction) — a brief curtain-raiser naming the block that's about to
// run, before the room settles into the normal "Call Next Player" flow.

function CategoryAnnouncementOverlay({ category }: { category: AuctionCategory | null }) {
  return (
    <AnimatePresence>
      {category && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[255] bg-jcc-navy-deep/97 backdrop-blur-md flex flex-col items-center justify-center gap-4"
        >
          <div className="stadium-glow pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: SMOOTH_EASE }}
            className="text-center px-6 relative z-10"
          >
            <motion.span
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="block text-xs font-black uppercase mb-5"
              style={{ color: category.color ?? "var(--color-jcc-accent-dark)" }}
            >
              Now Entering
            </motion.span>
            <h2
              className="text-[clamp(2.5rem,9vw,6rem)] font-black uppercase leading-none"
              style={{
                color: category.color ?? "var(--color-jcc-text-primary)",
                filter: `drop-shadow(0 8px 40px ${category.color ?? "rgba(212,175,55,0.35)"}55)`,
              }}
            >
              {category.name}
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-2 mt-6"
            >
              <span className="h-px w-8 bg-jcc-border-bright" />
              <p className="text-jcc-text-muted text-xs sm:text-sm font-bold uppercase tracking-widest">
                Floor {formatLakhs(category.floor_price ?? category.base_price)}
              </p>
              <span className="h-px w-8 bg-jcc-border-bright" />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Blocked-lot resolution panel ──────────────────────────────────────────
// auctionos_advance_lot refuses to run while a lot is 'blocked' — this is
// the only way out, an organizer-only manual pick (see
// AUCTION_RULES.md's "Category quota"). Shown in place of the ordinary
// on-block/interstitial UI whenever blockedLot is set.

function BlockedLotPanel({
  lot,
  category,
  participants,
  captains,
  lots,
  onResolve,
  resolving,
  isAdmin,
  teams,
}: {
  lot: AuctionLot;
  category: AuctionCategory | null;
  participants: AuctionWallet[];
  captains: AuctionCaptain[];
  lots: AuctionLot[];
  onResolve: (walletId: string | null) => void;
  resolving: boolean;
  isAdmin: boolean;
  teams: AuctionTeam[];
}) {
  const basePrice = category?.base_price ?? lot.base_price;
  const eligibleWallets = category?.wallet_kind_id
    ? participants.filter((w) => w.wallet_kind_id === category.wallet_kind_id)
    : participants;
  const candidates = eligibleWallets
    .map((wallet) => {
      const purchased = category
        ? lots.filter((l) => l.status === "sold" && l.sold_wallet_id === wallet.id && l.category_id === category.id).length
        : 0;
      const acquired = category
        ? (withCaptainBonus({ [category.id]: purchased }, wallet, captains)[category.id] ?? purchased)
        : purchased;
      const short = category ? acquired < category.min_required : false;
      const affordable = wallet.budget_remaining >= basePrice;
      const teamId = teamKeyOf(participants, wallet.id);
      return { wallet, teamId, acquired, short, affordable };
    })
    .filter((c) => c.teamId)
    .sort((a, b) => Number(b.short) - Number(a.short));

  return (
    <div className="flex flex-col items-center text-center gap-6 py-16">
      <AlertCircle className="w-9 h-9 text-jcc-accent-dark" />
      <div>
        <p className="text-jcc-accent-dark text-xs font-black uppercase tracking-[0.4em] mb-3">Needs Resolution</p>
        <h2 className="text-2xl sm:text-3xl font-black uppercase text-jcc-text-primary">{lot.display_name}</h2>
        <p className="text-jcc-text-muted text-sm max-w-md mx-auto mt-3">
          {category?.name ?? "This category"}&rsquo;s last unsold player — the system can&rsquo;t decide who this
          goes to on its own. Allot it to a team below, or let it go unsold for good.
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
            {candidates.map(({ wallet, teamId, short, affordable }) => {
              if (!teamId) return null;
              const team = teams.find((t) => t.id === teamId);
              if (!team) return null;
              return (
                <button
                  key={wallet.id}
                  onClick={() => onResolve(wallet.id)}
                  disabled={resolving || !affordable}
                  className="id-card px-5 py-4 flex flex-col items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_0_1px_rgba(212,175,55,0.55)] transition-shadow"
                  style={{ borderColor: short ? `${team.primary_color}90` : undefined, borderWidth: short ? 2 : undefined }}
                >
                  <TeamLogo team={team} className="w-10 h-10 object-contain" />
                  <p className="font-heading font-black text-xs uppercase" style={{ color: team.primary_color ?? undefined }}>
                    {team.short_name ?? team.name}
                  </p>
                  <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
                    {short ? "Short of quota" : "Optional pickup"}
                  </p>
                  <p className="score-number text-jcc-text-primary text-xs font-black">
                    {formatLakhs(wallet.budget_remaining)} left
                  </p>
                  {!affordable && (
                    <p className="text-red-400 text-[9px] font-black uppercase tracking-widest">Can&rsquo;t afford base price</p>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onResolve(null)}
            disabled={resolving}
            className="btn-ghost px-6 py-2.5 text-xs disabled:opacity-50"
          >
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
            Leave Unsold
          </button>
        </>
      ) : (
        <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
          Waiting for the auctioneer to resolve this lot…
        </p>
      )}
    </div>
  );
}

// ─── Captain Desk ───────────────────────────────────────────────────────────

function CaptainDesk({
  team,
  purse,
  isLeading,
  canBid,
  cooldown,
  onRaisePaddle,
  hasCaptain,
  captainName,
  captainValue,
  previewBudget,
  previewCaptainValue,
}: {
  team: AuctionTeam;
  purse: AuctionWallet | undefined;
  isLeading: boolean;
  canBid: boolean;
  cooldown: boolean;
  onRaisePaddle: () => void;
  hasCaptain: boolean;
  captainName: string | null;
  captainValue: number | null;
  previewBudget: number;
  previewCaptainValue: number | null;
}) {
  const budgetChanges = previewBudget !== (purse?.budget_remaining ?? 0);
  return (
    <motion.div
      className={`id-card relative p-7 flex flex-col items-center gap-4 text-center transition-shadow duration-500 ${isLeading ? "shadow-[0_0_0_1px_rgba(212,175,55,0.55),0_18px_44px_-20px_rgba(212,175,55,0.5)]" : ""}`}
      style={{ borderColor: `${team.primary_color}70`, borderWidth: 2 }}
      animate={isLeading ? { y: -3 } : { y: 0 }}
      transition={{ duration: 0.5, ease: SMOOTH_EASE }}
    >
      <TeamLogo team={team} className="w-28 h-28 object-contain" />
      {captainName && (
        <p className="text-sm font-black text-jcc-text-primary -mt-2">{captainName}</p>
      )}
      {team.tagline && <p className="text-xs text-jcc-text-muted font-bold -mt-1">{team.tagline}</p>}
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
  initialTeams,
  isAdmin = true,
  engine = liveEngine,
}: JccAuctionExperienceProps) {
  const [season, setSeason] = useState<Auction | null>(initialAuction);
  const [participants, setParticipants] = useState<AuctionWallet[]>(initialWallets);
  const [lots, setLots] = useState<AuctionLot[]>(initialLots);
  const [teams, setTeams] = useState<AuctionTeam[]>(initialTeams);
  // Auction creation has moved to the AuctionOS wizard (app/auctionos/new)
  // — this template's hall UI only bids in auctions already prepared
  // there, and the wizard assigns a real category_id per lot. Read here so
  // the next-bid preview can apply a category's bid_increment override,
  // matching what app/api/auctionos/bid/route.ts actually charges.
  const [categories, setCategories] = useState<AuctionCategory[]>(initialCategories);
  const [walletKinds, setWalletKinds] = useState<AuctionWalletKind[]>([]);
  const [captains, setCaptains] = useState<AuctionCaptain[]>([]);
  const [captainValuations, setCaptainValuations] = useState<CaptainValuation[]>([]);
  const [view, setView] = useState<ViewPhase>("hero");
  const [mounted, setMounted] = useState(false);

  const [advancing, setAdvancing] = useState(false);
  // Surfaces a failed admin action (bad password aside — that has its own
  // modal error) instead of letting it fail silently: postAdmin() throws on
  // a non-2xx response, and every handler below catches it here so a
  // rejected RPC (e.g. an organizer's session lost sync, or a server-side
  // validation error) is visible rather than looking like a dead button.
  const [actionError, setActionError] = useState<string | null>(null);
  const [cooldownTeams, setCooldownTeams] = useState<Record<string, boolean>>({});
  const [hammerPhase, setHammerPhase] = useState<HammerPhase>("idle");
  const [lastSoldSnapshot, setLastSoldSnapshot] = useState<AuctionLot | null>(null);
  const [loopedPlayerName, setLoopedPlayerName] = useState<string | null>(null);
  const [resolvingLot, setResolvingLot] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  // Seeded from the initial server snapshot so a spectator loading an
  // already-finished auction doesn't get a replay of the finale ceremony —
  // only a live transition into "completed" during this session plays it.
  const hasPlayedFinaleRef = useRef(initialAuction?.status === "completed");
  const [announcedCategory, setAnnouncedCategory] = useState<AuctionCategory | null>(null);
  // Seeded from the initial snapshot the same way — null only when the
  // auction hasn't resolved a single lot yet (a genuinely fresh start, where
  // the first category's own announcement should still play), otherwise the
  // category already on/next the block at load, so a page reload mid-block
  // doesn't replay it.
  const initialResolvedCount = initialLots.filter((p) => p.status === "sold" || p.status === "unsold").length;
  const initialActiveLot =
    initialLots.find((p) => p.status === "on_block") ??
    [...initialLots.filter((p) => p.status === "upcoming")].sort((a, b) => a.lot_order - b.lot_order)[0] ??
    null;
  const lastAnnouncedCategoryIdRef = useRef<string | null>(
    initialResolvedCount === 0 ? null : initialActiveLot?.category_id ?? null
  );

  const { ensurePassword, passwordModal } = useAdminPassword(season?.id);

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
    setWalletKinds(snap.walletKinds);
    setCaptains(snap.captains);
    setCaptainValuations(snap.captainValuations);
    setTeams(snap.teams);
    return snap;
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
  // A quota category's last lot, parked because the system can't
  // auto-resolve who it goes to (see AUCTION_RULES.md's "Category quota" —
  // 2+ teams tied short, or the one short team can't afford base_price).
  // auctionos_advance_lot refuses to run while this exists, so the hall
  // must surface it rather than falling through to the ordinary
  // "Call Next Player" interstitial (onBlockLot is null for a blocked lot
  // too — it's not on_block, nobody can bid on it).
  const blockedLot = lots.find((p) => p.status === "blocked") ?? null;
  const blockedCategory = blockedLot?.category_id
    ? categories.find((c) => c.id === blockedLot.category_id) ?? null
    : null;
  const upcomingLots = lots.filter((p) => p.status === "upcoming");
  const soldLots = [...lots.filter((p) => p.status === "sold")].sort((a, b) =>
    (b.sold_at ?? "").localeCompare(a.sold_at ?? "")
  );
  const totalLots = lots.length;
  const resolvedCount = lots.filter((p) => p.status === "sold" || p.status === "unsold").length;
  const isComplete = season?.status === "completed" || (totalLots > 0 && resolvedCount === totalLots);

  // Plays exactly once, the moment the room crosses into "completed" — not on
  // every refresh poll thereafter (hasPlayedFinaleRef guards re-fires when a
  // late spectator's client catches up to an auction that finished earlier).
  useEffect(() => {
    if (isComplete && !hasPlayedFinaleRef.current) {
      hasPlayedFinaleRef.current = true;
      setShowFinale(true);
      const timer = setTimeout(() => setShowFinale(false), 3600);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // Categories run in blocks (lot_order is reshuffled category-by-category at
  // auctionos_begin_auction) — sold/unsold tallies per category, in the same
  // order the auction actually calls them, not just the flat overall count.
  const categoryProgress = [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => {
      const catLots = lots.filter((p) => p.category_id === category.id);
      const sold = catLots.filter((p) => p.status === "sold").length;
      const unsold = catLots.filter((p) => p.status === "unsold").length;
      return { category, total: catLots.length, resolved: sold + unsold };
    })
    .filter((c) => c.total > 0);

  // Whether the next lot to be called starts a new category block — lets the
  // "captains taking their seats" interstitial announce the category instead
  // of repeating identical copy between every lot.
  const lastResolvedLot =
    [...lots]
      .filter((p) => p.status === "sold" || p.status === "unsold")
      .sort((a, b) => b.lot_order - a.lot_order)[0] ?? null;
  const nextUpLot = [...upcomingLots].sort((a, b) => a.lot_order - b.lot_order)[0] ?? null;
  const lastCategory = lastResolvedLot?.category_id
    ? categories.find((c) => c.id === lastResolvedLot.category_id) ?? null
    : null;
  const nextCategory = nextUpLot?.category_id
    ? categories.find((c) => c.id === nextUpLot.category_id) ?? null
    : null;
  const enteringNewCategory = resolvedCount > 0 && !!nextCategory && lastCategory?.id !== nextCategory.id;

  // The category currently running the block — on_block if a lot is live,
  // else whichever category the next call will open.
  const activeCategory = onBlockCategory ?? blockedCategory ?? nextCategory;

  // Fires the announcement overlay exactly once per category, the moment
  // the room crosses into it (including the very first category of a fresh
  // auction — see lastAnnouncedCategoryIdRef's seeding above).
  useEffect(() => {
    if (!activeCategory || activeCategory.id === lastAnnouncedCategoryIdRef.current) return;
    setAnnouncedCategory(activeCategory);
    // The ref is only committed once the timer actually fires, not the
    // moment it's scheduled — React 18 Strict Mode double-invokes this
    // effect (mount → cleanup → mount) in dev, and committing the ref
    // synchronously here meant the cleanup-cancelled first timer left the
    // overlay permanently stuck: the surviving second invocation would see
    // the ref already set and skip scheduling its own timer entirely.
    const timer = setTimeout(() => {
      lastAnnouncedCategoryIdRef.current = activeCategory.id;
      setAnnouncedCategory(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [activeCategory?.id]);

  // Resolves the admin password only when the engine actually needs one —
  // the mock engine does nothing off-browser, so /auctionos/dev never shows
  // this prompt. Returns `false` to mean "caller should bail", distinct
  // from a resolved `null` password on a no-auth engine.
  //
  // Every mutating handler below (callAdvance/handleRaisePaddle/handleSold/
  // handleUnsold/handleResolveBlockedLot/handleUndoBid/handleUndoSale)
  // calls this first, so gating isAdmin here — rather than only hiding the
  // triggering buttons — is defense-in-depth against a spectator somehow
  // still reaching one of these functions (e.g. a stale ref, a future
  // control that forgets its own isAdmin check).
  async function ensureEngineAuth(): Promise<string | null | false> {
    if (!isAdmin) return false;
    if (!engine.requiresAdminAuth) return null;
    const password = await ensurePassword();
    return password ?? false;
  }

  // Shared core of "call the next lot" — used both by the in-hall Call
  // First/Next Player button and by the hero's Start Auction button (which
  // authenticates and calls the very first lot in one step, then enters the
  // hall already live rather than dropping the organizer into an empty room
  // to find the same button again). Returns whether it succeeded so a
  // caller like handleStartAuction knows whether it's safe to change view.
  async function callAdvance(): Promise<boolean> {
    if (!season) return false;
    const password = await ensureEngineAuth();
    if (password === false) return false;
    setAdvancing(true);
    setActionError(null);
    try {
      await engine.advance(season.id, password);
      await refresh();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to call the next player.");
      return false;
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAdvance() {
    await callAdvance();
  }

  // Hero-screen entry point: authenticates, calls the first lot, and only
  // then drops the organizer straight into the live hall — spectators still
  // use the password-free "Enter Auction Hall" button below to just watch.
  async function handleStartAuction() {
    const ok = await callAdvance();
    if (ok) setView("hall");
  }

  async function handleRaisePaddle(teamId: string) {
    if (!onBlockLot) return;
    const wallet = walletForTeamKind(participants, teamId, onBlockCategory?.wallet_kind_id);
    if (!wallet) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setCooldownTeams((c) => ({ ...c, [teamId]: true }));
    setTimeout(() => setCooldownTeams((c) => ({ ...c, [teamId]: false })), 1500);
    setActionError(null);
    try {
      await engine.bid(onBlockLot.id, wallet.id, password);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to place bid.");
    }
  }

  async function handleSold() {
    if (!onBlockLot || !onBlockLot.current_bid_wallet_id) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setActionError(null);
    setLastSoldSnapshot(onBlockLot);
    setHammerPhase("sold");
    try {
      await engine.sold(onBlockLot.id, password);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark lot sold.");
    } finally {
      setTimeout(() => setHammerPhase("idle"), 1600);
    }
  }

  async function handleUnsold() {
    if (!onBlockLot) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setActionError(null);
    const lotId = onBlockLot.id;
    const displayName = onBlockLot.display_name;
    try {
      await engine.unsold(lotId, password);
      const snap = await refresh();

      // auctionos_mark_unsold/mockEngine.unsold don't return their outcome —
      // it's fully expressed in the lot's own resulting status (see
      // AUCTION_RULES.md's "Category quota"), so read it back from the fresh
      // snapshot rather than threading extra return data through the engine
      // interface. 'sold' only happens here via the forced-allotment path —
      // a bid-won sale always goes through handleSold, never handleUnsold.
      const resolved = snap.lots.find((l) => l.id === lotId);
      if (resolved?.status === "upcoming") {
        setLoopedPlayerName(displayName);
        setTimeout(() => setLoopedPlayerName(null), 2000);
      } else if (resolved?.status === "sold") {
        setLastSoldSnapshot(resolved);
        setHammerPhase("allotted");
        setTimeout(() => setHammerPhase("idle"), 1600);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to mark lot unsold.");
    }
  }

  // Organizer's manual escape hatch for a 'blocked' lot — walletId null
  // gives up (terminal unsold), otherwise force-allots to that team. Same
  // admin-password gate as every other resolution action.
  async function handleResolveBlockedLot(walletId: string | null) {
    if (!blockedLot || !engine.resolveBlockedLot) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setResolvingLot(true);
    setActionError(null);
    const lotId = blockedLot.id;
    try {
      await engine.resolveBlockedLot(lotId, walletId, password);
      const snap = await refresh();

      const resolved = snap.lots.find((l) => l.id === lotId);
      if (resolved?.status === "sold") {
        setLastSoldSnapshot(resolved);
        setHammerPhase("allotted");
        setTimeout(() => setHammerPhase("idle"), 1600);
      }
      // resolved?.status === "unsold" (organizer gave up): nothing further to
      // announce, same as any other terminal unsold lot.
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resolve blocked lot.");
    } finally {
      setResolvingLot(false);
    }
  }

  // Retracts the current highest bid on the on_block lot — only legal
  // server-side while the lot hasn't been hammered yet (see AUCTIONOS.md
  // §11's auctionos_undo_bid). Real-auction-only: engine.undoBid is
  // undefined on the mock, so this is never called from there.
  async function handleUndoBid() {
    if (!onBlockLot || !engine.undoBid) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setActionError(null);
    try {
      await engine.undoBid(onBlockLot.id, password);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to undo bid.");
    }
  }

  // Reverses the most recently resolved lot (sold or unsold) back onto the
  // block — only legal server-side if no later lot has been opened yet
  // (auctionos_undo_sale). Real-auction-only, same as handleUndoBid.
  async function handleUndoSale() {
    if (!lastResolvedLot || !engine.undoSale) return;
    const password = await ensureEngineAuth();
    if (password === false) return;
    setActionError(null);
    try {
      await engine.undoSale(lastResolvedLot.id, password);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to undo sale.");
    }
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
            {(() => {
              if (!season) return null;
              const notStartedYet = !onBlockLot && !blockedLot && resolvedCount === 0 && season.status !== "completed";
              const showStartAuction = isAdmin && notStartedYet;
              // Spectators (non-admin) get no client-side way into the hall
              // until the auctioneer has actually called a lot — entering
              // early would only show an inert "waiting" room anyway, but
              // gating the button itself (rather than relying on that
              // placeholder screen) means there's no path in at all, not
              // just a boring one. Admins keep the ghost "preview the hall"
              // button even pre-start, since they're the ones who'd use it
              // to get to the Start Auction control inside the hall too.
              if (!isAdmin && notStartedYet) {
                return (
                  <p className="text-jcc-text-muted text-[11px] font-black uppercase tracking-widest">
                    Doors open once the auctioneer starts the auction
                  </p>
                );
              }
              return (
                <>
                  {showStartAuction && (
                    <button onClick={handleStartAuction} disabled={advancing} className="btn-vibrant-blue">
                      {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      Start Auction
                    </button>
                  )}
                  <button onClick={() => setView("hall")} className={showStartAuction ? "btn-ghost" : "btn-vibrant-blue"}>
                    <Gavel className="w-4 h-4" />
                    {season.status === "completed" ? "View Results" : "Enter Auction Hall"}
                  </button>
                </>
              );
            })()}
          </motion.div>
        </motion.div>

        <ActionErrorToast message={actionError} onDismiss={() => setActionError(null)} />
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

        {categoryProgress.length > 0 && !isComplete && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 -mt-6 mb-10 scrollbar-thin">
            {categoryProgress.map(({ category, resolved, total }) => {
              const isCurrent = category.id === activeCategory?.id;
              const accent = category.color ?? "#94a3b8";
              return (
                <motion.div
                  key={category.id}
                  animate={{ scale: isCurrent ? 1.06 : 1 }}
                  transition={{ duration: 0.45, ease: SMOOTH_EASE }}
                  className={`flex items-center gap-2 shrink-0 rounded-full transition-colors duration-500 ${
                    isCurrent ? "px-4 py-2" : "px-3 py-1.5 opacity-50"
                  }`}
                  style={
                    isCurrent
                      ? {
                          backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
                          border: `1.5px solid color-mix(in srgb, ${accent} 55%, transparent)`,
                          boxShadow: `0 0 26px -8px color-mix(in srgb, ${accent} 70%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`rounded-full shrink-0 ${isCurrent ? "w-2.5 h-2.5 animate-pulse" : "w-1.5 h-1.5"}`}
                    style={{ backgroundColor: accent }}
                  />
                  <span
                    className={`font-black uppercase tracking-widest ${
                      isCurrent ? "text-jcc-text-primary text-[11px]" : "text-jcc-text-muted text-[10px]"
                    }`}
                  >
                    {category.name}
                  </span>
                  <span
                    className={`score-number font-black ${isCurrent ? "text-sm" : "text-xs text-jcc-text-primary"}`}
                    style={isCurrent ? { color: accent } : undefined}
                  >
                    {resolved}
                    <span className="text-jcc-text-muted/50">/{total}</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {!season ? (
          <div className="flex flex-col items-center text-center gap-4 py-24">
            <AuctionOSSeal className="w-14 h-14" />
            <h2 className="text-2xl font-black uppercase text-jcc-text-primary">The Hall Awaits</h2>
            <p className="text-jcc-text-muted text-sm max-w-sm">
              No auction has been scheduled yet. An auctioneer needs to prepare the lot list before the room can open.
            </p>
          </div>
        ) : isComplete ? (
          <CompletedRecap
            lots={lots}
            participants={participants}
            categories={categories}
            teams={teams}
            captains={captains}
            valuationByCaptain={valuationByCaptain}
          />
        ) : blockedLot ? (
          <BlockedLotPanel
            lot={blockedLot}
            category={blockedCategory}
            participants={participants}
            captains={captains}
            lots={lots}
            onResolve={handleResolveBlockedLot}
            resolving={resolvingLot}
            isAdmin={isAdmin}
            teams={teams}
          />
        ) : !onBlockLot ? (
          (() => {
            const currentCategoryProgress = nextCategory
              ? categoryProgress.find((c) => c.category.id === nextCategory.id) ?? null
              : null;
            return (
              <div className="flex flex-col items-center text-center gap-6 py-24">
                <Sparkles className="w-8 h-8 text-jcc-accent-dark" />
                {nextCategory && (
                  <p
                    className="text-sm sm:text-base font-black uppercase tracking-[0.3em]"
                    style={{ color: nextCategory.color ?? undefined }}
                  >
                    {nextCategory.name}
                  </p>
                )}
                <h2 className="text-2xl sm:text-3xl font-black uppercase text-jcc-text-primary -mt-2">
                  {resolvedCount === 0
                    ? "The Captains Are Taking Their Seats"
                    : enteringNewCategory
                      ? `Next Up: ${nextCategory!.name}`
                      : "The Floor Is Open"}
                </h2>
                <p className="text-jcc-text-muted text-sm max-w-sm">
                  {upcomingLots.length} {upcomingLots.length === 1 ? "player waits" : "players wait"} to be called to
                  the block.
                </p>
                {isAdmin ? (
                  <div className="flex items-center gap-3">
                    <button onClick={handleAdvance} disabled={advancing} className="btn-vibrant-blue">
                      {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                      {resolvedCount === 0 ? "Call First Player" : "Call Next Player"}
                    </button>
                    {engine.undoSale && lastResolvedLot && (
                      <button
                        onClick={handleUndoSale}
                        title={`Undo ${lastResolvedLot.status === "sold" ? "sale" : "unsold call"} for ${lastResolvedLot.display_name}`}
                        className="btn-ghost px-4 py-3"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">
                    Waiting for the auctioneer…
                  </p>
                )}
                {currentCategoryProgress && (
                  <p className="score-number text-jcc-text-primary text-lg font-black uppercase tracking-widest">
                    {currentCategoryProgress.category.name}{" "}
                    <span className="text-jcc-accent-dark">
                      {currentCategoryProgress.resolved}
                    </span>
                    <span className="text-jcc-text-muted/50"> / {currentCategoryProgress.total}</span>
                  </p>
                )}
              </div>
            );
          })()
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
              onUndoBid={engine.undoBid ? handleUndoBid : undefined}
              isAdmin={isAdmin}
              teams={teams}
            />
          </>
        )}

        {season && (
          <div className="mt-16">
            <Eyebrow className="mb-5">Live Wallets</Eyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {teams.map((team) => {
                const teamWallets = walletsForTeam(participants, team.id);
                // Order by the wallet kind's own sort_order once it's loaded
                // (first poll); until then, fall back to the order wallets
                // already come in (seeding emits Wallet A before B) so the
                // strip never flashes empty on first render.
                const ordered = [...teamWallets].sort((a, b) => {
                  const ai = walletKinds.find((k) => k.id === a.wallet_kind_id)?.sort_order ?? 0;
                  const bi = walletKinds.find((k) => k.id === b.wallet_kind_id)?.sort_order ?? 0;
                  return ai - bi;
                });
                return (
                  <div
                    key={team.id}
                    className="flex flex-col gap-3 px-5 py-4 rounded-2xl border bg-jcc-navy-light"
                    style={{ borderColor: `${team.primary_color}70` }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TeamLogo team={team} className="w-8 h-8 object-contain shrink-0" />
                      <p
                        className="text-xs font-black uppercase tracking-widest truncate min-w-0"
                        style={{ color: team.primary_color ?? undefined }}
                      >
                        {team.name}
                      </p>
                    </div>

                    {ordered.map((wallet, kindIdx) => {
                      const kindName =
                        walletKinds.find((k) => k.id === wallet.wallet_kind_id)?.name ??
                        `Wallet ${String.fromCharCode(65 + kindIdx)}`;
                      const remaining = wallet.budget_remaining;
                      const spent = wallet.budget_total - remaining;
                      const spentPct =
                        wallet.budget_total > 0 ? Math.min(100, Math.round((spent / wallet.budget_total) * 100)) : 0;
                      const squadCount = wallet.acquired_count;
                      const slotCount = TEAM_SHEET_FIRST_XI_COUNT;
                      return (
                        <div key={wallet.id} className={kindIdx > 0 ? "pt-3 border-t border-jcc-border" : undefined}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-jcc-accent-dark mb-1.5">
                            {kindName}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">
                                Purse Left
                              </p>
                              <p className="score-number text-base font-black text-jcc-text-primary leading-tight">
                                {formatLakhs(remaining)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">
                                Spent
                              </p>
                              <p className="score-number text-base font-black text-jcc-text-primary leading-tight">
                                {formatLakhs(spent)}
                              </p>
                            </div>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-jcc-border overflow-hidden mt-2">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${spentPct}%`, backgroundColor: team.primary_color ?? undefined }}
                            />
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            {Array.from({ length: slotCount }, (_, i) => (
                              <span
                                key={i}
                                className="w-1 h-4 rounded-full shrink-0"
                                style={{
                                  backgroundColor: i < squadCount ? (team.primary_color ?? undefined) : "var(--color-jcc-border)",
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-[10px] font-bold text-jcc-text-muted mt-3 whitespace-nowrap">
                            {squadCount}/{slotCount} signed
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {soldLots.length > 0 && (
          <div className="mt-16">
            <Eyebrow className="mb-5">Recent Signings</Eyebrow>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin">
              {soldLots.map((p) => {
                const teamId = teamKeyOf(participants, p.sold_wallet_id);
                const team = teamId ? teams.find((t) => t.id === teamId) ?? null : null;
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
                        <p className="text-xs font-black uppercase tracking-widest mt-1" style={{ color: team.primary_color ?? undefined }}>
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

        {season && !isComplete && (
          <div className="mt-16 w-screen relative left-1/2 -translate-x-1/2 max-w-400 px-4 sm:px-6">
            <Eyebrow className="mb-6">Team Sheets</Eyebrow>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {teams.map((team) => (
                <TeamSheet
                  key={team.id}
                  team={team}
                  lots={lots}
                  participants={participants}
                  categories={categories}
                  captains={captains}
                  valuationByCaptain={valuationByCaptain}
                />
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
          return teamId ? teams.find((t) => t.id === teamId)?.name ?? null : null;
        })()}
      />
      <AuctionFinaleOverlay show={showFinale} />
      <CategoryAnnouncementOverlay category={announcedCategory} />
      <LoopedToast playerName={loopedPlayerName} />
      <ActionErrorToast message={actionError} onDismiss={() => setActionError(null)} />
      {passwordModal}
    </div>
  );
}

// Slot-machine reveal for the name on the block — scrambles through random
// letters and settles left-to-right onto the real name, once per lot (keyed
// off `triggerKey`, not `text`, so a lot whose name happens to repeat still
// re-scrambles). Builds a beat of anticipation before the name lands.
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function ScrambleText({
  text,
  triggerKey,
  className,
}: {
  text: string;
  triggerKey: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);
  // Read via ref, not a `text` dependency, so a StrictMode dev double-invoke
  // (mount -> cleanup -> remount) just restarts the same scramble instead of
  // silently no-oping — a ref-guarded "already ran for this key" flag would
  // survive the first invocation's cleanup and skip the real one.
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const currentText = textRef.current;
    const durationMs = 700;
    const frameMs = 35;
    const totalFrames = Math.round(durationMs / frameMs);
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const revealCount = Math.ceil((frame / totalFrames) * currentText.length);
      setDisplay(
        currentText
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            return i < revealCount ? ch : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          })
          .join("")
      );
      if (frame >= totalFrames) {
        setDisplay(currentText);
        clearInterval(interval);
      }
    }, frameMs);

    return () => clearInterval(interval);
  }, [triggerKey]);

  return <span className={className}>{display}</span>;
}

// ─── Spotlight stage — the lot currently on the block ───────────────────

// If `teamId`'s captain sits in this lot's category, project what their
// captain_value would become should `previewBidAmount` be the winning bid —
// mirrors _auctionos_recalc_captain_valuation's own math (highest unreversed
// purchase in the team's category, halved) so this preview never disagrees
// with what the server would actually charge. Returns null when this team
// has no captain in this lot's category (nothing to project) — also null
// for a Regular captain (fixed price, never purchase-derived — see
// _auctionos_charge_regular_captains) or an MVP captain who already has a
// value (only the team's FIRST purchase in the category ever sets it, per
// _auctionos_recalc_captain_valuation, so a later sale never moves it).
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
  if (category.name?.toUpperCase().includes("REGULAR")) return null;
  if (currentValue != null) return null;
  const newValue = previewBidAmount * 0.5;
  return { newValue, delta: newValue };
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
  onUndoBid,
  isAdmin,
  teams,
}: {
  lot: AuctionLot;
  category: AuctionCategory | null;
  participants: AuctionWallet[];
  captains: AuctionCaptain[];
  valuationByCaptain: Map<string, CaptainValuation>;
  cooldownTeams: Record<string, boolean>;
  onRaisePaddle: (teamId: string) => void;
  onSold: () => void;
  onUnsold: () => void;
  onUndoBid?: () => void;
  isAdmin: boolean;
  teams: AuctionTeam[];
}) {
  const currentBid = lot.current_bid ?? lot.base_price;
  // Mirrors app/api/auctionos/bid/route.ts's own increment resolution: a
  // category's organizer-set bid_increment (schema v4) wins over JCC's
  // tier ladder when set, so the preview here never disagrees with what
  // the server actually charges.
  const nextBid = currentBid + (category?.bid_increment ?? getNextBidIncrement(currentBid));
  const leadingTeamId = teamKeyOf(participants, lot.current_bid_wallet_id);
  const leadingTeam = leadingTeamId ? teams.find((t) => t.id === leadingTeamId) ?? null : null;

  return (
    <div>
      <div
        className="premium-card px-6 py-10 sm:px-10 flex flex-col items-center text-center gap-6 transition-colors duration-500"
        style={leadingTeam ? { backgroundColor: `${leadingTeam.primary_color}40` } : undefined}
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
          <h2 className="text-3xl sm:text-4xl font-black uppercase text-jcc-text-primary">
            <ScrambleText text={lot.display_name} triggerKey={lot.id} />
          </h2>
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
          {leadingTeam && (
            <TeamLogo team={leadingTeam} className="w-24 h-24 sm:w-28 sm:h-28 object-contain shrink-0" />
          )}
        </div>

        {isAdmin && (
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
            {onUndoBid && (
              <button
                onClick={onUndoBid}
                disabled={!lot.current_bid_wallet_id}
                title="Retract the current highest bid"
                className="btn-ghost px-4 py-3 disabled:opacity-30"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-5">
        {teams.map((team) => {
          const teamId = team.id;
          const purse = walletForTeamKind(participants, teamId, category?.wallet_kind_id);
          const isLeading = leadingTeamId === teamId;
          const canAfford = (purse?.budget_remaining ?? 0) >= nextBid;

          // "If I win this lot right now" preview: the leading team would
          // pay currentBid (what Sold actually charges); anyone else would
          // have to clear nextBid to take the lead in the first place.
          const captain = captains.find((c) => entityTeamKey(c) === teamId);
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
              team={team}
              purse={purse}
              isLeading={isLeading}
              canBid={canAfford && isAdmin}
              cooldown={!!cooldownTeams[teamId]}
              onRaisePaddle={() => onRaisePaddle(teamId)}
              hasCaptain={!!captain}
              captainName={captain?.display_name ?? null}
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
  team,
  lots,
  participants,
  categories,
  captains,
  valuationByCaptain,
}: {
  team: AuctionTeam;
  lots: AuctionLot[];
  participants: AuctionWallet[];
  categories: AuctionCategory[];
  captains: AuctionCaptain[];
  valuationByCaptain: Map<string, CaptainValuation>;
}) {
  // The captain has no purchase behind their own slot (AUCTIONOS.md
  // "captains occupy one category slot with no purchase behind it") — they
  // don't come from `lots` at all, so they're always pinned to slot 1
  // rather than falling wherever their (coincidental, same-name) sale
  // landed in acquisition order.
  const captain = captains.find((c) => entityTeamKey(c) === team.id) ?? null;
  const captainCategory = captain ? categories.find((c) => c.id === captain.category_id) ?? null : null;
  const captainIsMvp = !!captainCategory?.name?.toUpperCase().includes("MVP");
  const captainValue = captain ? valuationByCaptain.get(captain.id)?.captain_value ?? null : null;

  const squad = lots
    .filter((p) => p.status === "sold" && teamKeyOf(participants, p.sold_wallet_id) === team.id)
    .filter(
      (p) => !captain || p.display_name.trim().toLowerCase() !== captain.display_name.trim().toLowerCase()
    )
    .sort((a, b) => (a.sold_at ?? "").localeCompare(b.sold_at ?? ""));

  const lotSlotCount = TEAM_SHEET_SLOT_COUNT - (captain ? 1 : 0);
  const lotSlots: Array<AuctionLot | null> = Array.from({ length: lotSlotCount }, (_, i) => squad[i] ?? null);
  const slots: Array<{ isCaptain: boolean; lot: AuctionLot | null }> = captain
    ? [{ isCaptain: true, lot: null }, ...lotSlots.map((lot) => ({ isCaptain: false, lot }))]
    : lotSlots.map((lot) => ({ isCaptain: false, lot }));

  return (
    <div
      className="rounded-4xl p-5 sm:p-6"
      style={{
        background: "var(--color-jcc-navy)",
        border: "1.5px solid color-mix(in srgb, var(--color-jcc-accent) 60%, transparent)",
      }}
    >
      <div className="flex items-center gap-3 mb-4 min-w-0">
        <TeamLogo team={team} className="w-9 h-9 object-contain shrink-0" />
        <h3
          className="font-heading text-lg sm:text-xl font-black uppercase tracking-[0.08em] min-w-0 break-words leading-tight"
          style={{ color: team.primary_color ?? undefined }}
        >
          {team.name}
        </h3>
      </div>

      {slots.map((slot, i) => {
        const isSectionStart = i === 0 || i === TEAM_SHEET_FIRST_XI_COUNT;
        const slotLot = slot.lot;
        const category = slotLot ? categories.find((c) => c.id === slotLot.category_id) ?? null : null;
        const isMvp = slot.isCaptain ? captainIsMvp : !!category?.name?.toUpperCase().includes("MVP");
        const filled = slot.isCaptain || !!slot.lot;
        const name = slot.isCaptain ? captain?.display_name : slot.lot?.display_name;
        // MVP captains have no value until the team's first buy in that
        // category (highest-qualifying-purchase formula, still null) — show
        // a placeholder rather than a wrong/empty price.
        const priceLabel = slot.isCaptain
          ? captainValue != null
            ? formatLakhs(captainValue)
            : "—"
          : slot.lot
            ? formatLakhs(slot.lot.sold_price ?? 0)
            : null;
        return (
          <div key={i}>
            {isSectionStart && (
              <p
                className={`text-jcc-text-muted text-[9px] font-black uppercase tracking-[0.25em] mb-1 ${i === 0 ? "" : "mt-3"}`}
              >
                {i === 0 ? "First XI" : "Guest Players"}
              </p>
            )}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="score-number text-jcc-text-muted/50 text-[11px] w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="font-bold text-xs uppercase tracking-wide truncate"
                  style={filled ? { color: isMvp ? "var(--color-jcc-accent-dark)" : (team.primary_color ?? undefined) } : undefined}
                >
                  {filled ? `${slot.isCaptain ? "(c) " : ""}${name}` : ""}
                </span>
              </div>
              {priceLabel != null && (
                <span className="score-number text-jcc-accent-dark text-[10px] font-black shrink-0 pl-2">
                  {priceLabel}
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

function CompletedRecap({
  lots,
  participants,
  categories,
  teams,
  captains,
  valuationByCaptain,
}: {
  lots: AuctionLot[];
  participants: AuctionWallet[];
  categories: AuctionCategory[];
  teams: AuctionTeam[];
  captains: AuctionCaptain[];
  valuationByCaptain: Map<string, CaptainValuation>;
}) {
  const sold = lots.filter((p) => p.status === "sold");
  const topSignings = [...sold].sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0)).slice(0, 3);

  return (
    <div className="py-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: SMOOTH_EASE }}
        className="flex flex-col items-center text-center gap-4 mb-12"
      >
        <Trophy className="w-9 h-9 text-jcc-accent-dark" />
        <h2 className="text-3xl sm:text-4xl font-black uppercase text-jcc-text-primary">The Gavel Rests</h2>
        <p className="text-jcc-text-muted text-sm max-w-md">
          {sold.length} {sold.length === 1 ? "player" : "players"} found a new home this season.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } }}
        className="w-screen relative left-1/2 -translate-x-1/2 max-w-400 px-4 sm:px-6 mb-14"
      >
        <Eyebrow className="mb-6 text-center">Team Sheets</Eyebrow>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {teams.map((team) => (
            <motion.div
              key={team.id}
              variants={{ hidden: { opacity: 0, y: 24, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ duration: 0.5, ease: SMOOTH_EASE }}
            >
              <TeamSheet
                team={team}
                lots={lots}
                participants={participants}
                categories={categories}
                captains={captains}
                valuationByCaptain={valuationByCaptain}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {topSignings.length > 0 && (
        <div className="mb-14">
          <Eyebrow className="mb-6 max-w-md mx-auto">Marquee Signings</Eyebrow>
          <div className="flex justify-center gap-8 flex-wrap">
            {topSignings.map((p) => {
              const teamId = teamKeyOf(participants, p.sold_wallet_id);
              const team = teamId ? teams.find((t) => t.id === teamId) ?? null : null;
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
                      <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: team.primary_color ?? undefined }}>
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
    </div>
  );
}
