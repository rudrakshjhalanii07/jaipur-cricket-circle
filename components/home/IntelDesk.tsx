// The home page's analytics block, straight after the hero. Server Component:
// the scroll choreography comes from RevealMotion's data attributes (see
// components/RevealMotion.tsx) and the share buttons are their own island.
//
//   1. the cap race, head to head, with each top five underneath
//   2. this season's stat stories on a rail that pins and pans sideways
//   3. what members unlock on /stats

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BarChart3, Crosshair, Gem, GitCompareArrows, Lock, Sparkles, Swords, Users } from "lucide-react";
import Magnetic from "@/components/motion/Magnetic";
import { ShareButton } from "@/app/stats/Stories";
import { TONE } from "@/lib/scorecard-dashboard/stories";
import { teamByName } from "@/lib/teams";
import type { HomeIntel, IntelBoardRow, IntelCap } from "@/lib/home-intel.server";
import { Face } from "./IntelHero";
import { TopFiveShare } from "./HomeShare";

const CAPS = {
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
};
const clip = (image: string) => ({ backgroundImage: image, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;

function Duel({ cap, kind }: { cap: IntelCap; kind: keyof typeof CAPS }) {
  const team = teamByName(cap.team);
  return (
    <Link href="/stats#leaders" data-reveal className="group relative block overflow-hidden py-10 md:py-14">
      {team && (
        <Image src={team.logo} alt="" width={320} height={320} data-parallax="0.25" className="pointer-events-none absolute -right-6 top-6 w-48 object-contain opacity-[0.06] transition-opacity duration-700 group-hover:opacity-[0.12] md:w-72" />
      )}
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={{ background: CAPS[kind] }} />
          <span className="kicker text-jcc-text-muted">{kind === "orange" ? "Orange Cap · most runs" : "Purple Cap · most wickets"}</span>
        </span>
        <span className="grid h-11 w-11 place-items-center rounded-full border border-jcc-blue/15 transition duration-300 group-hover:border-jcc-blue group-hover:bg-jcc-blue group-hover:text-[#FCFBF8]">
          <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:rotate-45" />
        </span>
      </div>
      <div className="relative mt-8 flex items-end gap-3">
        <span data-count className="font-heading text-[7rem] font-extrabold leading-[0.78] tracking-[-0.05em] tabular-nums md:text-[12rem]" style={clip(CAPS[kind])}>
          {cap.value}
        </span>
        <span className="kicker pb-3 text-jcc-text-muted md:pb-5">{cap.unit}</span>
      </div>
      <div className="relative mt-8 flex items-center gap-4">
        <Face name={cap.name} photo={cap.photo} size={56} ring={team?.primary ?? "#D4AF37"} />
        <div className="min-w-0">
          <p className="truncate font-heading text-3xl font-bold tracking-[-0.035em] text-jcc-blue md:text-4xl">{cap.name}</p>
          <p className="mt-1 font-mono text-xs text-jcc-text-muted">{cap.detail}</p>
        </div>
      </div>
    </Link>
  );
}

function TopFive({ title, rows, unit, kind, season }: { title: string; rows: IntelBoardRow[]; unit: string; kind: "orange" | "purple"; season: string }) {
  const max = rows[0]?.value || 1;
  return (
    <div>
      <div className="flex items-end justify-between gap-3 border-b border-jcc-blue/80 pb-3">
        <p className="kicker text-jcc-text-muted">{title}</p>
        <span className="flex items-center gap-3">
          <TopFiveShare title={title} rows={rows} unit={unit} kind={kind} season={season} />
          <p className="kicker text-jcc-text-muted">{unit}</p>
        </span>
      </div>
      <ol data-reveal-stagger>
        {rows.map((r, i) => (
          <li key={r.name} className="grid grid-cols-[28px_auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-jcc-border py-3.5">
            <span className={`font-mono text-xs font-semibold ${i < 3 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
            <Face name={r.name} photo={r.photo} size={32} ring={teamByName(r.team)?.primary} />
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight text-jcc-blue">{r.name}</span>
              <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-jcc-blue/[0.07]">
                <span data-bar className={`block h-full rounded-full ${i === 0 ? "bg-linear-to-r from-jcc-accent-dark to-jcc-accent" : "bg-jcc-blue"}`} style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
            </span>
            <span className="text-right">
              <span className="block font-heading text-2xl font-bold leading-none tabular-nums tracking-tight text-jcc-blue">{r.value}</span>
              <span className="font-mono text-[10px] text-jcc-text-muted">{r.sub}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const MODULES = [
  { icon: Sparkles, title: "Stat stories", desc: "The numbers worth telling someone, with a share link on every one." },
  { icon: Crosshair, title: "Phase analysis", desc: "Powerplay and death-over wickets, dot-ball squeeze, balls per boundary." },
  { icon: GitCompareArrows, title: "Head to head", desc: "Any two players, twelve categories, side by side." },
  { icon: Gem, title: "Hidden gems", desc: "Who does the most with the fewest balls — and deserves more." },
  { icon: Swords, title: "Key battles", desc: "Headline batters against headline bowlers, meeting by meeting." },
  { icon: Users, title: "Player cards", desc: "DNA, badges, splits and every innings for every player." },
];

export default function IntelDesk({ intel }: { intel: HomeIntel | null }) {
  if (!intel) return null;
  const stories = intel.stories.slice(0, 8);

  return (
    <>
      {/* ── The cap race ── */}
      <section id="intelligence" className="relative bg-jcc-bg">
        <div className="mx-auto max-w-[88rem] px-5 pt-28 md:px-10 md:pt-40">
          <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p data-reveal className="kicker text-jcc-accent-dark">01 · The intelligence desk · {intel.seasonLabel}</p>
              <h2 data-split className="mt-5 font-heading text-[clamp(3rem,8vw,8rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-jcc-blue">
                The numbers don&apos;t lie.
              </h2>
              <h2 data-split className="font-heading text-[clamp(3rem,8vw,8rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-jcc-blue/30">
                They gossip.
              </h2>
            </div>
            <Link data-reveal href="/stats" className="group inline-flex items-center gap-3 pb-3 text-sm font-semibold tracking-tight text-jcc-blue">
              All twelve sections
              <span className="grid h-11 w-11 place-items-center rounded-full bg-jcc-blue text-[#FCFBF8] transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight size={18} />
              </span>
            </Link>
          </div>

          {intel.orange && intel.purple && (
            <div className="mt-16 grid border-y border-jcc-blue/80 lg:grid-cols-2">
              <div className="lg:pr-14">
                <Duel cap={intel.orange} kind="orange" />
              </div>
              <div className="border-t border-jcc-border lg:border-l lg:border-t-0 lg:pl-14">
                <Duel cap={intel.purple} kind="purple" />
              </div>
            </div>
          )}

          <div className="grid gap-14 py-16 md:grid-cols-2 md:gap-16 md:py-24">
            <TopFive title="Orange Cap race · top five" rows={intel.batting} unit="Runs" kind="orange" season={intel.seasonLabel} />
            <TopFive title="Purple Cap race · top five" rows={intel.bowling} unit="Wickets" kind="purple" season={intel.seasonLabel} />
          </div>
        </div>
      </section>

      {/* ── Stories rail: pins and pans on wide screens, swipes on phones ── */}
      {stories.length > 0 && (
        <section data-rail className="theme-static-dark print-grain relative overflow-hidden bg-[#0B1424]">
          <div aria-hidden className="pitch-grid absolute inset-0" />
          <div className="relative flex min-h-svh flex-col justify-center py-24 lg:py-0">
            <div className="no-scrollbar snap-x snap-mandatory overflow-x-auto lg:overflow-visible">
              <div data-rail-track className="flex w-max items-stretch gap-5 px-5 md:px-10 lg:pl-[max(2.5rem,calc((100vw-88rem)/2+2.5rem))] lg:pr-[10vw]">
                <div className="flex w-[82vw] shrink-0 snap-start flex-col justify-center sm:w-[420px] lg:w-[520px]">
                  <p className="kicker text-jcc-accent">02 · Stories from the scorecards</p>
                  <h2 data-skew className="mt-5 font-heading text-6xl font-extrabold leading-[0.88] tracking-[-0.042em] text-white md:text-8xl">
                    Read the
                    <br />
                    <span className="text-gold-foil">season.</span>
                  </h2>
                  <p className="mt-6 max-w-sm text-base leading-relaxed text-white/65">
                    Written straight from {intel.career.matches} scorecards. Nothing estimated: wicket phases come from the over each wicket fell in.
                  </p>
                  <p className="kicker mt-8 hidden items-center gap-3 text-white/50 lg:flex">
                    Keep scrolling <span className="h-px w-16 bg-white/30" />
                  </p>
                </div>
                {stories.map((s, i) => (
                  <article
                    key={s.id}
                    className={`relative flex w-[82vw] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] p-7 sm:w-[380px] md:p-8 ${
                      i % 3 === 0 ? "bg-jcc-accent text-[#0D1728]" : "border border-white/12 bg-white/[0.05] backdrop-blur-md"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`kicker ${i % 3 === 0 ? "text-[#0D1728]/70" : "text-white/65"}`}>
                        {String(i + 1).padStart(2, "0")} · {s.kicker}
                      </span>
                      <ShareButton story={s} photo={s.photo} dark={i % 3 !== 0} />
                    </div>
                    <div className="mt-12 flex items-end gap-2">
                      <span className="font-heading text-[5.5rem] font-extrabold leading-[0.8] tracking-[-0.045em] tabular-nums md:text-[6.5rem]" style={i % 3 === 0 ? { color: "#0D1728" } : clip(TONE[s.tone])}>
                        {s.value}
                      </span>
                    </div>
                    <p className={`kicker mt-3 ${i % 3 === 0 ? "text-[#0D1728]/70" : "text-white/55"}`}>{s.unit}</p>
                    <p className={`mt-8 font-heading text-2xl font-bold leading-[1.05] tracking-[-0.035em] ${i % 3 === 0 ? "text-[#0D1728]" : "text-white"}`}>{s.headline}</p>
                    <p className={`mt-3 text-[13.5px] leading-relaxed ${i % 3 === 0 ? "text-[#0D1728]/75" : "text-white/60"}`}>{s.body}</p>
                    {s.player && (
                      <div className="mt-auto flex items-center gap-2.5 pt-8">
                        <Face name={s.player} photo={s.photo} size={34} ring={teamByName(s.team)?.primary} />
                        <span className={`truncate text-sm font-semibold ${i % 3 === 0 ? "text-[#0D1728]" : "text-white"}`}>{s.player}</span>
                      </div>
                    )}
                  </article>
                ))}
                <Link href="/stats#stories" className="group flex w-[70vw] shrink-0 snap-start flex-col items-start justify-center gap-6 sm:w-[320px]">
                  <span className="grid h-28 w-28 place-items-center rounded-full border border-jcc-accent/50 text-jcc-accent transition duration-500 group-hover:scale-110 group-hover:bg-jcc-accent group-hover:text-[#0D1728]">
                    <ArrowUpRight size={40} className="transition-transform duration-500 group-hover:rotate-45" />
                  </span>
                  <span className="font-heading text-4xl font-bold leading-none tracking-[-0.04em] text-white">Every story,<br />every stat.</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── What members unlock ── */}
      <section className="relative bg-jcc-bg">
        <div className="mx-auto grid max-w-[88rem] gap-14 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p data-reveal className="kicker inline-flex items-center gap-2 text-jcc-accent-dark">
              <Lock className="h-3.5 w-3.5" /> 03 · Members only
            </p>
            <h2 data-split className="mt-5 font-heading text-[clamp(2.8rem,6vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.042em] text-jcc-blue">
              That was the trailer.
            </h2>
            <p data-reveal className="mt-6 max-w-md text-lg leading-relaxed text-jcc-text-muted">
              The full desk is for JCC members: twelve sections, every player&apos;s cards, every scorecard since Season 2. Log in with your registered phone number.
            </p>
            <div data-reveal className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link href="/stats" className="btn-vibrant-blue group">
                  <BarChart3 className="h-4 w-4" />
                  Open JCC Stats
                </Link>
              </Magnetic>
              <Link href="/profile" className="text-sm font-semibold tracking-tight text-jcc-blue underline decoration-jcc-accent decoration-2 underline-offset-4">
                Not a member yet?
              </Link>
            </div>
          </div>
          <ul data-reveal-stagger className="grid gap-px overflow-hidden rounded-[28px] border border-jcc-blue/10 bg-jcc-blue/10 sm:grid-cols-2">
            {MODULES.map((m, i) => (
              <li key={m.title} className="group relative bg-jcc-navy p-7 transition-colors duration-500 hover:bg-jcc-blue md:p-9">
                <span className="font-mono text-[11px] text-jcc-text-muted transition-colors group-hover:text-[#FCFBF8]/60">{String(i + 1).padStart(2, "0")}</span>
                <m.icon className="mt-8 h-7 w-7 text-jcc-accent-dark transition-colors group-hover:text-jcc-accent" />
                <h3 className="mt-5 font-heading text-2xl font-bold tracking-[-0.03em] text-jcc-blue transition-colors group-hover:text-[#FFFFFF]">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-jcc-text-muted transition-colors group-hover:text-[#FCFBF8]/80">{m.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
