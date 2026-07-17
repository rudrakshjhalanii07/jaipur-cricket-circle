import { Calendar, Users, Trophy, CalendarDays, Shield, Heart, PartyPopper, Coffee, CircleDot, Timer } from "lucide-react";
import { AnimateIn } from "@/components/AnimateIn";
import { TEAMS } from "@/lib/teams";

interface StatsSectionProps {
  stats: {
    activePlayers: string;
    sundayGames: string;
    sundaysActive: string;
    communityLove: string;
  };
}

const PILLARS = [
  { Icon: Heart, label: "Play Together" },
  { Icon: Users, label: "Grow Together" },
  { Icon: Coffee, label: "Stay Together" },
];

// A few tiles get a gold or royal-blue treatment to break up the grid —
// scattered by hand rather than uniformly alternated so the highlight reads
// as a deliberate accent, not a repeating pattern.
const VARIANT_STYLES = {
  gold: {
    card: "border-jcc-accent/40",
    style: { background: "linear-gradient(160deg, rgba(212,175,55,0.16) 0%, rgba(212,175,55,0.02) 100%)" },
    icon: "bg-jcc-accent/20",
    iconColor: "text-jcc-accent-dark",
    value: "text-jcc-accent-dark",
    label: "text-jcc-accent-dark/60",
    sub: "text-jcc-accent-dark/70",
  },
  blue: {
    // theme-static-dark resets --color-white to true white for this island —
    // without it, "text-white" resolves to navy ink (the light-theme remap)
    // and disappears against the navy card background.
    card: "theme-static-dark border-jcc-blue/30",
    style: { background: "linear-gradient(160deg, var(--color-jcc-blue) 0%, var(--color-jcc-blue-deep) 100%)" },
    icon: "bg-white/10",
    iconColor: "text-jcc-accent",
    value: "text-white",
    label: "text-white/55",
    sub: "text-jcc-accent/80",
  },
} as const;

export default function StatsSection({ stats }: StatsSectionProps) {
  const teamCount = Object.keys(TEAMS).length;

  // Active Members and Community Love stay in lockstep with HeroSection's
  // stat strip — both read from the same `stats` prop (app/page.tsx's
  // getClubStatistics()). The rest are fixed marketing figures matching the
  // "Our Journey So Far" flyer, not derived from live club statistics.
  const tiles = [
    { Icon: Calendar, label: "Journey Started", value: "8 Mar 2026" },
    { Icon: Users, label: "Active Members", value: stats.activePlayers, variant: "gold" },
    { Icon: Trophy, label: "Matches Played", value: "50+", variant: "blue" },
    { Icon: CalendarDays, label: "Consecutive Weekends", value: "19" },
    { Icon: PartyPopper, label: "Biggest Gathering", value: "30 Players", sub: "26th June 2026", variant: "gold" },
    { Icon: CircleDot, label: "Overs Bowled", value: "400+" },
    { Icon: Timer, label: "Hours of Cricket", value: "150+" },
    { Icon: Coffee, label: "Hours of Coffee", value: "34+" },
    { Icon: Shield, label: "Competitive Teams", value: `${teamCount}`, wide: true },
    { Icon: Heart, label: "Community Love", value: stats.communityLove, wide: true, variant: "blue" },
  ] satisfies Array<{
    Icon: typeof Calendar;
    label: string;
    value: string;
    sub?: string;
    wide?: boolean;
    variant?: keyof typeof VARIANT_STYLES;
  }>;

  return (
    <section id="by-the-numbers" className="py-24 sm:py-32 relative overflow-hidden section-bg-navy">
      <div className="absolute top-0 left-0 right-0 h-px bg-jcc-border" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-linear-to-r from-transparent via-jcc-accent to-transparent opacity-40" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-14">
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent-dark font-black">
            <Trophy className="w-5 h-5" />
            OUR JOURNEY SO FAR
          </span>
          <h2 className="text-4xl min-[380px]:text-5xl sm:text-6xl lg:text-7xl font-black text-jcc-blue tracking-tighter mt-6 uppercase italic leading-tight">
            The Circle, <span className="text-gradient-cyan">By the Numbers</span>
          </h2>
          <p className="mt-6 text-jcc-blue/60 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Started with five friends and a Sunday ball. Here&apos;s what it&apos;s grown into.
          </p>
        </AnimateIn>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {tiles.map((tile, i) => {
            const v = tile.variant ? VARIANT_STYLES[tile.variant] : null;
            return (
              <AnimateIn
                key={tile.label}
                delay={i * 80}
                direction="scale"
                className={tile.wide ? "col-span-2" : ""}
              >
                <div
                  className={`group relative overflow-hidden rounded-2xl border p-6 sm:p-8 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${
                    v ? v.card : "border-jcc-border bg-jcc-navy"
                  }`}
                  style={v?.style}
                >
                  <div
                    className={`mx-auto mb-4 flex w-11 h-11 items-center justify-center rounded-xl group-hover:scale-110 transition-transform ${
                      v ? v.icon : "bg-jcc-accent/10"
                    }`}
                  >
                    <tile.Icon className={`w-5 h-5 ${v ? v.iconColor : "text-jcc-accent-dark"}`} />
                  </div>
                  <p className={`font-heading text-2xl sm:text-3xl font-black ${v ? v.value : "text-jcc-blue"}`}>
                    {tile.value}
                  </p>
                  <p
                    className={`mt-2 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] ${
                      v ? v.label : "text-jcc-blue/50"
                    }`}
                  >
                    {tile.label}
                  </p>
                  {tile.sub && (
                    <p
                      className={`mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] ${
                        v ? v.sub : "text-jcc-accent-dark/70"
                      }`}
                    >
                      {tile.sub}
                    </p>
                  )}
                </div>
              </AnimateIn>
            );
          })}
        </div>

        <AnimateIn delay={200} className="mt-14 sm:mt-16">
          <div className="rounded-2xl border border-jcc-border bg-jcc-navy-light px-6 py-8 sm:py-10 text-center">
            <p className="font-heading text-2xl sm:text-3xl font-black italic text-jcc-blue tracking-tight">
              More than cricket, <span className="text-gradient-cyan">we are a Circle for life.</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {PILLARS.map((pillar) => (
                <span
                  key={pillar.label}
                  className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-jcc-blue/60"
                >
                  <pillar.Icon className="w-4 h-4 text-jcc-accent-dark" />
                  {pillar.label}
                </span>
              ))}
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
