import Link from "next/link";
import { ChevronRight, Sparkles, BookOpen } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

function StaticCricketBall({ size, className }: { size: number; className?: string }) {
  return (
    <div className={`pointer-events-none ${className ?? ""}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="animate-drift">
        <circle cx="24" cy="24" r="22" fill="url(#ctaBallGrad)" stroke="rgba(200,60,60,0.15)" strokeWidth="0.5" />
        <path d="M 8 24 C 16 14, 32 14, 40 24" stroke="rgba(180,60,60,0.25)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M 8 24 C 16 34, 32 34, 40 24" stroke="rgba(180,60,60,0.25)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {[13, 18, 23, 28, 33].map((x) => (
          <line key={x} x1={x} y1="19" x2={x + 1} y2="21" stroke="rgba(180,60,60,0.2)" strokeWidth="0.5" strokeLinecap="round" />
        ))}
        <defs>
          <radialGradient id="ctaBallGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#FF4D4D" />
            <stop offset="100%" stopColor="#800000" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function FinalCTASection() {
  return (
    <section id="final-cta" className="py-32 sm:py-48 relative overflow-hidden text-center section-bg-navy">
      <div className="hero-overlay opacity-60" />
      <div className="absolute inset-0 stadium-glow opacity-30 pointer-events-none" />

      <StaticCricketBall size={56} className="absolute top-[15%] left-[5%] opacity-10 hidden lg:block" />
      <StaticCricketBall size={40} className="absolute bottom-[20%] right-[8%] opacity-10 hidden lg:block" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn direction="scale">
          <AnimateIn delay={200} className="mb-8">
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-jcc-accent font-black">
              <Sparkles className="w-4 h-4" />
              JOIN THE MOVEMENT
            </span>
          </AnimateIn>

          <h2 className="text-5xl sm:text-6xl lg:text-8xl font-black text-white tracking-tight leading-[0.9] mb-8">
            Where Sunday
            <br />
            Becomes <span className="text-gradient-cyan">Legacy</span>
          </h2>

          <p className="text-white/60 text-lg sm:text-xl font-medium max-w-xl mx-auto mb-14 leading-relaxed">
            Every Sunday morning, we lace up and play the game we love. No egos — just cricket, community, and the joy of showing up.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/register" className="btn-vibrant-blue group text-[15px]">
              BECOME A MEMBER
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/about" className="btn-ghost group text-[15px]">
              <BookOpen className="w-5 h-5 text-jcc-accent" />
              OUR STORY
            </Link>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
