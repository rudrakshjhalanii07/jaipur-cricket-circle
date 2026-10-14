"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Hand, Crosshair, Swords, Shield, Target, ChevronDown } from "lucide-react";
import { allTimeXI, f2, type CardData, type XIRole } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import Jaali from "@/components/Jaali";
import { Avatar } from "./Avatar";
import { usePill } from "./motion";
import { SectionShare, listCard, playerRow, usePhotoOf } from "./SectionShare";

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
  // Every tile's impact bar shares one scale, so bars compare across the XI.
  const tileMax = Math.max(1, ...r.xi.map((q) => Math.max(0, q.impact.bat) + Math.max(0, q.impact.bowl) + Math.max(0, q.impact.field)));
  const title = period === "all" ? "JCC All-Time XI" : `${cur.label} XI`;
  const groups = ROLE_ORDER.map((role) => ({ role, players: r.xi.filter((q) => q.role === role) })).filter((g) => g.players.length);
  const photoOf = usePhotoOf();
  // The team sheet as a story card: eleven rows in batting-card order.
  const share = () => [
    listCard({
      id: `xi-${period}`,
      label: title,
      kicker: "Jaipur Cricket Circle · Team sheet",
      title,
      max: 11,
      rows: groups.flatMap((g) =>
        g.players.map((q) =>
          playerRow(`${names[q.p]}${q.captain ? " (c)" : q.vice ? " (vc)" : ""}`, ROLE[q.role].short, q.line, photoOf(names[q.p]), q.team),
        ),
      ),
      hash: "analytics",
    }),
  ];

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
        <span className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[11px] text-jcc-text-muted">Picked by the numbers alone</p>
          <SectionShare build={share} fileBase={`jcc-${period === "all" ? "all-time" : period}-xi`} label="Share the XI" />
        </span>
      </div>

      {/* ── The team sheet: a header strip, then the eleven in batting order ── */}
      <div className="print-grain heritage-frame theme-static-dark section-bg-royal relative overflow-hidden rounded-[2rem] px-5 py-10 md:px-12 md:py-14">
        <Jaali />
        <div className="relative flex flex-wrap items-end justify-between gap-x-12 gap-y-8 border-b border-[#FCFBF8]/12 pb-10">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-jcc-accent-highlight">Jaipur Cricket Circle · Team sheet</p>
            <h3 className="mt-3 font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-[#FCFBF8] md:text-6xl">{title}</h3>
          </div>
          <dl className="flex flex-wrap items-end gap-x-12 gap-y-6">
            {([
              ["Batting impact", signed(r.totals.bat)],
              ["Bowling impact", signed(r.totals.bowl)],
              ["Bowling options", String(r.method.bowlingOptions)],
            ] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">{k}</dt>
                <dd className="mt-1.5 font-heading text-3xl font-bold tracking-[-0.04em] tabular-nums text-[#FCFBF8] md:text-4xl">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">By club</dt>
              <dd className="mt-2 flex flex-wrap items-center gap-2.5">
                {r.totals.teams.map((t) => {
                  const team = teamByName(t.team);
                  return (
                    <span
                      key={t.team}
                      title={t.team}
                      className="inline-flex items-center gap-2.5 rounded-full bg-[#0D1728] py-1.5 pl-1.5 pr-4 ring-1"
                      style={{ boxShadow: `inset 0 0 0 1px ${teamColor(t.team)}66` }}
                    >
                      {team && (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FCFBF8]/[0.08]">
                          <Image src={team.logo} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
                        </span>
                      )}
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#FCFBF8]/80">{team?.shortName ?? t.team}</span>
                      <span className="font-heading text-xl font-bold tabular-nums text-[#FCFBF8]">{t.n}</span>
                    </span>
                  );
                })}
              </dd>
            </div>
          </dl>
        </div>

        <ol className="relative mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {r.xi.map((q, i) => {
            const R = ROLE[q.role];
            const lead = q.captain || q.vice;
            const team = teamByName(q.team);
            return (
              <li key={q.p} data-arow>
                <button
                  onClick={() => onOpenPlayer(q.p)}
                  className={`group relative flex h-full w-full flex-col items-center overflow-hidden rounded-3xl px-4 pb-7 pt-5 text-center ring-1 transition duration-500 hover:-translate-y-1 ${lead ? "bg-[#1C2F52] ring-jcc-accent/60 shadow-[0_18px_40px_-24px_rgba(212,175,55,0.6)]" : "bg-jcc-blue/90 ring-[#FCFBF8]/10 hover:ring-[#FCFBF8]/30"}`}
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: teamColor(q.team) }} />
                  {/* Backdrop: the team's colour washing down from the top, its crest as a watermark. */}
                  <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${teamColor(q.team)}55 0%, transparent 70%), linear-gradient(160deg, rgba(252,251,248,0.06) 0%, transparent 40%)` }} />
                  {team && (
                    <Image
                      src={team.logo}
                      alt=""
                      aria-hidden
                      width={180}
                      height={180}
                      className="pointer-events-none absolute -bottom-6 -right-8 w-40 rotate-[-12deg] object-contain opacity-[0.1] transition duration-700 group-hover:rotate-[-4deg] group-hover:opacity-[0.16]"
                    />
                  )}
                  <span className="relative flex w-full items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-[#FCFBF8]/60">{String(i + 1).padStart(2, "0")}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FCFBF8]/[0.08] px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-jcc-accent-highlight">
                      <R.icon size={10} /> {R.short}
                    </span>
                  </span>
                  <span className="relative mt-5 block">
                    <Avatar name={names[q.p]} size={96} ring={lead ? "#D4AF37" : teamColor(q.team)} className="transition-transform duration-500 group-hover:scale-105" />
                    {lead && (
                      <span className={`absolute -bottom-1 -right-1 grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-mono text-[10.5px] font-bold ${q.captain ? "bg-jcc-accent text-jcc-seam" : "bg-jcc-blue-deep text-jcc-accent-highlight ring-1 ring-jcc-accent"}`}>
                        {q.captain ? "C" : "VC"}
                      </span>
                    )}
                  </span>
                  <span className="relative mt-5 block w-full truncate text-[15px] font-semibold tracking-tight text-[#FCFBF8] decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[q.p]}</span>
                  <span className="relative mt-1.5 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#FCFBF8]/70">
                    {team && <Image src={team.logo} alt="" width={16} height={16} className="h-4 w-4 object-contain" />}
                    <span className="truncate">{q.team}</span>
                  </span>
                  <span className="relative mt-3 line-clamp-2 min-h-[2.5em] text-[12px] leading-snug text-[#FCFBF8]/80">{q.line}</span>
                  <span className="relative mt-auto w-full pt-5">
                    <span className="flex items-baseline justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">Impact</span>
                      <span className="font-heading text-2xl font-bold tabular-nums tracking-tight text-jcc-accent-highlight">{signed(q.impact.total)}</span>
                    </span>
                    <span className="mt-2 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-[#FCFBF8]/10">
                      {(["bat", "bowl", "field"] as const).map((k) => (
                        <span key={k} style={{ width: `${Math.max(0, (q.impact[k] / tileMax) * 100)}%`, background: k === "bat" ? "#F3C96A" : k === "bowl" ? "#A78BFA" : "#6EE7B7" }} />
                      ))}
                    </span>
                    <span className="mt-1.5 flex justify-between font-mono text-[9.5px] tabular-nums text-[#FCFBF8]/65">
                      <span>bat {signed(q.impact.bat)}</span>
                      <span>bowl {signed(q.impact.bowl)}</span>
                      <span>fld {signed(q.impact.field)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {r.twelfth && (
            <li data-arow>
              <button
                onClick={() => onOpenPlayer(r.twelfth!.p)}
                className="group flex h-full w-full flex-col items-center rounded-3xl border border-dashed border-[#FCFBF8]/30 px-4 pb-7 pt-5 text-center transition duration-500 hover:-translate-y-1 hover:border-[#FCFBF8]/60"
              >
                <span className="w-full text-right font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#FCFBF8]/70">12th man</span>
                <span className="mt-5 block opacity-80 transition group-hover:opacity-100">
                  <Avatar name={names[r.twelfth.p]} size={96} />
                </span>
                <span className="mt-5 block w-full truncate text-[15px] font-semibold tracking-tight text-[#FCFBF8]">{names[r.twelfth.p]}</span>
                <span className="mt-1.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#FCFBF8]/70">{r.twelfth.team}</span>
                <span className="mt-auto pt-5 font-heading text-2xl font-bold tabular-nums tracking-tight text-[#FCFBF8]/70">{signed(r.twelfth.impact.total)}</span>
              </button>
            </li>
          )}
        </ol>
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
