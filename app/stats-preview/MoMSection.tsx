"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Trophy, Flame, Swords, Crosshair, Target, Hand, Zap } from "lucide-react";
import { fmtDate, momAnalytics, type Award, type AwardType, type CardData } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { Avatar, Portrait, usePhoto } from "./Avatar";
import { Counter, usePill } from "./motion";

const PERIODS = [
  { key: "all", label: "All-time", seasons: [2, 3] },
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
] as const;

/** Award types in the JCC palette: fills, and a readable ink for text. */
export const TYPE_COLOR: Record<AwardType, string> = { Batting: "#12233F", Bowling: "#D4AF37", "All-round": "#A97824", Fielding: "#8A94A6" };
const TYPE_INK: Record<AwardType, string> = { Batting: "#12233F", Bowling: "#8A6516", "All-round": "#7A5518", Fielding: "#4F5868" };
export const TYPE_ICON: Record<AwardType, typeof Target> = { Batting: Target, Bowling: Crosshair, "All-round": Swords, Fielding: Hand };

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
const teamColor = (team: string) => teamByName(team)?.primary ?? "#667085";

export function TypeChip({ type }: { type: AwardType }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${TYPE_COLOR[type]}22`, color: TYPE_INK[type] }}>
      <Icon size={11} /> {type}
    </span>
  );
}

/** An open block under a navy hairline. */
function Block({ title, note, icon, children }: { title: string; note?: string; icon?: typeof Target; children: React.ReactNode }) {
  const Icon = icon;
  return (
    <div data-apanel className="min-w-0 border-t border-jcc-blue/80 pt-5">
      <h3 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-[-0.03em] text-white">
        {Icon && <Icon size={18} className="text-jcc-accent-dark" />}
        {title}
      </h3>
      {note && <p className="mt-1 text-[13px] text-jcc-text-muted">{note}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

type Analytics = ReturnType<typeof momAnalytics>;

/** The record book as a two-pane browser: categories on the left, the selected record in full on the right. */
function RecordBook({ A, names, onOpenMatch }: { A: Analytics; names: string[]; onOpenMatch: (id: string) => void }) {
  const books = [
    { key: "biggest", title: "Biggest performances", note: "Highest match impact.", icon: Flame, rows: A.records.biggest, value: (a: Award) => signed(a.score) },
    { key: "dominant", title: "Most dominant", note: "Furthest clear of the runner-up.", icon: Trophy, rows: A.records.dominant, value: (a: Award) => signed(a.margin) },
    { key: "closest", title: "Photo finishes", note: "Smallest winning margin over the runner-up.", icon: Zap, rows: A.records.closest, value: (a: Award) => a.margin.toFixed(2) },
    { key: "batting", title: "Best batting awards", note: "Highest batting impact in an award.", icon: Target, rows: A.records.batting, value: (a: Award) => signed(a.impact.bat) },
    { key: "bowling", title: "Best bowling awards", note: "Highest bowling impact in an award.", icon: Crosshair, rows: A.records.bowling, value: (a: Award) => signed(a.impact.bowl) },
    { key: "losing", title: "In a losing cause", note: "Awards won by a player on the losing side.", icon: Swords, rows: A.records.losingSide, value: (a: Award) => signed(a.score) },
  ];
  const [key, setKey] = useState(books[0].key);
  const { box, pill } = usePill(key);
  const book = books.find((b) => b.key === key) ?? books[0];
  const [first, ...rest] = book.rows;

  return (
    <div className="mt-20">
      <div className="flex items-end justify-between gap-4 border-b border-jcc-blue/80 pb-4">
        <h4 className="font-heading text-4xl font-bold tracking-[-0.04em] text-white">Record book</h4>
        <span className={LABEL}>Tap an award for its scorecard</span>
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14">
        {/* categories */}
        <div ref={box} className="no-scrollbar relative -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          <span ref={pill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-2xl bg-jcc-blue" style={{ opacity: 0 }} />
          {books.map((b) => {
            const on = b.key === key;
            const lead = b.rows[0];
            return (
              <button
                key={b.key}
                data-active={on}
                onClick={() => setKey(b.key)}
                className={`relative z-10 flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-300 lg:w-full ${on ? "text-[#FCFBF8]" : "text-white hover:bg-jcc-navy"}`}
              >
                <b.icon size={16} className={on ? "text-jcc-accent-highlight" : "text-jcc-accent-dark"} />
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[14px] font-semibold tracking-tight">{b.title}</span>
                  {lead && (
                    <span className={`hidden truncate font-mono text-[10.5px] lg:block ${on ? "text-[#FCFBF8]/70" : "text-jcc-text-muted"}`}>
                      {names[lead.p]} · {b.value(lead)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* the selected record */}
        <div key={book.key} data-apanel className="min-w-0">
          <p className={LABEL}>{book.note}</p>
          {!first ? (
            <p className="mt-6 text-sm text-jcc-text-muted">Every award went to the winning side.</p>
          ) : (
            <>
              <button onClick={() => onOpenMatch(first.matchId)} className="group mt-6 grid w-full items-center gap-6 rounded-3xl bg-jcc-navy p-6 text-left shadow-[0_20px_40px_-30px_rgba(18,35,63,0.6)] ring-1 ring-jcc-border transition hover:ring-jcc-accent/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:p-8">
                <Avatar name={names[first.p]} size={88} ring="#D4AF37" />
                <div className="min-w-0">
                  <p className={LABEL}>No. 1 · {first.team}</p>
                  <div className="mt-1 font-heading text-3xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline md:text-4xl">{names[first.p]}</div>
                  <p className="mt-1 text-[15px] font-medium text-white">{first.line}</p>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-jcc-text-muted">
                    v {first.opp} · {fmtDate(first.date)}, Season {first.season}
                    {first.runnerUp ? ` · runner-up ${names[first.runnerUp.p]}` : ""}
                  </p>
                </div>
                <span className="font-heading text-6xl font-bold leading-none tracking-[-0.05em] tabular-nums md:text-7xl" style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  {book.value(first)}
                </span>
              </button>
              <ol className="mt-4">
                {rest.map((a, i) => (
                  <li key={a.m} data-arow>
                    <button onClick={() => onOpenMatch(a.matchId)} className="group relative grid w-full grid-cols-[32px_auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-jcc-border py-4 text-left">
                      <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-1 rounded-xl bg-jcc-navy opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="text-outline relative font-heading text-3xl font-bold leading-none text-jcc-accent-dark">{i + 2}</span>
                      <Avatar name={names[a.p]} size={44} ring={teamColor(a.team)} className="relative" />
                      <div className="relative min-w-0">
                        <div className="font-semibold tracking-tight text-white">
                          {names[a.p]} <span className="font-normal text-jcc-text-muted">· {a.line}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-jcc-text-muted">
                          {a.team} v {a.opp} · {fmtDate(a.date)}, S{a.season}
                          {a.runnerUp ? ` · runner-up ${names[a.runnerUp.p]}` : ""}
                        </div>
                      </div>
                      <span className="relative font-heading text-3xl font-bold tabular-nums tracking-[-0.04em] text-white">{book.value(a)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MoMSection({ data, onOpenPlayer, onOpenMatch }: { data: CardData; onOpenPlayer: (p: number, card?: string) => void; onOpenMatch: (id: string) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const { box, pill } = usePill(period);
  const cur = PERIODS.find((x) => x.key === period)!;
  const A = useMemo(() => momAnalytics(data, [...cur.seasons]), [data, cur]);
  const names = data.players;
  const top = A.leaderboard[0];
  const maxAwards = top?.awards ?? 1;
  const topHasPhoto = Boolean(usePhoto(top ? names[top.p] : null));
  const winPct = Math.round((100 * A.summary.fromWinningSide) / Math.max(1, A.summary.awards));

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div ref={box} role="tablist" aria-label="Period" className="relative inline-flex rounded-full bg-jcc-navy p-1 shadow-[0_10px_30px_-20px_rgba(18,35,63,0.5)]">
          <span ref={pill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue" style={{ opacity: 0 }} />
          {PERIODS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={period === x.key}
              data-active={period === x.key}
              onClick={() => setPeriod(x.key)}
              className={`relative z-10 rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300 ${period === x.key ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-jcc-text-muted">Tap a player for their cards, or an award for the scorecard</p>
      </div>

      {/* ── Spread: the most-awarded player, and the season in three numbers ── */}
      {top && (
        <div data-apanel className="grid border-y border-jcc-blue/80 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <button onClick={() => onOpenPlayer(top.p, "awards")} className="group relative min-h-[320px] overflow-hidden py-10 text-left lg:pr-12">
            {topHasPhoto && <Portrait name={names[top.p]} className="absolute inset-y-0 right-0 w-[55%]" />}
            <div className="relative">
              <span className="inline-flex items-center gap-2 text-jcc-accent-dark">
                <Trophy size={14} />
                <span className={LABEL}>Most Player of the Match awards</span>
              </span>
              <div className="mt-8 flex items-end gap-3">
                <span
                  className="font-heading text-[7rem] font-bold leading-[0.78] tracking-[-0.06em] tabular-nums md:text-[9rem]"
                  style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                >
                  <Counter value={top.awards} />
                </span>
                <span className={`${LABEL} pb-3`}>awards</span>
              </div>
              <div className="mt-8 flex items-center gap-3">
                {!topHasPhoto && <Avatar name={names[top.p]} size={44} ring="#D4AF37" />}
                <span className="font-heading text-3xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline md:text-4xl">{names[top.p]}</span>
              </div>
              <p className="mt-2 font-mono text-xs text-jcc-text-muted">
                {Math.round(top.rate)}% of his {top.matches} matches · runner-up {top.runnerUp}×
              </p>
            </div>
          </button>

          <div className="border-t border-jcc-border py-10 lg:border-l lg:border-t-0 lg:pl-12">
            <dl className="grid grid-cols-3 gap-6">
              {([
                [A.summary.awards, "", "Awards"],
                [A.summary.winners, "", "Different winners"],
                [winPct, "%", "From the winning side"],
              ] as const).map(([v, unit, l]) => (
                <div key={l}>
                  <dd className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">
                    <Counter value={v} />
                    {unit}
                  </dd>
                  <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">{l}</dt>
                </div>
              ))}
            </dl>
            <div className="mt-10">
              <div className={LABEL}>What won the awards</div>
              <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full">
                {A.types.filter((t) => t.n).map((t) => (
                  <div key={t.type} data-bar className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(100 * t.n) / Math.max(1, A.summary.awards)}%`, background: TYPE_COLOR[t.type] }} title={`${t.type} ${t.n}`} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                {A.types.filter((t) => t.n).map((t) => {
                  const Icon = TYPE_ICON[t.type];
                  return (
                    <div key={t.type} className="flex items-center justify-between border-b border-jcc-border pb-2">
                      <span className="inline-flex items-center gap-2 text-[13px] text-white">
                        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `${TYPE_COLOR[t.type]}22`, color: TYPE_INK[t.type] }}>
                          <Icon size={12} />
                        </span>
                        {t.type}
                      </span>
                      <span className="font-heading text-xl font-bold tabular-nums text-white">{t.n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Award table · By club · Nearly men ── */}
      <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Block title="Award table" note="Ranked by awards, then awards per match. Each bar splits a player's awards by what won them.">
          <ol>
            {A.leaderboard.map((r, i) => (
              <li key={r.p} data-arow>
                <button onClick={() => onOpenPlayer(r.p, "awards")} className="group relative grid w-full grid-cols-[40px_minmax(0,1fr)_56px] items-center gap-4 border-b border-jcc-border py-3.5 text-left">
                  <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-0.5 rounded-xl bg-jcc-navy opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className={`relative font-heading text-3xl font-bold leading-none tracking-[-0.04em] ${i === 0 ? "text-jcc-accent-dark" : "text-outline text-jcc-text-muted/70"}`}>{i + 1}</span>
                  <div className="relative flex min-w-0 items-center gap-3">
                    <Avatar name={names[r.p]} size={i < 3 ? 44 : 36} ring={i === 0 ? "#D4AF37" : teamColor(r.team)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold tracking-tight text-white">{names[r.p]}</div>
                      <div className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full" style={{ width: `${(100 * r.awards) / maxAwards}%` }}>
                        {(Object.keys(r.types) as AwardType[]).filter((t) => r.types[t]).map((t) => (
                          <div key={t} data-bar style={{ width: `${(100 * r.types[t]) / r.awards}%`, background: TYPE_COLOR[t] }} />
                        ))}
                      </div>
                      <div className="mt-1.5 truncate font-mono text-[10.5px] text-jcc-text-muted">
                        {Math.round(r.rate)}% of {r.matches} matches · runner-up {r.runnerUp}×{r.streak >= 2 ? ` · ${r.streak} in a row` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="relative text-right font-heading text-3xl font-bold tabular-nums tracking-tight text-white">{r.awards}</span>
                </button>
              </li>
            ))}
          </ol>
        </Block>

        <div className="space-y-14">
          <Block title="By club" note="Awards won by each side's players.">
            <ol>
              {A.teams.map((t) => {
                const team = teamByName(t.team);
                return (
                  <li key={t.team} data-arow className="flex items-center gap-4 border-b border-jcc-border py-3.5">
                    {team && <Image src={team.logo} alt="" width={40} height={40} className="h-10 w-10 object-contain" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold tracking-tight text-white">{t.team}</span>
                        <span className="font-heading text-2xl font-bold tabular-nums text-white">{t.awards}</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-jcc-navy-light">
                        <div data-bar className="h-full rounded-full" style={{ width: `${t.share}%`, background: teamColor(t.team) }} />
                      </div>
                      <div className="mt-1 font-mono text-[10.5px] text-jcc-text-muted">{t.winners} different winners</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Block>

          <Block title="Nearly men" icon={Zap} note="Most runner-up finishes.">
            {A.nearlyMen.length ? (
              <ol>
                {A.nearlyMen.slice(0, 6).map((r) => (
                  <li key={r.p} data-arow>
                    <button onClick={() => onOpenPlayer(r.p, "awards")} className="group flex w-full items-center gap-3 border-b border-jcc-border py-3 text-left">
                      <Avatar name={names[r.p]} size={34} ring={teamColor(r.team)} />
                      <span className="flex-1 truncate font-semibold tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1">{names[r.p]}</span>
                      <span className="font-mono text-[11px] text-jcc-text-muted">won {r.awards}</span>
                      <span className="w-12 text-right font-heading text-2xl font-bold tabular-nums text-white">{r.runnerUp}×</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-jcc-text-muted">No one has finished runner-up twice yet.</p>
            )}
          </Block>
        </div>
      </div>

      {/* ── Record book ── */}
      <RecordBook A={A} names={names} onOpenMatch={onOpenMatch} />

      {/* ── Matchday timeline ── */}
      <div className="mt-20 border-t border-jcc-blue/80 pt-5">
        <h4 className="font-heading text-4xl font-bold tracking-[-0.04em] text-white">Matchday by matchday</h4>
        <ol className="relative mt-10 border-l border-jcc-blue/15 pl-8">
          {A.days.map((d) => (
            <li key={d.date} data-arow className="relative pb-8 last:pb-0">
              <span aria-hidden className="absolute -left-[37px] top-1.5 h-2.5 w-2.5 rounded-full bg-jcc-accent ring-4 ring-jcc-navy-light" />
              <div className="flex items-baseline gap-3">
                <span className="font-heading text-xl font-bold tracking-tight text-white">{fmtDate(d.date)}</span>
                <span className={LABEL}>Season {d.season}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.awards.map((a) => (
                  <button
                    key={a.m}
                    onClick={() => onOpenMatch(a.matchId)}
                    title={`${a.result} · ${a.line}`}
                    className="group flex items-center gap-2.5 rounded-full bg-jcc-navy py-1 pl-1 pr-4 text-left text-[12.5px] shadow-[0_1px_0_rgba(18,35,63,0.06)] ring-1 ring-jcc-border transition hover:-translate-y-0.5 hover:ring-jcc-accent/60"
                  >
                    <Avatar name={names[a.p]} size={28} ring={TYPE_COLOR[a.type]} />
                    <span className="font-semibold text-white">{names[a.p]}</span>
                    <span className="font-mono text-[10.5px] text-jcc-text-muted">v {a.opp}</span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-jcc-text-muted">
        Awards are decided from the numbers, judged against each match&apos;s own scoring rate, with a 1.3× weight on the winning side. Bowling awards outnumber batting ones because in 7-over box cricket a tight two-over spell moves a match more than a quick score; a smaller wicket value barely changes that. Award type: 70%+ of the impact from one skill, otherwise all-round.
      </p>
    </div>
  );
}
