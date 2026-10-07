"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  MIN_BALLS,
  f0,
  f1,
  f2,
  leaderboardRows,
  leagueInsights,
  ov,
  type BoardRow,
  type CardData,
} from "@/lib/scorecard-dashboard/profile";
import { teamByName } from "@/lib/teams";
import AchievementsTab from "./achievements";
import AllTimeXI from "./AllTimeXI";
import MoMSection from "./MoMSection";

type Metric = {
  key: string;
  label: string;
  /** Column shown as the ranking value. */
  value: (r: BoardRow) => number | null;
  fmt: (n: number) => string;
  low?: boolean;
  /** Rate metrics need a minimum sample. */
  qualify?: (r: BoardRow) => boolean;
  extra: (r: BoardRow) => string;
  note?: string;
};

const QB = (r: BoardRow) => r.balls >= MIN_BALLS;
const QW = (r: BoardRow) => r.bowlBalls >= MIN_BALLS;
const int = (n: number) => String(Math.round(n));

const METRICS: Record<"bat" | "bowl" | "field" | "awards", Metric[]> = {
  bat: [
    { key: "runs", label: "Most runs", value: (r) => r.runs, fmt: int, extra: (r) => `SR ${f0(r.sr)} · avg ${f1(r.avg)}` },
    { key: "s6", label: "Most sixes", value: (r) => r.s6, fmt: int, extra: (r) => `${r.runs} runs · a six every ${r.s6 ? f1(r.balls / r.s6) : "–"} balls` },
    { key: "f4", label: "Most fours", value: (r) => r.f4, fmt: int, extra: (r) => `${r.runs} runs` },
    { key: "bnd", label: "Most boundaries", value: (r) => r.bnd, fmt: int, extra: (r) => `${r.f4} fours · ${r.s6} sixes` },
    { key: "sr", label: "Best strike rate", value: (r) => r.sr, fmt: (n) => n.toFixed(1), qualify: QB, extra: (r) => `${r.runs} off ${r.balls}` },
    { key: "avg", label: "Best average", value: (r) => r.avg, fmt: (n) => n.toFixed(1), qualify: QB, extra: (r) => `${r.runs} runs` },
    { key: "bpb", label: "Fewest balls per boundary", value: (r) => r.bpb, fmt: (n) => n.toFixed(2), low: true, qualify: QB, extra: (r) => `${r.bnd} boundaries in ${r.balls} balls` },
    { key: "dotsFaced", label: "Most dot balls faced", value: (r) => r.dotsFaced, fmt: int, extra: (r) => `at least ${f0(r.dotFacedPct)}% of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "dotFacedPct", label: "Highest dot % faced", value: (r) => r.dotFacedPct, fmt: (n) => `${n.toFixed(0)}%`, qualify: QB, extra: (r) => `${r.dotsFaced} of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "dotFacedLow", label: "Lowest dot % faced", value: (r) => r.dotFacedPct, fmt: (n) => `${n.toFixed(0)}%`, low: true, qualify: QB, extra: (r) => `${r.dotsFaced} of ${r.balls} balls`, note: "Batters' dot balls are a minimum: every non-boundary run is counted as a single." },
    { key: "t30", label: "Most 30+ scores", value: (r) => r.t30, fmt: int, extra: (r) => `${r.runs} runs` },
    { key: "ducks", label: "Most ducks", value: (r) => r.ducks, fmt: int, extra: (r) => `${r.runs} runs` },
  ],
  bowl: [
    { key: "wk", label: "Most wickets", value: (r) => r.wk, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov · econ ${f2(r.econ)}` },
    { key: "econ", label: "Best economy", value: (r) => r.econ, fmt: (n) => n.toFixed(2), low: true, qualify: QW, extra: (r) => `${ov(r.bowlBalls)} ov · ${r.wk} wkts` },
    { key: "dots", label: "Most dot balls bowled", value: (r) => r.dots, fmt: int, extra: (r) => `${f0(r.dotPct)}% of ${r.bowlBalls} balls` },
    { key: "dotPct", label: "Best dot %", value: (r) => r.dotPct, fmt: (n) => `${n.toFixed(0)}%`, qualify: QW, extra: (r) => `${r.dots} dots in ${ov(r.bowlBalls)} ov` },
    { key: "death", label: "Wickets in the last 2 overs", value: (r) => r.death, fmt: int, extra: (r) => `${r.wk} wkts in all`, note: "Phase comes from the over each wicket fell in (fall-of-wicket record)." },
    { key: "powerplay", label: "Wickets in the first 2 overs", value: (r) => r.powerplay, fmt: int, extra: (r) => `${r.wk} wkts in all`, note: "Phase comes from the over each wicket fell in (fall-of-wicket record)." },
    { key: "ducksTaken", label: "Most ducks taken", value: (r) => r.ducksTaken, fmt: int, extra: (r) => `${r.wk} wkts` },
    { key: "hauls2", label: "Most 2+ wicket spells", value: (r) => r.hauls2, fmt: int, extra: (r) => `${r.wk} wkts` },
    { key: "maidens", label: "Most maidens", value: (r) => r.maidens, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov` },
    { key: "wides", label: "Most wides", value: (r) => r.wides, fmt: int, extra: (r) => `${ov(r.bowlBalls)} ov · ${r.noBalls} no-balls` },
  ],
  field: [
    { key: "fielding", label: "Most dismissals", value: (r) => r.fielding, fmt: int, extra: (r) => `${r.catches} ct · ${r.runOuts} ro · ${r.stumpings} st` },
    { key: "catches", label: "Most catches", value: (r) => r.catches, fmt: int, extra: (r) => `${r.matches} matches` },
    { key: "runOuts", label: "Most run outs", value: (r) => r.runOuts, fmt: int, extra: (r) => `${r.matches} matches` },
    { key: "stumpings", label: "Most stumpings", value: (r) => r.stumpings, fmt: int, extra: (r) => `${r.matches} matches` },
  ],
  awards: [
    { key: "mom", label: "Most Player of the Match awards", value: (r) => r.mom, fmt: int, extra: (r) => `in ${r.matches} matches · ${r.runs} runs · ${r.wk} wkts`, note: "Player of the Match is decided from the numbers: impact against that match's own scoring rate, with a 1.3× weight on the winning side." },
  ],
};

