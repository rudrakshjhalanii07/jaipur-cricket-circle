"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AuctionOSSeal } from "@/components/auctionos/AuctionOSBrand";
import JoinCodeCard from "@/components/auctionos/wizard/JoinCodeCard";
import { WIZARD_STEPS, type BootstrapData, type WizardStepId } from "@/components/auctionos/wizard/types";
import IdentityStep from "@/components/auctionos/wizard/steps/IdentityStep";
import FranchisesStep from "@/components/auctionos/wizard/steps/FranchisesStep";
import WalletsStep from "@/components/auctionos/wizard/steps/WalletsStep";
import TalentPoolStep from "@/components/auctionos/wizard/steps/TalentPoolStep";
import CategoriesStep from "@/components/auctionos/wizard/steps/CategoriesStep";
import CaptainsStep from "@/components/auctionos/wizard/steps/CaptainsStep";
import ReviewStep from "@/components/auctionos/wizard/steps/ReviewStep";

const ADMIN_KEY = "jcc_admin_password";

function completionFor(step: WizardStepId, data: BootstrapData): boolean {
  switch (step) {
    case "identity":
      return true;
    case "franchises":
      return data.teams.length > 0;
    case "wallets":
      return data.wallet_kinds.length > 0;
    case "talent":
      return data.lots.length > 0;
    case "categories":
      return data.categories.length > 0;
    case "captains":
      return true; // optional — never blocks
    case "review":
    case "begin":
      return data.auction.status !== "draft";
    default:
      return false;
  }
}

export default function DashboardShell({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  // sessionStorage can't be read during the render that has to match the
  // server (the server has no `window`, so a lazy useState initializer
  // here would make the very first client render diverge from the SSR
  // output — a real hydration mismatch, not just a lint nit). Instead,
  // adminPassword starts null on both server and the client's first paint,
  // and the actual read happens in a mount-only effect below; `mounted`
  // gates every branch that depends on it so server and pre-mount client
  // output stay identical.
  const [mounted, setMounted] = useState(false);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStepId>("identity");

  useEffect(() => {
    // Synchronizing React state with an external system (sessionStorage,
    // which doesn't exist during SSR) — the one-time mount read this rule's
    // own docs carve out as fine; see the identical disable a few lines
    // down for the bootstrap-triggering effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setAdminPassword(sessionStorage.getItem(ADMIN_KEY));
  }, []);

  const bootstrap = useCallback(
    async (password: string) => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/auctionos/${auctionId}`, {
          headers: { "x-admin-password": password },
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            sessionStorage.removeItem(ADMIN_KEY);
            setAdminPassword(null);
            setFetchError("Incorrect admin password for this auction.");
          } else {
            setFetchError(json.error ?? "Failed to load auction.");
          }
          setLoading(false);
          return;
        }
        setData(json as BootstrapData);
      } catch {
        setFetchError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [auctionId]
  );

  useEffect(() => {
    // Synchronizing with an external system (the API) on password change —
    // exactly the case react-hooks/set-state-in-effect's own docs carve
    // out as fine, just not statically distinguishable from a bad pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (adminPassword) bootstrap(adminPassword);
    else setLoading(false);
  }, [adminPassword, bootstrap]);

  const refetch = useCallback(async () => {
    if (adminPassword) await bootstrap(adminPassword);
  }, [adminPassword, bootstrap]);

  const joinCode = useMemo(() => {
    if (!mounted) return null;
    return sessionStorage.getItem(`auctionos_code_${auctionId}`);
  }, [mounted, auctionId]);

  // Identical on server and the client's first paint (mounted is false in
  // both) — the actual branch (password gate / loading / data) only
  // renders once the client has mounted and read sessionStorage, which by
  // definition happens after hydration has already reconciled.
  if (!mounted || (loading && !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jcc-navy-deep">
        <Loader2 className="w-6 h-6 animate-spin text-jcc-accent-dark" />
      </div>
    );
  }

  if (!adminPassword) {
    return (
      <PasswordGate
        auctionId={auctionId}
        error={fetchError}
        onUnlocked={(password) => {
          sessionStorage.setItem(ADMIN_KEY, password);
          setAdminPassword(password);
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jcc-navy-deep px-4 text-center">
        <p className="text-red-500 text-sm font-bold">{fetchError ?? "Could not load this auction."}</p>
      </div>
    );
  }

  const isDraft = data.auction.status === "draft";
  const readOnly = !isDraft;

  return (
    <div className="min-h-screen page-top bg-jcc-navy-deep pb-16">
      <StickyTopBar auction={data.auction} joinCode={joinCode} adminPassword={adminPassword} auctionId={auctionId} refetch={refetch} readOnly={readOnly} />

      <div className="max-w-6xl mx-auto px-4 mt-8 grid lg:grid-cols-[240px_1fr] gap-6">
        <ProgressSidebar activeStep={activeStep} onSelect={setActiveStep} data={data} readOnly={readOnly} />

        <div className="flex flex-col gap-4 min-w-0">
          {readOnly && (
            <div className="premium-card px-5 py-4 flex items-center gap-3 border-jcc-accent-dark/40 flex-wrap">
              <Lock className="w-4 h-4 text-jcc-accent-dark shrink-0" />
              <p className="text-jcc-text-primary text-xs font-bold flex-1 min-w-[200px]">
                This auction has left draft status ({data.auction.status}) — editing is locked. Showing a
                read-only summary.
              </p>
              <button onClick={() => router.push("/auctionos/hall")} className="btn-ghost !px-4 !py-2 text-[10px]">
                Go to Auction Hall
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={readOnly ? "review-locked" : activeStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              {readOnly ? (
                <ReviewStep
                  auctionId={auctionId}
                  data={data}
                  adminPassword={adminPassword}
                  refetch={refetch}
                  readOnly
                />
              ) : (
                <StepBody step={activeStep} auctionId={auctionId} data={data} adminPassword={adminPassword} refetch={refetch} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StepBody({
  step,
  auctionId,
  data,
  adminPassword,
  refetch,
}: {
  step: WizardStepId;
  auctionId: string;
  data: BootstrapData;
  adminPassword: string;
  refetch: () => Promise<void>;
}) {
  const props = { auctionId, data, adminPassword, refetch, readOnly: false };
  switch (step) {
    case "identity":
      return <IdentityStep {...props} />;
    case "franchises":
      return <FranchisesStep {...props} />;
    case "wallets":
      return <WalletsStep {...props} />;
    case "talent":
      return <TalentPoolStep {...props} />;
    case "categories":
      return <CategoriesStep {...props} />;
    case "captains":
      return <CaptainsStep {...props} />;
    case "review":
    case "begin":
      return <ReviewStep {...props} />;
    default:
      return null;
  }
}

function ProgressSidebar({
  activeStep,
  onSelect,
  data,
  readOnly,
}: {
  activeStep: WizardStepId;
  onSelect: (step: WizardStepId) => void;
  data: BootstrapData;
  readOnly: boolean;
}) {
  return (
    <nav className="premium-card p-3 h-fit lg:sticky lg:top-24 flex lg:flex-col gap-1 overflow-x-auto">
      {WIZARD_STEPS.map((step) => {
        const complete = completionFor(step.id, data);
        const active = activeStep === step.id && !readOnly;
        return (
          <button
            key={step.id}
            disabled={readOnly}
            onClick={() => onSelect(step.id)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors shrink-0 ${
              active
                ? "bg-jcc-navy-light text-jcc-text-primary border border-jcc-accent-dark/40"
                : "text-jcc-text-muted hover:text-jcc-text-primary hover:bg-jcc-navy-light border border-transparent"
            } ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0 ${
                complete ? "bg-jcc-accent-dark text-white" : "border border-jcc-border text-transparent"
              }`}
            >
              {complete && <Check className="w-2.5 h-2.5" />}
            </span>
            {step.label}
            {active && <ChevronRight className="w-3 h-3 ml-auto" />}
          </button>
        );
      })}
    </nav>
  );
}

