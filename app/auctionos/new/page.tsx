"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { AuctionOSMark, AuctionOSSeal, HeroBackdrop } from "@/components/auctionos/AuctionOSBrand";
import { fetchAuctionTemplateBySlug } from "@/lib/auctionos/core/data";
import LogoUpload from "@/components/auctionos/wizard/LogoUpload";
import JoinCodeCard from "@/components/auctionos/wizard/JoinCodeCard";

// Theme swatches capture `theme_key` (presentational choice, doesn't reskin
// anything yet per the plan). All three route to the `jcc` template row —
// `blank` is the engine's bare, unstyled reference implementation (no
// branding, no formatted currency, no design at all — see AUCTIONOS.md),
// not a legitimate customer-facing "theme." Every swatch here previously
// looked like a JCC color variant but two of three silently swapped in the
// unstyled engine template; there's no real second template with actual
// branding yet, so nothing here should resolve to `blank`.
const THEMES = [
  { key: "royal", label: "Royal", templateSlug: "jcc", swatch: ["#12233F", "#D4AF37"] },
  { key: "midnight", label: "Midnight", templateSlug: "jcc", swatch: ["#0B1220", "#8FA3C9"] },
  { key: "classic-jcc", label: "Classic JCC", templateSlug: "jcc", swatch: ["#12233F", "#F3C96A"] },
] as const;

interface DraftResult {
  auction_id: string;
  access_code: string;
  admin_password: string;
}

export default function NewAuctionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<(typeof THEMES)[number]["key"]>("royal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const theme = THEMES.find((t) => t.key === themeKey) ?? THEMES[0];
      const templateRow = await fetchAuctionTemplateBySlug(theme.templateSlug);
      if (!templateRow) {
        setError(`Could not resolve the "${theme.templateSlug}" template. Try again.`);
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/auctionos/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          logo_url: logoUrl,
          venue: venue.trim() || null,
          starts_at: startsAt || null,
          theme_key: themeKey,
          template_id: templateRow.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create auction draft.");
        setSubmitting(false);
        return;
      }
      setResult(data as DraftResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!result) return;
    sessionStorage.setItem("jcc_admin_password", result.admin_password);
    // access_code is a one-time reveal (never re-fetchable via the API —
    // see AUCTIONOS.md's "Landing philosophy") — stashed per-auction so the
    // dashboard's sticky bar can still show/copy/QR it for the rest of
    // *this* browser session, without inventing a new "show me the code
    // again" server endpoint that would break that one-time-reveal model.
    sessionStorage.setItem(`auctionos_code_${result.auction_id}`, result.access_code);
    router.push(`/auctionos/dashboard/${result.auction_id}`);
  }

  async function copy(field: "code" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      // no-op — value stays visible for manual selection
    }
  }

  return (
    <div className="min-h-screen relative page-top flex flex-col items-center justify-center px-4 pb-16 overflow-hidden">
      <HeroBackdrop />
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <AuctionOSSeal className="w-10 h-10" />
          <AuctionOSMark className="text-3xl sm:text-4xl text-jcc-text-primary" />
          <p className="text-jcc-text-muted text-[11px] font-black uppercase tracking-[0.35em]">
            Prepare a New Auction
          </p>
        </motion.div>

        {!result ? (
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="premium-card w-full p-6 sm:p-8 flex flex-col gap-6"
          >
            <div className="flex items-start gap-5">
              <LogoUpload value={logoUrl} onChange={setLogoUrl} label="Logo" />
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Auction Name
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. JCC Season 5 Auction"
                  className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Venue (optional)
                </label>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Clubhouse Lawn"
                  className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-jcc-navy-light border border-jcc-border text-jcc-text-primary text-sm font-bold placeholder:text-jcc-text-muted/50 focus:outline-none focus:border-jcc-accent-dark transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => setThemeKey(theme.key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                      themeKey === theme.key
                        ? "border-jcc-accent-dark bg-jcc-navy-light"
                        : "border-jcc-border hover:border-jcc-border-bright"
                    }`}
                  >
                    <span className="flex gap-1">
                      {theme.swatch.map((c) => (
                        <span key={c} className="w-4 h-4 rounded-full border border-jcc-border" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-jcc-text-primary">
                      {theme.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold">
                <ShieldAlert className="w-3.5 h-3.5" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn-vibrant-blue justify-center disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Create Auction Draft
            </button>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="premium-card w-full p-6 sm:p-8 flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-accent-dark">
                <Check className="w-5 h-5" />
              </span>
              <h2 className="text-sm font-black uppercase tracking-widest text-jcc-text-primary">
                Draft Created
              </h2>
              <p className="text-jcc-text-muted text-xs leading-relaxed max-w-sm">
                Save these now — the admin password is shown exactly once and cannot be recovered later.
              </p>
            </div>

            <div className="flex flex-col gap-4 items-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Join Code
                </span>
                <JoinCodeCard code={result.access_code} />
              </div>

              <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-jcc-border">
                <span className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                  Admin Password
                </span>
                <button
                  onClick={() => copy("password", result.admin_password)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-text-primary text-lg font-black uppercase tracking-[0.3em] hover:border-jcc-accent-dark transition-colors"
                >
                  {result.admin_password}
                  {copiedField === "password" ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <p className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold text-center">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  Save this now — it will not be shown again.
                </p>
              </div>
            </div>

            <button onClick={handleContinue} className="btn-vibrant-blue justify-center">
              Continue to Dashboard
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
