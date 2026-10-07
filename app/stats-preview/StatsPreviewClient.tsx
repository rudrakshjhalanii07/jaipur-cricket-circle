"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { Trophy, Target, Flame, Hand, Zap, Shield } from "lucide-react";
import type {
  BattingRow,
  BowlingRow,
  InningsRecord,
  ScopeKey,
  ScopeStats,
} from "@/lib/scorecard-dashboard/compute";
import { teamByName } from "@/lib/teams";
import { manOfTheMatch, slug, type CardData } from "@/lib/scorecard-dashboard/profile";
import PlayerDeck, { deckHash } from "./PlayerDeck";
import AnalyticsSection from "./AnalyticsSection";
import MatchScorecard from "./MatchScorecard";

// Everything rendered here is either a number or a string formatted on the
// server — no toLocale* calls, so server and client HTML always match.
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const dp = (n: number | null, places = 2) => (n === null ? "–" : n.toFixed(places));

const SECTIONS = [
  ["table", "Table"],
  ["batting", "Batting"],
  ["bowling", "Bowling"],
  ["fielding", "Fielding"],
  ["analytics", "Analytics"],
  ["records", "Records"],
  ["results", "Results"],
] as const;

const SEASONS: Record<ScopeKey, number[]> = { s2: [2], s3: [3], all: [2, 3] };

/** Opens a player's flash cards by CricHeroes ID (the merged ID the tables use). */
const OpenPlayer = createContext<(id: string, order?: string[]) => void>(() => {});

// ─── Small pieces ────────────────────────────────────────────────────────────

