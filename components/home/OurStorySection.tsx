import Image from "next/image";
import { BookOpen } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";

type Block =
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "names" };

const STORY: Block[] = [
  { type: "p", text: "Not every community begins with a grand vision. Some begin with five friends, one cricket ball, and an ordinary Sunday." },
  { type: "names" },
  { type: "p", text: "We had careers, responsibilities, deadlines, and the usual busyness that comes with adult life. Like many people, we believed those carefree days of school and college cricket were behind us." },
  { type: "quote", text: "But something unexpected happened that morning. For a few hours, we forgot everything else." },
  { type: "p", text: "We laughed without hesitation. We celebrated every wicket as if it were a World Cup final. We sledged each other like school friends. We argued, smiled, competed, and walked off the ground feeling lighter than we had in years." },
  { type: "quote", text: "It wasn't just cricket. It was the feeling we thought adulthood had taken away." },
  { type: "p", text: "We decided to do it again the following week. Then again. And again. Without realizing it, a weekly game became a ritual." },
  { type: "p", text: "As more friends joined, something beautiful started happening. People from different professions, age groups, and backgrounds began finding the same joy we had experienced on that very first Sunday." },
  { type: "quote", text: "Some came looking for cricket. Many stayed because they found friendship." },
  { type: "p", text: "As the community grew, we also noticed the challenges that often prevent amateur sports communities from thriving—finding players, booking grounds, balancing teams, organizing tournaments, resolving conflicts, and creating a welcoming environment for everyone." },
  { type: "p", text: "Having been part of other communities ourselves, we knew these problems could be solved with thoughtful systems and transparent leadership." },
  { type: "p", text: "So we built Jaipur Cricket Circle differently. We created a community where people could simply show up, play, and enjoy the game, while a dedicated Core Committee and Executive Committee handled everything behind the scenes—from governance and logistics to tournaments and community building." },
  { type: "p", text: "This is only the beginning. Our dream is to build India's most loved box cricket community, connecting thousands of passionate cricketers across cities, creating world-class tournaments, embracing technology and analytics, collaborating with academies and institutions, and building an ecosystem where anyone who loves cricket feels they belong." },
];

const PILLARS = ["Belonging", "Equality", "Healthy Competition", "Friendship Beyond the Rope", "Rediscovered Joy"];

const FOUNDERS = ["Opal", "Sagar", "Nitin Setia", "Nitesh", "Abhijeet"];

export default function OurStorySection() {
  return (
    <section id="our-story" className="py-24 sm:py-32 relative overflow-hidden section-bg-navy">
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-jcc-accent/20 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-40 bg-jcc-accent/[0.06] blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-16 sm:mb-20">
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <BookOpen className="w-5 h-5" />
            OUR STORY
          </span>
          <h2 className="text-3xl min-[380px]:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter mt-6 uppercase italic leading-tight">
            Five Friends. <span className="text-gradient-cyan">One Ball.</span>
          </h2>
          <p
            className="mt-6 text-white/70 text-xl sm:text-2xl max-w-2xl mx-auto italic leading-relaxed"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            The ordinary Sunday that became Jaipur Cricket Circle.
          </p>
        </AnimateIn>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-12 lg:gap-16 items-start">
          {/* ── Photo plate ─────────────────────────────────────────────── */}
          <AnimateIn direction="left" className="lg:sticky lg:top-32">
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
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-jcc-accent/80 whitespace-nowrap">
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
                          <span
                            className="text-jcc-accent-highlight font-black not-italic"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {name}
                          </span>
                          {idx < FOUNDERS.length - 2 ? ", " : idx === FOUNDERS.length - 2 ? ", and " : ""}
                        </span>
                      ))}
                      {" "}— met for a game of box cricket in Jaipur.
                    </p>
                  </AnimateIn>
                );
              }

              if (block.type === "quote") {
                return (
                  <AnimateIn key={i} delay={delay} direction="right">
                    <blockquote className="relative pl-6 sm:pl-8 border-l-2 border-jcc-accent/50 py-1">
                      <p
                        className="text-xl sm:text-2xl lg:text-3xl italic font-medium text-white leading-snug"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {block.text}
                      </p>
                    </blockquote>
                  </AnimateIn>
                );
              }

              return (
                <AnimateIn key={i} delay={delay}>
                  <p className="text-white/75 text-base sm:text-lg font-medium leading-relaxed">
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
                    className="inline-flex items-center px-4 py-2 rounded-full border border-jcc-accent/25 bg-jcc-accent/[0.06] text-[11px] sm:text-xs font-black uppercase tracking-[0.15em] text-jcc-accent-highlight"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            </AnimateIn>

            {/* ── Closing signature ─────────────────────────────────────── */}
            <AnimateIn delay={150} direction="scale">
              <div className="pt-6">
                <p
                  className="text-2xl sm:text-3xl lg:text-4xl italic font-black leading-tight text-gradient-cyan"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Cricket brings people together.
                  <br />
                  Community keeps them together.
                </p>
                <p className="mt-6 text-lg sm:text-xl font-black uppercase italic text-white tracking-tight">
                  Welcome to <span className="text-gradient-cyan">Jaipur Cricket Circle.</span> 🏏❤️
                </p>
              </div>
            </AnimateIn>
          </div>
        </div>
      </div>
    </section>
  );
}
