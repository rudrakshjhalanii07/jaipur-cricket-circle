import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, Trophy } from "lucide-react";
import type { DayMatch, DayReport, ReportInnings } from "@/lib/match-reports";
import { ov } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import Jaali from "@/components/Jaali";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-jcc-text-muted";

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

function Crest({ team, size }: { team: string; size: number }) {
  const t = teamByName(team);
  if (!t) return <span style={{ width: size, height: size }} className="shrink-0" />;
  return <Image src={t.logo} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

/** One result in the masthead strip; jumps to that match's section. */
function ResultCard({ m }: { m: DayMatch }) {
  return (
    <a href={`#match-${m.matchNo}`} className="group block border-t border-jcc-border py-4">
      <div className={`${LABEL} mb-3 flex items-center justify-between`}>
        <span>Match {m.matchNo}</span>
        <span className={m.kicker === "Thriller" || m.kicker === "Tie" ? "text-jcc-accent" : ""}>{m.kicker}</span>
      </div>
      {m.innings.map((inn) => {
        const won = m.winner === inn.team;
        return (
          <div key={inn.team} className="flex items-center gap-3 py-1">
            <Crest team={inn.team} size={24} />
            <span className={`flex-1 truncate text-sm ${won ? "font-semibold text-white" : "text-jcc-text-muted"}`}>{inn.team}</span>
            <span className={`font-heading text-2xl tabular-nums ${won ? "text-jcc-accent" : "text-white/70"}`}>
              {inn.runs}/{inn.wickets}
            </span>
            <span className="w-8 text-right font-mono text-[10px] text-jcc-text-muted">{ov(inn.balls)}</span>
          </div>
        );
      })}
      <div className="mt-2 text-xs text-jcc-text-muted transition-colors group-hover:text-jcc-accent">{m.result} ↓</div>
    </a>
  );
}

function Innings({ inn }: { inn: ReportInnings }) {
  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-4 border-b-2 border-jcc-blue pb-3">
        <div className="flex items-center gap-3">
          <Crest team={inn.team} size={26} />
          <h4 className="font-heading text-xl tracking-tight text-white">{inn.team}</h4>
        </div>
        <div className="font-heading text-xl tabular-nums text-white">
          {inn.runs}/{inn.wickets} <span className="font-mono text-xs text-jcc-text-muted">({ov(inn.balls)})</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className={`${LABEL} text-right`}>
              <th className="py-3 text-left font-medium">Batter</th>
              <th className="w-10 font-medium">R</th>
              <th className="w-10 font-medium">B</th>
              <th className="w-10 font-medium">4s</th>
              <th className="w-10 font-medium">6s</th>
              <th className="w-12 font-medium">SR</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {inn.batting.map((b) => (
              <tr key={b.name} className="border-t border-jcc-border text-right">
                <td className="py-2.5 pr-3 text-left">
                  <div className="font-semibold text-white">{b.name}</div>
                  <div className="text-xs text-jcc-text-muted">{b.how}</div>
                </td>
                <td className={`font-semibold ${b.out ? "text-white" : "text-jcc-accent-dark"}`}>{b.runs}{b.out ? "" : "*"}</td>
                <td className="text-jcc-text-muted">{b.balls}</td>
                <td className="text-jcc-text-muted">{b.f4}</td>
                <td className="text-jcc-text-muted">{b.s6}</td>
                <td className="text-jcc-text-muted">{b.balls ? ((100 * b.runs) / b.balls).toFixed(0) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-jcc-border py-2.5 text-xs leading-relaxed text-jcc-text-muted">
        {inn.extras} extras
        {inn.fow.length > 0 && (
          <>
            <span className="mx-2">·</span>
            Fall of wickets: {inn.fow.map((f) => `${f.score}-${f.wicket} (${f.name}, ${f.over})`).join(", ")}
          </>
        )}
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className={`${LABEL} text-right`}>
              <th className="py-3 text-left font-medium">Bowler</th>
              <th className="w-10 font-medium">O</th>
              <th className="w-10 font-medium">M</th>
              <th className="w-10 font-medium">R</th>
              <th className="w-10 font-medium">W</th>
              <th className="w-12 font-medium">Econ</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {inn.bowling.map((b) => (
              <tr key={b.name} className="border-t border-jcc-border text-right">
                <td className="py-2.5 pr-3 text-left font-semibold text-white">{b.name}</td>
                <td className="text-jcc-text-muted">{ov(b.balls)}</td>
                <td className="text-jcc-text-muted">{b.mdn}</td>
                <td className="text-jcc-text-muted">{b.runs}</td>
                <td className={`font-semibold ${b.wk ? "text-jcc-accent-dark" : "text-white"}`}>{b.wk}</td>
                <td className="text-jcc-text-muted">{b.balls ? ((6 * b.runs) / b.balls).toFixed(2) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DayReportView({ report }: { report: DayReport }) {
  const playing = new Set(report.matches.flatMap((m) => m.innings.map((i) => i.team)));
  const seasonHref = `/boundary-banter?season=${report.season}#match-reports`;

  return (
    <article className="relative">
      {/* ── Masthead + the day's results ── */}
      <header className="theme-static-dark section-bg-royal page-top relative overflow-hidden pb-14">
        <Jaali intensity={3} weight={1.6} fade="0.88 0.4" drift={[0.95, 0.15, 0.72, 0.85]} />
        <div
          className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[620px] max-w-full"
          style={{ background: "radial-gradient(ellipse at top right, rgba(212,175,55,0.16), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <nav className={`${LABEL} mb-10 flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <Link href="/boundary-banter" className="hover:text-jcc-accent">Boundary Banter</Link>
            <span>/</span>
            <Link href={seasonHref} className="hover:text-jcc-accent">Season {report.season}</Link>
            <span>/</span>
            <span className="text-white">Week {report.week}</span>
          </nav>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-jcc-accent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-jcc-seam">
              {report.kicker}
            </span>
            <span className={LABEL}>
              Season {report.season} · Week {report.week} · {report.matches.length} {report.matches.length === 1 ? "match" : "matches"}
            </span>
          </div>

          <h1 className="max-w-4xl font-heading text-4xl leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
            {report.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/80">{report.dek}</p>

          <p className="mt-6 text-sm text-jcc-text-muted">
            By <span className="font-semibold text-white">{report.byline}</span>
            <span className="mx-2">·</span>
            {longDate(report.date)}
            <span className="mx-2">·</span>
            {report.venue}
          </p>

          <div className="mt-12 grid gap-x-12 sm:grid-cols-2">
            {report.matches.map((m) => (
              <ResultCard key={m.matchNo} m={m} />
            ))}
          </div>
        </div>
      </header>

      {/* ── The story + sidebar ── */}
      <div className="section-bg-navy">
        <div className="mx-auto grid max-w-5xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          <div className="max-w-[65ch]">
            <p className="mb-5 text-lg leading-[1.8] text-white/80 first-letter:float-left first-letter:mr-1.5 first-letter:mt-1 first-letter:font-heading first-letter:text-[4.2rem] first-letter:leading-[0.8] first-letter:text-jcc-accent-dark">
              {report.lede.join(" ")}
            </p>

            {report.matches.map((m) => {
              const [a, b] = m.innings;
              return (
                <section key={m.matchNo} id={`match-${m.matchNo}`} className="mt-14 scroll-mt-28 border-t border-jcc-border pt-8">
                  <div className={`${LABEL} mb-3 flex flex-wrap items-center gap-x-3`}>
                    <span className="text-jcc-accent-dark">Match {m.matchNo}</span>
                    <span>{m.kicker}</span>
                  </div>
                  <h2 className="font-heading text-2xl leading-snug tracking-tight text-white sm:text-3xl">{m.headline}</h2>
                  <p className="mt-3 mb-6 font-mono text-xs text-jcc-text-muted">
                    {a.team} {a.runs}/{a.wickets} ({ov(a.balls)}) · {b.team} {b.runs}/{b.wickets} ({ov(b.balls)}) — {m.result}
                  </p>
                  {m.paragraphs.map((p, j) => (
                    <p key={j} className="mb-5 text-[17px] leading-[1.8] text-white/80">{p}</p>
                  ))}
                  {m.potm && (
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-jcc-text-muted">
                      <Trophy className="h-3.5 w-3.5 text-jcc-accent" />
                      Player of the Match: <span className="font-semibold text-white">{m.potm.name}</span>
                      <span className="font-mono text-xs text-jcc-accent-dark">{m.potm.line}</span>
                    </p>
                  )}
                </section>
              );
            })}

            {report.records.length > 0 && (
              <section className="mt-14 border-t border-jcc-border pt-8">
                <h2 className="mb-4 font-heading text-2xl tracking-tight text-white sm:text-3xl">For the record books</h2>
                <p className="text-[17px] leading-[1.8] text-white/80">{report.records.join(" ")}</p>
              </section>
            )}

            <figure className="mt-16 border-l-2 border-jcc-accent pl-6">
              <figcaption className={`${LABEL} mb-3 text-jcc-accent-dark`}>The Banter Verdict</figcaption>
              <blockquote className="font-heading text-2xl italic leading-snug tracking-tight text-white sm:text-[1.75rem]">
                {report.verdict}
              </blockquote>
            </figure>
          </div>

          <aside className="space-y-12 self-start lg:sticky lg:top-28">
            {report.star && (
              <div>
                <div className={`${LABEL} mb-4 flex items-center gap-2`}>
                  <Trophy className="h-3.5 w-3.5 text-jcc-accent" /> Star of the day
                </div>
                <div className="font-heading text-3xl leading-tight tracking-tight text-white">{report.star.name}</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-jcc-text-muted">
                  <Crest team={report.star.team} size={18} /> {report.star.team}
                </div>
                <div className="mt-3 font-mono text-xs text-jcc-accent-dark">{report.star.line}</div>
                <p className="mt-4 text-sm leading-relaxed text-white/70">{report.star.blurb}</p>
              </div>
            )}

            <div>
              <div className={`${LABEL} mb-2`}>The day in numbers</div>
              <dl>
                {report.numbers.map((n) => (
                  <div key={n.label} className="flex items-baseline gap-4 border-b border-jcc-border py-3">
                    <dt className="w-16 shrink-0 font-heading text-3xl tabular-nums tracking-tight text-white">{n.value}</dt>
                    <dd className="text-sm leading-snug text-jcc-text-muted">{n.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <div className={`${LABEL} mb-2`}>Season {report.season} table, after Week {report.week}</div>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className={`${LABEL} text-right`}>
                    <th className="py-2 text-left font-medium">Team</th>
                    <th className="font-medium">P</th>
                    <th className="font-medium">W</th>
                    <th className="font-medium">Pts</th>
                    <th className="font-medium">NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.table.map((row, i) => (
                    <tr key={row.team} className={`border-t border-jcc-border text-right ${playing.has(row.team) ? "text-white" : "text-jcc-text-muted"}`}>
                      <td className="py-2.5 text-left">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3 font-mono text-[10.5px] text-jcc-text-muted">{i + 1}</span>
                          <Crest team={row.team} size={18} />
                          <span className={i === 0 ? "font-semibold" : ""}>{row.team.replace(/^The /, "")}</span>
                          {row.moved > 0 && <span className="text-[10px] text-jcc-accent-dark" aria-label="moved up">▲</span>}
                          {row.moved < 0 && <span className="text-[10px] text-jcc-text-muted" aria-label="moved down">▼</span>}
                        </span>
                      </td>
                      <td>{row.played}</td>
                      <td>{row.won}</td>
                      <td className="font-semibold">{row.points}</td>
                      <td>{row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Scorecards, one fold per match ── */}
      <section className="section-bg-ice border-t border-jcc-border">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className={`${LABEL} mb-6`}>Full scorecards</div>
          {report.matches.map((m) => {
            const [a, b] = m.innings;
            return (
              <details key={m.matchNo} className="group border-t border-jcc-border last:border-b">
                <summary className="flex cursor-pointer list-none items-center gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-[10.5px] text-jcc-text-muted">M{m.matchNo}</span>
                  <span className="flex-1 font-heading text-lg tracking-tight text-white sm:text-xl">
                    {a.team.replace(/^The /, "")} {a.runs}/{a.wickets} <span className="text-jcc-text-muted">v</span> {b.team.replace(/^The /, "")} {b.runs}/{b.wickets}
                  </span>
                  <span className="hidden text-xs text-jcc-text-muted sm:block">{m.result}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-jcc-text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-12 pb-10 lg:grid-cols-2">
                  {m.innings.map((inn) => (
                    <Innings key={inn.team} inn={inn} />
                  ))}
                </div>
              </details>
            );
          })}
          <p className={`${LABEL} mt-4`}>{report.matches[0]?.overs} overs a side</p>
        </div>
      </section>

      {/* ── Previous / next matchday ── */}
      <nav className="theme-static-dark section-bg-royal-deep">
        <div className="mx-auto grid max-w-5xl gap-px px-4 py-12 sm:grid-cols-2 sm:px-6">
          {report.prev ? (
            <Link href={`/boundary-banter/${report.prev.slug}`} className="group py-4 sm:pr-8">
              <span className={`${LABEL} flex items-center gap-2`}>
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" /> Week {report.week - 1}
              </span>
              <span className="mt-2 block font-heading text-xl leading-snug text-white group-hover:text-jcc-accent">{report.prev.headline}</span>
            </Link>
          ) : <span />}
          {report.next ? (
            <Link href={`/boundary-banter/${report.next.slug}`} className="group py-4 sm:pl-8 sm:text-right">
              <span className={`${LABEL} flex items-center gap-2 sm:justify-end`}>
                Week {report.week + 1} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="mt-2 block font-heading text-xl leading-snug text-white group-hover:text-jcc-accent">{report.next.headline}</span>
            </Link>
          ) : <span />}
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <Link href={seasonHref} className={`${LABEL} hover:text-jcc-accent`}>
            ← All Season {report.season} matchdays
          </Link>
        </div>
      </nav>
    </article>
  );
}
