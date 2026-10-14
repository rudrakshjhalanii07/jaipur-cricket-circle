import Image from "next/image";
import { BookOpen } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

type Block =
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "names" };

const STORY: Block[] = [
  {
    type: "p",
    text: "Not every community begins with a grand vision. Some begin with five friends, one cricket ball, and an ordinary Sunday.",
  },
  { type: "names" },
  {
    type: "p",
    text: "We had careers, responsibilities, deadlines, and the usual busyness that comes with adult life. Like many people, we believed those carefree days of school and college cricket were behind us.",
  },
  {
    type: "quote",
    text: "But something unexpected happened that morning. For a few hours, we forgot everything else.",
  },
  {
    type: "p",
    text: "We laughed without hesitation. We celebrated every wicket as if it were a World Cup final. We sledged each other like school friends. We argued, smiled, competed, and walked off the ground feeling lighter than we had in years.",
  },
  {
    type: "quote",
    text: "It wasn't just cricket. It was the feeling we thought adulthood had taken away.",
  },
  {
    type: "p",
    text: "We decided to do it again the following week. Then again. And again. Without realizing it, a weekly game became a ritual.",
  },
  {
    type: "p",
    text: "As more friends joined, something beautiful started happening. People from different professions, age groups, and backgrounds began finding the same joy we had experienced on that very first Sunday.",
  },
  {
    type: "quote",
    text: "Some came looking for cricket. Many stayed because they found friendship.",
  },
  {
    type: "p",
    text: "As the community grew, we also noticed the challenges that often prevent amateur sports communities from thriving—finding players, booking grounds, balancing teams, organizing tournaments, resolving conflicts, and creating a welcoming environment for everyone.",
  },
  {
    type: "p",
    text: "Having been part of other communities ourselves, we knew these problems could be solved with thoughtful systems and transparent leadership.",
  },
  {
    type: "p",
    text: "So we built Jaipur Cricket Circle differently. We created a community where people could simply show up, play, and enjoy the game, while a dedicated Core Committee and Executive Committee handled everything behind the scenes—from governance and logistics to tournaments and community building.",
  },
  {
    type: "p",
    text: "This is only the beginning. Our dream is to build India's most loved box cricket community, connecting thousands of passionate cricketers across cities, creating world-class tournaments, embracing technology and analytics, collaborating with academies and institutions, and building an ecosystem where anyone who loves cricket feels they belong.",
  },
];

const PILLARS = [
  "Belonging",
  "Equality",
  "Healthy Competition",
  "Friendship Beyond the Rope",
  "Rediscovered Joy",
];

const FOUNDERS = ["Nitin", "Abhijeet", "Sagar", "Opal", "Nitesh"];