function StickyTopBar({
  auction,
  joinCode,
  adminPassword,
  auctionId,
  refetch,
  readOnly,
}: {
  auction: BootstrapData["auction"];
  joinCode: string | null;
  adminPassword: string;
  auctionId: string;
  refetch: () => Promise<void>;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(auction.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || name === auction.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to rename auction");
        setSaving(false);
        return;
      }
      await refetch();
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sticky top-0 z-20 backdrop-blur-xl bg-jcc-navy-deep/90 border-b border-jcc-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AuctionOSSeal className="w-8 h-8 shrink-0" />
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                className="px-3 py-1.5 rounded-lg bg-jcc-navy-light border border-jcc-accent-dark text-jcc-text-primary text-sm font-black"
              />
              <button onClick={save} disabled={saving} className="text-jcc-accent-dark">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-body text-jcc-text-primary text-base sm:text-lg font-black uppercase tracking-wide truncate">
                {auction.name}
              </h1>
              {!readOnly && (
                <button onClick={() => setEditing(true)} className="text-jcc-text-muted hover:text-jcc-accent-dark shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {error && <span className="text-red-500 text-[10px] font-bold">{error}</span>}
          {joinCode ? (
            <JoinCodeCard code={joinCode} variant="compact" />
          ) : (
            <span className="text-jcc-text-muted text-[10px] font-bold hidden sm:inline">
              Join code shown once, at creation
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordGate({
  auctionId,
  error,
  onUnlocked,
}: {
  auctionId: string;
  error: string | null;
  onUnlocked: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/auctionos/${auctionId}`, {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        setLocalError("Incorrect admin password.");
        setSubmitting(false);
        return;
      }
      onUnlocked(password);
    } catch {
      setLocalError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen page-top flex items-center justify-center px-4 bg-jcc-navy-deep">
      <div className="premium-card w-full max-w-sm p-6 sm:p-7 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-accent-dark">
            <KeyRound className="w-5 h-5" />
          </span>
          <h2 className="font-body text-base font-black uppercase tracking-widest text-jcc-text-primary">
            Resume Auction
          </h2>
        </div>
        <p className="text-jcc-text-muted text-xs leading-relaxed">
          Enter this auction&apos;s admin password to continue building it.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLocalError(null);
            }}
            placeholder="ADMIN PASSWORD"
            className="w-full px-4 py-3 rounded-xl bg-jcc-navy-deep border border-jcc-border text-jcc-text-primary text-sm font-black uppercase tracking-[0.15em] text-center placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
          />
          {(localError || error) && (
            <p className="flex items-center justify-center gap-1.5 text-red-500 text-[11px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> {localError || error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !password}
            className="btn-vibrant-blue justify-center disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
