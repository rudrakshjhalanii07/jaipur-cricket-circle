"use client";

import { Avatar } from "./Avatar";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, Link2, ClipboardCopy } from "lucide-react";
import {
  DUCKS,
  KIND_LABEL,
  f0,
  f1,
  f2,
  fmtDate,
  ov,
  plural,
  playerProfile,
  leagueInsights,
  momAnalytics,
  type AwardType,
  slug,
  type BadgeTone,
  type CardData,
  type Profile,
  type Split,
  type BowlSplit,
} from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import { AchievementStyles, Emblem, TierChip, tierOf } from "./achievements";
import { TypeChip, TYPE_COLOR } from "./MoMSection";

// Chart colours: player series, not-out / secondary series, league reference.
// Checked for colour-blind separation; the grey reference always carries a label.
const MARK = "#2B59C3";
const MARK_2 = "#B98419";
const REF = "#7D8DB0";
const BAD = "#B0473F";

const TONE: Record<BadgeTone, string> = {
  crown: "bg-jcc-accent text-jcc-seam border-jcc-accent",
  bat: "bg-[#2B59C3]/10 text-[#1F449A] border-[#2B59C3]/25",
  ball: "bg-emerald-600/10 text-emerald-800 border-emerald-600/25",
  field: "bg-[#176178]/10 text-[#176178] border-[#176178]/25",
  team: "bg-jcc-navy-light text-white border-jcc-border",
  warn: "bg-jcc-danger/10 text-jcc-danger border-jcc-danger/25",
};

export function deckHash(name: string, card?: string) {
  return `player-${slug(name)}${card ? `.${card}` : ""}`;
}

// ─── Building blocks ─────────────────────────────────────────────────────────