export default function OurStorySection() {
  return (
    <section
      id="our-story"
      // overflow-x-clip, not overflow-hidden: hidden makes this section the
      // scroll container, and the photo's sticky would stick to it instead of
      // the viewport — it scrolled away with the text.
      className="py-24 sm:py-32 relative overflow-x-clip section-bg-navy"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-jcc-accent/20 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-40 bg-jcc-accent/[0.06] blur-[120px] pointer-events-none" />

      <div className="max-w-[88rem] mx-auto px-5 md:px-10 relative z-10">
        <div className="mb-16 grid items-end gap-6 sm:mb-24 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p data-reveal className="kicker inline-flex items-center gap-2 text-jcc-accent-dark">
              <BookOpen className="h-3.5 w-3.5" /> 06 · Our story
            </p>
            <h2 data-split className="mt-5 font-heading text-[clamp(2.8rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-jcc-blue">
              Five friends. One ball.
            </h2>
          </div>
          <p data-reveal className="max-w-xs text-xl italic leading-snug text-jcc-text-muted md:pb-3 md:text-right" style={{ fontFamily: "var(--font-serif)" }}>
            The ordinary Sunday that became Jaipur Cricket Circle.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-12 lg:gap-16 items-start">
          {/* ── Photo plate ─────────────────────────────────────────────── */}
          <AnimateIn direction="left" className="lg:sticky lg:top-28 self-start">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-3 rounded-[36px] border border-jcc-accent/20" />
              <div className="relative rounded-[28px] overflow-hidden border border-jcc-accent/30 shadow-[0_25px_70px_rgba(0,0,0,0.4)] bg-jcc-blue-deep">
                <div className="relative w-full aspect-[4160/2677]">
                  <Image
                    src="/gallery/about_us.jpeg"
                    alt="Jaipur Cricket Circle — where it began"
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-contain"
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[28px]" />
              </div>
              <div className="mt-5 flex items-center gap-3 justify-center">
                <span className="w-8 h-px bg-jcc-accent/50" />
                <p className="kicker whitespace-nowrap text-jcc-accent-dark">
                  8th March 2026 — Where It Began
                </p>
                <span className="w-8 h-px bg-jcc-accent/50" />
              </div>
            </div>
          </AnimateIn>

          {/* ── Narrative ────────────────────────────────────────────────── */}
          <div className="space-y-7">
            {STORY.map((block, i) => {
              const delay = Math.min(i * 70, 420);

              if (block.type === "names") {
                return (
                  <AnimateIn key={i} delay={delay}>
                    <p className="text-white/75 text-base sm:text-lg font-medium leading-relaxed">
                      On 8th March 2026, the five of us —{" "}
                      {FOUNDERS.map((name, idx) => (
                        <span key={name}>
                          <span className="font-heading font-bold text-jcc-accent-dark">
                            {name}
                          </span>
                          {idx < FOUNDERS.length - 2
                            ? ", "
                            : idx === FOUNDERS.length - 2
                              ? ", and "
                              : ""}
                        </span>
                      ))}{" "}
                      — met for a game of box cricket in Jaipur.
                    </p>
                  </AnimateIn>
                );
              }

              if (block.type === "quote") {
                return (
                  <AnimateIn key={i} delay={delay} direction="right">
                    <blockquote data-story-line className="relative pl-6 sm:pl-8 border-l-2 border-jcc-accent/50 py-1">
                      <p
                        className="text-2xl sm:text-3xl lg:text-4xl italic font-medium text-jcc-blue leading-snug"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {block.text}
                      </p>
                    </blockquote>
                  </AnimateIn>
                );
              }

              return (
                <AnimateIn key={i} delay={delay}>
                  <p data-story-line className="text-white/75 text-base sm:text-lg font-medium leading-relaxed">
                    {block.text}
                  </p>
                </AnimateIn>
              );
            })}

            {/* ── Pillars ────────────────────────────────────────────────── */}
            <AnimateIn delay={100}>
              <div className="h-px w-full bg-linear-to-r from-jcc-accent/40 via-jcc-accent/10 to-transparent my-2" />
              <p className="text-white/75 text-base sm:text-lg font-medium leading-relaxed mb-5">
                Today, Jaipur Cricket Circle stands for much more than cricket.
              </p>
              <div className="flex flex-wrap gap-3">
                {PILLARS.map((pillar) => (
                  <span
                    key={pillar}
                    className="inline-flex items-center px-4 py-2 rounded-full border border-jcc-blue/15 bg-jcc-navy font-mono text-[11px] uppercase tracking-[0.14em] text-jcc-blue"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            </AnimateIn>

            {/* ── Closing signature ─────────────────────────────────────── */}
            <AnimateIn delay={150} direction="scale">
              <div className="pt-6">
                <p className="font-heading text-3xl font-extrabold leading-[0.95] tracking-[-0.045em] text-jcc-blue sm:text-5xl">
                  Cricket brings people together.
                  <br />
                  Community keeps them together.
                </p>
                <p className="mt-6 text-lg font-semibold tracking-tight text-jcc-blue sm:text-xl">
                  Welcome to{" "}
                  <span className="text-gradient-cyan">
                    Jaipur Cricket Circle.
                  </span>{" "}
                  🏏❤️
                </p>
              </div>
            </AnimateIn>
          </div>
        </div>
      </div>
    </section>
  );
}
