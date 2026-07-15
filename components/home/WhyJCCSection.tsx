import { PitchDivider } from "./CricketDecorations";
import { AnimateIn } from "@/components/AnimateIn";

const chapters = [
  {
    number: "01",
    label: "Chapter One",
    lines: ["Equality", "on the Pitch"],
    body:
      "Titles stay at the boundary rope. Here, a CEO faces a college student's yorker, and a first-timer can strike the winning six. The twenty-two yards ahead is the only hierarchy that matters — and it favours no one.",
    align: "left" as const,
  },
  {
    number: "02",
    label: "Chapter Two",
    lines: ["Every Sunday", "is Match Day"],
    body:
      "Rain or shine, alarms at 5:30, whites on by six. For fifty-two Sundays a year, we show up — not from discipline, but from something closer to devotion.",
    align: "right" as const,
  },
  {
    number: "03",
    label: "Chapter Three",
    lines: ["One Brotherhood", "Beyond the Boundary"],
    body:
      "Mavericks and NeuroStrikers contest every run fiercely on the field. Off it, we are a single circle — sharing chai, celebrating centuries, and already planning next Sunday.",
    align: "left" as const,
  },
];

export default function WhyJCCSection() {
  return (
    <>
      <PitchDivider />
      <section id="why-jcc" className="theme-static-dark py-28 sm:py-40 relative section-bg-royal overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-black/10 to-transparent" />

        <div className="max-w-5xl mx-auto px-6 sm:px-8 relative z-10">
          <AnimateIn className="text-center mb-24 sm:mb-32">
            <span className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.5em] text-jcc-accent font-black">
              <span className="w-8 h-px bg-jcc-accent/60" />
              A Manifesto
              <span className="w-8 h-px bg-jcc-accent/60" />
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mt-6">
              The Principles We <span className="text-gradient-cyan">Play By</span>
            </h2>
          </AnimateIn>

          <div className="flex flex-col gap-28 sm:gap-40 lg:gap-48">
            {chapters.map((chapter) => {
              const isRight = chapter.align === "right";
              return (
                <article key={chapter.number} className="relative">
                  <span
                    aria-hidden
                    className={`pointer-events-none select-none absolute -top-10 sm:-top-16 font-heading font-black leading-none text-[110px] sm:text-[170px] lg:text-[220px] text-jcc-accent/[0.08] ${
                      isRight ? "right-0 sm:-right-4" : "left-0 sm:-left-4"
                    }`}
                  >
                    {chapter.number}
                  </span>

                  <div
                    className={`relative flex flex-col ${
                      isRight ? "items-start sm:items-end text-left sm:text-right" : "items-start text-left"
                    }`}
                  >
                    <AnimateIn direction={isRight ? "right" : "left"}>
                      <span className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.5em] text-jcc-accent/80 font-bold">
                        {chapter.label}
                      </span>
                    </AnimateIn>

                    <AnimateIn delay={120} direction={isRight ? "right" : "left"}>
                      <h3 className="font-heading font-black uppercase text-white text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight mt-5 max-w-2xl">
                        {chapter.lines[0]}
                        <br />
                        {chapter.lines[1]}
                      </h3>
                    </AnimateIn>

                    <AnimateIn delay={280}>
                      <div
                        className={`divider-draw h-px w-20 bg-jcc-accent my-8 ${isRight ? "divider-draw-right ml-auto" : ""}`}
                      />
                    </AnimateIn>

                    <AnimateIn delay={420}>
                      <p className="max-w-lg text-white/70 text-lg leading-relaxed font-medium">
                        {chapter.body}
                      </p>
                    </AnimateIn>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
