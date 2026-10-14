"use client";

// Captains: every skipper's record. Results, batting first against chasing,
// the toss and what it was worth, their own form with the armband, and how
// they fare against each side, plus toss awards. Captains come from the
// scorecards' "(c)" tags (and the admin for later matches); the toss is only
// recorded for matches scored in the admin, so toss figures cover those.

import { useMemo, useState } from "react";
import Image from "next/image";
import { Coins, Crown, Frown, Percent, Shield, Swords, Target, Trophy } from "lucide-react";
import type { CardData } from "@/lib/scorecard-dashboard/profile";
import type { CaptaincyRow } from "@/lib/scorecard-dashboard/captaincy.server";
import { teamByName } from "@/lib/teams";
import { Avatar, Portrait, usePhoto } from "./Avatar";
import { Emblem } from "./achievements";
import { Counter } from "./motion";
import { GOLD, PURPLE, SectionShare, listCard, playerRow, statCard, usePhotoOf } from "./SectionShare";
import { buildCaptains, captainAwards, played, type Rec } from "./captains";

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const teamColor = (t: string) => teamByName(t)?.primary ?? "#8A94A6";
const wl = (r: Rec) => `${r.w}–${r.l}${r.t ? `–${r.t}` : ""}`;

function Bar({ label, rec, color }: { label: string; rec: Rec; color: string }) {
  const n = played(rec);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-jcc-text-muted">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-white">{wl(rec)} <span className="text-jcc-text-muted">· {pct(rec.w, n)}%</span></span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-jcc-navy-light">
        <span style={{ width: `${pct(rec.w, n)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CaptainsTab({ data, seasons, captaincy, onOpenPlayer }: { data: CardData; seasons: number[]; captaincy: CaptaincyRow[]; onOpenPlayer: (p: number, card?: string) => void }) {
  const caps = useMemo(() => buildCaptains(data, seasons, captaincy), [data, seasons, captaincy]);
  const [focus, setFocus] = useState<number | null>(null);
  const names = data.players;
  const photoOf = usePhotoOf();
  const top = [...caps].sort((a, b) => b.all.w - a.all.w || pct(b.all.w, played(b.all)) - pct(a.all.w, played(a.all)))[0];
  const topHasPhoto = Boolean(usePhoto(top ? names[top.p] : null));
  const sel = caps.find((c) => c.p === focus) ?? caps[0];

  // Toss
  const tossers = caps.filter((c) => c.toss.won + c.toss.lost > 0);
  const T = tossers.reduce((s, c) => ({ won: s.won + c.toss.won, conv: s.conv + c.toss.wonThenWon, bat: s.bat + c.toss.bat, bowl: s.bowl + c.toss.bowl }), { won: 0, conv: 0, bat: 0, bowl: 0 });
  const AWARD_ICON: Record<string, typeof Crown> = { "Skipper Supreme": Crown, "Winning Habit": Shield, "Chase Captain": Target, "Fortress Captain": Shield, "Toss King": Coins, "Coin Whisperer": Percent, "Toss Converter": Trophy, "Toss Jinx": Frown };
  const awards = captainAwards(caps).map((a) => ({ ...a, icon: AWARD_ICON[a.label] ?? Crown }));

  if (!caps.length) return <p className="text-sm text-jcc-text-muted">No captains on record in this view yet.</p>;

  const share = () => [
    top &&
      statCard({
        id: "top", label: "Most wins", kicker: "Captains · most wins", title: `${names[top.p]} leads from the front`,
        value: String(top.all.w), unit: "wins as captain", colors: GOLD, name: names[top.p], photo: photoOf(names[top.p]), team: [...top.teams.keys()][0],
        facts: [{ label: "Record", value: wl(top.all) }, { label: "Win %", value: `${pct(top.all.w, played(top.all))}%` }, { label: "Best streak", value: String(top.streak) }], hash: "analytics",
      }),
    listCard({
      id: "board", label: "Captains", kicker: "Captains · the record", title: "Captains by wins",
      rows: [...caps].sort((a, b) => b.all.w - a.all.w).slice(0, 6).map((c) => playerRow(names[c.p], `${pct(c.all.w, played(c.all))}%`, `${wl(c.all)} · defended ${wl(c.first)} · chased ${wl(c.chase)}`, photoOf(names[c.p]), [...c.teams.keys()][0])),
      hash: "analytics",
    }),
    // The jinx stays off the share cards.
    ...awards.filter((a) => a.tone !== "warn").map((a) =>
      statCard({ id: a.label, label: a.label, kicker: `Toss award · ${a.label}`, title: `${names[a.p]}: ${a.label}`, value: a.value, unit: a.unit, colors: a.tone === "crown" ? GOLD : PURPLE, body: a.why, name: names[a.p], photo: photoOf(names[a.p]), team: a.team, hash: "analytics" }),
    ),
  ].filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div data-apanel>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-[13px] text-jcc-text-muted">Captains from the scorecards. The toss is recorded for {T.won} matches scored in the admin, so toss figures cover those.</p>
        <SectionShare build={share} fileBase="jcc-captains" label="Share captains" />
      </div>

      {/* ── Spread: the winningest captain ── */}
      {top && (
        <div className="grid border-y border-jcc-blue/80 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <button onClick={() => onOpenPlayer(top.p)} className="group relative min-h-[320px] overflow-hidden py-10 text-left lg:pr-12">
            {topHasPhoto && <Portrait name={names[top.p]} className="absolute inset-y-0 right-0 w-[55%]" />}
            <div className="relative">
              <span className="inline-flex items-center gap-2 text-jcc-accent-dark"><Crown size={14} /><span className={LABEL}>Most wins as captain</span></span>
              <div className="mt-8 flex items-end gap-3">
                <span className="font-heading text-[7rem] font-bold leading-[0.78] tracking-[-0.06em] tabular-nums md:text-[9rem]" style={{ backgroundImage: "linear-gradient(135deg,#F3C96A,#D4AF37 45%,#A97824)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  <Counter value={top.all.w} />
                </span>
                <span className={`${LABEL} pb-3`}>wins</span>
              </div>
              <div className="mt-6 font-heading text-3xl font-bold tracking-[-0.03em] text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[top.p]}</div>
              <div className="mt-1 font-mono text-[12px] text-jcc-text-muted">{wl(top.all)} · {pct(top.all.w, played(top.all))}% · best run {top.streak} straight</div>
            </div>
          </button>
          <dl className="grid grid-cols-2 content-center gap-x-8 gap-y-8 border-t border-jcc-border py-10 lg:border-l lg:border-t-0 lg:pl-12">
            {([
              ["Captains", String(caps.length)],
              ["Toss winners won", `${pct(T.conv, T.won)}%`],
              ["Chose to bowl", `${pct(T.bowl, T.bat + T.bowl)}%`],
              ["Tosses recorded", String(T.won)],
            ] as const).map(([k, v]) => (
              <div key={k}>
                <dd className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">{v}</dd>
                <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── Toss awards ── */}
      {awards.length > 0 && (
        <div className="mt-16">
          <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-3">
            <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">Captaincy &amp; toss awards</h3>
            <span className={LABEL}>Also in Achievements</span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {awards.map((a) => (
              <button key={a.label} onClick={() => onOpenPlayer(a.p)} className="group flex flex-col items-center text-center">
                <span className="transition duration-500 group-hover:-translate-y-1.5 group-hover:rotate-6">
                  <Emblem label={a.label} tone={a.tone} tier={a.tone === "warn" ? "banter" : "legendary"} size={88} icon={a.icon} />
                </span>
                <div className="mt-4 font-heading text-lg font-bold tracking-tight text-white">{a.label}</div>
                <div className="mt-1 font-heading text-3xl font-bold tabular-nums tracking-tight text-jcc-accent-dark">{a.value}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-jcc-text-muted">{a.unit}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Avatar name={names[a.p]} size={28} ring={teamColor(a.team)} />
                  <span className="text-sm font-semibold text-white">{names[a.p]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── The captains' table ── */}
      <div className="mt-16">
        <div className="flex items-end justify-between border-b border-jcc-blue/80 pb-3">
          <h3 className="font-heading text-3xl font-bold tracking-[-0.03em] text-white">Every captain</h3>
          <span className={LABEL}>Tap one for the full file</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className={LABEL}>
                {["Captain", "M", "W", "L", "T", "Win %", "Defending", "Chasing", "Toss won", "Won after toss", "Best streak"].map((h, i) => (
                  <th key={h} className={`py-3 font-medium ${i ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {caps.map((c) => {
                const n = played(c.all);
                const tosses = c.toss.won + c.toss.lost;
                const on = sel?.p === c.p;
                return (
                  <tr key={c.p} onClick={() => setFocus(c.p)} className={`cursor-pointer border-t border-jcc-border transition-colors ${on ? "bg-jcc-navy" : "hover:bg-jcc-navy/60"}`}>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-3">
                        <Avatar name={names[c.p]} size={36} ring={teamColor([...c.teams.keys()][0])} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-white">{names[c.p]}</span>
                          <span className="flex items-center gap-1">
                            {[...c.teams.keys()].map((t) => teamByName(t) && <Image key={t} src={teamByName(t)!.logo} alt={t} title={t} width={16} height={16} className="h-4 w-4 object-contain" />)}
                          </span>
                        </span>
                      </span>
                    </td>
                    {[n, c.all.w, c.all.l, c.all.t].map((v, i) => <td key={i} className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{v}</td>)}
                    <td className="py-3 text-right font-heading text-lg font-bold tabular-nums text-jcc-accent-dark">{pct(c.all.w, n)}%</td>
                    <td className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{wl(c.first)}</td>
                    <td className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{wl(c.chase)}</td>
                    <td className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{tosses ? `${c.toss.won}/${tosses}` : "–"}</td>
                    <td className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{c.toss.won ? `${pct(c.toss.wonThenWon, c.toss.won)}%` : "–"}</td>
                    <td className="py-3 text-right font-mono text-[13px] tabular-nums text-white">{c.streak}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── The full file on one captain ── */}
      {sel && (
        <div className="print-grain heritage-frame theme-static-dark section-bg-royal relative mt-12 overflow-hidden rounded-[2rem] px-5 py-8 md:px-10 md:py-10">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-[100px]" style={{ background: `${teamColor([...sel.teams.keys()][0])}55` }} />
          <div className="relative grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
            <button onClick={() => onOpenPlayer(sel.p)} className="group flex flex-col items-start text-left">
              <Avatar name={names[sel.p]} size={112} ring="#D4AF37" />
              <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-jcc-accent-highlight">Captain&apos;s file</p>
              <h4 className="mt-1 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-[#FCFBF8] decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[sel.p]}</h4>
              <p className="mt-2 text-[13px] text-[#FCFBF8]/75">{[...sel.teams.entries()].map(([t, n]) => `${t} (${n})`).join(" · ")}</p>
              <div className="mt-5 flex gap-1.5">
                {sel.recent.slice(-10).map((r, i) => (
                  <span key={i} title={r} className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[10px] font-bold ${r === "W" ? "bg-jcc-accent text-jcc-seam" : r === "L" ? "bg-[#FCFBF8]/15 text-[#FCFBF8]/80" : "border border-[#FCFBF8]/50 text-[#FCFBF8]"}`}>{r}</span>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-[#FCFBF8]/60">Last {Math.min(10, sel.recent.length)}, oldest → newest</p>
            </button>

            <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="space-y-4 rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10">
                <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight"><Shield size={13} /> Results</p>
                <Bar label="Overall" rec={sel.all} color="#D4AF37" />
                <Bar label="Batting first (defending)" rec={sel.first} color="#F59E0B" />
                <Bar label="Chasing" rec={sel.chase} color="#6E9BE6" />
                <div className="grid grid-cols-2 gap-4 border-t border-[#FCFBF8]/10 pt-4 text-[#FCFBF8]">
                  <div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">Biggest win by runs</div><div className="mt-1 font-heading text-2xl font-bold">{sel.bigRuns ? `${sel.bigRuns.n} runs` : "–"}</div>{sel.bigRuns && <div className="text-[11.5px] text-[#FCFBF8]/65">vs {sel.bigRuns.opp}</div>}</div>
                  <div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">Biggest chase win</div><div className="mt-1 font-heading text-2xl font-bold">{sel.bigWkts ? `${sel.bigWkts.n} wkts` : "–"}</div>{sel.bigWkts && <div className="text-[11.5px] text-[#FCFBF8]/65">vs {sel.bigWkts.opp}</div>}</div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10">
                <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight"><Coins size={13} /> The toss</p>
                {sel.toss.won + sel.toss.lost ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-[#FCFBF8]">
                      {([["Won", sel.toss.won], ["Lost", sel.toss.lost], ["Win %", `${pct(sel.toss.won, sel.toss.won + sel.toss.lost)}%`]] as const).map(([k, v]) => (
                        <div key={k}><div className="font-heading text-3xl font-bold tabular-nums">{v}</div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">{k}</div></div>
                      ))}
                    </div>
                    <div className="border-t border-[#FCFBF8]/10 pt-4 text-[13px] leading-relaxed text-[#FCFBF8]/80">
                      Won the toss and chose to bat {sel.toss.bat}, to bowl {sel.toss.bowl}.<br />
                      Won the match {sel.toss.wonThenWon} of {sel.toss.won} times after winning the toss{sel.toss.lost ? `, ${sel.toss.lostThenWon} of ${sel.toss.lost} after losing it` : ""}.
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[#FCFBF8]/70">No toss recorded for this captain&apos;s matches.</p>
                )}
              </div>

              <div className="space-y-4 rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10">
                <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight"><Target size={13} /> Own form with the armband</p>
                <div className="grid grid-cols-2 gap-4 text-[#FCFBF8]">
                  <div><div className="font-heading text-3xl font-bold tabular-nums">{sel.form.runs}</div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">runs · SR {sel.form.balls ? Math.round((100 * sel.form.runs) / sel.form.balls) : "–"}</div></div>
                  <div><div className="font-heading text-3xl font-bold tabular-nums">{sel.form.wk}</div><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#FCFBF8]/60">wickets · econ {sel.form.bowlBalls ? ((6 * sel.form.conceded) / sel.form.bowlBalls).toFixed(2) : "–"}</div></div>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl bg-jcc-blue/90 p-6 ring-1 ring-[#FCFBF8]/10">
                <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-jcc-accent-highlight"><Swords size={13} /> Against each side</p>
                {[...sel.vs.entries()].sort((a, b) => played(b[1]) - played(a[1])).map(([t, rec]) => (
                  <div key={t} className="flex items-center gap-3">
                    {teamByName(t) && <Image src={teamByName(t)!.logo} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />}
                    <span className="flex-1 text-[13.5px] text-[#FCFBF8]">{t}</span>
                    <span className="font-mono text-[12.5px] tabular-nums text-[#FCFBF8]">{wl(rec)}</span>
                    <span className="w-12 text-right font-heading text-lg font-bold tabular-nums text-jcc-accent-highlight">{pct(rec.w, played(rec))}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
