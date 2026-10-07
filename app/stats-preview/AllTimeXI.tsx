"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Hand, Crosshair, Swords, Shield, Target, ChevronDown } from "lucide-react";
import { allTimeXI, f2, type CardData, type XIRole } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import Jaali from "./Jaali";
import { Avatar } from "./Avatar";
import { usePill } from "./motion";

const PERIODS = [
  { key: "all", label: "All-time", seasons: [2, 3] },
  { key: "s3", label: "Season 3", seasons: [3] },
  { key: "s2", label: "Season 2", seasons: [2] },
] as const;

const ROLE: Record<XIRole, { icon: typeof Hand; short: string; group: string }> = {
  Opener: { icon: Target, short: "OPEN", group: "Openers" },
  Wicketkeeper: { icon: Hand, short: "WK", group: "Wicketkeeper" },
  "Middle order": { icon: Shield, short: "MID", group: "Middle order" },
  "All-rounder": { icon: Swords, short: "AR", group: "All-rounders" },
  Bowler: { icon: Crosshair, short: "BOWL", group: "Bowlers" },
};
const ROLE_ORDER: XIRole[] = ["Opener", "Wicketkeeper", "Middle order", "All-rounder", "Bowler"];

/** Impact components, kept inside the JCC palette. */
const IMPACT = { bat: "#12233F", bowl: "#D4AF37", field: "#8A94A6" } as const;

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n))}`;
const teamColor = (t: string) => teamByName(t)?.primary ?? "#A3ABB8";

function ImpactBar({ bat, bowl, field, max }: { bat: number; bowl: number; field: number; max: number }) {
  // Positive contributions stack to the right; negatives are shown in the legend, not the bar.
  const seg = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-jcc-navy-light">
      <div style={{ width: seg(bat), background: IMPACT.bat }} />
      <div style={{ width: seg(bowl), background: IMPACT.bowl }} />
      <div style={{ width: seg(field), background: IMPACT.field }} />
    </div>
  );
}

export default function AllTimeXI({ data, onOpenPlayer }: { data: CardData; onOpenPlayer: (p: number, card?: string) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("all");
  const [showMethod, setShowMethod] = useState(false);
  const { box, pill } = usePill(period);
  const cur = PERIODS.find((x) => x.key === period)!;
  const r = useMemo(() => allTimeXI(data, [...cur.seasons]), [data, cur]);
  const names = data.players;
  const max = Math.max(1, ...r.xi.map((q) => Math.max(0, q.impact.bat) + Math.max(0, q.impact.bowl) + Math.max(0, q.impact.field)));
  const title = period === "all" ? "JCC All-Time XI" : `${cur.label} XI`;
  const order = new Map(r.xi.map((q, i) => [q.p, i + 1]));
  const groups = ROLE_ORDER.map((role) => ({ role, players: r.xi.filter((q) => q.role === role) })).filter((g) => g.players.length);

  return (
    <div data-apanel>
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
        <p className="font-mono text-[11px] text-jcc-text-muted">Picked by the numbers alone · tap a player for their cards</p>
      </div>

      {/* ── The team sheet: a lineup, grouped by role ── */}
      <div className="print-grain heritage-frame theme-static-dark section-bg-royal relative overflow-hidden rounded-[2rem] px-5 py-10 md:px-12 md:py-14">
        <Jaali />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-14">
          <div className="rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-jcc-accent-highlight">Jaipur Cricket Circle · Team sheet</p>
            <h3 className="mt-3 font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-[#FCFBF8] md:text-6xl">{title}</h3>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-[#FCFBF8]/15 pt-6 lg:grid-cols-1 lg:gap-6">
              {([
                ["Batting impact", signed(r.totals.bat)],
                ["Bowling impact", signed(r.totals.bowl)],
                ["Bowling options", String(r.method.bowlingOptions)],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">{k}</dt>
                  <dd className="mt-1 font-heading text-4xl font-bold tracking-[-0.04em] tabular-nums text-[#FCFBF8]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">Players by club</div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
                {r.totals.teams.map((t) => {
                  const team = teamByName(t.team);
                  return (
                    <span key={t.team} className="inline-flex items-center gap-2" title={t.team}>
                      {team && <Image src={team.logo} alt={t.team} width={28} height={28} className="h-7 w-7 object-contain" />}
                      <span className="font-heading text-2xl font-bold tabular-nums text-[#FCFBF8]">{t.n}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#FCFBF8]/10 rounded-3xl bg-jcc-blue/90 px-5 py-6 ring-1 ring-[#FCFBF8]/10 md:px-8">
            {groups.map((g) => {
              const R = ROLE[g.role];
              return (
                <div key={g.role} className="grid gap-4 py-6 first:pt-0 last:pb-0 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-start">
                  <div className="flex items-center gap-2 text-jcc-accent-highlight sm:pt-8">
                    <R.icon size={14} />
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">{R.group}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-6">
                    {g.players.map((q) => (
                      <button key={q.p} onClick={() => onOpenPlayer(q.p)} className="group w-[104px] text-center">
                        <span className="relative mx-auto block w-fit">
                          <Avatar
                            name={names[q.p]}
                            size={84}
                            ring={q.captain || q.vice ? "#D4AF37" : teamColor(q.team)}
                            className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-105"
                          />
                          <span className="absolute -left-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-jcc-blue-deep font-mono text-[11px] font-semibold text-[#FCFBF8] ring-1 ring-[#FCFBF8]/20">
                            {order.get(q.p)}
                          </span>
                          {(q.captain || q.vice) && (
                            <span className={`absolute -bottom-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[10px] font-bold ${q.captain ? "bg-jcc-accent text-jcc-seam" : "bg-jcc-blue-deep text-jcc-accent-highlight ring-1 ring-jcc-accent"}`}>
                              {q.captain ? "C" : "VC"}
                            </span>
                          )}
                        </span>
                        <span className="mt-3 block truncate text-[14px] font-semibold tracking-tight text-[#FCFBF8] decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[q.p]}</span>
                        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[#FCFBF8]/70">{q.team}</span>
                        <span className="mt-1 block font-heading text-xl font-bold tabular-nums tracking-tight text-jcc-accent-highlight">{signed(q.impact.total)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {r.twelfth && (
              <div className="grid gap-4 py-6 last:pb-0 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#FCFBF8]/70">12th man</span>
                <button onClick={() => onOpenPlayer(r.twelfth!.p)} className="group flex items-center gap-4 text-left">
                  <span className="rounded-full p-[3px] ring-1 ring-dashed ring-[#FCFBF8]/40" style={{ outline: "1px dashed rgba(252,251,248,0.35)", outlineOffset: 3 }}>
                    <Avatar name={names[r.twelfth.p]} size={52} className="opacity-80 transition group-hover:opacity-100" />
                  </span>
                  <span>
                    <span className="block font-semibold text-[#FCFBF8]">{names[r.twelfth.p]}</span>
                    <span className="block font-mono text-[11px] text-[#FCFBF8]/75">{r.twelfth.team} · {signed(r.twelfth.impact.total)}</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Why each player is in ── */}
      <div className="mt-16 flex flex-wrap items-end justify-between gap-4 border-t border-jcc-blue/80 pt-5">
        <h4 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">Why each player is in</h4>
        <div className="flex flex-wrap gap-x-4 font-mono text-[10.5px] uppercase tracking-[0.12em] text-jcc-text-muted">
          {(["bat", "bowl", "field"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full" style={{ background: IMPACT[k] }} />
              {k === "bat" ? "Batting" : k === "bowl" ? "Bowling" : "Fielding"}
            </span>
          ))}
        </div>
      </div>
      <ol>
        {r.xi.map((q, i) => {
          const R = ROLE[q.role];
          return (
            <li key={q.p} data-arow className="grid gap-x-8 gap-y-3 border-b border-jcc-border py-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_96px]">
              <button onClick={() => onOpenPlayer(q.p)} className="group flex min-w-0 items-center gap-4 text-left">
                <span className="w-6 font-mono text-xs text-jcc-text-muted">{String(i + 1).padStart(2, "0")}</span>
                <Avatar name={names[q.p]} size={48} ring={q.captain || q.vice ? "#D4AF37" : teamColor(q.team)} />
                <span className="min-w-0">
                  <span className="block truncate font-heading text-lg font-bold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">
                    {names[q.p]} {q.captain && <span className="text-jcc-accent-dark">(c)</span>}
                    {q.vice && <span className="text-jcc-accent-dark">(vc)</span>}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-jcc-text-muted">
                    <R.icon size={11} /> {q.role} · {q.matches} m
                  </span>
                </span>
              </button>
              <div className="min-w-0">
                <ImpactBar {...q.impact} max={max} />
                <p className="mt-3 text-[13.5px] font-medium text-white">{q.line}</p>
                <p className="mt-1 text-[13px] leading-snug text-jcc-text-muted">{q.why}</p>
                {q.alternatives.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-jcc-text-muted">
                    Close calls ·{" "}
                    {q.alternatives.map((a, k) => (
                      <span key={a.p}>
                        {k > 0 && ", "}
                        <button onClick={() => onOpenPlayer(a.p)} className="text-white underline-offset-2 hover:underline">{names[a.p]}</button> {signed(a.score)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="font-heading text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums text-white">{signed(q.impact.total)}</div>
                <div className="mt-1.5 font-mono text-[10px] text-jcc-text-muted">
                  {signed(q.impact.bat)} · {signed(q.impact.bowl)} · {signed(q.impact.field)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Method ── */}
      <div className="mt-12 border-t border-jcc-blue/80 pt-5">
        <button onClick={() => setShowMethod((v) => !v)} className="flex w-full items-center justify-between text-left" aria-expanded={showMethod}>
          <span className={LABEL}>How the XI is picked</span>
          <ChevronDown size={16} className={`text-jcc-text-muted transition ${showMethod ? "rotate-180" : ""}`} />
        </button>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-white">
          Every player gets one <b>impact score</b>, in runs, for what he added above a league-average player given the same chances. The side is then filled slot by slot from the highest scores.
        </p>
        {showMethod && (
          <ul className="mt-4 max-w-3xl space-y-2 text-[13px] leading-relaxed text-jcc-text-muted">
            <li><b className="text-white">Batting:</b> runs, minus what an average batter scores off the same balls ({r.method.lrpb.toFixed(2)} a ball), minus {r.method.W.toFixed(1)} runs for each dismissal beyond the league rate (one every {r.method.lbpd.toFixed(1)} balls).</li>
            <li><b className="text-white">Bowling:</b> runs saved against the league ({(r.method.wrpb * 6).toFixed(2)} an over), plus {r.method.W.toFixed(1)} runs for each wicket above the league rate (one every {r.method.wbpw.toFixed(1)} balls).</li>
            <li><b className="text-white">Wicket value:</b> {r.method.W.toFixed(1)} runs, half a league-average innings, the same for batters and bowlers.</li>
            <li><b className="text-white">Fielding:</b> {(r.method.W / 4).toFixed(1)} runs for each catch, stumping or run out.</li>
            <li><b className="text-white">Eligible:</b> {r.method.minMatches}+ matches ({r.method.pool} players).</li>
            <li><b className="text-white">Slots, in order:</b> wicketkeeper (best total, needs keeping dismissals) · 2 openers (best batting, bat at 1 or 2) · 2 all-rounders (best bat + bowl, 30+ balls in both) · 4 bowlers (best bowling) · 2 middle order (best batting left). Captain and vice-captain are the two highest totals.</li>
          </ul>
        )}
        <p className="mt-4 text-xs text-jcc-text-muted">
          Box cricket sides are usually smaller than eleven; the XI is the best-balanced eleven the numbers support. League economy {f2(r.method.wrpb * 6)} runs an over.
        </p>
      </div>
    </div>
  );
}
