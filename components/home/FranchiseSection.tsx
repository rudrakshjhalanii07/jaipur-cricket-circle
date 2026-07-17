import Image from "next/image";
import { Shield } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";
import { TEAMS, type TeamId } from "@/lib/teams";

// Display order for this section only — NeuroStrikers leads. Does not
// affect TEAM_ORDER_ALL, which other pages (auction) depend on.
const FRANCHISE_DISPLAY_ORDER: TeamId[] = [
  "neurostrikers",
  "mavericks",
  "outliers",
  "vikings",
];

export default function FranchiseSection() {
  return (
    <section id="franchise" className="theme-static-dark py-24 sm:py-32 relative overflow-hidden section-bg-royal">
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-linear-to-r from-transparent via-jcc-accent to-transparent opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-16">
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <Shield className="w-5 h-5" />
            THE FRANCHISES
          </span>
          <h2 className="text-3xl min-[380px]:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter mt-6 uppercase italic leading-tight">
            Four Teams. <span className="text-gradient-cyan">One Circle.</span>
          </h2>
          <p className="mt-6 text-white/70 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Every crest carries its own captain, colours, and legacy.
          </p>
        </AnimateIn>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {FRANCHISE_DISPLAY_ORDER.map((id, i) => {
            const team = TEAMS[id];
            return (
              <AnimateIn key={id} delay={i * 150} direction="scale">
                <div className="franchise-logo flex flex-col items-center gap-4 text-center">
                  <div
                    className="group relative w-44 h-44 sm:w-60 sm:h-60 lg:w-72 lg:h-72 flex items-center justify-center transition-transform duration-300 hover:scale-105"
                  >
                    <div
                      className="pointer-events-none absolute -inset-4 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-90"
                      style={{ background: `radial-gradient(circle, ${team.glow} 0%, transparent 70%)` }}
                    />
                    <Image
                      src={team.logo}
                      alt={`${team.name} crest`}
                      width={288}
                      height={288}
                      className="relative w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                    />
                  </div>
                  <div>
                    <p className="text-base sm:text-xl lg:text-2xl font-black text-white uppercase italic tracking-tight whitespace-nowrap">
                      {team.name}
                    </p>
                    <p
                      className="mt-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap"
                      style={{ color: team.primary }}
                    >
                      {team.tagline}
                    </p>
                  </div>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
