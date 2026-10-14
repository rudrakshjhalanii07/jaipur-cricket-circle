// The club's eleven values as one typographic index. Each row opens on hover
// (and is always open on touch screens, where there is no hover) — the full
// text is there without eleven screens of scrolling.

const VALUES = [
  ["Community First", "Cricket is our reason to meet, but people are our purpose. Every decision begins with strengthening the community before anything else."],
  ["Inclusivity", "Everyone deserves a place to play, regardless of skill or background. We welcome every player with respect, warmth, and equal opportunity."],
  ["Equality", "Every member matters equally on and off the field. No favoritism — everyone gets a fair chance to participate and contribute."],
  ["Friendship", "We build lasting friendships through the spirit of the game. The strongest victories are the relationships created beyond cricket."],
  ["Diversity", "Different people, personalities, professions, and perspectives make us stronger. Our differences are celebrated because they enrich our community."],
  ["Leadership", "Leadership is about serving, inspiring, and taking responsibility. Every member has the opportunity to lead by example."],
  ["Respect", "Respect is earned through humility, discipline, and kindness. We honor teammates, opponents, officials, and every individual equally."],
  ["Sportsmanship", "Winning is celebrated, but character is remembered. We compete fiercely while playing with integrity and grace."],
  ["Justice", "Every decision is guided by fairness, transparency, and consistency. Trust grows when everyone knows the same rules apply to all."],
  ["Transparency", "Open communication builds confidence within the community. Our decisions, processes, and governance remain honest and accountable."],
  ["Democracy", "Every voice has value, and every opinion deserves to be heard. Together, we shape the future of JCC through participation and collective decision-making."],
] as const;

export default function WhyJCCSection() {
  return (
    <section id="why-jcc" className="relative bg-jcc-bg">
      <div className="mx-auto max-w-[88rem] px-5 py-28 md:px-10 md:py-40">
        <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p data-reveal className="kicker text-jcc-accent-dark">08 · What we stand for</p>
            <h2 data-split className="mt-5 font-heading text-[clamp(2.8rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-jcc-blue">
              Eleven values.
            </h2>
            <h2 data-split className="font-heading text-[clamp(2.8rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-jcc-blue/30">
              No exceptions.
            </h2>
          </div>
        </div>
        <ol className="mt-16 border-t border-jcc-blue/80">
          {VALUES.map(([title, body], i) => (
            <li
              key={title}
              data-reveal
              className="group relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 border-b border-jcc-border py-6 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-x-10 md:py-8"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-jcc-blue transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100" />
              <span className="relative font-mono text-xs text-jcc-accent-dark md:pl-4">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="relative font-heading text-3xl font-bold tracking-[-0.04em] text-jcc-blue transition-[color,transform] duration-500 group-hover:translate-x-2 group-hover:text-[#FFFFFF] md:text-6xl">
                {title}
              </h3>
              <p className="relative col-start-2 mt-2 max-w-xl text-[15px] leading-relaxed text-jcc-text-muted transition-colors duration-500 group-hover:text-[rgba(255,255,255,0.75)] md:col-start-3 md:mt-0 md:pr-4 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