function TeamLogo({ name, size = 20 }: { name: string; size?: number }) {
  const team = teamByName(name);
  if (!team) return null;
  return (
    <Image
      src={team.logo}
      alt={team.name}
      title={team.name}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function PlayerCell({ name, teams }: { name: string; teams: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {teams.map((t) => (
          <span key={t} className="rounded-full bg-jcc-navy ring-2 ring-jcc-navy">
            <TeamLogo name={t} size={22} />
          </span>
        ))}
      </div>
      <span className="font-semibold text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{name}</span>
    </div>
  );
}

/** The ranking stat, with a bar scaled to the leader. */
function BarStat({ value, max, label }: { value: number; max: number; label?: string }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-jcc-navy-light sm:block">
        <div
          className="h-full rounded-full bg-gradient-to-r from-jcc-accent-dark to-jcc-accent"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-9 text-right font-heading text-base font-bold text-white">{label ?? value}</span>
    </div>
  );
}

function SectionTitle({ id, kicker, title, note }: { id: string; kicker: string; title: string; note?: string }) {
  return (
    <div id={id} className="mb-5 scroll-mt-40 border-b border-jcc-border pb-4 pt-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-jcc-accent-dark">{kicker}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">{title}</h2>
        {note && <p className="text-xs text-jcc-text-muted">{note}</p>}
      </div>
    </div>
  );
}

type Col = { head: string; align?: "left" | "right"; className?: string };

function DataTable({ cols, rows }: { cols: Col[]; rows: { key: string; cells: ReactNode[]; highlight?: boolean; onClick?: () => void }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-jcc-border bg-jcc-navy shadow-[0_1px_2px_rgba(18,35,63,0.04),0_8px_24px_-12px_rgba(18,35,63,0.12)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-jcc-blue text-[10.5px] uppercase tracking-[0.14em] text-[#FCFBF8]/75">
              {cols.map((c) => (
                <th
                  key={c.head}
                  className={`px-3 py-3 font-semibold first:pl-5 last:pr-5 ${c.align === "left" ? "text-left" : "text-right"} ${c.className ?? ""}`}
                >
                  {c.head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                onClick={r.onClick}
                onKeyDown={r.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.onClick!(); } } : undefined}
                tabIndex={r.onClick ? 0 : undefined}
                className={`group border-t border-jcc-border transition-colors hover:bg-jcc-navy-light/70 ${r.onClick ? "cursor-pointer" : ""} ${r.highlight ? "bg-jcc-accent/[0.06]" : ""}`}
              >
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`whitespace-nowrap px-3 py-2.5 tabular-nums first:pl-5 last:pr-5 ${cols[i].align === "left" ? "text-left" : "text-right"} ${cols[i].className ?? ""}`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  const medal = n === 1 ? "bg-jcc-accent text-jcc-seam" : n <= 3 ? "bg-jcc-accent/15 text-jcc-accent-dark" : "text-jcc-text-muted";
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${medal}`}>{n}</span>
  );
}

function ShowAll({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  return (
    <div className="mt-3 flex justify-center">
      <button
        onClick={onToggle}
        className="rounded-full border border-jcc-border bg-jcc-navy px-5 py-2 text-xs font-semibold uppercase tracking-wider text-jcc-text-muted transition hover:border-jcc-accent/60 hover:text-white"
      >
        {open ? "Show top 10" : `Show all ${total}`}
      </button>
    </div>
  );
}

// ─── Leaders ─────────────────────────────────────────────────────────────────

function LeaderCard({
  icon,
  title,
  name,
  teams,
  value,
  unit,
  detail,
  featured,
  id,
}: {
  id?: string;
  icon: ReactNode;
  title: string;
  name: string;
  teams: string[];
  value: string | number;
  unit: string;
  detail: string;
  featured?: "orange" | "purple";
}) {
  const open = useContext(OpenPlayer);
  const ring =
    featured === "orange"
      ? "from-[#F59E0B] to-[#EA580C]"
      : featured === "purple"
        ? "from-[#8B5CF6] to-[#6D28D9]"
        : "from-jcc-accent-highlight to-jcc-accent-dark";
  return (
    <button
      type="button"
      onClick={() => id && open(id)}
      className="relative overflow-hidden rounded-2xl border border-jcc-border bg-jcc-navy p-5 text-left shadow-[0_8px_30px_-16px_rgba(18,35,63,0.25)] transition hover:-translate-y-0.5 hover:border-jcc-accent/60"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ring}`} />
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-jcc-text-muted">{title}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-white ${ring}`}>{icon}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-heading text-4xl font-bold leading-none text-white">{value}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-jcc-text-muted">{unit}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {teams.map((t) => (
          <TeamLogo key={t} name={t} size={20} />
        ))}
        <span className="truncate font-semibold text-white">{name}</span>
      </div>
      <p className="mt-1 text-xs text-jcc-text-muted">{detail}</p>
    </button>
  );
}

function Leaders({ s }: { s: ScopeStats }) {
  const runs = s.batting[0];
  const wkts = s.bowling[0];
  const sixes = [...s.batting].sort((a, b) => b.sixes - a.sixes || b.strikeRate - a.strikeRate)[0];
  const fielder = s.fielding[0];
  const fielderTeams = s.batting.find((b) => b.id === fielder?.id)?.teams ?? s.bowling.find((b) => b.id === fielder?.id)?.teams ?? [];
  // Rate leaders need a floor so a 2-ball cameo doesn't top the list.
  const minBalls = s.key === "all" ? 120 : 60;
  const minOvers = s.key === "all" ? 15 : 8;
  const sr = [...s.batting].filter((b) => b.balls >= minBalls).sort((a, b) => b.strikeRate - a.strikeRate)[0];
  const econ = [...s.bowling].filter((b) => b.balls >= minOvers * 6).sort((a, b) => a.economy - b.economy)[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {runs && (
        <LeaderCard id={runs.id} featured="orange" icon={<Trophy size={14} />} title="Orange Cap" name={runs.name} teams={runs.teams} value={runs.runs} unit="runs" detail={`${runs.innings} inns · SR ${runs.strikeRate.toFixed(1)} · HS ${runs.highest}`} />
      )}
      {wkts && (
        <LeaderCard id={wkts.id} featured="purple" icon={<Target size={14} />} title="Purple Cap" name={wkts.name} teams={wkts.teams} value={wkts.wickets} unit="wkts" detail={`${wkts.overs} ov · Econ ${wkts.economy.toFixed(2)} · Best ${wkts.best}`} />
      )}
      {sixes && (
        <LeaderCard id={sixes.id} icon={<Flame size={14} />} title="Most Sixes" name={sixes.name} teams={sixes.teams} value={sixes.sixes} unit="sixes" detail={`${sixes.fours} fours · ${sixes.runs} runs`} />
      )}
      {sr && (
        <LeaderCard id={sr.id} icon={<Zap size={14} />} title="Best Strike Rate" name={sr.name} teams={sr.teams} value={sr.strikeRate.toFixed(1)} unit="SR" detail={`${sr.runs} off ${sr.balls} · min ${minBalls} balls`} />
      )}
      {econ && (
        <LeaderCard id={econ.id} icon={<Shield size={14} />} title="Best Economy" name={econ.name} teams={econ.teams} value={econ.economy.toFixed(2)} unit="RPO" detail={`${econ.overs} ov · ${econ.wickets} wkts · min ${minOvers} overs`} />
      )}
      {fielder && (
        <LeaderCard id={fielder.id} icon={<Hand size={14} />} title="Top Fielder" name={fielder.name} teams={fielderTeams} value={fielder.total} unit="dismissals" detail={`${fielder.catches} ct · ${fielder.stumpings} st · ${fielder.runOuts} run-outs`} />
      )}
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Standings({ s }: { s: ScopeStats }) {
  return (
    <div className="grid gap-3">
      {s.standings.map((t, i) => {
        const team = teamByName(t.team);
        const color = team?.primary ?? "#12233F";
        return (
          <div
            key={t.team}
            className="relative grid grid-cols-[auto_1fr_auto] items-center gap-4 overflow-hidden rounded-2xl border border-jcc-border bg-jcc-navy py-4 pl-5 pr-5 shadow-[0_6px_20px_-14px_rgba(18,35,63,0.3)] md:grid-cols-[auto_1fr_auto_auto_auto]"
          >
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
            <div className="flex items-center gap-3">
              <span className="w-5 text-center font-heading text-xl font-bold text-jcc-text-muted">{i + 1}</span>
              <TeamLogo name={t.team} size={44} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-heading text-lg font-bold text-white md:text-xl">{t.team}</div>
              <div className="mt-0.5 text-xs text-jcc-text-muted">
                P {t.played} · W {t.won} · L {t.lost}
                {t.tied ? ` · T ${t.tied}` : ""}
              </div>
            </div>
            <div className="hidden items-center gap-1 md:flex" title="Last 5 results, oldest → newest">
              {t.form.slice(-5).map((r, k) => (
                <span
                  key={k}
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${
                    r === "W" ? "bg-emerald-600/90 text-white" : r === "L" ? "bg-jcc-danger/85 text-white" : "bg-jcc-navy-light text-jcc-text-muted"
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
            <div className="hidden text-right md:block">
              <div className="text-[10px] uppercase tracking-wider text-jcc-text-muted">NRR</div>
              <div className={`font-semibold tabular-nums ${t.nrr >= 0 ? "text-emerald-700" : "text-jcc-danger"}`}>
                {t.nrr > 0 ? "+" : ""}
                {t.nrr.toFixed(3)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading text-3xl font-bold leading-none text-white">{t.points}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-jcc-text-muted">
                pts · {t.pct.toFixed(1)}%
                <span className="md:hidden">
                  {" "}
                  · {t.nrr > 0 ? "+" : ""}
                  {t.nrr.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BattingTable({ rows }: { rows: BattingRow[] }) {
  const [open, setOpen] = useState(false);
  const openPlayer = useContext(OpenPlayer);
  const shown = open ? rows : rows.slice(0, 10);
  const max = rows[0]?.runs ?? 0;
  return (
    <>
      <DataTable
        cols={[
          { head: "#", align: "left", className: "w-10" },
          { head: "Player", align: "left" },
          { head: "Runs" },
          { head: "M" },
          { head: "Inn" },
          { head: "NO" },
          { head: "HS" },
          { head: "Avg" },
          { head: "SR" },
          { head: "30s" },
          { head: "50s" },
          { head: "4s" },
          { head: "6s" },
        ]}
        rows={shown.map((p, i) => ({
          key: p.id,
          highlight: i === 0,
          onClick: () => openPlayer(p.id, rows.map((r) => r.id)),
          cells: [
            <Rank key="r" n={i + 1} />,
            <PlayerCell key="p" name={p.name} teams={p.teams} />,
            <BarStat key="b" value={p.runs} max={max} />,
            p.matches,
            p.innings,
            p.notOuts,
            p.highest,
            dp(p.average),
            p.strikeRate.toFixed(2),
            p.thirties,
            p.fifties,
            p.fours,
            p.sixes,
          ],
        }))}
      />
      {rows.length > 10 && <ShowAll total={rows.length} open={open} onToggle={() => setOpen((v) => !v)} />}
    </>
  );
}

function BowlingTable({ rows }: { rows: BowlingRow[] }) {
  const [open, setOpen] = useState(false);
  const openPlayer = useContext(OpenPlayer);
  const shown = open ? rows : rows.slice(0, 10);
  const max = rows[0]?.wickets ?? 0;
  return (
    <>
      <DataTable
        cols={[
          { head: "#", align: "left", className: "w-10" },
          { head: "Player", align: "left" },
          { head: "Wkts" },
          { head: "M" },
          { head: "Overs" },
          { head: "Runs" },
          { head: "Best" },
          { head: "Econ" },
          { head: "Avg" },
          { head: "Dot %" },
          { head: "Mdn" },
          { head: "Wd" },
          { head: "Nb" },
        ]}
        rows={shown.map((p, i) => ({
          key: p.id,
          highlight: i === 0,
          onClick: () => openPlayer(p.id, rows.map((r) => r.id)),
          cells: [
            <Rank key="r" n={i + 1} />,
            <PlayerCell key="p" name={p.name} teams={p.teams} />,
            <BarStat key="b" value={p.wickets} max={max} />,
            p.matches,
            p.overs,
            p.runs,
            p.best,
            p.economy.toFixed(2),
            dp(p.average),
            p.dotPct.toFixed(1),
            p.maidens,
            p.wides,
            p.noBalls,
          ],
        }))}
      />
      {rows.length > 10 && <ShowAll total={rows.length} open={open} onToggle={() => setOpen((v) => !v)} />}
    </>
  );
}

function FieldingTable({ s }: { s: ScopeStats }) {
  const [open, setOpen] = useState(false);
  const openPlayer = useContext(OpenPlayer);
  const rows = open ? s.fielding : s.fielding.slice(0, 10);
  const max = s.fielding[0]?.total ?? 0;
  const teamsOf = (id: string) => s.batting.find((b) => b.id === id)?.teams ?? s.bowling.find((b) => b.id === id)?.teams ?? [];
  return (
    <>
      <DataTable
        cols={[
          { head: "#", align: "left", className: "w-10" },
          { head: "Player", align: "left" },
          { head: "Total" },
          { head: "Catches" },
          { head: "Stumpings" },
          { head: "Run-outs" },
        ]}
        rows={rows.map((f, i) => ({
          key: f.id,
          highlight: i === 0,
          onClick: f.id.startsWith("name:") ? undefined : () => openPlayer(f.id, s.fielding.map((r) => r.id)),
          cells: [
            <Rank key="r" n={i + 1} />,
            <PlayerCell key="p" name={f.name} teams={teamsOf(f.id)} />,
            <BarStat key="b" value={f.total} max={max} />,
            f.catches,
            f.stumpings,
            f.runOuts,
          ],
        }))}
      />
      {s.fielding.length > 10 && <ShowAll total={s.fielding.length} open={open} onToggle={() => setOpen((v) => !v)} />}
    </>
  );
}

function RecordCard({ title, items, teamFromLabel }: { title: string; items: InningsRecord[]; teamFromLabel?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-jcc-border bg-jcc-navy p-5 shadow-[0_6px_20px_-14px_rgba(18,35,63,0.3)]">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">{title}</h3>
      <ol className="divide-y divide-jcc-border">
        {items.map((r, i) => (
          <li key={`${r.matchId}-${r.label}-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{i + 1}</span>
            {teamFromLabel && <TeamLogo name={r.label} size={22} />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">{r.label}</div>
              <div className="truncate text-[11.5px] text-jcc-text-muted">
                {r.sub} · {r.date}
                {r.tenOver && (
                  <span className="ml-1.5 rounded-full bg-jcc-accent/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-jcc-accent-dark">
                    10 ov
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-white">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Results({ s, onOpen, mom }: { s: ScopeStats; onOpen: (matchId: string) => void; mom: Map<string, { name: string; team: string }> }) {
  return (
    <div className="space-y-8">
      {s.matchdays.map((d) => (
        <div key={d.date}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">{d.label}</h3>
            <span className="text-xs text-jcc-text-muted">
              {d.matches.length} {d.matches.length === 1 ? "match" : "matches"} · {d.matches[0].venue}
            </span>
            <div className="h-px flex-1 bg-jcc-border" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.matches.map((m) => {
              const winner = m.lines.find((l) => l.won);
              const color = (winner && teamByName(winner.team)?.primary) || "#667085";
              return (
                <button
                  key={m.matchId}
                  type="button"
                  onClick={() => onOpen(m.matchId)}
                  aria-label={`Full scorecard: ${m.lines.map((l) => l.team).join(" v ")}`}
                  className="group relative overflow-hidden rounded-xl border border-jcc-border bg-jcc-navy p-4 text-left transition hover:-translate-y-0.5 hover:border-jcc-accent/60 hover:shadow-[0_12px_28px_-16px_rgba(18,35,63,0.4)]"
                >
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
                  <div className="space-y-2">
                    {m.lines.map((l) => (
                      <div key={l.team} className="flex items-center gap-2 text-sm">
                        <TeamLogo name={l.team} size={20} />
                        <span className={`flex-1 truncate ${l.won ? "font-bold text-white" : "text-jcc-text-muted"}`}>{l.team}</span>
                        <span className={`tabular-nums ${l.won ? "font-bold text-white" : "text-jcc-text-muted"}`}>{l.score}</span>
                      </div>
                    ))}
                  </div>
                  {mom.get(m.matchId) && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px]">
                      <Trophy size={12} className="shrink-0 text-jcc-accent-dark" />
                      <span className="text-jcc-text-muted">Player of the Match</span>
                      <span className="truncate font-semibold text-white">{mom.get(m.matchId)!.name}</span>
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-jcc-border pt-2.5 text-[11.5px]">
                    <span className="font-semibold text-jcc-accent-dark">{m.result}</span>
                    <span className="flex items-center gap-1.5">
                      {m.overs !== 7 && (
                        <span className="rounded-full bg-jcc-accent/15 px-1.5 py-px text-[9.5px] font-bold uppercase text-jcc-accent-dark">
                          {m.overs} ov
                        </span>
                      )}
                      <span className="text-[10.5px] font-semibold text-jcc-text-muted transition group-hover:text-jcc-accent-dark">Scorecard →</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StatsPreviewClient({ scopes, cardData }: { scopes: ScopeStats[]; cardData: CardData }) {
  const [key, setKey] = useState<ScopeKey>("s3");
  const s = scopes.find((x) => x.key === key)!;
  const seasons = SEASONS[key];

  // Player flash cards. The URL hash (#player-<name>.<card>) makes a deck shareable.
  const [deck, setDeck] = useState<{ p: number; card?: string; order: number[] } | null>(null);
  const [matchOpen, setMatchOpen] = useState<string | null>(null);
  const closeMatch = () => setMatchOpen(null);
  const momById = useMemo(() => {
    const out = new Map<string, { name: string; team: string }>();
    for (const [m, x] of manOfTheMatch(cardData)) out.set(cardData.matches[m].id, { name: cardData.players[x.p], team: x.team });
    return out;
  }, [cardData]);
  const indexOfId = useMemo(() => new Map(cardData.playerIds.map((id, i) => [id, i])), [cardData]);
  const setHash = (h: string | null) => {
    window.history.replaceState(null, "", h ? `#${h}` : window.location.pathname + window.location.search);
  };
  const openIndex = useCallback(
    (p: number, card?: string, order?: number[]) => {
      setDeck((d) => ({ p, card, order: order ?? d?.order ?? [p] }));
      setHash(deckHash(cardData.players[p], card));
    },
    [cardData],
  );
  const openById = useCallback(
    (id: string, order?: string[]) => {
      const p = indexOfId.get(id);
      if (p == null) return;
      openIndex(p, undefined, order?.map((x) => indexOfId.get(x)).filter((x): x is number => x != null));
    },
    [indexOfId, openIndex],
  );
  useEffect(() => {
    // Opens the deck named in the hash: on arrival from a shared link, and on back/forward.
    const fromHash = () => {
      const m = window.location.hash.match(/^#player-([a-z0-9-]+)(?:\.([a-z-]+))?$/);
      const p = m ? cardData.players.findIndex((n) => slug(n) === m[1]) : -1;
      if (!m || p < 0) return setDeck(null);
      setKey("all");
      setDeck((d) => ({ p, card: m[2], order: d?.order.includes(p) ? d.order : [p] }));
    };
    const frame = requestAnimationFrame(fromHash);
    window.addEventListener("hashchange", fromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [cardData]);
  const { summary } = s;

  const heroStats: [string, string | number][] = [
    ["Matches", summary.matches],
    ["Runs", thousands(summary.runs)],
    ["Wickets", summary.wickets],
    ["Sixes", summary.sixes],
    ["Fours", summary.fours],
    ["Avg 1st inns", summary.avgFirstInnings],
  ];
  const totalWins = summary.defendsWon + summary.chasesWon;
  const chasePct = totalWins ? Math.round((summary.chasesWon / totalWins) * 100) : 0;

  return (
    <OpenPlayer.Provider value={openById}>
    <main className="pb-24">
      {/* Hero — Royal Blue band */}
      <section className="theme-static-dark section-bg-royal relative overflow-hidden pb-14 pt-32 md:pt-36">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-jcc-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#3B6FC4]/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-jcc-accent/40 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-jcc-accent-highlight">
            <span className="h-1.5 w-1.5 rounded-full bg-jcc-accent-highlight" /> Preview · not linked yet
          </span>
          <h1 className="mt-5 font-heading text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">
            The Numbers<span className="text-jcc-accent">.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-jcc-text-muted md:text-base">
            Every scorecard from Seasons 2 and 3. 58 matches, 14 Jun – 2 Oct 2026, straight from CricHeroes.
          </p>

          <div className="mt-8 inline-flex rounded-full border border-white/15 bg-white/[0.06] p-1">
            {scopes.map((sc) => (
              <button
                key={sc.key}
                onClick={() => setKey(sc.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition md:px-5 ${
                  sc.key === key ? "bg-jcc-accent text-jcc-seam shadow-[0_4px_16px_-4px_rgba(212,175,55,0.6)]" : "text-white/70 hover:text-white"
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-3 gap-y-6 border-t border-white/10 pt-8 md:grid-cols-6">
            {heroStats.map(([label, value]) => (
              <div key={label} className="border-white/10 px-1 md:border-l md:px-5 md:first:border-l-0 md:first:pl-0">
                <div className="font-heading text-3xl font-bold tabular-nums md:text-4xl">{value}</div>
                <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-jcc-accent-highlight/90">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 max-w-md">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-white/70">
              <span>Won batting first · {summary.defendsWon}</span>
              <span>Won chasing · {summary.chasesWon}</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10">
              <div className="bg-jcc-accent" style={{ width: `${100 - chasePct}%` }} />
              <div className="bg-[#60A5FA]" style={{ width: `${chasePct}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Section nav */}
      <nav className="sticky top-16 z-20 border-b border-jcc-border bg-jcc-navy-deep/85 backdrop-blur-md md:top-20">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2.5">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-jcc-text-muted transition hover:bg-jcc-navy-light hover:text-white"
            >
              {label}
            </a>
          ))}
          <span className="ml-auto hidden items-center whitespace-nowrap pl-4 text-xs font-semibold text-jcc-accent-dark md:flex">{s.label}</span>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4">
        <div className="pt-10">
          <Leaders s={s} />
        </div>

        <SectionTitle
          id="table"
          kicker="Standings"
          title="Points Table"
          note={`${key === "all" ? "Both seasons combined · " : ""}Win 2 · Tie 1 · ranked by points %, then NRR`}
        />
        <Standings s={s} />

        <SectionTitle id="batting" kicker="Orange Cap race" title="Batting" note="Most runs · ties: strike rate, then average · tap a player for their cards" />
        <BattingTable rows={s.batting} />

        <SectionTitle id="bowling" kicker="Purple Cap race" title="Bowling" note="Most wickets · ties: economy, then runs conceded" />
        <BowlingTable rows={s.bowling} />

        <SectionTitle id="fielding" kicker="In the field" title="Fielding" note="From dismissal text · every fielder named in a run-out is credited" />
        <FieldingTable s={s} />

        <SectionTitle
          id="analytics"
          kicker="Cricket analytics"
          title="Analytics"
          note="Leaderboards, death overs, team DNA, player labels, attendance · tap any player for their cards"
        />
        <AnalyticsSection data={cardData} seasons={seasons} onOpenPlayer={(p, card) => openIndex(p, card, [p])} onOpenMatch={setMatchOpen} />

        <SectionTitle id="records" kicker="Hall of fame" title="Records" note="10 ov = one of the three 10-over matches on 26 Jun" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RecordCard title="Top individual scores" items={s.topScores} />
          <RecordCard title="Best bowling figures" items={s.bestSpells} />
          <RecordCard title="Biggest wins" items={s.biggestWins} teamFromLabel />
          <RecordCard title="Highest team totals" items={s.highestTotals} teamFromLabel />
          <RecordCard title="Lowest totals (batting first)" items={s.lowestTotals} teamFromLabel />
        </div>

        <SectionTitle id="results" kicker="Match by match" title="Results" note="Newest first" />
        <Results s={s} onOpen={setMatchOpen} mom={momById} />

        <p className="mt-14 text-center text-xs text-jcc-text-muted">
          Retired-hurt innings are counted as retired out. Guests count for the side they played for that day.
        </p>
      </div>
      {matchOpen && (
        <MatchScorecard
          data={cardData}
          matchId={matchOpen}
          onClose={closeMatch}
          onOpenPlayer={(p) => { setMatchOpen(null); openIndex(p, undefined, [p]); }}
        />
      )}
      {deck && (
        <PlayerDeck
          data={cardData}
          seasons={seasons}
          scopeLabel={s.label}
          player={deck.p}
          card={deck.card}
          order={deck.order}
          onNavigate={(p, card) => openIndex(p, card)}
          onOpenMatch={(id) => { setDeck(null); setHash(null); setMatchOpen(id); }}
          onClose={() => { setDeck(null); setHash(null); }}
        />
      )}
    </main>
    </OpenPlayer.Provider>
  );
}