const TABS = [
  ["boards", "Leaderboards"],
  ["xi", "JCC All-Time XI"],
  ["mom", "Player of the Match"],
  ["kings", "Death overs & dots"],
  ["teams", "Team DNA"],
  ["labels", "Achievements"],
  ["attendance", "Attendance"],
  ["chances", "Fewer chances"],
] as const;
type TabKey = (typeof TABS)[number][0];


function Dot({ team }: { team: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: teamByName(team)?.primary ?? "#667085" }} />;
}

function Panel({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-jcc-border bg-jcc-navy p-5 shadow-[0_6px_20px_-14px_rgba(18,35,63,0.3)]">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-jcc-accent-dark">{title}</h3>
      {note && <p className="mt-1 text-xs text-jcc-text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? "border-jcc-blue bg-jcc-blue text-[#FCFBF8]" : "border-jcc-border bg-jcc-navy text-jcc-text-muted hover:border-jcc-accent/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function RankList({
  rows,
  value,
  extra,
  names,
  onOpen,
  limit = 10,
}: {
  rows: BoardRow[];
  value: (r: BoardRow) => string;
  extra: (r: BoardRow) => string;
  names: string[];
  onOpen: (p: number) => void;
  limit?: number;
}) {
  if (!rows.length) return <p className="text-sm text-jcc-text-muted">No one qualifies yet.</p>;
  return (
    <ol className="divide-y divide-jcc-border">
      {rows.slice(0, limit).map((r, i) => (
        <li key={r.p}>
          <button onClick={() => onOpen(r.p)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-jcc-navy-light/60">
            <span className={`w-5 shrink-0 text-center text-xs font-bold ${i === 0 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{i + 1}</span>
            <Dot team={r.team} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">{names[r.p]}</div>
              <div className="truncate text-[11.5px] text-jcc-text-muted">{extra(r)}</div>
            </div>
            <span className="shrink-0 font-heading text-lg font-bold tabular-nums text-white">{value(r)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export default function AnalyticsSection({
  data,
  seasons,
  onOpenPlayer,
  onOpenMatch,
}: {
  data: CardData;
  seasons: number[];
  onOpenPlayer: (p: number, card?: string) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>("boards");
  const [disc, setDisc] = useState<"bat" | "bowl" | "field" | "awards">("bat");
  const [metricKey, setMetricKey] = useState("s6");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => leaderboardRows(data, seasons), [data, seasons]);
  const L = useMemo(() => leagueInsights(data, seasons), [data, seasons]);
  const names = data.players;

  const metric = METRICS[disc].find((m) => m.key === metricKey) ?? METRICS[disc][0];
  const board = rows
    .filter((r) => (metric.qualify ? metric.qualify(r) : true) && metric.value(r) != null && (metric.low || (metric.value(r) ?? 0) > 0))
    .sort((a, b) => (metric.low ? metric.value(a)! - metric.value(b)! : metric.value(b)! - metric.value(a)!) || b.matches - a.matches);
  const top = board[0] ? metric.value(board[0]) ?? 0 : 0;

  const by = (f: (r: BoardRow) => number, filter: (r: BoardRow) => boolean = () => true) =>
    [...rows].filter((r) => filter(r) && f(r) > 0).sort((a, b) => f(b) - f(a));


  return (
    <div>
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(([k, l]) => (
          <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Chip>
        ))}
      </div>

      {tab === "boards" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(["bat", "bowl", "field", "awards"] as const).map((d) => (
                <Chip key={d} active={disc === d} onClick={() => { setDisc(d); setMetricKey(METRICS[d][0].key); setShowAll(false); }}>
                  {d === "bat" ? "Batting" : d === "bowl" ? "Bowling" : d === "field" ? "Fielding" : "Awards"}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 lg:flex-col">
              {METRICS[disc].map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setMetricKey(m.key); setShowAll(false); }}
                  aria-pressed={m.key === metric.key}
                  className={`rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition ${
                    m.key === metric.key ? "border-jcc-accent bg-jcc-accent/10 text-white" : "border-jcc-border bg-jcc-navy text-jcc-text-muted hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <Panel
            title={metric.label}
            note={[metric.qualify ? `Minimum ${MIN_BALLS} balls ${disc === "bowl" ? "bowled" : "faced"}.` : "", metric.note ?? "", "Tap a player to open their cards."].filter(Boolean).join(" ")}
          >
            {board.length ? (
              <ol className="divide-y divide-jcc-border">
                {(showAll ? board : board.slice(0, 15)).map((r, i) => {
                  const v = metric.value(r)!;
                  const w = metric.low ? (top / v) * 100 : top ? (v / top) * 100 : 0;
                  return (
                    <li key={r.p}>
                      <button onClick={() => onOpenPlayer(r.p)} className="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 py-2.5 text-left transition hover:bg-jcc-navy-light/60">
                        <span className={`text-center text-xs font-bold ${i === 0 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><Dot team={r.team} /><span className="truncate font-semibold text-white">{names[r.p]}</span></div>
                          <div className="truncate text-[11.5px] text-jcc-text-muted">{metric.extra(r)}</div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-jcc-navy-light sm:block">
                            <div className="h-full rounded-full bg-gradient-to-r from-jcc-accent-dark to-jcc-accent" style={{ width: `${Math.min(100, w)}%` }} />
                          </div>
                          <span className="w-14 text-right font-heading text-lg font-bold tabular-nums text-white">{metric.fmt(v)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="text-sm text-jcc-text-muted">No one qualifies in this season yet.</p>}
            {board.length > 15 && (
              <div className="mt-3 flex justify-center">
                <button onClick={() => setShowAll((v) => !v)} className="rounded-full border border-jcc-border px-5 py-2 text-xs font-semibold uppercase tracking-wider text-jcc-text-muted hover:text-white">
                  {showAll ? "Show top 15" : `Show all ${board.length}`}
                </button>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "kings" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel title="Death-over kings" note="Wickets in the last 2 overs of an innings, from the over each wicket fell.">
            <RankList rows={by((r) => r.death)} value={(r) => String(r.death)} extra={(r) => `${r.wk} wkts in all · econ ${f2(r.econ)}`} names={names} onOpen={(p) => onOpenPlayer(p, "wickets")} />
          </Panel>
          <Panel title="New-ball strikers" note="Wickets in the first 2 overs.">
            <RankList rows={by((r) => r.powerplay)} value={(r) => String(r.powerplay)} extra={(r) => `${r.wk} wkts in all · econ ${f2(r.econ)}`} names={names} onOpen={(p) => onOpenPlayer(p, "wickets")} />
          </Panel>
          <Panel title="Dot-ball monsters" note="Most dot balls bowled.">
            <RankList rows={by((r) => r.dots)} value={(r) => String(r.dots)} extra={(r) => `${f0(r.dotPct)}% of ${ov(r.bowlBalls)} ov`} names={names} onOpen={(p) => onOpenPlayer(p, "bowling")} />
          </Panel>
          <Panel title="Dot-ball squeeze" note={`Best dot-ball percentage, min ${MIN_BALLS} balls bowled.`}>
            <RankList rows={by((r) => r.dotPct ?? 0, QW)} value={(r) => `${f0(r.dotPct)}%`} extra={(r) => `${r.dots} dots · econ ${f2(r.econ)}`} names={names} onOpen={(p) => onOpenPlayer(p, "bowling")} />
          </Panel>
          <Panel title="Dot balls faced (min)" note="Batters who faced the most dot balls. A minimum: every non-boundary run is counted as a single.">
            <RankList rows={by((r) => r.dotsFaced)} value={(r) => String(r.dotsFaced)} extra={(r) => `at least ${f0(r.dotFacedPct)}% of ${r.balls} balls`} names={names} onOpen={(p) => onOpenPlayer(p, "scoring")} />
          </Panel>
          <Panel title="Four dots in a row">
            <p className="text-sm leading-relaxed text-white">
              Spotting a streak of consecutive dot balls needs every ball in order. The CricHeroes export has scorecard totals only, so this can&apos;t be worked out yet.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-jcc-text-muted">
              With CricHeroes&apos; ball-by-ball commentary we could add dot-ball streaks, true death-over runs and economy, and exact bowler-against-batter head-to-heads.
            </p>
          </Panel>
        </div>
      )}

      {tab === "teams" && (
        <div className="grid gap-4 md:grid-cols-2">
          {L.teams.map((t) => {
            const team = teamByName(t.team);
            return (
              <div key={t.team} className="relative overflow-hidden rounded-2xl border border-jcc-border bg-jcc-navy p-5 shadow-[0_6px_20px_-14px_rgba(18,35,63,0.3)]">
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: team?.primary ?? "#12233F" }} />
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-heading text-2xl font-bold text-white">{t.team}</h3>
                  <span className="text-xs font-semibold text-jcc-text-muted">{t.won}–{t.lost} · {t.players} players used</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.traits.length ? t.traits.map((tr) => (
                    <span key={tr} className="rounded-full border border-jcc-accent/40 bg-jcc-accent/10 px-2.5 py-0.5 text-[11.5px] font-bold text-jcc-accent-dark">{tr}</span>
                  )) : <span className="text-xs text-jcc-text-muted">A balanced side: nothing far from the league average.</span>}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 text-[12px]">
                  {([
                    ["Run rate", f2(t.runRate)],
                    ["Conceded", f2(t.conceded)],
                    ["Avg 1st inns", f1(t.avgFirst)],
                    ["Chasing", `${t.chase[0]}–${t.chase[1]}`],
                    ["Defending", `${t.defend[0]}–${t.defend[1]}`],
                    ["Sixes / match", f1(t.sixesPerMatch)],
                    ["Runs in boundaries", `${f0(t.boundaryPct)}%`],
                    ["Dot % bowled", `${f0(t.dotPctBowled)}%`],
                    ["Wides / match", f1(t.widesPerMatch)],
                    ["Wickets / match", f1(t.wicketsPerMatch)],
                    ["Catches / match", f1(t.catchesPerMatch)],
                    ["Run outs / match", f1(t.runOutsPerMatch)],
                  ] as const).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wider text-jcc-text-muted">{k}</dt>
                      <dd className="font-heading text-lg font-bold tabular-nums text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-wider text-jcc-text-muted">How their batters get out</div>
                  <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full">
                    {t.howOut.map((h, i) => (
                      <div key={h.label} title={`${h.label} ${h.pct}%`} style={{ width: `${h.pct}%`, background: ["#2B59C3", "#B98419", "#7D8DB0", "#1A7A5E"][i] }} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-jcc-text-muted">
                    {t.howOut.map((h, i) => (
                      <span key={h.label} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: ["#2B59C3", "#B98419", "#7D8DB0", "#1A7A5E"][i] }} />{h.label} {h.pct}%</span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Top run-scorers · {f0(t.topRunShare)}% from #1</div>
                    {t.topRunners.map((r) => <button key={r.p} onClick={() => onOpenPlayer(r.p)} className="block truncate text-left hover:text-jcc-accent-dark"><b className="text-white">{names[r.p]}</b> <span className="text-jcc-text-muted">{r.runs}</span></button>)}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-jcc-text-muted">Top wicket-takers · {f0(t.topWicketShare)}% from #1</div>
                    {t.topWicketTakers.map((r) => <button key={r.p} onClick={() => onOpenPlayer(r.p)} className="block truncate text-left hover:text-jcc-accent-dark"><b className="text-white">{names[r.p]}</b> <span className="text-jcc-text-muted">{r.wk}</span></button>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "xi" && <AllTimeXI data={data} onOpenPlayer={onOpenPlayer} />}

      {tab === "mom" && <MoMSection data={data} onOpenPlayer={onOpenPlayer} onOpenMatch={onOpenMatch} />}

      {tab === "labels" && (
        <AchievementsTab rows={L.badges} names={names} players={L.summary.players} onOpenPlayer={onOpenPlayer} />
      )}

      {tab === "attendance" && (
        <Panel
          title="Highest attendance"
          note={`A matchday is one date on the calendar, usually 3–4 matches; there have been ${L.summary.matchdays} in this view. Team matches counts the matches his own side played. A match counts when the player batted, bowled or was named in a dismissal; CricHeroes doesn't list anyone who did none of those.`}
        >
          <div className="grid grid-cols-[24px_1fr_auto_auto] items-end gap-3 border-b border-jcc-border pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-jcc-text-muted">
            <span />
            <span>Player</span>
            <span className="w-24 text-right">Team matches</span>
            <span className="w-24 text-right sm:w-40">Matchdays played</span>
          </div>
          <ol className="divide-y divide-jcc-border">
            {L.attendance.map((a, i) => (
              <li key={a.p}>
                <button onClick={() => onOpenPlayer(a.p, "chances")} className="grid w-full grid-cols-[24px_1fr_auto_auto] items-center gap-3 py-2 text-left transition hover:bg-jcc-navy-light/60">
                  <span className="text-center text-xs font-bold text-jcc-text-muted">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><Dot team={a.team} /><span className="truncate font-semibold text-white">{names[a.p]}</span></div>
                    <div className="truncate text-[11.5px] text-jcc-text-muted">
                      {a.team}
                      {a.guest > 0 && ` · +${a.guest} as guest for ${a.guestTeams.join(", ")}`}
                    </div>
                  </div>
                  <span className="w-24 text-right text-sm tabular-nums text-jcc-text-muted">
                    <b className="text-white">{a.present}</b>/{a.teamMatches}
                  </span>
                  <div className="flex w-24 items-center justify-end gap-2.5 sm:w-40">
                    <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-jcc-navy-light sm:block">
                      <div className="h-full rounded-full bg-jcc-blue" style={{ width: `${(100 * a.matchdays) / Math.max(1, a.ofMatchdays)}%` }} />
                    </div>
                    <span className="text-right font-heading text-lg font-bold tabular-nums text-white">{a.matchdays}/{a.ofMatchdays}</span>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {tab === "chances" && (
        <div className="space-y-4">
          <Panel title="Deserve more chances" note="Efficient when given the ball or the bat, but used less than teammates (min 3 matches).">
            {L.chances.filter((c) => c.underusedBat || c.underusedBowl).length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {L.chances.filter((c) => c.underusedBat || c.underusedBowl).map((c) => (
                  <button key={c.p} onClick={() => onOpenPlayer(c.p, "chances")} className="rounded-xl border border-jcc-accent/40 bg-jcc-accent/[0.06] p-3 text-left text-[13px] hover:border-jcc-accent">
                    <div className="flex items-center gap-2 font-semibold text-white"><Dot team={c.team} />{names[c.p]}</div>
                    {c.underusedBat && <div className="mt-1 text-jcc-text-muted">SR {f0(c.sr)} but {f1(c.ballsPerMatch)} balls a match (team {f1(c.teamBallsPerMatch)})</div>}
                    {c.underusedBowl && <div className="mt-1 text-jcc-text-muted">Econ {f2(c.econ)} but bowls in {f0(c.bowlShare)}% of matches</div>}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-jcc-text-muted">Nobody stands out as underused in this season.</p>}
          </Panel>
          <Panel title="Fewest chances" note="Balls faced plus balls bowled per match, fewest first.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-[13px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-jcc-text-muted">
                    {["Player", "M", "Batted in", "Avg pos", "Balls / match", "SR", "Bowled in", "Overs / match", "Econ"].map((h, i) => (
                      <th key={h} className={`px-2 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {L.chances.map((c) => (
                    <tr key={c.p} onClick={() => onOpenPlayer(c.p, "chances")} className="cursor-pointer border-t border-jcc-border hover:bg-jcc-navy-light/60">
                      <td className="px-2 py-2"><span className="flex items-center gap-2 font-semibold text-white"><Dot team={c.team} />{names[c.p]}</span></td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.matches}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{c.battedIn}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{f1(c.avgPos)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{f1(c.ballsPerMatch)} <span className="text-jcc-text-muted">/ {f1(c.teamBallsPerMatch)}</span></td>
                      <td className="px-2 py-2 text-right tabular-nums">{f0(c.sr)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{f0(c.bowlShare)}%</td>
                      <td className="px-2 py-2 text-right tabular-nums">{f1(c.oversPerMatch)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{f2(c.econ)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
