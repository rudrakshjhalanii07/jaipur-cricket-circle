import { PitchDivider } from "./CricketDecorations";
import { AnimateIn } from "@/components/AnimateIn";

const chapters = [
  {
    number: "01",
    title: "Community First",
    body:
      "Cricket is our reason to meet, but people are our purpose. Every decision begins with strengthening the community before anything else.",
    align: "left" as const,
  },
  {
    number: "02",
    title: "Inclusivity",
    body:
      "Everyone deserves a place to play, regardless of skill or background. We welcome every player with respect, warmth, and equal opportunity.",
    align: "right" as const,
  },
  {
    number: "03",
    title: "Equality",
    body:
      "Every member matters equally on and off the field. No favoritism — everyone gets a fair chance to participate and contribute.",
    align: "left" as const,
  },
  {
    number: "04",
    title: "Friendship",
    body:
      "We build lasting friendships through the spirit of the game. The strongest victories are the relationships created beyond cricket.",
    align: "right" as const,
  },
  {
    number: "05",
    title: "Diversity",
    body:
      "Different people, personalities, professions, and perspectives make us stronger. Our differences are celebrated because they enrich our community.",
    align: "left" as const,
  },
  {
    number: "06",
    title: "Leadership",
    body:
      "Leadership is about serving, inspiring, and taking responsibility. Every member has the opportunity to lead by example.",
    align: "right" as const,
  },
  {
    number: "07",
    title: "Respect",
    body:
      "Respect is earned through humility, discipline, and kindness. We honor teammates, opponents, officials, and every individual equally.",
    align: "left" as const,
  },
  {
    number: "08",
    title: "Sportsmanship",
    body:
      "Winning is celebrated, but character is remembered. We compete fiercely while playing with integrity and grace.",
    align: "right" as const,
  },
  {
    number: "09",
    title: "Justice",
    body:
      "Every decision is guided by fairness, transparency, and consistency. Trust grows when everyone knows the same rules apply to all.",
    align: "left" as const,
  },
  {
    number: "10",
    title: "Transparency",
    body:
      "Open communication builds confidence within the community. Our decisions, processes, and governance remain honest and accountable.",
    align: "right" as const,
  },
  {
    number: "11",
    title: "Democracy",
    body:
      "Every voice has value, and every opinion deserves to be heard. Together, we shape the future of JCC through participation and collective decision-making.",
    align: "left" as const,
  },
];

export default function WhyJCCSection() {
  return (
    <>
      <PitchDivider />
      <section id="why-jcc" className="py-28 sm:py-40 relative section-bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-black/10 to-transparent" />

        <div className="max-w-5xl mx-auto px-6 sm:px-8 relative z-10">
          <AnimateIn className="text-center mb-24 sm:mb-32">
            <span className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.5em] text-jcc-accent font-black">
              <span className="w-8 h-px bg-jcc-accent/60" />
Our Core
              <span className="w-8 h-px bg-jcc-accent/60" />
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mt-6">
              Values We Are <span className="text-gradient-cyan">Driven By</span>
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
                        Principle {chapter.number}
                      </span>
                    </AnimateIn>

                    <AnimateIn delay={120} direction={isRight ? "right" : "left"}>
                      <h3 className="font-heading font-black uppercase text-white text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight mt-5 max-w-2xl">
                        {chapter.title}
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
