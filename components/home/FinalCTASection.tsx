import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

export default function FinalCTASection() {
  return (
    <section
      id="final-cta"
      className="relative py-40 sm:py-56 overflow-hidden section-bg-navy text-center"
    >
      {/* Environmental crest artwork — pushed well behind every foreground
          element, oversized so it bleeds off the section edges, desaturated
          and blurred so it reads as embossed texture rather than a logo the
          eye is asked to parse. Nudged down so its densest detail (crown,
          lettering, wreath) sits clear of the heading/quote block above it. */}
      <AnimateIn
        direction="scale"
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
      >
        <img
          src="/jcc_logo.png"
          alt=""
          aria-hidden="true"
          className="w-[780px] h-[798px] sm:w-[1050px] sm:h-[1074px] lg:w-[1275px] lg:h-[1303px] object-contain opacity-[0.08] sm:opacity-[0.1] blur-[2.5px] saturate-[0.45] -translate-y-[2%]"
        />
      </AnimateIn>

      {/* Edge vignette — draws the eye back toward the center of the composition */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 45%, transparent 50%, color-mix(in srgb, var(--color-jcc-navy-deep) 60%, transparent) 100%)",
        }}
      />

      {/* Warm ivory paper — grain intensity halved so it enhances rather than competes */}
      <div className="absolute inset-0 noise-overlay opacity-[0.0075] pointer-events-none z-[1]" />

      {/* Soft readability light behind the heading/quote block — a falloff,
          not a card: no edge is ever visible, only a gentle lift in contrast */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 62% 48% at 50% 30%, color-mix(in srgb, var(--jcc-bg) 90%, white) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-6">
        <AnimateIn direction="up">
          <span className="block text-[11px] font-black uppercase tracking-[0.55em] text-jcc-accent-dark mb-8">
            The Invitation
          </span>
        </AnimateIn>

        <AnimateIn direction="up" delay={150}>
          <h2
            className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black uppercase leading-[0.94] mb-10 text-jcc-text-primary"
            style={{
              textShadow:
                "0 1px 1px rgba(255,255,255,0.7), 0 2px 22px rgba(255,255,255,0.55)",
            }}
          >
            The Circle Is
            <br />
            Never Complete.
          </h2>
        </AnimateIn>

        <AnimateIn direction="up" delay={350}>
          <div className="w-14 h-px bg-jcc-accent/50 mx-auto mb-8 divider-draw" />
        </AnimateIn>

        <AnimateIn direction="up" delay={500}>
          <p className="font-heading italic text-jcc-text-primary/65 text-lg sm:text-xl font-medium mb-16 leading-relaxed">
            Some arrive for a match.
            <br />
            Some stay for a lifetime.
          </p>
        </AnimateIn>

        <AnimateIn direction="up" delay={800}>
          <div className="flex flex-col items-center gap-8 mb-20">
            <Link
              href="/register"
              className="btn-vibrant-blue btn-final-invite !px-12 !py-5 !text-[13px] !tracking-[0.18em]"
            >
              Become a Member
            </Link>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-jcc-text-muted transition-colors duration-500 hover:text-jcc-accent-dark"
            >
              Our Story
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 ease-out group-hover:translate-x-1" />
            </Link>
          </div>
        </AnimateIn>

        <AnimateIn direction="up" delay={900}>
          <div className="w-10 h-px bg-jcc-accent/50 mx-auto mb-6" />
          <p className="text-[12px] font-black uppercase tracking-[0.45em] text-jcc-text-primary/80 mb-3">
            Est. MMXXVI
          </p>
          <p className="font-heading text-[17px] font-black uppercase tracking-[0.3em] text-jcc-text-primary mb-3">
            Jaipur Cricket Circle
          </p>
          <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-jcc-text-muted mb-8">
            Jaipur &bull; Rajasthan
          </p>
          <div className="w-10 h-px bg-jcc-accent/50 mx-auto mb-8" />
          <p className="font-heading italic text-jcc-text-primary/90 text-[16px] font-semibold tracking-[0.03em] leading-relaxed">
            The score fades.
            <br />
            The Circle remains.
          </p>
        </AnimateIn>
      </div>
    </section>
  );
}
