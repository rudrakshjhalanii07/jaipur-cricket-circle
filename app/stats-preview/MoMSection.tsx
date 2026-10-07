"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Trophy, Flame, Swords, Crosshair, Target, Hand, Zap, Medal } from "lucide-react";
import { fmtDate, momAnalytics, type Award, type AwardType, type CardData } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";

const PERIODS = [
  { key: "all", label: "All-time", seasons: [2, 3] },
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
] as const;

export const TYPE_COLOR: Record<AwardType, string> = { Batting: "#2B59C3", Bowling: "#1A7A5E", "All-round": "#B98419", Fielding: "#176178" };
export const TYPE_ICON: Record<AwardType, typeof Target> = { Batting: Target, Bowling: Crosshair, "All-round": Swords, Fielding: Hand };

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
const dot = (team: string) => teamByName(team)?.primary ?? "#667085";

export function TypeChip({ type }: { type: AwardType }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${TYPE_COLOR[type]}1A`, color: TYPE_COLOR[type] }}>
      <Icon size={11} /> {type}
    </span>
  );
}

function Panel({ title, note, icon, children }: { title: string; note?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-jcc-border bg-jcc-navy p-5 shadow-[0_6px_20px_-14px_rgba(18,35,63,0.3)]">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">{icon}{title}</h3>
      {note && <p className="mt-1 text-xs text-jcc-text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AwardRow({ a, names, onOpenMatch, value }: { a: Award; names: string[]; onOpenMatch: (id: string) => void; value: string }) {
  return (
    <li>
      <button onClick={() => onOpenMatch(a.matchId)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-jcc-navy-light/60">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot(a.team) }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{names[a.p]} <span className="font-normal text-jcc-text-muted">· {a.line}</span></div>
          <div className="truncate text-[11.5px] text-jcc-text-muted">v {a.opp} · {fmtDate(a.date)} S{a.season}{a.runnerUp ? ` · runner-up ${names[a.runnerUp.p]}` : ""}</div>
        </div>
        <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-white">{value}</span>
      </button>
    </li>
  );
}

export default function MoMSection({ data, onOpenPlayer, onOpenMatch }: { data: CardData; onOpenPlayer: (p: number, card?: string) => void; onOpenMatch: (id: string) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const cur = PERIODS.find((x) => x.key === period)!;
  const A = useMemo(() => momAnalytics(data, [...cur.seasons]), [data, cur]);
  const names = data.players;
  const top = A.leaderboard[0];
  const maxAwards = top?.awards ?? 1;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PERIODS.map((x) => (
          <button
            key={x.key}
            onClick={() => setPeriod(x.key)}
            aria-pressed={period === x.key}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${period === x.key ? "border-jcc-blue bg-jcc-blue text-[#FCFBF8]" : "border-jcc-border bg-jcc-navy text-jcc-text-muted hover:text-white"}`}
          >
            {x.label}
          </button>
        ))}
        <span className="text-xs text-jcc-text-muted">Tap a player for their cards, or an award for the scorecard.</span>
      </div>

      {/* Header band */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-jcc-blue px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-jcc-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-x-10 gap-y-5">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-jcc-accent-highlight to-jcc-accent-dark text-jcc-seam shadow-[0_10px_24px_-8px_rgba(212,175,55,0.8)]"><Trophy size={30} /></span>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-jcc-accent-highlight">Player of the Match</p>
              <h3 className="font-heading text-3xl font-bold leading-none text-[#FCFBF8]">Award Records</h3>
            </div>
          </div>
          {top && (
            <button onClick={() => onOpenPlayer(top.p, "awards")} className="text-left">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#FCFBF8]/60">Most awards</div>
              <div className="font-heading text-2xl font-bold leading-tight text-[#FCFBF8]">{names[top.p]} <span className="text-jcc-accent-highlight">×{top.awards}</span></div>
            </button>
          )}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {([
              [A.summary.awards, "awards"],
              [A.summary.winners, "different winners"],
              [`${Math.round((100 * A.summary.fromWinningSide) / Math.max(1, A.summary.awards))}%`, "from the winning side"],
            ] as const).map(([v, l]) => (
              <div key={l}>
                <div className="font-heading text-3xl font-bold tabular-nums leading-none text-[#FCFBF8]">{v}</div>
                <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#FCFBF8]/60">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            {A.types.filter((t) => t.n).map((t) => <div key={t.type} style={{ width: `${(100 * t.n) / Math.max(1, A.summary.awards)}%`, background: TYPE_COLOR[t.type] }} title={`${t.type} ${t.n}`} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-[#FCFBF8]/70">
            {A.types.filter((t) => t.n).map((t) => (
              <span key={t.type} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[t.type] }} />{t.type} awards {t.n}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Leaderboard */}
        <Panel title="Award table" icon={<Medal size={13} />} note="Ranked by awards, then awards per match. Bars split each player's awards by what won them.">
          <ol className="divide-y divide-jcc-border">
            {A.leaderboard.map((r, i) => (
              <li key={r.p}>
                <button onClick={() => onOpenPlayer(r.p, "awards")} className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 py-2.5 text-left transition hover:bg-jcc-navy-light/60">
                  <span className={`text-center text-xs font-bold ${i === 0 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot(r.team) }} /><span className="truncate font-semibold text-white">{names[r.p]}</span></div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-jcc-navy-light" style={{ width: `${(100 * r.awards) / maxAwards}%` }}>
                      {(Object.keys(r.types) as AwardType[]).filter((t) => r.types[t]).map((t) => <div key={t} style={{ width: `${(100 * r.types[t]) / r.awards}%`, background: TYPE_COLOR[t] }} />)}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-jcc-text-muted">
                      {Math.round(r.rate)}% of his {r.matches} matches · runner-up {r.runnerUp}×{r.streak >= 2 ? ` · ${r.streak} in a row` : ""}
                    </div>
                  </div>
                  <span className="font-heading text-2xl font-bold tabular-nums text-white">{r.awards}</span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel title="By team" note="Awards won by each side's players.">
            <div className="space-y-3">
              {A.teams.map((t) => (
                <div key={t.team}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="flex items-center gap-2 font-semibold text-white"><span className="h-2 w-2 rounded-full" style={{ background: dot(t.team) }} />{t.team}</span>
                    <span className="tabular-nums text-jcc-text-muted"><b className="text-white">{t.awards}</b> · {t.winners} different winners</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-jcc-navy-light">
                    <div className="h-full rounded-full" style={{ width: `${t.share}%`, background: dot(t.team) }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Nearly men" icon={<Zap size={13} />} note="Most runner-up finishes.">
            {A.nearlyMen.length ? (
              <ol className="divide-y divide-jcc-border">
                {A.nearlyMen.slice(0, 6).map((r) => (
                  <li key={r.p}>
                    <button onClick={() => onOpenPlayer(r.p, "awards")} className="flex w-full items-center gap-3 py-2 text-left hover:bg-jcc-navy-light/60">
                      <span className="h-2 w-2 rounded-full" style={{ background: dot(r.team) }} />
                      <span className="flex-1 truncate font-semibold text-white">{names[r.p]}</span>
                      <span className="text-[12px] text-jcc-text-muted">won {r.awards}</span>
                      <span className="w-10 text-right font-heading text-lg font-bold text-white">{r.runnerUp}×</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-jcc-text-muted">No one has finished runner-up twice yet.</p>}
          </Panel>
        </div>
      </div>

      {/* Record book */}
      <h4 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">Record book</h4>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Panel title="Biggest performances" icon={<Flame size={13} />} note="Highest match impact.">
          <ol className="divide-y divide-jcc-border">{A.records.biggest.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={signed(a.score)} />)}</ol>
        </Panel>
        <Panel title="Most dominant" icon={<Trophy size={13} />} note="Furthest clear of the runner-up.">
          <ol className="divide-y divide-jcc-border">{A.records.dominant.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={signed(a.margin)} />)}</ol>
        </Panel>
        <Panel title="Photo finishes" icon={<Zap size={13} />} note="Smallest winning margin.">
          <ol className="divide-y divide-jcc-border">{A.records.closest.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={a.margin.toFixed(2)} />)}</ol>
        </Panel>
        <Panel title="Best batting awards" icon={<Target size={13} />} note="Highest batting impact in an award.">
          <ol className="divide-y divide-jcc-border">{A.records.batting.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={signed(a.impact.bat)} />)}</ol>
        </Panel>
        <Panel title="Best bowling awards" icon={<Crosshair size={13} />} note="Highest bowling impact in an award.">
          <ol className="divide-y divide-jcc-border">{A.records.bowling.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={signed(a.impact.bowl)} />)}</ol>
        </Panel>
        <Panel title="In a losing cause" icon={<Swords size={13} />} note="Awards won by a player on the losing side.">
          {A.records.losingSide.length ? (
            <ol className="divide-y divide-jcc-border">{A.records.losingSide.map((a) => <AwardRow key={a.m} a={a} names={names} onOpenMatch={onOpenMatch} value={signed(a.score)} />)}</ol>
          ) : <p className="text-sm text-jcc-text-muted">Every award went to the winning side.</p>}
        </Panel>
      </div>

      {/* Timeline */}
      <h4 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">Matchday by matchday</h4>
      <div className="space-y-3">
        {A.days.map((d) => (
          <div key={d.date} className="grid items-start gap-3 sm:grid-cols-[110px_1fr]">
            <div className="pt-1.5 text-[12px] font-bold text-white">{fmtDate(d.date)} <span className="font-normal text-jcc-text-muted">S{d.season}</span></div>
            <div className="flex flex-wrap gap-2">
              {d.awards.map((a) => (
                <button key={a.m} onClick={() => onOpenMatch(a.matchId)} className="flex items-center gap-2 rounded-xl border border-jcc-border bg-jcc-navy px-3 py-1.5 text-left text-[12px] transition hover:border-jcc-accent/60" title={`${a.result} · ${a.line}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[a.type] }} />
                  <span className="font-semibold text-white">{names[a.p]}</span>
                  <span className="text-jcc-text-muted">v {a.opp}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-jcc-text-muted">
        Awards are decided from the numbers, judged against each match&apos;s own scoring rate, with a 1.3× weight on the winning side. Bowling awards outnumber batting ones because in 7-over box cricket a tight two-over spell moves a match more than a quick score; a smaller wicket value barely changes that. Award type: 70%+ of the impact from one skill, otherwise all-round.
      </p>
    </div>
  );
}
