"use client";

// Head to head: any two players, side by side, metric by metric. A butterfly
// chart — each bar grows outwards from the centre line, scaled to the larger
// of the pair, and the better side of every row is lit in gold. Economy is
// the one row where lower wins. Opens on the Orange Cap against the Purple Cap.

import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { duel, f0, f1, f2, fmtDate, leaderboardRows, type BoardRow, type CardData } from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { focusOf, focusStyle } from "@/lib/photo-focus";
import { gsap, reduceMotion, useGSAP } from "./motion";
import { GOLD, SectionShare, usePhotoOf } from "./SectionShare";
import type { SheetCard } from "./ShareSheet";

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";

type Metric = { label: string; get: (r: BoardRow) => number | null; fmt: (n: number | null) => string; lower?: boolean; min?: (r: BoardRow) => boolean; kind: "bat" | "bowl" | "other" };

const METRICS: Metric[] = [
  { label: "Matches", get: (r) => r.matches, fmt: f0, kind: "other" },
  { label: "Runs", get: (r) => r.runs, fmt: f0, kind: "bat" },
  { label: "Strike rate", get: (r) => r.sr, fmt: f1, min: (r) => r.balls >= 15, kind: "bat" },
  { label: "Average", get: (r) => r.avg, fmt: f1, min: (r) => r.balls >= 15, kind: "bat" },
  { label: "Sixes", get: (r) => r.s6, fmt: f0, kind: "bat" },
  { label: "Boundaries", get: (r) => r.bnd, fmt: f0, kind: "bat" },
  { label: "Wickets", get: (r) => r.wk, fmt: f0, kind: "bowl" },
  { label: "Economy", get: (r) => r.econ, fmt: f2, lower: true, min: (r) => r.bowlBalls >= 12, kind: "bowl" },
  { label: "Dot-ball %", get: (r) => r.dotPct, fmt: f1, min: (r) => r.bowlBalls >= 12, kind: "bowl" },
  { label: "Death-over wkts", get: (r) => r.death, fmt: f0, kind: "bowl" },
  { label: "Fielding", get: (r) => r.fielding, fmt: f0, kind: "other" },
  { label: "Player of the Match", get: (r) => r.mom, fmt: f0, kind: "other" },
];

