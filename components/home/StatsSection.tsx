import type { HomeStats } from "@/app/page";
import ClubShareButton from "./ClubShareButton";

// The Circle in numbers — the community's own count (members, matchdays,
// overs, hours), as two marquees running against each other. Tertiary on the
// home page: the cricket analytics above carry the weight, this is the club.

/** "31st July 2026" — the flyer's date style. */
function fmtGatheringDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix} ${d.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}`;
}

function Row({ items, reverse }: { items: { value: string; label: string }[]; reverse?: boolean }) {
  return (
    <div className="edge-fade overflow-hidden">
      <div className={`marquee ${reverse ? "marquee-reverse" : ""}`} style={{ "--marquee-speed": "40s" } as React.CSSProperties}>
        {[0, 1].map((dup) => (
          <div key={dup} aria-hidden={dup === 1} className="flex items-center">
            {items.map((it) => (
              <span key={it.label} className="flex items-baseline gap-4 whitespace-nowrap px-8 md:px-12">
                <span className="font-heading text-6xl font-extrabold tracking-[-0.045em] text-jcc-blue md:text-[8rem]">{it.value}</span>
                <span className="kicker text-jcc-text-muted">{it.label}</span>
                <span className="pl-8 text-3xl text-jcc-accent md:pl-12">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsSection({ stats }: { stats: HomeStats }) {
  const gathering = stats.biggestGathering;
  const top = [
    { value: stats.activePlayers, label: "Players" },
    { value: stats.weeklyGames, label: "Matches played" },
    { value: stats.weeksActive, label: "Weeks played" },
    { value: stats.competitiveTeams, label: "Franchises" },
  ];
  const bottom = [
    { value: stats.oversBowled, label: "Overs bowled" },
    { value: stats.hoursOfCricket, label: "Hours of cricket" },
    ...(gathering ? [{ value: String(gathering.players), label: `Biggest turnout · ${fmtGatheringDate(gathering.date)}` }] : []),
    { value: "34+", label: "Hours of coffee" },
    { value: stats.communityLove, label: "Community love" },
  ];

  return (
    <section id="by-the-numbers" className="relative overflow-hidden border-y border-jcc-blue/10 bg-jcc-navy-light py-24 md:py-32">
      <div className="mx-auto mb-12 max-w-[88rem] px-5 md:mb-16 md:px-10">
        <p data-reveal className="kicker text-jcc-accent-dark">05 · The Circle, counted · since 8 March 2026</p>
        <h2 data-split className="mt-5 max-w-4xl font-heading text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-jcc-blue">
          Five friends and a ball, then this.
        </h2>
        <div data-reveal className="mt-8">
          <ClubShareButton
            numbers={{
              since: "8 March 2026",
              stats: [...top, ...bottom.slice(0, 2)].map((x) => ({ value: String(x.value), label: x.label })),
              facts: [
                ...(gathering ? [{ value: `${gathering.players} players`, label: "Biggest turnout" }] : []),
                { value: "34+", label: "Hours of coffee" },
                { value: String(stats.communityLove), label: "Community love" },
              ],
            }}
          />
        </div>
      </div>
      <div className="space-y-2 md:space-y-4">
        <Row items={top} />
        <Row items={bottom} reverse />
      </div>
    </section>
  );
}
