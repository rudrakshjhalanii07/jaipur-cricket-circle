"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";

// Code display + copy button + QR, shared by the Step-1 one-time reveal
// panel and the dashboard sticky bar (small variant). Encodes
// `{origin}/auctionos?code={code}` — a scannable shortcut into the landing
// page's code-entry flow — rather than the bare code text.
export default function JoinCodeCard({
  code,
  variant = "full",
}: {
  code: string;
  variant?: "full" | "compact";
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/auctionos?code=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: variant === "compact" ? 96 : 160,
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="Join code QR" className="w-32 h-32 rounded-xl border border-jcc-border p-2 bg-white" />
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