/** A fighter's card: tall photo in team light, name on it, tap anywhere to pick someone else. */
function Fighter({ rows, names, value, onChange, side, photo }: { rows: BoardRow[]; names: string[]; value: number; onChange: (p: number) => void; side: "left" | "right"; photo: string | null }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => names[a.p].localeCompare(names[b.p])), [rows, names]);
  const row = rows.find((r) => r.p === value);
  const color = teamByName(row?.team)?.primary ?? "#D4AF37";
  const name = names[value];
  const pos = focusOf(photo);
  return (
    <label className={`group relative block w-full max-w-[250px] cursor-pointer ${side === "right" ? "justify-self-end" : ""}`}>
      <span aria-hidden className="absolute -inset-4 rounded-[36px] opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-80" style={{ background: color }} />
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[26px]" style={{ boxShadow: `0 0 0 2px ${color}` }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.split("#")[0]} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" style={focusStyle(pos, 0.45, 0.8)} />
        ) : (
          <span className="grid h-full w-full place-items-center bg-[#13233D] font-heading text-7xl font-bold text-[#FCFBF8]/30">
            {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#05080F] via-[#05080F]/60 to-transparent" />
        <span className={`absolute top-3 inline-flex items-center gap-1 rounded-full bg-[#05080F]/75 px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#FCFBF8] ring-1 ring-[#FCFBF8]/25 backdrop-blur ${side === "left" ? "left-3" : "right-3"}`}>
          Change <ChevronDown size={11} />
        </span>
        <span className={`absolute bottom-4 ${side === "left" ? "left-4" : "right-4 text-right"}`}>
          <span className="block font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color }}>{row?.team ?? "—"}</span>
          <span className="mt-1 block font-heading text-2xl font-bold leading-none tracking-[-0.03em] text-[#FCFBF8] md:text-3xl">{name}</span>
          <span className="mt-1 block font-mono text-[10px] text-[#FCFBF8]/60">{row?.matches ?? 0} matches</span>
        </span>
      </span>
      <select
        aria-label={side === "left" ? "First player" : "Second player"}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {sorted.map((r) => (
          <option key={r.p} value={r.p}>
            {names[r.p]} · {r.team}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Compare({ data, seasons, onOpenPlayer }: { data: CardData; seasons: number[]; onOpenPlayer: (p: number) => void }) {
  const rows = useMemo(() => leaderboardRows(data, seasons).filter((r) => r.matches >= 2), [data, seasons]);
  const names = data.players;
  const defaults = useMemo(() => {
    const bat = [...rows].sort((a, b) => b.runs - a.runs || (b.sr ?? 0) - (a.sr ?? 0))[0];
    const bowl = [...rows].sort((a, b) => b.wk - a.wk || (a.econ ?? 99) - (b.econ ?? 99)).find((r) => r.p !== bat?.p);
    return [bat?.p ?? 0, bowl?.p ?? 0] as const;
  }, [rows]);
  const [pick, setPick] = useState<[number | null, number | null]>([null, null]);
  // A pick from another season may not exist in this one; fall back quietly.
  const has = (p: number | null) => p != null && rows.some((r) => r.p === p);
  const a = has(pick[0]) ? pick[0]! : defaults[0];
  const b = has(pick[1]) ? pick[1]! : defaults[1];
  const A = rows.find((r) => r.p === a);
  const B = rows.find((r) => r.p === b);
  const board = useRef<HTMLDivElement>(null);
  const photoOf = usePhotoOf();

  useGSAP(
    () => {
      if (reduceMotion() || !board.current) return;
      const q = gsap.utils.selector(board);
      gsap.fromTo(q("[data-cbar]"), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "expo.out", stagger: 0.03 });
      gsap.fromTo(q("[data-cval]"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.02 });
    },
    { scope: board, dependencies: [a, b, seasons] },
  );

  if (!A || !B) return null;
  let winsA = 0;
  let winsB = 0;
  const lines = METRICS.map((m) => {
    const va = m.min && !m.min(A) ? null : m.get(A);
    const vb = m.min && !m.min(B) ? null : m.get(B);
    const max = Math.max(va ?? 0, vb ?? 0) || 1;
    let win: "a" | "b" | null = null;
    if (va != null && vb != null && va !== vb) win = (m.lower ? va < vb : va > vb) ? "a" : "b";
    else if (va != null && vb == null && va > 0) win = "a";
    else if (vb != null && va == null && vb > 0) win = "b";
    if (win === "a") winsA++;
    if (win === "b") winsB++;
    // Lower-is-better rows draw the better (smaller) value as the longer bar.
    const len = (v: number | null) => (v == null ? 0 : m.lower ? Math.min(...[va, vb].filter((x): x is number => x != null)) / v : v / max);
    return { m, va, vb, win, la: len(va), lb: len(vb) };
  });

  const ca = teamByName(A.team)?.primary ?? "#D4AF37";
  const cb = teamByName(B.team)?.primary ?? "#3B6FC4";

  // Exact one-on-one: innings where one bowled at the other, and the wickets.
  const aOnB = duel(data, seasons, a, b);
  const bOnA = duel(data, seasons, b, a);

  // The face-off as story cards: the overall score, then batting and bowling
  // on their own, then the one-on-one. Values sit on each player's side with
  // the better one in gold, so nothing is read as "21 · 17".
  const share = (): SheetCard[] => {
    const na = names[a], nb = names[b];
    const first = (n: string) => n.split(/\s+/)[0];
    const fa = first(na), fb = first(nb);
    const versus = { left: { name: na, photo: photoOf(na), color: ca }, right: { name: nb, photo: photoOf(nb), color: cb } };
    const base = { versus, byline: `${fa} v ${fb}`, team: "Face-off", footer: `${window.location.host}/stats` };
    const link = `${window.location.origin}/stats#compare`;
    const rowsOf = (ls: typeof lines) =>
      ls.filter((l) => l.va != null || l.vb != null).map((l) => ({ label: l.m.label, a: l.m.fmt(l.va), b: l.m.fmt(l.vb), win: l.win, pa: l.la, pb: l.lb }));
    const score = (ls: typeof lines) => [ls.filter((l) => l.win === "a").length, ls.filter((l) => l.win === "b").length] as const;
    const cards: SheetCard[] = [];

    const head = ["Runs", "Strike rate", "Wickets", "Economy", "Fielding", "Player of the Match"];
    const leader = winsA === winsB ? null : winsA > winsB ? fa : fb;
    cards.push({
      id: `faceoff-${a}-${b}`,
      label: "Face-off",
      text: `${na} v ${nb}: ${winsA}–${winsB} on ${lines.length} categories\n${link}`,
      spec: {
        ...base,
        kicker: `Face-off · ${lines.length} categories`,
        title: leader ? `${leader} takes the face-off` : "Dead level",
        hero: { value: `${winsA}–${winsB}`, unit: "categories won", colors: GOLD },
        compare: rowsOf(lines.filter((l) => head.includes(l.m.label))),
      },
    });

    const part = (kind: "bat" | "bowl", word: string, noun: string) => {
      const ls = lines.filter((l) => l.m.kind === kind);
      const rows = rowsOf(ls);
      if (!rows.length || rows.every((r) => r.a === "0" && r.b === "0")) return;
      const [x, y] = score(ls);
      cards.push({
        id: `faceoff-${kind}-${a}-${b}`,
        label: capital(word),
        text: `${na} v ${nb} ${word}: ${x}–${y}\n${link}`,
        spec: {
          ...base,
          kicker: `Face-off · ${word}`,
          title: x === y ? `Level ${kind === "bat" ? "with the bat" : "with the ball"}` : `${x > y ? fa : fb} the better ${noun}`,
          hero: { value: `${x}–${y}`, unit: `${word} categories won`, colors: GOLD },
          compare: rows,
        },
      });
    };
    part("bat", "batting", "batter");
    part("bowl", "bowling", "bowler");

    // One on one: only the exact facts, and only when someone has a wicket to show.
    if (aOnB.wk + bOnA.wk > 0) {
      const x = aOnB.wk, y = bOnA.wk;
      const max = Math.max(x, y, 1), maxM = Math.max(aOnB.meetings, bOnA.meetings, 1);
      cards.push({
        id: `duel-${a}-${b}`,
        label: "One on one",
        text: `${fa} has dismissed ${fb} ${times(x)}, ${fb} has dismissed ${fa} ${times(y)}\n${link}`,
        spec: {
          ...base,
          kicker: "One on one · ball v bat",
          title: x === y ? "All square, wicket for wicket" : `${x > y ? fa : fb} has the upper hand`,
          hero: { value: `${x}–${y}`, unit: "times dismissed the other", colors: GOLD },
          compare: [
            { label: "Wickets of the other", a: String(x), b: String(y), win: x === y ? null : x > y ? "a" : "b", pa: x / max, pb: y / max },
            { label: "Innings bowled at", a: String(aOnB.meetings), b: String(bOnA.meetings), win: null, pa: aOnB.meetings / maxM, pb: bOnA.meetings / maxM },
          ],
          body: "Counted from innings where one bowled and the other batted. The scorecards record who took each wicket, not who bowled each ball.",
        },
      });
      for (const [bw, bt, dl, bwName, btName, color] of [[a, b, aOnB, na, nb, ca], [b, a, bOnA, nb, na, cb]] as const) {
        if (!dl.wk) continue;
        cards.push({
          id: `duel-${bw}-on-${bt}`,
          label: `${first(bwName)}'s wickets`,
          text: `${bwName} has dismissed ${btName} ${times(dl.wk)} in ${dl.meetings} innings\n${link}`,
          spec: {
            ...base,
            versus: { left: { name: bwName, photo: photoOf(bwName), color }, right: { name: btName, photo: photoOf(btName), color: color === ca ? cb : ca } },
            kicker: "One on one · wickets",
            title: `${first(bwName)} has ${first(btName)}'s number`,
            hero: { value: String(dl.wk), unit: `${dl.wk === 1 ? "dismissal" : "dismissals"} in ${dl.meetings} innings`, colors: GOLD },
            facts: [
              { label: "Bowled at him", value: `${dl.meetings} innings` },
              { label: "Strike", value: `${Math.round((100 * dl.wk) / dl.meetings)}%` },
              ...(dl.last ? [{ label: "Latest", value: fmtDate(dl.last) }] : []),
            ],
          },
        });
      }
    }
    return cards;
  };

  const decided = winsA + winsB || 1;
  const verdict = winsA === winsB ? "Dead level" : `${names[winsA > winsB ? a : b].split(" ")[0]} takes it`;

  return (
    <div ref={board}>
      {/* The arena light: each side in its team's colour, a seam down the middle */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 transition-[background] duration-700" style={{ background: `radial-gradient(40% 45% at 10% 38%, ${ca}50, transparent 70%), radial-gradient(40% 45% at 90% 38%, ${cb}50, transparent 70%)` }} />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-[6deg] bg-gradient-to-b from-transparent via-jcc-accent/40 to-transparent" />
        <p className="absolute left-1/2 top-[22%] -translate-x-1/2 select-none font-heading text-[14rem] font-bold italic leading-none tracking-[-0.06em] text-[#FCFBF8]/[0.035] md:text-[24rem]">VS</p>
      </div>

      <div className="relative">
        <div className="grid grid-cols-2 items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-10">
          <Fighter rows={rows} names={names} value={a} onChange={(p) => setPick([p, b])} side="left" photo={photoOf(names[a])} />

          {/* The scoreboard */}
          <div className="order-last col-span-2 flex flex-col items-center text-center md:order-none md:col-span-1">
            <p className="font-heading text-7xl font-bold leading-none tracking-[-0.06em] tabular-nums md:text-[7.5rem]">
              <span data-cval className={winsA >= winsB ? "text-jcc-accent" : "text-[#FCFBF8]/45"}>{winsA}</span>
              <span className="mx-1 text-[#FCFBF8]/20">:</span>
              <span data-cval className={winsB >= winsA ? "text-jcc-accent" : "text-[#FCFBF8]/45"}>{winsB}</span>
            </p>
            <p className={`${LABEL} mt-2 text-[#FCFBF8]/60`}>{verdict} · categories</p>
            <div className="mt-4 flex h-2.5 w-56 overflow-hidden rounded-full bg-[#FCFBF8]/10">
              <span className="h-full transition-[width] duration-700" style={{ width: `${(100 * winsA) / decided}%`, background: ca }} />
              <span className="h-full w-0.5 bg-[#FCFBF8]" />
              <span className="h-full flex-1" style={{ background: cb }} />
            </div>
            <button
              type="button"
              onClick={() => setPick([b, a])}
              aria-label="Swap players"
              className="mt-5 grid h-14 w-14 place-items-center rounded-full bg-jcc-accent text-[#0B1424] shadow-[0_0_40px_rgba(212,175,55,0.5)] transition duration-500 hover:rotate-180"
            >
              <ArrowLeftRight size={20} />
            </button>
          </div>

          <Fighter rows={rows} names={names} value={b} onChange={(p) => setPick([a, p])} side="right" photo={photoOf(names[b])} />
        </div>

        {/* Round by round */}
        <ul className="mt-14 space-y-1">
          {lines.map(({ m, va, vb, win, la, lb }) => (
            <li key={m.label} className="grid grid-cols-[3.5rem_minmax(0,1fr)_7rem_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#FCFBF8]/[0.04] md:grid-cols-[5rem_minmax(0,1fr)_11rem_minmax(0,1fr)_5rem] md:gap-5">
              <span data-cval className={`text-right font-heading text-lg font-bold tabular-nums tracking-tight md:text-2xl ${win === "a" ? "text-jcc-accent" : "text-[#FCFBF8]/45"}`}>{m.fmt(va)}</span>
              <span className="flex h-3 justify-end">
                <span
                  data-cbar
                  className="block h-full rounded-full"
                  style={{ width: `${la * 100}%`, transformOrigin: "right center", background: win === "a" ? "linear-gradient(90deg, #A97824, #F3C96A)" : `${ca}55`, boxShadow: win === "a" ? "0 0 18px rgba(212,175,55,0.45)" : undefined }}
                />
              </span>
              <span className="text-center">
                <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] md:text-[11px] ${win ? "bg-[#FCFBF8]/[0.08] text-[#FCFBF8]" : "text-[#FCFBF8]/55"}`}>{m.label}</span>
                {m.lower && <span className="block font-mono text-[9px] text-[#FCFBF8]/45">lower wins</span>}
              </span>
              <span className="flex h-3">
                <span
                  data-cbar
                  className="block h-full rounded-full"
                  style={{ width: `${lb * 100}%`, transformOrigin: "left center", background: win === "b" ? "linear-gradient(90deg, #F3C96A, #A97824)" : `${cb}55`, boxShadow: win === "b" ? "0 0 18px rgba(212,175,55,0.45)" : undefined }}
                />
              </span>
              <span data-cval className={`font-heading text-lg font-bold tabular-nums tracking-tight md:text-2xl ${win === "b" ? "text-jcc-accent" : "text-[#FCFBF8]/45"}`}>{m.fmt(vb)}</span>
            </li>
          ))}
        </ul>

        {/* One on one: the exact part of a head to head */}
        {aOnB.meetings + bOnA.meetings > 0 && (
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {([[a, b, aOnB, ca], [b, a, bOnA, cb]] as const).map(([bw, bt, dl, color]) => (
              <div key={bw} className="rounded-2xl border border-[#FCFBF8]/10 bg-[#FCFBF8]/[0.03] p-5">
                <p className={`${LABEL} text-[#FCFBF8]/55`}>
                  <span style={{ color }}>{names[bw].split(" ")[0]}</span> bowling at {names[bt].split(" ")[0]}
                </p>
                <p className="mt-2 font-heading text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums text-[#FCFBF8]">
                  <span className={dl.wk ? "text-jcc-accent" : ""}>{dl.wk}</span>
                  <span className="ml-2 align-middle text-sm font-semibold tracking-tight text-[#FCFBF8]/60">
                    {dl.wk === 1 ? "dismissal" : "dismissals"} in {dl.meetings} {dl.meetings === 1 ? "innings" : "innings"}
                  </span>
                </p>
                {dl.last && <p className="mt-2 font-mono text-[10.5px] text-[#FCFBF8]/45">latest {fmtDate(dl.last)}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            {[a, b].map((p) => (
              <button key={p} type="button" onClick={() => onOpenPlayer(p)} className="rounded-full border border-[#FCFBF8]/20 px-4 py-2 text-[13px] font-semibold tracking-tight text-[#FCFBF8] transition-colors hover:border-jcc-accent hover:text-jcc-accent">
                {names[p].split(" ")[0]}&apos;s cards →
              </button>
            ))}
            <SectionShare build={share} fileBase="jcc-head-to-head" label="Share the face-off" dark />
          </div>
          <p className="font-mono text-[11px] text-[#FCFBF8]/50">Rates need 15 balls faced or 12 bowled · gold marks the better side of each row</p>
        </div>
      </div>
    </div>
  );
}