type Tip = { x: number; y: number; body: ReactNode } | null;
type SetTip = (t: Tip) => void;

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-jcc-navy px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcc-text-muted">{label}</div>
      <div className="mt-0.5 font-heading text-2xl font-bold leading-tight tabular-nums text-white">{value}</div>
      {sub && <div className="text-[11.5px] text-jcc-text-muted">{sub}</div>}
    </div>
  );
}
function Kpis({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-jcc-border bg-jcc-border sm:grid-cols-4">
      {children}
    </div>
  );
}
function Sec({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-jcc-accent-dark">{title}</h3>
      {children}
      {note && <p className="mt-2 text-xs leading-relaxed text-jcc-text-muted">{note}</p>}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-jcc-border px-4 py-8 text-center text-sm text-jcc-text-muted">{children}</div>;
}
function Legend({ items }: { items: [string, string, "box" | "line" | "dot"][] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-jcc-text-muted">
      {items.map(([label, color, shape]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            className={shape === "line" ? "h-3 w-[3px] rounded-sm" : shape === "dot" ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function Table({ head, rows, left = 1 }: { head: string[]; rows: ReactNode[][]; left?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-jcc-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-jcc-navy-light text-[10px] uppercase tracking-[0.1em] text-jcc-text-muted">
            {head.map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-3 py-2 font-semibold ${i < left ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="border-t border-jcc-border">
              {r.map((c, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 tabular-nums ${i < left ? "text-left" : "text-right"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SplitTable({ rows }: { rows: Split[] }) {
  const shown = rows.filter((r) => r.inns);
  if (!shown.length) return null;
  return (
    <Table
      head={["Split", "Inns", "Runs", "Balls", "Avg", "SR"]}
      rows={shown.map((r) => [
        r.label, r.inns, r.runs, r.balls, f1(r.avg),
        <span key="sr" className="inline-flex items-center justify-end gap-2">
          {f0(r.sr)}
          <span className="hidden h-1.5 rounded-full sm:inline-block" style={{ width: Math.round((48 * Math.min(r.sr ?? 0, 240)) / 240), background: MARK }} />
        </span>,
      ])}
    />
  );
}
function BowlSplitTable({ rows }: { rows: BowlSplit[] }) {
  const shown = rows.filter((r) => r.spells);
  if (!shown.length) return null;
  return (
    <Table
      head={["Split", "Spells", "Overs", "Runs", "Wkts", "Econ", "Dots"]}
      rows={shown.map((r) => [r.label, r.spells, ov(r.balls), r.runs, r.wk, f2(r.econ), `${f0(r.dotPct)}%`])}
    />
  );
}

/** Player value against the league value, on one scale. */
function Meter({ label, hint, v, lg, fmt, better }: { label: string; hint: string; v: number | null; lg: number | null; fmt: (n: number | null) => string; better: "high" | "low" | null }) {
  if (v == null) return null;
  const max = Math.max(v, lg ?? 0) * 1.18 || 1;
  const x = (n: number) => 2 + (n / max) * 96;
  const good = lg == null || better == null ? null : better === "high" ? v >= lg : v <= lg;
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b border-jcc-border py-2.5 last:border-0 sm:grid-cols-[180px_1fr]">
      <div>
        <div className="text-[13px] font-semibold text-white">{label}</div>
        <div className="text-[11px] text-jcc-text-muted">{hint}</div>
      </div>
      <div>
        <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="block h-3.5 w-full" aria-label={`${label}: ${fmt(v)}, league ${fmt(lg)}`}>
          <line x1="0" x2="100" y1="7" y2="7" stroke="rgba(18,35,63,.12)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={x(v)} y1="7" y2="7" stroke={MARK} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {lg != null && <line x1={x(lg)} x2={x(lg)} y1="0" y2="14" stroke={REF} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-jcc-text-muted">
          <b className="tabular-nums text-white">{fmt(v)}</b>
          {lg != null && <span>League {fmt(lg)}</span>}
          {good != null && <span className={good ? "font-semibold text-emerald-700" : "font-semibold text-jcc-danger"}>{good ? "▲ better than league" : "▼ worse than league"}</span>}
        </div>
      </div>
    </div>
  );
}

/** Player share against league share, per category. */
function PairBars({ rows, who }: { rows: { label: string; pct: number; n: number; league: number }[]; who: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.pct, r.league]));
  return (
    <div>
      <Legend items={[[who, MARK, "box"], ["League", REF, "box"]]} />
      <div className="grid gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
            <span className="font-semibold text-white">{r.label}</span>
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 rounded-[3px]" style={{ width: `${Math.max(1, (r.pct / max) * 78)}%`, background: MARK }} />
                <span className="tabular-nums text-jcc-text-muted">{Math.round(r.pct)}% ({r.n})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-[3px] opacity-80" style={{ width: `${Math.max(1, (r.league / max) * 78)}%`, background: REF }} />
                <span className="tabular-nums text-jcc-text-muted">{Math.round(r.league)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type BarItem = { v: number; color: string; label?: string; top?: string; marks?: number; tip: ReactNode };
function BarChart({ items, min = 10, aria, setTip }: { items: BarItem[]; min?: number; aria: string; setTip: SetTip }) {
  if (!items.length) return null;
  const W = Math.max(560, items.length * 22), H = 200, L = 28, B = 20, T = 22;
  const max = Math.max(min, ...items.map((i) => i.v));
  const step = max > 60 ? 20 : max > 30 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - 4) / items.length;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  const show = (e: React.PointerEvent, body: ReactNode) => setTip({ x: e.clientX, y: e.clientY, body });
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ minWidth: Math.min(W, 560) }} role="img" aria-label={aria} onPointerLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(18,35,63,.07)" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#667085">{t}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const x = L + i * bw + 2, w = Math.max(3, bw - 4), h = Math.max(it.v > 0 ? 2 : 0, y(0) - y(it.v));
          return (
            <g key={i}>
              <rect x={x} y={y(0) - h} width={w} height={h} rx={Math.min(4, w / 2)} fill={it.color} />
              {it.top && <text x={x + w / 2} y={y(0) - h - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#12233F">{it.top}</text>}
              {Array.from({ length: it.marks ?? 0 }, (_, k) => (
                <circle key={k} cx={x + w / 2} cy={y(0) - h - 7 - k * 8} r="3.2" fill={BAD} stroke="#fff" strokeWidth="1.5" />
              ))}
              {it.label && <text x={x + w / 2} y={H - 5} textAnchor="middle" fontSize="9.5" fill="#667085">{it.label}</text>}
              <rect
                x={L + i * bw} y={T - 14} width={bw} height={H - T - B + 14} fill="transparent"
                onPointerMove={(e) => show(e, it.tip)} onPointerDown={(e) => show(e, it.tip)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Percentile({ label, value, pct, hint }: { label: string; value: string; pct: number; hint: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-jcc-border py-2 last:border-0">
      <div>
        <span className="text-[13px] font-semibold text-white">{label}</span>
        <span className="ml-2 text-[11px] text-jcc-text-muted">{hint}</span>
      </div>
      <span className="text-[12px] tabular-nums text-jcc-text-muted">
        {value} · <b className="text-white">{pct}</b>th pct
      </span>
      <div className="col-span-2 h-2 overflow-hidden rounded-full bg-jcc-navy-light">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: pct >= 70 ? MARK : pct <= 30 ? BAD : REF }} />
      </div>
    </div>
  );
}

function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mb-3 inline-flex rounded-full border border-jcc-border p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${v === value ? "bg-jcc-blue text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

type Card = { id: string; tab: string; kicker: string; title: string; body: ReactNode };

function Badges({ pr, all }: { pr: Profile; all?: boolean }) {
  const list = all ? pr.badges : pr.badges.slice(0, 8);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((b) => (
        <span key={b.label} title={b.why} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${TONE[b.tone]}`}>
          {b.tone === "crown" && <span className="mr-1">★</span>}
          {b.label}
        </span>
      ))}
      {!all && pr.badges.length > 8 && <span className="px-1 py-1 text-[11.5px] font-semibold text-jcc-text-muted">+{pr.badges.length - 8} more on the Labels card</span>}
    </div>
  );
}

function MatchupsBatter({ pr }: { pr: Profile }) {
  const [by, setBy] = useState<"wk" | "econ" | "sr">("wk");
  const rows = [...pr.batting.matchups].sort(
    by === "wk" ? (a, b) => b.wk - a.wk || (a.econ ?? 99) - (b.econ ?? 99)
      : by === "econ" ? (a, b) => Number(b.balls >= 24) - Number(a.balls >= 24) || (a.econ ?? 99) - (b.econ ?? 99)
        : (a, b) => Number(b.bb >= 10) - Number(a.bb >= 10) || (a.sr ?? 999) - (b.sr ?? 999),
  );
  return (
    <>
      <Toggle value={by} onChange={setBy} options={[["wk", "By wickets"], ["econ", "By economy"], ["sr", "By his strike rate"]]} />
      <Table
        head={["Bowler", "Inns", "Got him", "Overs", "Econ", "Dot %", "His runs (balls)", "His SR"]}
        rows={rows.map((e) => [pr.nameOf(e.p), e.inns, e.wk || "–", ov(e.balls), f2(e.econ), f0(e.dotPct), `${e.br} (${e.bb})`, f0(e.sr)])}
      />
    </>
  );
}
function MatchupsBowler({ pr }: { pr: Profile }) {
  const [by, setBy] = useState<"wk" | "slow" | "fast">("wk");
  const rows = [...pr.bowling.matchups].sort(
    by === "wk" ? (a, b) => b.wk - a.wk || (a.sr ?? 999) - (b.sr ?? 999)
      : by === "slow" ? (a, b) => Number(b.bb >= 10) - Number(a.bb >= 10) || (a.sr ?? 999) - (b.sr ?? 999)
        : (a, b) => Number(b.bb >= 10) - Number(a.bb >= 10) || (b.sr ?? 0) - (a.sr ?? 0),
  );
  return (
    <>
      <Toggle value={by} onChange={setBy} options={[["wk", "Dismissed most"], ["slow", "Scored slowest"], ["fast", "Scored fastest"]]} />
      <Table
        head={["Batter", "Inns", "Got out", "Ducks", "Their runs (balls)", "Their SR", "His econ"]}
        rows={rows.map((e) => [pr.nameOf(e.p), e.inns, e.wk || "–", e.ducks || "–", `${e.br} (${e.bb})`, f0(e.sr), f2(e.econ)])}
      />
    </>
  );
}

function TipList({ tips }: { tips: Profile["tips"]["batting"] }) {
  return (
    <ol className="grid gap-3">
      {tips.map((t, i) => (
        <li key={t.title} className="rounded-xl border border-jcc-border bg-jcc-navy p-4">
          <div className="flex items-baseline gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jcc-blue text-xs font-bold text-[#FCFBF8]">{i + 1}</span>
            <h4 className="font-heading text-lg font-bold text-white">{t.title}</h4>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-jcc-text-muted"><b className="text-white">Why: </b>{t.why}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white"><b>Next step: </b>{t.next}</p>
          {t.target && <p className="mt-2 inline-block rounded-full bg-jcc-accent/15 px-2.5 py-0.5 text-[11.5px] font-bold text-jcc-accent-dark">Target: {t.target}</p>}
        </li>
      ))}
    </ol>
  );
}

type MoMView = ReturnType<typeof momAnalytics>;

function buildCards(pr: Profile, scopeLabel: string, setTip: SetTip, holders: Map<string, number>, momA: MoMView, onOpenMatch: (id: string) => void): Card[] {
  const b = pr.B, w = pr.W, LB = pr.league.LB, LW = pr.league.LW;
  const rk = (r: { rank: number; of: number } | null) => (r ? `#${r.rank} of ${r.of}` : undefined);
  const cards: Card[] = [];
  const color = teamByName(pr.team)?.primary ?? "#12233F";

  cards.push({
    id: "overview", tab: "Overview", kicker: `${scopeLabel} · Overview`, title: pr.name,
    body: (
      <>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-jcc-text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-white">{pr.teams.join(" · ")}</span>
          <span>{pr.role}</span>
          <span>{plural(pr.matches, "match", "matches")}</span>
          {pr.mom.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-jcc-accent/15 px-2 py-0.5 text-[11.5px] font-bold text-jcc-accent-dark" title={pr.mom.map((x) => `${fmtDate(x.date)} v ${x.opp}: ${x.line}`).join("\n")}>
              🏆 {pr.mom.length}× Player of the Match
            </span>
          )}
          <span>Played {pr.attendance.present} of his team&apos;s {pr.attendance.teamMatches} matches{pr.attendance.guest ? ` (+${pr.attendance.guest} as a guest)` : ""}</span>
        </div>
        <div className="mb-4"><Badges pr={pr} /></div>
        {b.inns > 0 && (
          <Kpis>
            <Kpi label="Runs" value={b.runs} sub={rk(pr.ranks.runs)} />
            <Kpi label="Strike rate" value={f1(b.sr)} sub={rk(pr.ranks.sr) ?? "under 30 balls"} />
            <Kpi label="Average" value={f1(b.avg)} sub={`${b.inns} inns · ${b.no} not out`} />
            <Kpi label="Highest" value={b.hs} sub={`${b.f4} fours · ${b.s6} sixes`} />
          </Kpis>
        )}
        {w.spells > 0 && (
          <Kpis>
            <Kpi label="Wickets" value={w.wk} sub={rk(pr.ranks.wk)} />
            <Kpi label="Economy" value={f2(w.econ)} sub={rk(pr.ranks.econ) ?? "under 30 balls"} />
            <Kpi label="Dot balls" value={w.dots} sub={`${f0(w.dotPct)}% of balls`} />
            <Kpi label="Best" value={w.best} sub={`${ov(w.balls)} overs`} />
          </Kpis>
        )}
        <div className="grid gap-4 md:grid-cols-2 [&>section]:mt-0">
          <Sec title="Strengths">
            <ul className="grid gap-2">
              {(pr.insights.good.length ? pr.insights.good : [{ title: "Too early to call", body: "Not enough balls yet to name a strength." }]).map((n) => (
                <li key={n.title} className="rounded-lg bg-emerald-600/[0.07] px-3 py-2 text-[13px]"><b className="text-emerald-800">{n.title}.</b> <span className="text-white">{n.body}</span></li>
              ))}
            </ul>
          </Sec>
          <Sec title="Weaknesses">
            <ul className="grid gap-2">
              {(pr.insights.bad.length ? pr.insights.bad : [{ title: "Nothing stands out", body: "No clear weakness in the numbers yet." }]).map((n) => (
                <li key={n.title} className="rounded-lg bg-jcc-danger/[0.07] px-3 py-2 text-[13px]"><b className="text-jcc-danger">{n.title}.</b> <span className="text-white">{n.body}</span></li>
              ))}
            </ul>
          </Sec>
        </div>
        {pr.insights.info.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {pr.insights.info.map((n) => (
              <li key={n.title} className="rounded-lg bg-jcc-navy-light px-3 py-2 text-[13px]"><b>{n.title}.</b> {n.body}</li>
            ))}
          </ul>
        )}
      </>
    ),
  });

  cards.push({
    id: "next", tab: "Next steps", kicker: "Coaching", title: "How to improve next season",
    body: (
      <>
        {pr.tips.batting.length > 0 && <Sec title="Batting"><TipList tips={pr.tips.batting} /></Sec>}
        {pr.tips.bowling.length > 0 && <Sec title="Bowling"><TipList tips={pr.tips.bowling} /></Sec>}
        {!pr.tips.batting.length && !pr.tips.bowling.length && <Empty>No batting or bowling yet in {scopeLabel}.</Empty>}
        <p className="mt-4 text-xs text-jcc-text-muted">Suggestions come from the scorecard numbers only. A coach watching the player will see things the scorecard can&apos;t.</p>
      </>
    ),
  });

  cards.push({
    id: "labels", tab: "Achievements", kicker: pr.dna.tags.length ? `Player type · ${pr.dna.tags.join(" · ")}` : "Player type", title: `${plural(pr.badges.length, "achievement")} unlocked`,
    body: (
      <>
        <Sec title="Badges">
          <AchievementStyles />
          {pr.badges.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {pr.badges.map((bd, i) => {
                const n = holders.get(bd.label) ?? 1;
                const tier = tierOf(bd.tone, n);
                return (
                  <div key={bd.label} className="ach-tile flex flex-col items-center rounded-2xl border border-jcc-border bg-jcc-navy p-3 text-center" style={{ animationDelay: `${i * 30}ms` }}>
                    <Emblem label={bd.label} tone={bd.tone} tier={tier} size={64} />
                    <div className="mt-2"><TierChip tier={tier} /></div>
                    <div className="mt-1.5 font-heading text-[15px] font-bold leading-tight text-white">{bd.label}</div>
                    <div className="mt-1 text-[11.5px] leading-snug text-jcc-text-muted">{bd.why}</div>
                    <div className="mt-1.5 text-[10.5px] font-semibold text-jcc-accent-dark">{n === 1 ? "Only him" : `${n} players hold this`}</div>
                  </div>
                );
              })}
            </div>
          ) : <Empty>No achievements yet. They unlock with more balls faced or bowled.</Empty>}
        </Sec>
        {pr.dna.batting.length > 0 && (
          <Sec title="Batting DNA" note="Percentile among players with 30+ balls faced. 100 is the best in the league.">
            {pr.dna.batting.map((a) => <Percentile key={a.label} {...a} />)}
          </Sec>
        )}
        {pr.dna.bowling.length > 0 && (
          <Sec title="Bowling DNA" note="Percentile among players with 30+ balls bowled. 100 is the best in the league.">
            {pr.dna.bowling.map((a) => <Percentile key={a.label} {...a} />)}
          </Sec>
        )}
      </>
    ),
  });

  if (b.inns) {
    cards.push({
      id: "scoring", tab: "Scoring", kicker: "Batting · Aggression", title: "How he scores",
      body: (
        <>
          <Kpis>
            <Kpi label="Fours" value={b.f4} />
            <Kpi label="Sixes" value={b.s6} sub={rk(pr.ranks.six)} />
            <Kpi label="20+ / 30+ / 50+" value={`${b.t20}/${b.t30}/${b.t50}`} />
            <Kpi label="Dot balls faced (min)" value={b.dots} sub={`${f0(b.dotPct)}% of balls`} />
          </Kpis>
          <Sec title="Against the league" note="Scorecards don't record batters' dot balls. The minimum counts every non-boundary run as a single, so the real figure is this or higher.">
            <Meter label="Strike rate" hint="Runs per 100 balls" v={b.sr} lg={LB.sr} fmt={f1} better="high" />
            <Meter label="Balls per boundary" hint="Lower means more often" v={b.bpb} lg={LB.bpb} fmt={f2} better="low" />
            <Meter label="Sixes per 100 balls" hint="Power" v={b.six100} lg={LB.six100} fmt={f1} better="high" />
            <Meter label="Runs from boundaries" hint="Share of his runs" v={b.bndPct} lg={LB.bndPct} fmt={(n) => `${f0(n)}%`} better={null} />
            <Meter label="SR without boundaries" hint="Singles and twos" v={b.nbSR} lg={LB.nbSR} fmt={f1} better="high" />
            <Meter label="Dot balls faced (min)" hint="Lower is better" v={b.dotPct} lg={LB.dotPct} fmt={(n) => `${f0(n)}%`} better="low" />
            <Meter label="Batting average" hint="Runs per dismissal" v={b.avg} lg={LB.avg} fmt={f1} better="high" />
          </Sec>
        </>
      ),
    });

    const bt = pr.batting;
    cards.push({
      id: "dismissals", tab: "Dismissals", kicker: "Batting · Dismissals", title: "How he gets out",
      body: bt.outs ? (
        <>
          <Kpis>
            <Kpi label="Dismissals" value={bt.outs} sub={`${b.no} not outs`} />
            <Kpi label="Out in ≤6 balls" value={bt.quick} sub={`${f0((100 * bt.quick) / bt.outs)}% of dismissals`} />
            <Kpi label="First wicket to fall" value={bt.firstWicket} sub={`of ${bt.outs}`} />
            <Kpi label="Keeper involved" value={bt.keeper} sub="caught behind or stumped" />
          </Kpis>
          <Sec title="Dismissal types"><PairBars rows={bt.kinds} who={pr.name} /></Sec>
          <Sec title="Balls faced when out" note={`Each bar is one dismissal, shortest first. ${bt.inFirstTwoOvers} came in the first 2 overs of the innings.`}>
            <BarChart setTip={setTip} aria="Balls faced in each dismissal" items={bt.ballsWhenOut.map((v) => ({ v, color: MARK, tip: `Out after ${plural(v, "ball")}` }))} />
          </Sec>
          <div className="grid gap-4 md:grid-cols-2">
            <Sec title="Dismissed by">
              {bt.dismissedBy.length ? <Table head={["Bowler", "Times"]} rows={bt.dismissedBy.map((e) => [pr.nameOf(e.p), e.n])} /> : <Empty>No bowler credited.</Empty>}
            </Sec>
            <Sec title="Caught or stumped by">
              {bt.caughtBy.length ? <Table head={["Fielder", "Times"]} rows={bt.caughtBy.map((e) => [pr.nameOf(e.p), e.n])} /> : <Empty>Never caught.</Empty>}
            </Sec>
          </div>
        </>
      ) : <Empty>Never dismissed in {scopeLabel}.</Empty>,
    });

    cards.push({
      id: "ducks", tab: "Ducks", kicker: "Batting · Ducks",
      title: b.ducks ? `${plural(b.ducks, "duck")} in ${b.inns} innings` : `No ducks in ${b.inns} innings`,
      body: (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {DUCKS.map((t) => {
              const n = bt.duckCounts[t.key];
              return (
                <div key={t.key} className={`rounded-xl border p-3 ${n ? "border-jcc-accent bg-jcc-accent/10" : "border-jcc-border"}`}>
                  <div className={`font-heading text-3xl font-bold leading-none ${n ? "text-white" : "text-jcc-text-muted"}`}>{n}</div>
                  <div className="mt-1 text-[13px] font-bold text-white">{t.label}</div>
                  <div className="text-[11.5px] text-jcc-text-muted">{t.rule}</div>
                  <div className="text-[11px] text-jcc-text-muted">League: {pr.league.ld[t.key] ?? 0}</div>
                </div>
              );
            })}
          </div>
          {bt.duckList.length > 0 && (
            <Sec title="Every duck">
              <Table left={3} head={["Date", "Type", "Against", "Balls", "How out"]} rows={bt.duckList.map((r) => [`${fmtDate(r.date)} · S${r.season}`, DUCKS.find((t) => t.key === r.type)!.label, r.opp, r.balls, r.how])} />
            </Sec>
          )}
          <p className="mt-3 text-xs text-jcc-text-muted">Platinum is read from the fall-of-wicket record (out to ball 0.1). Retired-out zeros don&apos;t count.</p>
        </>
      ),
    });

    cards.push({
      id: "innings", tab: "Innings", kicker: "Batting · Every innings", title: "Innings by innings",
      body: (
        <>
          <Legend items={[["Out", MARK, "box"], ["Not out", MARK_2, "box"]]} />
          <BarChart
            setTip={setTip} min={20} aria="Runs in each innings, in date order"
            items={bt.log.map((r) => ({
              v: r.runs, color: r.out ? MARK : MARK_2, label: fmtDate(r.date).split(" ")[0],
              top: r.runs >= 25 ? `${r.runs}${r.out ? "" : "*"}` : undefined,
              tip: (
                <>
                  <b>{r.runs}{r.out ? "" : "*"} ({r.balls})</b> · {r.f4}×4 {r.s6}×6<br />
                  {fmtDate(r.date)} · S{r.season} · vs {r.opp}<br />
                  {r.how}<br />
                  {r.chasing ? "Chasing" : "Batting first"} · #{r.pos} · {r.won ? "Won" : "Lost"}
                </>
              ),
            }))}
          />
          <p className="mb-4 text-xs text-jcc-text-muted">Hover or tap a bar for the scorecard line.</p>
          <Sec title="The first 10 balls"><SplitTable rows={bt.first10} /></Sec>
        </>
      ),
    });

    cards.push({
      id: "splits", tab: "Splits", kicker: "Batting · Splits", title: "Where and when he scores",
      body: (
        <>
          <Sec title="Situation"><SplitTable rows={bt.situation} /></Sec>
          {bt.seasons.length > 0 && <Sec title="Season"><SplitTable rows={bt.seasons} /></Sec>}
          <Sec title="Opponent"><SplitTable rows={bt.opponents} /></Sec>
          <Sec title="Batting position" note={`He made ${f0(bt.teamShare)}% of his team's runs in the innings he batted.`}><SplitTable rows={bt.positions} /></Sec>
        </>
      ),
    });

    cards.push({
      id: "vs-bowlers", tab: "Vs bowlers", kicker: "Batting · Matchups", title: "Bowlers against him",
      body: bt.matchups.length ? (
        <>
          <MatchupsBatter pr={pr} />
          <p className="mt-2 text-xs leading-relaxed text-jcc-text-muted">From the innings where both played. Economy and dot % are the bowler&apos;s whole spell in those innings, and his SR is his whole innings: the export has no ball-by-ball data. Listed: bowled in 2+ of his innings, or dismissed him.</p>
        </>
      ) : <Empty>Not enough innings to compare bowlers yet.</Empty>,
    });
  }

  if (w.spells) {
    const bw = pr.bowling;
    cards.push({
      id: "bowling", tab: "Bowling", kicker: "Bowling · Overview", title: "With the ball",
      body: (
        <>
          <Kpis>
            <Kpi label="Overs" value={ov(w.balls)} sub={plural(w.spells, "spell")} />
            <Kpi label="Wickets" value={w.wk} sub={rk(pr.ranks.wk)} />
            <Kpi label="Economy" value={f2(w.econ)} sub={rk(pr.ranks.econ) ?? "under 30 balls"} />
            <Kpi label="Dot balls" value={w.dots} sub={`${f0(w.dotPct)}% · ${rk(pr.ranks.dot) ?? ""}`} />
            <Kpi label="Average" value={f1(w.avg)} />
            <Kpi label="Strike rate" value={f1(w.sr)} sub="balls per wicket" />
            <Kpi label="Best" value={w.best} sub={`${w.hauls2} spells of 2+ wkts`} />
            <Kpi label="Extras" value={`${w.wd} wd · ${w.nb} nb`} sub={plural(w.mdn, "maiden")} />
          </Kpis>
          <Sec title="Against the league">
            <Meter label="Economy" hint="Runs per over, lower is better" v={w.econ} lg={LW.econ} fmt={f2} better="low" />
            <Meter label="Strike rate" hint="Balls per wicket, lower is better" v={w.sr} lg={LW.sr} fmt={f1} better="low" />
            <Meter label="Dot balls" hint="Share of balls" v={w.dotPct} lg={LW.dotPct} fmt={(n) => `${f0(n)}%`} better="high" />
            <Meter label="Wides per over" hint="Lower is better" v={w.wdo} lg={LW.wdo} fmt={f2} better="low" />
          </Sec>
          <Sec title="Every spell">
            <Legend items={[["Runs conceded", MARK, "box"], ["Wicket", BAD, "dot"]]} />
            <BarChart
              setTip={setTip} min={20} aria="Runs conceded in each spell"
              items={bw.spells.map((r) => ({
                v: r.runs, color: MARK, marks: r.wk, label: fmtDate(r.date).split(" ")[0],
                tip: (
                  <>
                    <b>{ov(r.balls)}-{r.mdn}-{r.runs}-{r.wk}</b><br />
                    {fmtDate(r.date)} · S{r.season} · vs {r.opp}<br />
                    {r.dots} dots · {r.wd} wides · {r.nb} no-balls<br />
                    Economy {f2(r.balls ? (6 * r.runs) / r.balls : null)} · {r.won ? "Won" : "Lost"}
                  </>
                ),
              }))}
            />
          </Sec>
          <Sec title="By opponent"><BowlSplitTable rows={bw.opponents} /></Sec>
          {bw.seasons.length > 0 && <Sec title="By season"><BowlSplitTable rows={bw.seasons} /></Sec>}
        </>
      ),
    });

    cards.push({
      id: "wickets", tab: "Wickets", kicker: "Bowling · Wickets", title: w.wk ? `Every wicket (${bw.wickets.length})` : "Wickets",
      body: (
        <>
          {bw.wickets.length ? (
            <>
              <Kpis>
                <Kpi label="First 2 overs" value={pr.phase.powerplay} sub={rk(pr.ranks.pp) ?? "wickets"} />
                <Kpi label="Middle overs" value={pr.phase.middle} sub="wickets" />
                <Kpi label="Last 2 overs" value={pr.phase.death} sub={rk(pr.ranks.death) ?? "wickets"} />
                <Kpi label="Ducks taken" value={bw.ducksTaken} />
              </Kpis>
              <Sec title="Wicket by wicket">
                <Table
                  left={4}
                  head={["Date", "Batter", "How out", "Fell at", "Score", "Phase"]}
                  rows={bw.wickets.map((r) => [
                    `${fmtDate(r.date)} · S${r.season}`,
                    <span key="b"><b className="text-white">{r.batter}</b> <span className="text-jcc-text-muted">{r.batterTeam}</span>{r.duck && <span className="ml-1.5 rounded-full bg-jcc-accent/15 px-1.5 py-px text-[10px] font-bold text-jcc-accent-dark">{DUCKS.find((t) => t.key === r.duck)!.label} duck</span>}</span>,
                    r.how, r.fow || "–", r.score,
                    r.phase === "death" ? "Last 2 ov" : r.phase === "powerplay" ? "First 2 ov" : r.phase ? "Middle" : "–",
                  ])}
                />
              </Sec>
              <Sec title="How his wickets fall"><PairBars rows={bw.victimKinds} who={pr.name} /></Sec>
            </>
          ) : <Empty>No wickets yet in {scopeLabel}.</Empty>}
          {bw.matchups.length > 0 && (
            <Sec title="Batters against him" note="From the innings where both played. The batter's runs and his economy cover whole innings, not only their duel.">
              <MatchupsBowler pr={pr} />
            </Sec>
          )}
        </>
      ),
    });
  }

  if (pr.F.total) {
    cards.push({
      id: "fielding", tab: "Fielding", kicker: "Fielding", title: "In the field",
      body: (
        <>
          <Kpis>
            <Kpi label="Dismissals" value={pr.F.total} sub={rk(pr.ranks.field)} />
            <Kpi label="Catches" value={pr.F.c} sub={pr.F.kc ? `${pr.F.kc} as keeper` : undefined} />
            <Kpi label="Run outs" value={pr.F.ro} sub="involved in" />
            <Kpi label="Stumpings" value={pr.F.st} />
          </Kpis>
          <Sec title="Every dismissal he was part of">
            <Table left={4} head={["Date", "Batter", "Type", "Scorecard"]} rows={pr.fielding.map((r) => [fmtDate(r.date), r.batter, `${KIND_LABEL[r.kind]}${r.keeper ? " (keeper)" : ""}`, r.how])} />
          </Sec>
        </>
      ),
    });
  }

  const myAwards = momA.awards.filter((a) => a.p === pr.p);
  const myRunnerUps = momA.awards.filter((a) => a.runnerUp?.p === pr.p);
  if (myAwards.length || myRunnerUps.length) {
    const row = momA.leaderboard.find((r) => r.p === pr.p);
    const rank = row ? momA.leaderboard.findIndex((r) => r.p === pr.p) + 1 : null;
    const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
    cards.push({
      id: "awards", tab: "Awards", kicker: "Player of the Match",
      title: myAwards.length ? `${plural(myAwards.length, "award")}${rank ? ` · #${rank} in the league` : ""}` : "Still chasing a first award",
      body: (
        <>
          <Kpis>
            <Kpi label="Awards" value={myAwards.length} sub={rank ? `#${rank} of ${momA.leaderboard.length} winners` : "none yet"} />
            <Kpi label="Award rate" value={row ? `${Math.round(row.rate)}%` : "0%"} sub={`of his ${pr.matches} matches`} />
            <Kpi label="Runner-up" value={myRunnerUps.length} sub="times second-best" />
            <Kpi label="Best streak" value={row?.streak ?? 0} sub="awards in a row" />
          </Kpis>
          {row && (
            <Sec title="What won them">
              <div className="flex h-3 overflow-hidden rounded-full bg-jcc-navy-light">
                {(Object.keys(row.types) as AwardType[]).filter((t) => row.types[t]).map((t) => <div key={t} style={{ width: `${(100 * row.types[t]) / row.awards}%`, background: TYPE_COLOR[t] }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(row.types) as AwardType[]).filter((t) => row.types[t]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5"><TypeChip type={t} /><b className="text-[13px] text-white">{row.types[t]}</b></span>
                ))}
              </div>
            </Sec>
          )}
          {myAwards.length > 0 && (
            <Sec title="Every award" note="Tap a row for the full scorecard.">
              <div className="grid gap-2">
                {myAwards.map((a) => (
                  <button key={a.m} onClick={() => onOpenMatch(a.matchId)} className="flex items-start gap-3 rounded-xl border border-jcc-border p-3 text-left transition hover:border-jcc-accent/60">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-jcc-accent-highlight to-jcc-accent-dark text-[15px]">🏆</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <b className="text-white">{a.line}</b>
                        <TypeChip type={a.type} />
                        {!a.winner && <span className="rounded-full bg-jcc-danger/10 px-2 py-0.5 text-[10.5px] font-bold text-jcc-danger">losing side</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-jcc-text-muted">
                        v {a.opp} · {fmtDate(a.date)} S{a.season} · {a.result}
                        {a.runnerUp && <> · beat {pr.nameOf(a.runnerUp.p)} by {a.margin.toFixed(1)}</>}
                      </div>
                    </div>
                    <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-white">{sgn(a.score)}</span>
                  </button>
                ))}
              </div>
            </Sec>
          )}
          {myRunnerUps.length > 0 && (
            <Sec title="So close" note="Matches where he finished second.">
              <Table
                left={3}
                head={["Date", "Against", "Award went to", "His line", "Gap"]}
                rows={myRunnerUps.map((a) => [
                  `${fmtDate(a.date)} · S${a.season}`,
                  a.team === pr.team ? a.opp : a.team,
                  <button key="w" onClick={() => onOpenMatch(a.matchId)} className="font-semibold text-white hover:text-jcc-accent-dark">{pr.nameOf(a.p)}</button>,
                  a.runnerUp!.line,
                  a.margin.toFixed(1),
                ])}
              />
            </Sec>
          )}
        </>
      ),
    });
  }

  cards.push({
    id: "chances", tab: "Opportunity", kicker: "Opportunity", title: "How many chances he gets",
    body: (
      <>
        <Kpis>
          <Kpi label="Attendance" value={`${pr.attendance.present}/${pr.attendance.teamMatches}`} sub={`${pr.attendance.pct}% of his team's matches${pr.attendance.guest ? ` · +${pr.attendance.guest} as guest` : ""}`} />
          <Kpi label="Batted in" value={pr.chances.battedIn} sub={`avg position ${f1(pr.chances.avgPos)}`} />
          <Kpi label="Balls faced / match" value={f1(pr.chances.ballsPerMatch)} sub={`team avg ${f1(pr.chances.teamBallsPerMatch)}`} />
          <Kpi label="Bowled in" value={`${f0(pr.chances.bowlShare)}%`} sub={`${f1(pr.chances.oversPerMatch)} overs / match`} />
        </Kpis>
        {(pr.chances.underusedBat || pr.chances.underusedBowl) ? (
          <p className="rounded-lg bg-jcc-accent/10 px-3 py-2.5 text-[13px] text-white">
            <b className="text-jcc-accent-dark">Deserves more chances. </b>
            {pr.chances.underusedBat && `Strikes at ${f0(pr.B.sr)} (league ${f0(LB.sr)}) but faces fewer balls than his teammates. `}
            {pr.chances.underusedBowl && `Economy ${f2(pr.W.econ)} (league ${f2(LW.econ)}) but bowls in only ${f0(pr.chances.bowlShare)}% of his matches.`}
          </p>
        ) : (
          <p className="text-[13px] text-jcc-text-muted">His share of the batting and bowling matches his numbers.</p>
        )}
        <p className="mt-3 text-xs text-jcc-text-muted">Attendance counts a match when he batted, bowled or took a fielding dismissal. CricHeroes doesn&apos;t list players who did none of those, so true attendance may be a little higher.</p>
      </>
    ),
  });

  return cards;
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export default function PlayerDeck({
  data,
  seasons,
  scopeLabel,
  player,
  card,
  order,
  onNavigate,
  onClose,
  onOpenMatch,
}: {
  data: CardData;
  seasons: number[];
  scopeLabel: string;
  player: number;
  card?: string;
  order: number[];
  onNavigate: (player: number, card?: string) => void;
  onClose: () => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pr = useMemo(() => playerProfile(data, seasons, player), [data, seasons, player]);
  const holders = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of leagueInsights(data, seasons).badges) for (const b of r.badges) m.set(b.label, (m.get(b.label) ?? 0) + 1);
    return m;
  }, [data, seasons]);
  const momA = useMemo(() => momAnalytics(data, seasons), [data, seasons]);
  const cards = useMemo(() => (pr ? buildCards(pr, scopeLabel, setTip, holders, momA, onOpenMatch) : []), [pr, scopeLabel, holders, momA, onOpenMatch]);
  const idx = Math.max(0, cards.findIndex((c) => c.id === card));
  const go = (i: number) => {
    const c = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (c) onNavigate(player, c.id);
  };
  const pos = order.indexOf(player);
  const tabsRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; dx: number } | null>(null);
  const [drag, setDrag] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    // Scroll only the tab strip; scrollIntoView would also pan the page on phones.
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (strip && tab) strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [idx, player]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!pr) return null;
  const current = cards[idx];

  const link = () => `${window.location.origin}${window.location.pathname}#${deckHash(pr.name, current?.id)}`;
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("Couldn't copy. Copy the address bar instead.");
    }
  };
  const summary = () => {
    const b = pr.B, w = pr.W;
    const lines = [`${pr.name} · ${pr.teams.join("/")} · ${scopeLabel}`];
    if (pr.badges.length) lines.push(`🏷️ ${pr.badges.slice(0, 6).map((x) => x.label).join(", ")}`);
    if (b.inns) lines.push(`🏏 ${b.runs} runs, ${b.inns} inns, avg ${f1(b.avg)}, SR ${f1(b.sr)}, HS ${b.hs}, ${b.f4}×4 ${b.s6}×6, ${b.ducks} ducks`);
    if (w.spells) lines.push(`🎯 ${w.wk} wkts in ${ov(w.balls)} ov, econ ${f2(w.econ)}, best ${w.best}, ${w.dots} dots`);
    if (pr.F.total) lines.push(`🧤 ${pr.F.c} catches, ${pr.F.ro} run outs, ${pr.F.st} stumpings`);
    const tips = [...pr.tips.batting, ...pr.tips.bowling].slice(0, 3).map((t) => t.title);
    if (tips.length) lines.push(`Next steps: ${tips.join("; ")}`);
    lines.push(link());
    return lines.join("\n");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#0D1728]/90 px-2 pb-3 pt-3 backdrop-blur-md sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${pr.name} player cards`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-auto mb-2 flex w-full max-w-4xl items-center gap-2 text-[#FCFBF8]">
        <DeckButton onClick={() => onNavigate(order[pos - 1], current?.id)} disabled={pos <= 0} label="Previous player"><ChevronLeft size={16} /><span className="hidden sm:inline">Prev</span></DeckButton>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 sm:justify-start">
          <Avatar name={pr.name} size={30} ring="rgba(212,175,55,0.8)" />
          <span className="truncate text-sm font-semibold">{pr.name}</span>
        </div>
        <DeckButton onClick={() => copy(summary(), "Summary copied, ready to paste")} label="Copy summary"><ClipboardCopy size={15} /><span className="hidden sm:inline">Summary</span></DeckButton>
        <DeckButton onClick={() => copy(link(), "Link copied")} label="Copy link"><Link2 size={15} /><span className="hidden sm:inline">Link</span></DeckButton>
        <DeckButton onClick={() => onNavigate(order[pos + 1], current?.id)} disabled={pos < 0 || pos >= order.length - 1} label="Next player"><span className="hidden sm:inline">Next</span><ChevronRight size={16} /></DeckButton>
        <DeckButton onClick={onClose} label="Close"><X size={16} /></DeckButton>
      </div>

      <div ref={tabsRef} role="tablist" className="relative mx-auto mb-2 flex w-full max-w-4xl gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {cards.map((c, i) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={i === idx}
            onClick={() => go(i)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${i === idx ? "border-jcc-accent bg-jcc-accent text-jcc-seam shadow-[0_6px_18px_-6px_rgba(212,175,55,0.7)]" : "border-[#FCFBF8]/25 bg-[#FCFBF8]/[0.06] text-[#FCFBF8]/85 hover:border-[#FCFBF8]/50 hover:bg-[#FCFBF8]/[0.12] hover:text-[#FCFBF8]"}`}
          >
            {c.tab}
          </button>
        ))}
      </div>

      <div
        className="relative mx-auto min-h-0 w-full max-w-4xl flex-1 touch-pan-y overflow-hidden rounded-2xl"
        onPointerDown={(e) => { if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, dx: 0 }; }}
        onPointerMove={(e) => {
          const s = swipe.current;
          if (!s) return;
          s.dx = e.clientX - s.x;
          if (Math.abs(s.dx) > Math.abs(e.clientY - s.y) && Math.abs(s.dx) > 8) setDrag(s.dx);
        }}
        onPointerUp={() => {
          const s = swipe.current;
          swipe.current = null;
          setDrag(0);
          if (s && s.dx < -50) go(idx + 1);
          else if (s && s.dx > 50) go(idx - 1);
        }}
        onPointerCancel={() => { swipe.current = null; setDrag(0); }}
      >
        <div
          className="flex h-full"
          style={{ transform: `translateX(calc(${-100 * idx}% + ${drag}px))`, transition: drag ? "none" : "transform .35s cubic-bezier(.2,.8,.2,1)" }}
        >
          {cards.map((c, i) => (
            <article
              key={c.id}
              aria-hidden={i !== idx}
              className="h-full w-full shrink-0 overflow-y-auto rounded-2xl bg-jcc-navy p-5 text-white shadow-2xl sm:p-7"
            >
              <header className="mb-5 border-b border-jcc-border pb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-jcc-accent-dark">{c.kicker}</p>
                <h2 className="mt-1 font-heading text-3xl font-bold leading-tight text-white">{c.title}</h2>
              </header>
              {Math.abs(i - idx) <= 1 ? c.body : null}
            </article>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-4xl items-center justify-between gap-3">
        <DeckButton onClick={() => go(idx - 1)} disabled={idx === 0} label="Previous card"><ChevronLeft size={16} /></DeckButton>
        <div className="flex flex-wrap justify-center gap-1.5">
          {cards.map((c, i) => (
            <button key={c.id} aria-label={c.tab} onClick={() => go(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-jcc-accent" : "w-1.5 bg-[#FCFBF8]/40 hover:bg-[#FCFBF8]/70"}`} />
          ))}
        </div>
        <DeckButton onClick={() => go(idx + 1)} disabled={idx === cards.length - 1} label="Next card"><ChevronRight size={16} /></DeckButton>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-[70] max-w-[260px] rounded-lg bg-jcc-blue px-3 py-2 text-xs leading-snug text-[#FCFBF8] shadow-xl"
          style={{ left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 270), top: Math.max(8, tip.y - 90) }}
        >
          {tip.body}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-jcc-accent px-4 py-2 text-sm font-bold text-jcc-seam shadow-xl">{toast}</div>
      )}
    </div>
  );
}

function DeckButton({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border border-[#FCFBF8]/25 bg-[#FCFBF8]/[0.08] px-3 text-[13px] font-semibold text-[#FCFBF8] transition hover:border-[#FCFBF8]/50 hover:bg-[#FCFBF8]/15 disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}
