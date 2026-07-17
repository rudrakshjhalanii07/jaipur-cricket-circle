"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Gavel,
  Lock,
  Loader2,
  AlertCircle,
  Check,
  X,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";

import { TEAMS, TEAM_ORDER_ALL, type TeamId } from "@/lib/teams";
import type { AuctionExperienceProps } from "@/lib/auctionos/core/template";
import type { Auction, AuctionWallet, AuctionLot, AuctionCategory } from "@/lib/auctionos/core/types";
import {
  fetchActiveAuction,
  fetchWallets,
  fetchLots,
  fetchAuctionCategories,
  fetchAuctionTemplateBySlug,
} from "@/lib/auctionos/core/data";
import { fetchEligiblePlayers, type EligiblePlayer } from "./data";
import {
  formatLakhs,
  getNextBid,
  BASE_PRICE_TIERS_LAKHS,
  DEFAULT_PURSE_LAKHS,
} from "./rules";
import { getDiceBearUrl } from "@/lib/avatar";
import { SMOOTH_EASE } from "@/lib/animations";
import RollingNumber from "@/components/auctionos/RollingNumber";
import AuctionCountdown from "@/components/auctionos/AuctionCountdown";
import { AuctionOSMark, AuctionOSSeal, HeroBackdrop } from "@/components/auctionos/AuctionOSBrand";

const POLL_INTERVAL_MS = 4000;
const ROLE_OPTIONS = ["Batter", "Bowler", "All-Rounder", "Wicketkeeper"];
const TEMPLATE_ID = "jcc";

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

// ─── Pool Builder (admin) — curates the lot list before starting a season ──

interface DraftLot {
  player_id: string | null;
  display_name: string;
  role: string;
  base_price: number;
  image: string | null;
}

function PoolBuilderModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; starts_at: string | null; lots: DraftLot[] }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("Season II");
  const [startsAt, setStartsAt] = useState("");
  const [eligible, setEligible] = useState<EligiblePlayer[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [search, setSearch] = useState("");
  const [lots, setLots] = useState<DraftLot[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchEligiblePlayers().then((fetched) => {
      if (cancelled) return;
      setEligible(fetched);
      setLoadingEligible(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  function toggleSelect(p: EligiblePlayer) {
    setLots((prev) => {
      const exists = prev.find((l) => l.player_id === p.id);
      if (exists) return prev.filter((l) => l.player_id !== p.id);
      return [
        ...prev,
        {
          player_id: p.id,
          display_name: p.name,
          role: p.cricket_role
            ? p.cricket_role.charAt(0).toUpperCase() + p.cricket_role.slice(1)
            : "All-Rounder",
          base_price: BASE_PRICE_TIERS_LAKHS[0],
          image: p.image,
        },
      ];
    });
  }

  function updateLot(playerId: string, patch: Partial<DraftLot>) {
    setLots((prev) =>
      prev.map((l) => (l.player_id === playerId ? { ...l, ...patch } : l))
    );
  }

  const filtered = eligible.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-jcc-blue/25 backdrop-blur-md z-[290]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[295] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="premium-card w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col pointer-events-auto"
            >
              <div className="px-6 pt-6 pb-4 border-b border-jcc-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <AuctionOSSeal className="w-10 h-10 shrink-0" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-jcc-text-primary">
                      Prepare the Auction
                    </h3>
                    <p className="text-[10px] text-jcc-text-muted font-bold mt-0.5">
                      Curate the lot list, then open the hall.
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-jcc-navy-light transition-colors">
                  <X className="w-4 h-4 text-jcc-text-muted" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted mb-1.5 block">
                      Auction Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-jcc-navy-light border border-jcc-border rounded-xl px-3.5 py-2.5 text-jcc-text-primary text-sm font-medium focus:outline-none focus:border-jcc-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted mb-1.5 block">
                      Opens At (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="w-full bg-jcc-navy-light border border-jcc-border rounded-xl px-3.5 py-2.5 text-jcc-text-primary text-sm font-medium focus:outline-none focus:border-jcc-accent"
                    />
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search eligible players..."
                    className="w-full bg-jcc-navy-light border border-jcc-border rounded-xl pl-10 pr-3.5 py-2.5 text-jcc-text-primary text-sm font-medium focus:outline-none focus:border-jcc-accent placeholder:text-jcc-text-muted/60"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {loadingEligible ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="w-5 h-5 text-jcc-text-muted animate-spin" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-jcc-text-muted text-xs text-center py-8">No eligible players found.</p>
                  ) : (
                    filtered.map((p) => {
                      const selected = lots.some((l) => l.player_id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSelect(p)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${selected ? "border-jcc-accent/50 bg-jcc-accent/10" : "border-jcc-border hover:border-jcc-accent/30 bg-jcc-navy"}`}
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selected ? "bg-jcc-accent border-jcc-accent" : "border-jcc-text-muted/40"}`}>
                            {selected && <Check className="w-3 h-3 text-jcc-blue" />}
                          </div>
                          <span className="text-sm font-bold text-jcc-text-primary truncate">{p.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {lots.length > 0 && (
                  <div className="pt-2 border-t border-jcc-border space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-jcc-accent-dark">
                      Lots ({lots.length})
                    </p>
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                      {lots.map((l, i) => (
                        <div key={l.player_id} className="flex items-center gap-2 text-xs">
                          <span className="w-5 text-jcc-text-muted score-number shrink-0">{i + 1}</span>
                          <span className="flex-1 text-jcc-text-primary font-bold truncate">{l.display_name}</span>
                          <select
                            value={l.role}
                            onChange={(e) => updateLot(l.player_id!, { role: e.target.value })}
                            className="bg-jcc-navy-light border border-jcc-border rounded-lg px-2 py-1.5 text-jcc-text-primary text-[11px]"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <select
                            value={l.base_price}
                            onChange={(e) => updateLot(l.player_id!, { base_price: Number(e.target.value) })}
                            className="bg-jcc-navy-light border border-jcc-border rounded-lg px-2 py-1.5 text-jcc-text-primary text-[11px]"
                          >
                            {BASE_PRICE_TIERS_LAKHS.map((tier) => (
                              <option key={tier} value={tier}>{formatLakhs(tier)}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-jcc-danger/10 border border-jcc-danger/20">
                    <AlertCircle className="w-3.5 h-3.5 text-jcc-danger shrink-0" />
                    <p className="text-jcc-danger text-xs font-medium">{error}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-jcc-border shrink-0">
                <button
                  disabled={lots.length === 0 || !name.trim() || submitting}
                  onClick={() =>
                    onSubmit({
                      name: name.trim(),
                      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
                      lots,
                    })
                  }
                  className="btn-vibrant-blue w-full disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gavel className="w-3.5 h-3.5" />}
                  {submitting ? "Preparing..." : `Prepare Auction (${lots.length} lots)`}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
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
}: {
  teamId: TeamId;
  purse: AuctionWallet | undefined;
  isLeading: boolean;
  canBid: boolean;
  cooldown: boolean;
  onRaisePaddle: () => void;
}) {
  const team = TEAMS[teamId];
  return (
    <motion.div
      className={`id-card relative p-5 flex flex-col items-center gap-3 text-center transition-shadow duration-500 ${isLeading ? "shadow-[0_0_0_1px_rgba(212,175,55,0.55),0_18px_44px_-20px_rgba(212,175,55,0.5)] border-jcc-accent/40" : ""}`}
      animate={isLeading ? { y: -3 } : { y: 0 }}
      transition={{ duration: 0.5, ease: SMOOTH_EASE }}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `${team.primary}14` }}>
        <TeamLogo teamId={teamId} className="w-10 h-10 object-contain" />
      </div>
      <div>
        <p className="font-heading font-black text-sm uppercase tracking-wide" style={{ color: team.primary }}>
          {team.shortName}
        </p>
        <p className="text-[10px] text-jcc-text-muted font-bold">{team.captain}</p>
      </div>
      <div className="w-full pt-2 border-t border-jcc-border grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">Purse Left</p>
          <p className="score-number text-sm font-black text-jcc-text-primary">
            {formatLakhs(purse?.budget_remaining ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">Squad</p>
          <p className="score-number text-sm font-black text-jcc-text-primary">{purse?.acquired_count ?? 0}</p>
        </div>
      </div>
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

export default function AuctionExperience({
  initialAuction,
  initialWallets,
  initialLots,
  initialCategories,
}: AuctionExperienceProps) {
  const [season, setSeason] = useState<Auction | null>(initialAuction);
  const [participants, setParticipants] = useState<AuctionWallet[]>(initialWallets);
  const [lots, setLots] = useState<AuctionLot[]>(initialLots);
  // Categories aren't read anywhere in this template's UI yet (JCC's pool
  // builder still assigns a display-only `role`, not a real category_id —
  // see the note in handleStartAuction below) — kept as state so a future
  // pass can start reading it without re-plumbing the prop contract.
  const [, setCategories] = useState<AuctionCategory[]>(initialCategories);
  const [view, setView] = useState<ViewPhase>("hero");
  const [mounted, setMounted] = useState(false);

  const [showBuilder, setShowBuilder] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Shown once, right after creation — the access code is never retrievable
  // again after this response (auctions has no public read policy; see
  // AUCTIONOS.md's "Landing philosophy"), so the organizer must copy it
  // here before dismissing this banner.
  const [createdAccessCode, setCreatedAccessCode] = useState<string | null>(null);

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
    const s = await fetchActiveAuction();
    setSeason(s);
    if (s) {
      const [p, l, c] = await Promise.all([fetchWallets(s.id), fetchLots(s.id), fetchAuctionCategories(s.id)]);
      setParticipants(p);
      setLots(l);
      setCategories(c);
    } else {
      setParticipants([]);
      setLots([]);
      setCategories([]);
    }
  }, []);

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

  const onBlockLot = lots.find((p) => p.status === "on_block") ?? null;
  const upcomingLots = lots.filter((p) => p.status === "upcoming");
  const soldLots = [...lots.filter((p) => p.status === "sold")].sort((a, b) =>
    (b.sold_at ?? "").localeCompare(a.sold_at ?? "")
  );
  const totalLots = lots.length;
  const resolvedCount = lots.filter((p) => p.status === "sold" || p.status === "unsold").length;
  const isComplete = season?.status === "completed" || (totalLots > 0 && resolvedCount === totalLots);

  async function handleStartAuction(payload: { name: string; starts_at: string | null; lots: DraftLot[] }) {
    const password = await ensurePassword();
    if (!password) return;
    setStarting(true);
    setStartError(null);
    try {
      // template_id is now the auction_templates DB uuid, not the "jcc"
      // slug — resolve it here rather than baking a uuid into this file.
      const templateRow = await fetchAuctionTemplateBySlug(TEMPLATE_ID);
      if (!templateRow) {
        setStartError("JCC template is not seeded in the database yet.");
        setStarting(false);
        return;
      }
      // Note: lots aren't assigned a category_id here — the pool builder
      // only collects a display-only `role` (stored in metadata, same as
      // before), and per-auction category rows don't exist until this same
      // request creates them, so there's no id yet to reference. Wiring a
      // role → category_id mapping (via JCC_ROLE_TO_CATEGORY_NAME) is
      // future pool-builder work, not part of this rewrite pass.
      const res = await fetch("/api/auctionos/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          template_id: templateRow.id,
          name: payload.name,
          starts_at: payload.starts_at,
          settings: null,
          categories: null,
          team_ids: TEAM_ORDER_ALL,
          wallet_kinds: [{ name: "Main Purse", initial_balance: DEFAULT_PURSE_LAKHS, transfer_enabled: false, sort_order: 0 }],
          lots: payload.lots.map((l, i) => ({
            external_ref: l.player_id,
            display_name: l.display_name,
            base_price: l.base_price,
            lot_order: i + 1,
            category_id: null,
            metadata: { role: l.role, image: l.image },
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setStartError(data.error ?? "Failed to start the auction");
        setStarting(false);
        return;
      }
      const { data } = await res.json();
      if (data?.access_code) setCreatedAccessCode(data.access_code);
      await refresh();
      setShowBuilder(false);
      setStarting(false);
    } catch {
      setStartError("Network error. Please try again.");
      setStarting(false);
    }
  }

  async function handleAdvance() {
    if (!season) return;
    const password = await ensurePassword();
    if (!password) return;
    setAdvancing(true);
    await fetch("/api/auctionos/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ auction_id: season.id }),
    });
    await refresh();
    setAdvancing(false);
  }

  async function handleRaisePaddle(teamId: TeamId) {
    if (!onBlockLot) return;
    const wallet = walletForTeam(participants, teamId);
    if (!wallet) return;
    const password = await ensurePassword();
    if (!password) return;
    setCooldownTeams((c) => ({ ...c, [teamId]: true }));
    setTimeout(() => setCooldownTeams((c) => ({ ...c, [teamId]: false })), 1500);
    await fetch("/api/auctionos/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ lot_id: onBlockLot.id, wallet_id: wallet.id }),
    });
    await refresh();
  }

  async function handleSold() {
    if (!onBlockLot || !onBlockLot.current_bid_wallet_id) return;
    const password = await ensurePassword();
    if (!password) return;
    setLastSoldSnapshot(onBlockLot);
    setHammerPhase("going_once");
    setTimeout(() => setHammerPhase("going_twice"), 900);
    setTimeout(async () => {
      setHammerPhase("sold");
      await fetch("/api/auctionos/sold", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ lot_id: onBlockLot.id }),
      });
      await refresh();
      setTimeout(() => setHammerPhase("idle"), 1600);
    }, 1800);
  }

  async function handleUnsold() {
    if (!onBlockLot) return;
    const password = await ensurePassword();
    if (!password) return;
    await fetch("/api/auctionos/unsold", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ lot_id: onBlockLot.id }),
    });
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

        {createdAccessCode && (
          <div className="absolute top-6 right-6 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-jcc-border-bright bg-jcc-navy-light z-10">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-jcc-text-muted">Auction Code — share this</span>
              <span className="score-number text-lg font-black tracking-[0.25em] text-jcc-accent-dark">{createdAccessCode}</span>
            </div>
            <button
              onClick={() => setCreatedAccessCode(null)}
              aria-label="Dismiss"
              className="text-jcc-text-muted hover:text-jcc-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <motion.div
          className="flex flex-col items-center gap-9 text-center px-6 max-w-4xl w-full relative z-10"
          initial={mounted ? "hidden" : false}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: -16 }, visible: { opacity: 1, y: 0 } }}
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
            className="flex flex-col items-center leading-none gap-3"
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

          {season && (
            <motion.div
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              className="flex items-center gap-6 text-jcc-text-muted"
            >
              <div className="text-center">
                <p className="score-number text-2xl font-black text-jcc-text-primary">{totalLots}</p>
                <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">Lots</p>
              </div>
              <span className="h-8 w-px bg-jcc-border-bright" />
              <div className="text-center">
                <p className="score-number text-2xl font-black text-jcc-text-primary">{TEAM_ORDER_ALL.length}</p>
                <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">Franchises</p>
              </div>
              <span className="h-8 w-px bg-jcc-border-bright" />
              <div className="text-center">
                <p className="score-number text-2xl font-black text-jcc-accent-dark">{formatLakhs(DEFAULT_PURSE_LAKHS)}</p>
                <p className="text-[9px] font-black uppercase tracking-widest mt-0.5">Purse</p>
              </div>
            </motion.div>
          )}

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
            <button
              onClick={async () => {
                const pw = await ensurePassword();
                if (pw) setShowBuilder(true);
              }}
              className="btn-ghost"
            >
              <Sparkles className="w-4 h-4" />
              {season ? "Prepare Next Auction" : "Prepare The Auction"}
            </button>
          </motion.div>
        </motion.div>

        {passwordModal}
        <PoolBuilderModal
          isOpen={showBuilder}
          onClose={() => setShowBuilder(false)}
          onSubmit={handleStartAuction}
          submitting={starting}
          error={startError}
        />
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
              participants={participants}
              cooldownTeams={cooldownTeams}
              onRaisePaddle={handleRaisePaddle}
              onSold={handleSold}
              onUnsold={handleUnsold}
            />

            {upcomingLots.length > 0 && (
              <div className="mt-16">
                <Eyebrow className="mb-5">Upcoming Lots</Eyebrow>
                <div className="premium-card divide-y divide-jcc-border px-5">
                  {upcomingLots.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3.5">
                      <div className="flex items-center gap-4">
                        <span className="score-number text-jcc-text-muted/50 text-sm w-6">{p.lot_order}</span>
                        <span className="text-jcc-text-primary font-bold text-sm">{p.display_name}</span>
                        <span className="text-jcc-text-muted text-[10px] font-black uppercase tracking-widest">{lotRole(p)}</span>
                      </div>
                      <span className="score-number text-jcc-accent-dark text-sm font-black">{formatLakhs(p.base_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  <div key={p.id} className="flex flex-col items-center gap-3 shrink-0 w-32">
                    <PlayerPortrait
                      name={p.display_name}
                      image={lotImage(p)}
                      className="w-28 h-28 rounded-2xl overflow-hidden border border-jcc-border"
                    />
                    <div className="text-center">
                      <p className="text-jcc-text-primary font-bold text-xs leading-tight">{p.display_name}</p>
                      {team && (
                        <p className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: team.primary }}>
                          {team.shortName}
                        </p>
                      )}
                      <p className="score-number text-jcc-accent-dark text-xs font-black mt-0.5">
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

function SpotlightStage({
  lot,
  participants,
  cooldownTeams,
  onRaisePaddle,
  onSold,
  onUnsold,
}: {
  lot: AuctionLot;
  participants: AuctionWallet[];
  cooldownTeams: Record<string, boolean>;
  onRaisePaddle: (teamId: TeamId) => void;
  onSold: () => void;
  onUnsold: () => void;
}) {
  const currentBid = lot.current_bid ?? lot.base_price;
  const nextBid = getNextBid(currentBid);
  const leadingTeamId = teamKeyOf(participants, lot.current_bid_wallet_id);

  return (
    <div>
      <div className="premium-card px-6 py-10 sm:px-10 flex flex-col items-center text-center gap-6">
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
          <div>
            <p className="text-jcc-text-muted text-[9px] font-black tracking-widest uppercase mb-1">Leading</p>
            <p className="text-lg font-black" style={{ color: leadingTeamId ? TEAMS[leadingTeamId].primary : "var(--color-jcc-text-muted)" }}>
              {leadingTeamId ? TEAMS[leadingTeamId].shortName : "—"}
            </p>
          </div>
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

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {TEAM_ORDER_ALL.map((teamId) => {
          const purse = walletForTeam(participants, teamId);
          const isLeading = leadingTeamId === teamId;
          const canAfford = (purse?.budget_remaining ?? 0) >= nextBid;
          return (
            <CaptainDesk
              key={teamId}
              teamId={teamId}
              purse={purse}
              isLeading={isLeading}
              canBid={canAfford}
              cooldown={!!cooldownTeams[teamId]}
              onRaisePaddle={() => onRaisePaddle(teamId)}
            />
          );
        })}
      </div>
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
