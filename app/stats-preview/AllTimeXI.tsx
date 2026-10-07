"use client";

import { useMemo, useState } from "react";
import { Hand, Crosshair, Swords, Shield, Target, ChevronDown } from "lucide-react";
import { allTimeXI, f2, type CardData, type XIRole } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";

const PERIODS = [
  { key: "all", label: "All-time", seasons: [2, 3] },
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
] as const;

const ROLE: Record<XIRole, { icon: typeof Hand; short: string }> = {
  Wicketkeeper: { icon: Hand, short: "WK" },
  Opener: { icon: Target, short: "OPEN" },
  "Middle order": { icon: Shield, short: "MID" },
  "All-rounder": { icon: Swords, short: "AR" },
  Bowler: { icon: Crosshair, short: "BOWL" },
};

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n))}`;

function ImpactBar({ bat, bowl, field, max }: { bat: number; bowl: number; field: number; max: number }) {
  // Positive contributions stack to the right; negatives are shown in the legend, not the bar.
  const seg = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-jcc-navy-light">
      <div style={{ width: seg(bat), background: "#2B59C3" }} />
      <div style={{ width: seg(bowl), background: "#1A7A5E" }} />
      <div style={{ width: seg(field), background: "#B98419" }} />
    </div>
  );
}

export default function AllTimeXI({ data, onOpenPlayer }: { data: CardData; onOpenPlayer: (p: number, card?: string) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const [showMethod, setShowMethod] = useState(false);
  const cur = PERIODS.find((x) => x.key === period)!;
  const r = useMemo(() => allTimeXI(data, [...cur.seasons]), [data, cur]);
  const names = data.players;
  const max = Math.max(1, ...r.xi.map((q) => Math.max(0, q.impact.bat) + Math.max(0, q.impact.bowl) + Math.max(0, q.impact.field)));
  const title = period === "all" ? "JCC All-Time XI" : `${cur.label} XI`;
  const count = (role: XIRole) => r.xi.filter((q) => q.role === role).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PERIODS.map((x) => (
          <button
            key={x.key}
            onClick={() => setPeriod(x.key)}
            aria-pressed={period === x.key}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              period === x.key ? "border-jcc-blue bg-jcc-blue text-[#FCFBF8]" : "border-jcc-border bg-jcc-navy text-jcc-text-muted hover:text-white"
            }`}
          >
            {x.label}
          </button>
        ))}
        <span className="text-xs text-jcc-text-muted">Picked by the numbers alone. Tap a player for their cards.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Team sheet */}
        <div className="relative overflow-hidden rounded-3xl bg-jcc-blue p-5 text-[#FCFBF8] shadow-[0_24px_48px_-24px_rgba(13,23,40,0.6)] sm:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-jcc-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-[#3B6FC4]/25 blur-3xl" />
          <div className="relative">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-jcc-accent-highlight">Jaipur Cricket Circle · Team sheet</p>
            <h3 className="mt-1 font-heading text-4xl font-bold leading-none text-[#FCFBF8]">{title}</h3>
            <ol className="mt-5 divide-y divide-white/10">
              {r.xi.map((q, i) => {
                const R = ROLE[q.role];
                return (
                  <li key={q.p}>
                    <button onClick={() => onOpenPlayer(q.p)} className="group grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 py-2.5 text-left">
                      <span className="font-heading text-xl font-bold tabular-nums text-jcc-accent-highlight/80">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: teamByName(q.team)?.primary ?? "#A3ABB8" }} />
                          <span className="truncate text-[15px] font-semibold text-[#FCFBF8] decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[q.p]}</span>
                          {q.captain && <span className="rounded bg-jcc-accent px-1.5 text-[10px] font-extrabold text-jcc-seam">C</span>}
                          {q.vice && <span className="rounded border border-jcc-accent px-1.5 text-[10px] font-extrabold text-jcc-accent-highlight">VC</span>}
                          {q.role === "Wicketkeeper" && <span className="rounded border border-white/30 px-1.5 text-[10px] font-extrabold text-[#FCFBF8]/80">WK</span>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#FCFBF8]/60">
                          <R.icon size={12} /> {q.role} · {q.team}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-heading text-lg font-bold tabular-nums text-[#FCFBF8]">{signed(q.impact.total)}</span>
                        <span className="block text-[9.5px] uppercase tracking-wider text-[#FCFBF8]/50">impact</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {r.twelfth && (
              <button onClick={() => onOpenPlayer(r.twelfth!.p)} className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-white/20 px-3 py-2 text-left text-[13px] hover:border-jcc-accent/60">
                <span><span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-jcc-accent-highlight">12th man</span><span className="font-semibold text-[#FCFBF8]">{names[r.twelfth.p]}</span> <span className="text-[#FCFBF8]/55">· {r.twelfth.team}</span></span>
                <span className="font-heading font-bold tabular-nums text-[#FCFBF8]">{signed(r.twelfth.impact.total)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-jcc-border bg-jcc-navy p-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">Balance</h4>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              {(["Opener", "Middle order", "Wicketkeeper", "All-rounder", "Bowler"] as XIRole[]).map((role) => {
                const R = ROLE[role];
                return (
                  <div key={role} className="rounded-xl bg-jcc-navy-light px-1 py-2.5">
                    <R.icon size={16} className="mx-auto text-jcc-accent-dark" />
                    <div className="mt-1 font-heading text-2xl font-bold leading-none text-white">{count(role)}</div>
                    <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-wider text-jcc-text-muted">{R.short}</div>
                  </div>
                );
              })}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
              <div><dt className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Bowling options</dt><dd className="font-heading text-xl font-bold text-white">{r.method.bowlingOptions}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Batting impact</dt><dd className="font-heading text-xl font-bold text-white">{signed(r.totals.bat)}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Bowling impact</dt><dd className="font-heading text-xl font-bold text-white">{signed(r.totals.bowl)}</dd></div>
            </dl>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Players by team</div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full">
                {r.totals.teams.map((t) => <div key={t.team} title={`${t.team} ${t.n}`} style={{ width: `${(100 * t.n) / 11}%`, background: teamByName(t.team)?.primary ?? "#A3ABB8" }} />)}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-jcc-text-muted">
                {r.totals.teams.map((t) => <span key={t.team} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: teamByName(t.team)?.primary ?? "#A3ABB8" }} />{t.team} {t.n}</span>)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-jcc-border bg-jcc-navy p-5">
            <button onClick={() => setShowMethod((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={showMethod}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">How the XI is picked</h4>
              <ChevronDown size={16} className={`text-jcc-text-muted transition ${showMethod ? "rotate-180" : ""}`} />
            </button>
            <p className="mt-2 text-[13px] leading-relaxed text-white">
              Every player gets one <b>impact score</b>, in runs, for what he added above a league-average player given the same chances. The side is then filled slot by slot from the highest scores.
            </p>
            {showMethod && (
              <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-jcc-text-muted">
                <li><b className="text-white">Batting:</b> runs, minus what an average batter scores off the same balls ({r.method.lrpb.toFixed(2)} a ball), minus {r.method.W.toFixed(1)} runs for each dismissal beyond the league rate (one every {r.method.lbpd.toFixed(1)} balls).</li>
                <li><b className="text-white">Bowling:</b> runs saved against the league ({(r.method.wrpb * 6).toFixed(2)} an over), plus {r.method.W.toFixed(1)} runs for each wicket above the league rate (one every {r.method.wbpw.toFixed(1)} balls).</li>
                <li><b className="text-white">Wicket value:</b> {r.method.W.toFixed(1)} runs, half a league-average innings, the same for batters and bowlers.</li>
                <li><b className="text-white">Fielding:</b> {(r.method.W / 4).toFixed(1)} runs for each catch, stumping or run out.</li>
                <li><b className="text-white">Eligible:</b> {r.method.minMatches}+ matches ({r.method.pool} players).</li>
                <li><b className="text-white">Slots, in order:</b> wicketkeeper (best total, needs keeping dismissals) · 2 openers (best batting, bat at 1 or 2) · 2 all-rounders (best bat + bowl, 30+ balls in both) · 4 bowlers (best bowling) · 2 middle order (best batting left). Captain and vice-captain are the two highest totals.</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Picks */}
      <h4 className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">Why each player is in</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.xi.map((q) => {
          const R = ROLE[q.role];
          return (
            <div key={q.p} className="rounded-2xl border border-jcc-border bg-jcc-navy p-4">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onOpenPlayer(q.p)} className="min-w-0 text-left">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-jcc-navy-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-jcc-accent-dark"><R.icon size={11} />{q.role}</span>
                  <div className="mt-1.5 truncate font-heading text-lg font-bold text-white hover:text-jcc-accent-dark">
                    {names[q.p]} {q.captain && <span className="text-jcc-accent-dark">(c)</span>}{q.vice && <span className="text-jcc-accent-dark">(vc)</span>}
                  </div>
                  <div className="text-[11.5px] text-jcc-text-muted">{q.team} · {q.matches} matches</div>
                </button>
                <span className="font-heading text-2xl font-bold tabular-nums text-white">{signed(q.impact.total)}</span>
              </div>
              <div className="mt-3"><ImpactBar {...q.impact} max={max} /></div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-jcc-text-muted">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#2B59C3]" />Bat {signed(q.impact.bat)}</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#1A7A5E]" />Bowl {signed(q.impact.bowl)}</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#B98419]" />Field {signed(q.impact.field)}</span>
              </div>
              <p className="mt-2.5 text-[12.5px] text-white">{q.line}</p>
              <p className="mt-1 text-[12px] leading-snug text-jcc-text-muted">{q.why}</p>
              {q.alternatives.length > 0 && (
                <p className="mt-2 border-t border-jcc-border pt-2 text-[11.5px] text-jcc-text-muted">
                  <b className="text-white">Close calls:</b>{" "}
                  {q.alternatives.map((a, i) => (
                    <span key={a.p}>
                      {i > 0 && ", "}
                      <button onClick={() => onOpenPlayer(a.p)} className="hover:text-jcc-accent-dark">{names[a.p]}</button> ({signed(a.score)})
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-jcc-text-muted">
        Box cricket sides are usually smaller than eleven; the XI is the best-balanced eleven the numbers support. League economy {f2(r.method.wrpb * 6)} runs an over.
      </p>
    </div>
  );
}
