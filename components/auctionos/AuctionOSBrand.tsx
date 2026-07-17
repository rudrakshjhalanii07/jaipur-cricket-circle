import { Gavel } from "lucide-react";

// ─── AuctionOS wordmark — the platform identity. JCC is the organizer
// running an auction *on* AuctionOS; the "OS" carries the gold prestige
// accent, everything else stays Royal-Blue ink on white. ───────────────────

export function AuctionOSMark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-heading font-black tracking-tight leading-none ${className}`}>
      Auction<span className="text-gradient-gold">OS</span>
    </span>
  );
}

// A small "hallmark" — a gold gavel seal used as the platform's monogram in
// compact surfaces (top bars, seals) where the full wordmark is too wide.
export function AuctionOSSeal({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border border-jcc-border-bright bg-jcc-navy-light ${className}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 10px -4px rgba(18,35,63,0.15)" }}
    >
      <Gavel className="w-1/2 h-1/2 text-jcc-accent-dark" />
    </span>
  );
}

// ─── Hero backdrop — a layered "auction house" atmosphere for the white
// Royal luxury theme: an ivory vignette, a warm light shaft and concentric
// gold rings behind the wordmark (a seal motif, not a spotlight blob), a
// masked gold dot-grid, a Royal Blue counter-glow, and a fine inset frame
// with gold corner ticks that reads like an engraved certificate edge. ─────

export function HeroBackdrop() {
  // Radiating hallmark ticks — the "sundial" spokes around the medallion.
  const ticks = Array.from({ length: 32 }, (_, i) => i * (360 / 32));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Warm tonal base — ivory crown fading to a cool platinum floor, so the
          hall reads as lit from above rather than as flat paper. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #FAF3DF 0%, #FCFBF8 30%, #F2EEE3 76%, #E9E3D5 100%)",
        }}
      />

      {/* Edge vignette — darkens the far corners a few percent so the gold
          medallion and headline read brighter by contrast, stage-lit rather
          than flatly lit. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 45%, rgba(18,35,63,0.10) 100%)",
        }}
      />

      {/* Strong warm-gold wash falling from the top */}
      <div
        className="absolute inset-x-0 top-0 h-[70%]"
        style={{ background: "radial-gradient(ellipse 60% 75% at 50% -5%, rgba(212,175,55,0.42), transparent 68%)" }}
      />
      <div className="absolute -top-16 -left-10 w-[420px] h-[420px] rounded-full blur-[110px] opacity-[0.32]" style={{ background: "#D4AF37" }} />
      <div className="absolute -top-20 -right-16 w-[460px] h-[460px] rounded-full blur-[120px] opacity-[0.26]" style={{ background: "#F3C96A" }} />

      {/* Gold dot-grid — visible in the open margins, cleared around the
          wordmark/medallion so it frames rather than competes. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(169,120,36,0.5) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 52% 46% at 50% 44%, transparent 55%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 52% 46% at 50% 44%, transparent 55%, black 88%, transparent 100%)",
        }}
      />

      {/* Royal Blue grounding band rising from the floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38%]"
        style={{ background: "linear-gradient(0deg, rgba(18,35,63,0.14), transparent)" }}
      />

      {/* Fine film grain */}
      <div className="noise-overlay absolute inset-0 opacity-[0.06]" />

      {/* Stage — the single source of truth for the frame's bounds. The
          medallion and the certificate frame both derive their position
          from THIS box (via inset-0 + m-auto / inset-0 respectively)
          instead of independent percentages of the full backdrop, so they
          can never drift out of alignment with each other again if this
          box's insets are ever retuned. */}
      <div className="absolute top-40 sm:top-44 left-2 right-2 bottom-28 sm:left-4 sm:right-4 sm:bottom-32">
        {/* Hallmark medallion — a solid engraved-seal graphic centred in the
            stage: filled core, three bold rings, and radiating ticks like a
            sundial. The one deliberate focal graphic, built to read at a
            glance rather than as ambient texture. `m-auto` on an
            inset-0'd, explicitly-sized element centers it exactly in the
            middle of the stage box, in both axes, with no magic numbers. */}
        <svg
          className="absolute inset-0 m-auto w-[min(1000px,145vw)] h-[min(1000px,145vw)]"
          viewBox="0 0 800 800"
          fill="none"
        >
          <circle cx="400" cy="400" r="150" fill="rgba(212,175,55,0.09)" />
          <circle cx="400" cy="400" r="150" stroke="rgba(169,120,36,0.5)" strokeWidth="2" />
          <circle cx="400" cy="400" r="230" stroke="rgba(169,120,36,0.38)" strokeWidth="1.5" />
          <circle cx="400" cy="400" r="330" stroke="rgba(212,175,55,0.28)" strokeWidth="1.25" strokeDasharray="1 10" />
          {ticks.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const rOuter = 330;
            const rInner = deg % 90 === 0 ? 296 : 312;
            // Rounded to 2dp — Math.cos/sin can differ in their last binary
            // digit between server (Node) and client (browser) JS engines,
            // which otherwise serializes as a server/client string mismatch
            // and trips React's hydration check for no visible difference.
            const round = (n: number) => Math.round(n * 100) / 100;
            return (
              <line
                key={deg}
                x1={round(400 + rInner * Math.cos(rad))}
                y1={round(400 + rInner * Math.sin(rad))}
                x2={round(400 + rOuter * Math.cos(rad))}
                y2={round(400 + rOuter * Math.sin(rad))}
                stroke="rgba(169,120,36,0.4)"
                strokeWidth={deg % 90 === 0 ? 2 : 1}
              />
            );
          })}
        </svg>

        {/* Engraved certificate frame — fills the stage exactly. */}
        <div className="absolute inset-0 rounded-[1.75rem] border border-jcc-accent/35" />
        {[
          "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-[1.75rem]",
          "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-[1.75rem]",
          "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[1.75rem]",
          "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[1.75rem]",
        ].map((pos) => (
          <span key={pos} className={`absolute w-14 h-14 border-jcc-accent-dark/90 ${pos}`} />
        ))}
      </div>
    </div>
  );
}
