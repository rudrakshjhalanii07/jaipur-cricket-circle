"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Trophy, X } from "lucide-react";
import { f2, fmtDate, manOfTheMatch, matchScorecard, ov, type CardData, type ScorecardInnings } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";

function Logo({ team, size = 28 }: { team: string; size?: number }) {
  const t = teamByName(team);
  if (!t) return null;
  return <Image src={t.logo} alt={t.name} width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

function Name({ p, name, onOpen }: { p: number; name: string; onOpen: (p: number) => void }) {
  return (
    <button onClick={() => onOpen(p)} className="whitespace-nowrap text-left font-semibold text-white decoration-jcc-accent decoration-2 underline-offset-4 hover:underline">
      {name}
    </button>
  );
}

function Innings({ inn, onOpen }: { inn: ScorecardInnings; onOpen: (p: number) => void }) {
  const th = "whitespace-nowrap px-3 py-2 text-right font-semibold";
  const thL = "whitespace-nowrap px-3 py-2 text-left font-semibold";
  const td = "whitespace-nowrap px-3 py-2 text-right tabular-nums";
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-jcc-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-jcc-blue text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/75">
              <th className={thL}>Batter</th>
              <th className={th}>R</th>
              <th className={th}>B</th>
              <th className={th}>4s</th>
              <th className={th}>6s</th>
              <th className={th}>SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batting.map((r) => (
              <tr key={r.p} className="border-t border-jcc-border">
                <td className="px-3 py-2 text-left">
                  <Name p={r.p} name={r.name} onOpen={onOpen} />
                  <div className="text-[11.5px] text-jcc-text-muted">{r.how}</div>
                </td>
                <td className={`${td} font-bold ${r.out ? "text-white" : "text-jcc-accent-dark"}`}>{r.runs}{r.out ? "" : "*"}</td>
                <td className={td}>{r.balls}</td>
                <td className={td}>{r.f4}</td>
                <td className={td}>{r.s6}</td>
                <td className={td}>{r.sr == null ? "–" : r.sr.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="border-t border-jcc-border bg-jcc-navy-light/60 text-[12.5px]">
              <td className="px-3 py-2 text-left font-semibold">Extras</td>
              <td className="px-3 py-2 text-left text-jcc-text-muted" colSpan={4}>
                wd {inn.extras.wides} · nb {inn.extras.noBalls}{inn.extras.other ? ` · b/lb ${inn.extras.other}` : ""}
              </td>
              <td className={`${td} font-bold`}>{inn.extras.total}</td>
            </tr>
            <tr className="border-t border-jcc-border bg-jcc-navy-light">
              <td className="px-3 py-2.5 text-left font-heading text-base font-bold">Total</td>
              <td className="px-3 py-2.5 text-left text-[12px] text-jcc-text-muted" colSpan={4}>
                {ov(inn.balls)} overs · run rate {f2(inn.balls ? (6 * inn.runs) / inn.balls : null)}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-heading text-lg font-bold tabular-nums">{inn.runs}/{inn.wickets}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {inn.fow.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-jcc-accent-dark">Fall of wickets</h4>
          <div className="flex flex-wrap gap-1.5">
            {inn.fow.map((f) => (
              <button key={f.wicket} onClick={() => onOpen(f.p)} className="rounded-full border border-jcc-border bg-jcc-navy px-2.5 py-1 text-[12px] hover:border-jcc-accent/60">
                <b className="tabular-nums text-white">{f.score}/{f.wicket}</b> <span className="text-jcc-text-muted">{f.name}, {f.over} ov</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-jcc-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-jcc-navy-light text-[10px] uppercase tracking-[0.12em] text-jcc-text-muted">
              <th className={thL}>Bowler</th>
              <th className={th}>O</th>
              <th className={th}>M</th>
              <th className={th}>R</th>
              <th className={th}>W</th>
              <th className={th}>Econ</th>
              <th className={th}>Dots</th>
              <th className={th}>Wd</th>
              <th className={th}>Nb</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowling.map((r) => (
              <tr key={r.p} className="border-t border-jcc-border">
                <td className="whitespace-nowrap px-3 py-2 text-left"><Name p={r.p} name={r.name} onOpen={onOpen} /></td>
                <td className={td}>{ov(r.balls)}</td>
                <td className={td}>{r.mdn}</td>
                <td className={td}>{r.runs}</td>
                <td className={`${td} font-bold ${r.wk ? "text-white" : ""}`}>{r.wk}</td>
                <td className={td}>{f2(r.econ)}</td>
                <td className={td}>{r.dots}</td>
                <td className={td}>{r.wd}</td>
                <td className={td}>{r.nb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatchScorecard({
  data,
  matchId,
  onClose,
  onOpenPlayer,
}: {
  data: CardData;
  matchId: string;
  onClose: () => void;
  onOpenPlayer: (p: number) => void;
}) {
  const sc = useMemo(() => matchScorecard(data, matchId), [data, matchId]);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!sc) return null;
  const { match, innings } = sc;
  const mom = manOfTheMatch(data).get(data.matches.findIndex((x) => x.id === matchId));
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
  const result = match.winner ? `${match.winner} won by ${match.winBy}` : "Match tied";

  // Highlights: top score and best figures on each side.
  const all = innings.flatMap((i) => i.batting.map((b) => ({ ...b, team: i.team })));
  const top = [...all].sort((a, b) => b.runs - a.runs || a.balls - b.balls)[0];
  const spells = innings.flatMap((i) => i.bowling.map((b) => ({ ...b, team: innings.find((x) => x.inning !== i.inning)?.team ?? "" })));
  const best = [...spells].sort((a, b) => b.wk - a.wk || a.runs - b.runs)[0];
  const sixes = all.reduce((s, b) => s + b.s6, 0);
  const fours = all.reduce((s, b) => s + b.f4, 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#0D1728]/80 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Scorecard: ${match.teamA} v ${match.teamB}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-jcc-navy shadow-2xl">
        {/* Header band */}
        <div className="relative bg-jcc-blue px-5 pb-5 pt-5 text-[#FCFBF8] sm:px-7">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-jcc-accent/20 blur-3xl" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-[#FCFBF8]/70 hover:bg-white/10 hover:text-[#FCFBF8]"><X size={18} /></button>
          <p className="relative text-[10.5px] font-semibold uppercase tracking-[0.2em] text-jcc-accent-highlight">
            Season {match.season} · {fmtDate(match.date)} · {match.venue}{match.overs !== 7 ? ` · ${match.overs} overs` : ""}
          </p>
          <div className="relative mt-3 space-y-2">
            {innings.map((i) => {
              const won = match.winner === i.team;
              return (
                <div key={i.inning} className="flex items-center gap-3">
                  <Logo team={i.team} size={30} />
                  <span className={`flex-1 truncate font-heading text-xl font-bold sm:text-2xl ${won ? "text-[#FCFBF8]" : "text-[#FCFBF8]/60"}`}>{i.team}</span>
                  <span className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${won ? "text-[#FCFBF8]" : "text-[#FCFBF8]/60"}`}>
                    {i.runs}/{i.wickets} <span className="text-sm font-semibold text-[#FCFBF8]/55">({ov(i.balls)})</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="relative mt-3 font-semibold text-jcc-accent-highlight">{result}</p>
        </div>

        <div className="p-4 sm:p-6">
          {mom && (
            <div className="relative mb-5 overflow-hidden rounded-2xl border border-jcc-accent/50 bg-gradient-to-br from-jcc-accent/15 via-jcc-navy to-jcc-navy p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-jcc-accent-highlight to-jcc-accent-dark text-jcc-seam shadow-[0_8px_20px_-8px_rgba(212,175,55,0.8)]">
                  <Trophy size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-jcc-accent-dark">Player of the Match</p>
                  <button onClick={() => onOpenPlayer(mom.p)} className="mt-0.5 text-left font-heading text-2xl font-bold leading-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 hover:underline">
                    {data.players[mom.p]}
                  </button>
                  <p className="text-[13px] text-jcc-text-muted">
                    {mom.team} · <b className="text-white">{mom.line}</b>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {mom.impact.bat !== 0 && <span className="rounded-full bg-[#2B59C3]/10 px-2 py-0.5 font-semibold text-[#1F449A]">Bat {signed(mom.impact.bat)}</span>}
                    {mom.impact.bowl !== 0 && <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 font-semibold text-emerald-800">Bowl {signed(mom.impact.bowl)}</span>}
                    {mom.impact.field !== 0 && <span className="rounded-full bg-jcc-accent/15 px-2 py-0.5 font-semibold text-jcc-accent-dark">Field {signed(mom.impact.field)}</span>}
                    <span className="rounded-full bg-jcc-navy-light px-2 py-0.5 font-semibold text-white">Match impact {signed(mom.score)}{mom.winner ? " (winning side ×1.3)" : ""}</span>
                  </div>
                </div>
              </div>
              {mom.runnerUp && (
                <p className="mt-3 border-t border-jcc-border pt-2.5 text-[12px] text-jcc-text-muted">
                  Runner-up:{" "}
                  <button onClick={() => onOpenPlayer(mom.runnerUp!.p)} className="font-semibold text-white hover:text-jcc-accent-dark">{data.players[mom.runnerUp.p]}</button>
                  {" "}({mom.runnerUp.team}) · {mom.runnerUp.line} · {signed(mom.runnerUp.score)}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-snug text-jcc-text-muted">
                Decided from the numbers: runs and wickets above what this match&apos;s scoring rate would give an average player, with a 1.3× weight on the winning side.
              </p>
            </div>
          )}
          {/* Highlights */}
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-jcc-border bg-jcc-border sm:grid-cols-4">
            {top && (
              <button onClick={() => onOpenPlayer(top.p)} className="bg-jcc-navy px-3.5 py-3 text-left hover:bg-jcc-navy-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcc-text-muted">Top score</div>
                <div className="font-heading text-xl font-bold text-white">{top.runs}{top.out ? "" : "*"} <span className="text-sm text-jcc-text-muted">({top.balls})</span></div>
                <div className="truncate text-[11.5px] text-jcc-text-muted">{top.name}</div>
              </button>
            )}
            {best && (
              <button onClick={() => onOpenPlayer(best.p)} className="bg-jcc-navy px-3.5 py-3 text-left hover:bg-jcc-navy-light">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcc-text-muted">Best bowling</div>
                <div className="font-heading text-xl font-bold text-white">{best.wk}/{best.runs} <span className="text-sm text-jcc-text-muted">({ov(best.balls)})</span></div>
                <div className="truncate text-[11.5px] text-jcc-text-muted">{best.name}</div>
              </button>
            )}
            <div className="bg-jcc-navy px-3.5 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcc-text-muted">Boundaries</div>
              <div className="font-heading text-xl font-bold text-white">{fours + sixes}</div>
              <div className="text-[11.5px] text-jcc-text-muted">{fours} fours · {sixes} sixes</div>
            </div>
            <div className="bg-jcc-navy px-3.5 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcc-text-muted">Run rates</div>
              <div className="font-heading text-xl font-bold text-white">{innings.map((i) => f2(i.balls ? (6 * i.runs) / i.balls : null)).join(" · ")}</div>
              <div className="text-[11.5px] text-jcc-text-muted">1st · 2nd innings</div>
            </div>
          </div>

          {/* Innings tabs */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto" role="tablist">
            {innings.map((i, k) => (
              <button
                key={i.inning}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  tab === k ? "border-jcc-blue bg-jcc-blue text-[#FCFBF8]" : "border-jcc-border text-jcc-text-muted hover:text-white"
                }`}
              >
                <Logo team={i.team} size={16} />
                {i.team} {i.runs}/{i.wickets}
                <span className={tab === k ? "text-[#FCFBF8]/60" : "opacity-60"}>{k === 0 ? "1st inns" : "2nd inns"}</span>
              </button>
            ))}
          </div>
          {innings[tab] && <Innings inn={innings[tab]} onOpen={onOpenPlayer} />}
          <p className="mt-4 text-xs text-jcc-text-muted">
            From the CricHeroes scorecard (match {match.id}). Batters who didn&apos;t bat aren&apos;t in the export. Tap a name for that player&apos;s cards.
          </p>
        </div>
      </div>
    </div>
  );
}
