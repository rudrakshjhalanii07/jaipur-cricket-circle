"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";

// Code display + copy button + QR, shared by the Step-1 one-time reveal
// panel and the dashboard sticky bar (small variant). Encodes
// `{origin}/auctionos?code={code}` — a scannable shortcut into the landing
// page's code-entry flow — rather than the bare code text.
//
// `logoUrl` badges the template/organizer's logo in the center of the full
// QR (falls back to the site's own JCC mark) — errorCorrectionLevel "H"
// (~30% recovery) keeps it scannable with a badge covering roughly a
// fifth of the code. The compact variant is small enough (32px) that a
// badge would just break it, so it stays plain QR.
export default function JoinCodeCard({
  code,
  variant = "full",
  logoUrl,
}: {
  code: string;
  variant?: "full" | "compact";
  logoUrl?: string | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/auctionos?code=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: variant === "compact" ? 96 : 160,
      errorCorrectionLevel: variant === "compact" ? "M" : "H",
      // `--color-white` is remapped to Royal Blue ink sitewide (see
      // globals.css's "Foreground remap") — `light` needs a LITERAL white
      // here, not that token, or the QR's own backing tile (below) and its
      // "light" modules both resolve to the same navy and the whole code
      // renders as one solid block.
      color: { dark: "#12233F", light: "#FFFFFF00" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [code, variant]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API unavailable — silently no-op, the code is still visible to select/copy manually
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Join code QR" className="w-8 h-8 rounded" />
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-jcc-border bg-jcc-navy-light text-jcc-text-primary text-[11px] font-black uppercase tracking-[0.15em] hover:border-jcc-accent-dark transition-colors"
        >
          {code}
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {qrDataUrl && (
        <div className="relative w-32 h-32 rounded-xl border border-jcc-border p-2 bg-jcc-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Join code QR" className="w-full h-full" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || "/jcc_logo.png"}
            alt=""
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 object-contain rounded-full bg-jcc-navy border-2 border-jcc-navy shadow-sm"
          />
        </div>
      )}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-5 py-3 rounded-xl border border-jcc-border-bright bg-jcc-navy-light text-jcc-text-primary text-lg font-black uppercase tracking-[0.3em] hover:border-jcc-accent-dark transition-colors"
      >
        {code}
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
