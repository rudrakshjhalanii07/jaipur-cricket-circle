// The four franchises, as they stand this season. Secondary to the analytics
// above it: crest, captain-free identity and the table's numbers on one row
// each. Falls back to the plain crests when there's no table yet.

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TEAMS, teamByName, type TeamId } from "@/lib/teams";
import type { HomeIntel } from "@/lib/home-intel.server";

const ORDER: TeamId[] = ["neurostrikers", "mavericks", "outliers", "vikings"];

export default function TeamsBand({ intel }: { intel: HomeIntel | null }) {
  const rows = intel?.standings ?? [];
  const leaderPts = rows[0]?.points || 1;

  return (
    <section id="franchise" className="theme-static-dark print-grain relative overflow-hidden bg-jcc-blue">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-0 h-[30rem] w-[30rem] rounded-full bg-jcc-accent/12 blur-[130px]" />
      <div className="relative mx-auto max-w-[88rem] px-5 py-28 md:px-10 md:py-36">
        <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p data-reveal className="kicker text-jcc-accent">04 · The franchises{intel ? ` · ${intel.seasonLabel} table` : ""}</p>
            <h2 data-split className="mt-5 font-heading text-[clamp(2.8rem,7vw,7rem)] font-extrabold leading-[0.88] tracking-[-0.042em] text-white">
              Four crests. One crown.
            </h2>
          </div>
          <p data-reveal className="max-w-xs text-sm leading-relaxed text-white/65 md:pb-3 md:text-right">
            Win 2 · Tie 1 · ranked by points %, then net run rate.
          </p>
        </div>

        {rows.length > 0 ? (
          <ol data-reveal-stagger className="mt-14 border-t border-white/15">
            {rows.map((t, i) => {
              const team = teamByName(t.team);
              const nrr = `${t.nrr > 0 ? "+" : ""}${t.nrr.toFixed(2)}`;
              return (
                <li key={t.team} className="group relative grid grid-cols-[48px_64px_minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-6 md:grid-cols-[96px_96px_minmax(0,1fr)_200px_120px_100px] md:gap-8 md:py-8">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 origin-left scale-x-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                    style={{ background: `linear-gradient(90deg, ${team?.primary ?? "#3B6FC4"}55, transparent 70%)` }}
                  />
                  <span className={`relative font-heading text-5xl font-extrabold leading-none tracking-[-0.05em] md:text-7xl ${i === 0 ? "text-jcc-accent" : "text-outline text-white/45"}`}>{i + 1}</span>
                  {team && <Image src={team.logo} alt="" width={96} height={96} className="relative h-14 w-14 object-contain transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 md:h-20 md:w-20" />}
                  <div className="relative min-w-0">
                    <p className="truncate font-heading text-2xl font-bold tracking-[-0.035em] text-white md:text-4xl">{t.team}</p>
                    <p className="mt-1 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: team?.primary }} />
                      {team?.tagline}
                    </p>
                  </div>
                  <div className="relative hidden md:block">
                    <div className="h-1.5 rounded-full bg-white/10">
                      <span data-bar className="block h-full rounded-full bg-jcc-accent" style={{ width: `${(t.points / leaderPts) * 100}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-white/60">
                      P{t.played} · W{t.won} · L{t.lost}
                    </p>
                  </div>
                  <div className="relative hidden items-center gap-1.5 md:flex" title="Last five, oldest first">
                    {t.form.map((r, k) => (
                      <span key={k} className={`h-3 w-3 rounded-full ${r === "W" ? "bg-jcc-accent shadow-[0_0_12px_rgba(212,175,55,0.6)]" : r === "L" ? "bg-white/20" : "border border-white/60"}`} />
                    ))}
                  </div>
                  <div className="relative text-right">
                    <p className="font-heading text-4xl font-bold leading-none tabular-nums tracking-[-0.04em] text-white md:text-6xl">{t.points}</p>
                    <p className="mt-1 font-mono text-[10.5px] text-white/60">NRR {nrr}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div data-reveal-stagger className="mt-14 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {ORDER.map((id) => (
              <div key={id} className="text-center">
                <Image src={TEAMS[id].logo} alt={`${TEAMS[id].name} crest`} width={240} height={240} className="mx-auto h-40 w-40 object-contain" />
                <p className="mt-4 font-heading text-2xl font-bold text-white">{TEAMS[id].name}</p>
              </div>
            ))}
          </div>
        )}

        <Link data-reveal href="/stats#table" className="group mt-12 inline-flex items-center gap-3 text-sm font-semibold tracking-tight text-white">
          Full table, form and NRR
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/25 transition duration-500 group-hover:rotate-45 group-hover:border-jcc-accent group-hover:bg-jcc-accent group-hover:text-[#0D1728]">
            <ArrowUpRight size={16} />
          </span>
        </Link>
      </div>
    </section>
  );
}
