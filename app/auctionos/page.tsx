"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Sparkles, Loader2, ArrowRight, X } from "lucide-react";
import { AuctionOSMark, AuctionOSSeal, HeroBackdrop } from "@/components/auctionos/AuctionOSBrand";

const CODE_KEY = "auctionos_code_ok";
const ADMIN_KEY = "jcc_admin_password";

// The platform landing — deliberately shows nothing about any auction
// (no name, no lot count, no team list, no stats). It's a SaaS front door,
// not a status page: the only two things a visitor can do here are enter a
// code for an auction they were already invited to, or (as an organizer)
// prepare the next one. Both actions live behind a modal, opened by their
// button, so the landing itself stays a single calm hallmark moment — the
// same engraved-medallion backdrop used for the in-hall hero — rather than
// two permanently-open forms. See AUCTIONOS.md's "Landing philosophy".
export default function AuctionOSLandingPage() {
  const [modal, setModal] = useState<"code" | "password" | null>(null);

  return (
    <div className="min-h-screen relative page-top flex flex-col items-center justify-center px-4 pb-16 overflow-hidden">
      <HeroBackdrop />
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-9 text-center -translate-y-9">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <AuctionOSSeal className="w-9 h-9" />
          <span className="text-jcc-accent-dark text-[10px] font-black tracking-[0.5em] uppercase">
            Jaipur Cricket Circle
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 14, delay: 0.1 }}
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

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-jcc-text-muted text-sm sm:text-base font-medium max-w-md"
        >
          <span className="font-black text-jcc-text-primary">Create. Manage. Broadcast.</span>
          <br />
          Live Auctions for Sports Leagues.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <button onClick={() => setModal("code")} className="btn-vibrant-blue">
            <KeyRound className="w-4 h-4" />
            Enter Auction Hall
          </button>
          <button onClick={() => setModal("password")} className="btn-ghost">
            <Sparkles className="w-4 h-4" />
            Prepare Next Auction
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {modal === "code" && <CodeModal onClose={() => setModal(null)} />}
        {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ModalShell({
  icon,
  title,
  description,
  onClose,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-jcc-navy-deep/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm flex flex-col gap-4 p-6 sm:p-7 rounded-2xl border border-jcc-border bg-jcc-navy-light shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-jcc-text-muted hover:text-jcc-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-jcc-border-bright bg-jcc-navy-deep text-jcc-accent-dark">
            {icon}
          </span>
          <h2 className="text-sm font-black uppercase tracking-widest text-jcc-text-primary">{title}</h2>
        </div>
        <p className="text-jcc-text-muted text-xs leading-relaxed">{description}</p>
        {children}
      </motion.div>
    </motion.div>
  );
}

function CodeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auctionos/resolve-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That code doesn't match any auction.");
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem(CODE_KEY, data.auctionId);
      router.push("/auctionos/hall");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      icon={<KeyRound className="w-5 h-5" />}
      title="Enter Auction Hall"
      description="Have an auction code from your organizer? Enter it to join that auction's room."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="AUCTION CODE"
          maxLength={12}
          className="w-full px-4 py-3 rounded-xl bg-jcc-navy-deep border border-jcc-border text-jcc-text-primary text-sm font-black uppercase tracking-[0.2em] text-center placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
        />
        {error && <p className="text-red-500 text-[11px] font-bold text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="btn-vibrant-blue justify-center disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Enter
        </button>
      </form>
    </ModalShell>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        setError("Incorrect password.");
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem(ADMIN_KEY, password);
      router.push("/auctionos/hall");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      icon={<Sparkles className="w-5 h-5" />}
      title="Prepare Next Auction"
      description="Organizer access. Sign in to build the lot list and open the next auction."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          placeholder="ORGANIZER PASSWORD"
          className="w-full px-4 py-3 rounded-xl bg-jcc-navy-deep border border-jcc-border text-jcc-text-primary text-sm font-black uppercase tracking-[0.15em] text-center placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
        />
        {error && <p className="text-red-500 text-[11px] font-bold text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="btn-ghost justify-center disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Prepare
        </button>
      </form>
    </ModalShell>
  );
}
