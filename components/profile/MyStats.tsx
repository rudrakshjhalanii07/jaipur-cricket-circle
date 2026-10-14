"use client";

// The signed-in member's own record on the Profile tab: headline numbers per
// scope, the badges he holds and his player-of-the-match awards, with a link
// into his full card on /stats. Data comes from /api/player/me/stats, which
// reads the member pass set at login.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award, BarChart3, Clock, Crown, Flame, Hand, Loader2, Shield, Sparkles, Trophy, ArrowUpRight } from "lucide-react";
import { Counter } from "@/app/stats/motion";

type BadgeTone = "crown" | "bat" | "ball" | "field" | "team" | "warn";
type DnaAxis = { label: string; value: string; pct: number; hint: string };
type Scope = {
  key: string;
  label: string;
  played: boolean;
  matches?: number;
  team?: string;
  role?: string;
  winPct?: number | null;
  batting?: { inns: number; runs: number; balls: number; hs: string; notOuts: number; avg: number | null; sr: number | null; fours: number; sixes: number; ducks: number };
  bowling?: { spells: number; balls: number; wickets: number; runs: number; best: string; econ: number | null; avg: number | null; maidens: number };
  fielding?: { c: number; kc: number; st: number; ro: number; total: number };
  ranks?: Record<"runs" | "sr" | "six" | "wk" | "econ" | "dot" | "field" | "death" | "pp", { rank: number; of: number } | null>;
  dna?: { tags: string[]; batting: DnaAxis[]; bowling: DnaAxis[] };
  phase?: { powerplay: number; middle: number; death: number };
  teamShare?: number | null;
  badges?: { label: string; tone: BadgeTone; why: string }[];
  mom?: { date: string; season: number; line: string; opp: string }[];
};
type Access =
  | { kind: "permanent" }
  | { kind: "trial"; startedAt: string; endsAt: string; daysLeft: number }
  | { kind: "untracked" };
type Payload =
  | { ok: true; found: false; name: string; access: Access }
  | { ok: true; found: true; name: string; access: Access; scorecardName: string; cardHash: string; scopes: Scope[] };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The 14-day notice: how long is left, and that it ends. */
function AccessNote({ access }: { access: Access }) {
  if (access.kind !== "trial") return null;
  return (
    <p className="rounded-xl border border-jcc-accent/30 bg-jcc-accent/10 px-4 py-2.5 text-xs font-bold text-jcc-accent-dark">
      {access.daysLeft} {access.daysLeft === 1 ? "day" : "days"} of stats access left — member access lasts 14 days from
      first login and ends on {fmtDay(access.endsAt)}.
    </p>
  );
}

const TONE: Record<BadgeTone, { icon: typeof Crown; cls: string; dot: string }> = {
  crown: { icon: Crown, cls: "border-jcc-accent/40 bg-jcc-accent/10", dot: "#D4AF37" },
  bat: { icon: Flame, cls: "border-[#3B6FC4]/25 bg-[#3B6FC4]/[0.07]", dot: "#3B6FC4" },
  ball: { icon: Sparkles, cls: "border-[#7A4FB8]/25 bg-[#7A4FB8]/[0.07]", dot: "#7A4FB8" },
  field: { icon: Hand, cls: "border-[#2E8B57]/25 bg-[#2E8B57]/[0.07]", dot: "#2E8B57" },
  team: { icon: Shield, cls: "border-jcc-blue/12 bg-jcc-navy-light", dot: "#12233F" },
  warn: { icon: Award, cls: "border-[#B0473F]/25 bg-[#B0473F]/[0.06]", dot: "#B0473F" },
};

const GRAD = {
  gold: "linear-gradient(135deg, #F3C96A 0%, #D4AF37 45%, #A97824 100%)",
  orange: "linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)",
  purple: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
  green: "linear-gradient(135deg, #6EE7B7 0%, #2E8B57 100%)",
};
const clip = (g: string) => ({ backgroundImage: g, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }) as const;

const n = (v: number | null | undefined, d = 1) => (v == null ? "–" : v.toFixed(d));
const overs = (balls: number) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ""}`;
const KICK = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em]";

/** True a frame after mount, so bars grow from zero instead of appearing full. */
function useArrived() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function RankChip({ r, what }: { r?: { rank: number; of: number } | null; what: string }) {
  if (!r) return null;
  const top = r.rank <= 3;
  return (
    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${KICK} ${top ? "bg-jcc-accent text-[#0B1424]" : "bg-white/10 text-white/75"}`}>
      {top && <Crown className="h-3 w-3" />}#{r.rank} of {r.of} · {what}
    </span>
  );
}

function Headline({ label, value, grad, rank, rankWhat, sub }: { label: string; value: number; grad: string; rank?: { rank: number; of: number } | null; rankWhat: string; sub: string }) {
  return (
    <div className="min-w-0 border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:first:border-l-0 sm:first:pl-0">
      <p className={`${KICK} text-white/55`}>{label}</p>
      <p className="mt-2 font-heading text-6xl font-extrabold leading-[0.85] tracking-[-0.05em] tabular-nums md:text-7xl" style={clip(grad)}>
        <Counter value={value} />
      </p>
      <p className="mt-2 font-mono text-[11px] text-white/60">{sub}</p>
      <RankChip r={rank} what={rankWhat} />
    </div>
  );
}

function Num({ label, value, rank }: { label: string; value: React.ReactNode; rank?: { rank: number; of: number } | null }) {
  return (
    <div className="rounded-2xl bg-jcc-navy-light px-4 py-3.5">
      <p className={`${KICK} text-jcc-text-muted`}>{label}</p>
      <p className="mt-1.5 font-heading text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums text-jcc-blue">{value}</p>
      {rank && <p className="mt-1.5 font-mono text-[10px] text-jcc-accent-dark">#{rank.rank} of {rank.of}</p>}
    </div>
  );
}

/** One DNA axis: where this player sits among qualified players, 0–100. */
function DnaBar({ a, on }: { a: DnaAxis; on: boolean }) {
  const tier = a.pct >= 80 ? "Elite" : a.pct >= 60 ? "Strong" : a.pct >= 40 ? "Average" : "Below avg";
  return (
    <li title={a.hint} className="grid grid-cols-[120px_minmax(0,1fr)_76px] items-center gap-4 py-2">
      <span className="text-[13px] font-semibold tracking-tight text-jcc-blue">{a.label}<span className="block font-mono text-[10px] font-normal text-jcc-text-muted">{a.hint.replace(", lower is better", " ↓")}</span></span>
      <span className="relative h-2 overflow-hidden rounded-full bg-jcc-blue/[0.07]">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: on ? `${Math.max(3, a.pct)}%` : "0%", background: a.pct >= 60 ? GRAD.gold : "#12233F" }}
        />
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-jcc-blue/25" />
      </span>
      <span className="text-right">
        <span className="block font-heading text-sm font-bold tabular-nums text-jcc-blue">{a.value}</span>
        <span className={`block whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.1em] ${a.pct >= 60 ? "text-jcc-accent-dark" : "text-jcc-text-muted"}`}>{tier}</span>
      </span>
    </li>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Crown; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-jcc-blue/10 bg-jcc-navy p-5 md:p-6">
      <p className="flex items-center gap-2 font-heading text-lg font-bold tracking-[-0.02em] text-jcc-blue">
        <Icon className="h-4 w-4 text-jcc-accent-dark" /> {title}
      </p>
      {children}
    </div>
  );
}

export default function MyStats() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [expiredOn, setExpiredOn] = useState<string | null>(null);
  const [scopeKey, setScopeKey] = useState("career");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/player/me/stats")
      .then(async (r) => {
        const j = await r.json();
        if (r.status === 403 && j.expired) {
          if (!cancelled) setExpiredOn(j.endsAt);
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        if (!cancelled) setData(j as Payload);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (expiredOn) {
    return (
      <div className="premium-card p-8 text-center">
        <Clock className="w-6 h-6 text-jcc-accent mx-auto" />
        <p className="mt-3 text-sm font-black text-white">Your stats access has ended</p>
        <p className="mt-1 text-xs text-white/65">
          Member access to stats and badges lasts 14 days from first login; yours ended on {fmtDay(expiredOn)}. Speak to the
          JCC admins if you need it back.
        </p>
      </div>
    );
  }
  if (error) return null;
  if (!data) {
    return (
      <div className="premium-card p-8 flex items-center justify-center gap-2 text-xs font-bold text-white/65">
        <Loader2 className="w-4 h-4 animate-spin text-jcc-accent" /> Loading your stats…
      </div>
    );
  }
  if (!data.found) {
    return (
      <div className="premium-card p-8 text-center">
        <BarChart3 className="w-6 h-6 text-jcc-accent mx-auto" />
        <p className="mt-3 text-sm font-black text-white">No scorecards on record yet</p>
        <div className="mt-4"><AccessNote access={data.access} /></div>
        <p className="mt-3 text-xs text-white/65">
          Your numbers and badges appear here after your first recorded match. If you have played, ask an admin to check
          how your name is spelled on the scorecards.
        </p>
      </div>
    );
  }

  return <Card data={data} scopeKey={scopeKey} setScopeKey={setScopeKey} />;
}

function Card({ data, scopeKey, setScopeKey }: { data: Extract<Payload, { found: true }>; scopeKey: string; setScopeKey: (k: string) => void }) {
  const on = useArrived();
  const scopes = data.scopes.filter((s) => s.played);
  const s = scopes.find((x) => x.key === scopeKey) ?? scopes[0];
  if (!s) return null;
  const B = s.batting!, W = s.bowling!, F = s.fielding!;
  const R = s.ranks;
  const dna = s.dna;
  const ph = s.phase;
  const phaseTotal = ph ? ph.powerplay + ph.middle + ph.death : 0;
  const dismissals = F.total;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[32px] border border-jcc-blue/10 bg-jcc-navy shadow-[0_40px_80px_-50px_rgba(13,23,40,0.6)]">
      {/* ── The player card ── */}
      <div className="theme-static-dark print-grain relative overflow-hidden bg-[#0B1424] p-6 md:p-9">
        <div aria-hidden className="pitch-grid absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-jcc-accent/15 blur-[110px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`${KICK} text-jcc-accent`}>My stats · {s.label}</p>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-none tracking-[-0.04em] text-white md:text-4xl">
              {s.matches} {s.matches === 1 ? "match" : "matches"} <span className="text-white/40">·</span> {s.role}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              {s.team}
              {s.winPct != null && <> · your side won <b className="font-semibold text-white">{Math.round(s.winPct)}%</b> of them</>}
              {s.teamShare != null && <> · {Math.round(s.teamShare)}% of the team&apos;s runs</>}
            </p>
          </div>
          <div role="tablist" aria-label="Scope" className="flex gap-1 rounded-full border border-white/15 bg-white/5 p-1">
            {scopes.map((x) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={x.key === s.key}
                type="button"
                onClick={() => setScopeKey(x.key)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-tight transition-colors ${x.key === s.key ? "bg-jcc-accent text-[#0B1424]" : "text-white/65 hover:text-white"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-9 grid gap-6 sm:grid-cols-3">
          <Headline label="Runs" value={B.runs} grad={GRAD.orange} rank={R?.runs} rankWhat="runs" sub={`SR ${n(B.sr)} · HS ${B.hs} · ${B.inns} inns`} />
          <Headline label="Wickets" value={W.wickets} grad={GRAD.purple} rank={R?.wk} rankWhat="wickets" sub={`Econ ${n(W.econ)} · best ${W.best}`} />
          <Headline label="Dismissals" value={dismissals} grad={GRAD.green} rank={R?.field} rankWhat="fielding" sub={`${F.c + F.kc} ct · ${F.st} st · ${F.ro} ro`} />
        </div>

        {dna && dna.tags.length > 0 && (
          <div className="relative mt-8 flex flex-wrap items-center gap-2 border-t border-white/10 pt-6">
            <span className={`${KICK} mr-1 text-white/50`}>Player type</span>
            {dna.tags.map((t) => (
              <span key={t} className="rounded-full border border-jcc-accent/40 bg-jcc-accent/10 px-3 py-1 text-[12px] font-semibold text-jcc-accent-highlight">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5 p-5 md:p-7">
        <AccessNote access={data.access} />

        <div className="grid gap-5 2xl:grid-cols-2">
          <Panel title="Batting" icon={Flame}>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Num label="Average" value={n(B.avg)} />
              <Num label="Strike rate" value={n(B.sr)} rank={R?.sr} />
              <Num label="Fours" value={B.fours} />
              <Num label="Sixes" value={B.sixes} rank={R?.six} />
            </div>
            {dna && dna.batting.length > 0 ? (
              <>
                <p className={`${KICK} mt-6 text-jcc-text-muted`}>Against the league · centre line = median</p>
                <ul className="mt-1">{dna.batting.map((a) => <DnaBar key={a.label} a={a} on={on} />)}</ul>
              </>
            ) : (
              <p className="mt-5 text-[13px] text-jcc-text-muted">Face 30 balls in this scope to see how you compare with the league.</p>
            )}
          </Panel>

          <Panel title="Bowling" icon={Sparkles}>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Num label="Overs" value={overs(W.balls)} />
              <Num label="Economy" value={n(W.econ)} rank={R?.econ} />
              <Num label="Average" value={n(W.avg)} />
              <Num label="Best" value={W.best} />
            </div>
            {ph && phaseTotal > 0 && (
              <div className="mt-5">
                <p className={`${KICK} text-jcc-text-muted`}>When your wickets fall</p>
                <div className="mt-2 flex h-9 gap-[3px] overflow-hidden rounded-xl">
                  {([["powerplay", "Overs 1–2", "#3B6FC4"], ["middle", "Middle", "#12233F"], ["death", "Last 2", "#D4AF37"]] as const).map(([k, label, c]) =>
                    ph[k] ? (
                      <span
                        key={k}
                        title={`${label}: ${ph[k]}`}
                        className="flex items-center justify-center font-mono text-[10.5px] font-semibold text-[#FFFFFF] transition-[flex-grow] duration-1000"
                        style={{ flexGrow: on ? ph[k] : 0.001, flexBasis: 0, background: c }}
                      >
                        {ph[k]}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-jcc-text-muted">
                  <span>Powerplay {ph.powerplay}{R?.pp ? ` · #${R.pp.rank}` : ""}</span>
                  <span>Middle {ph.middle}</span>
                  <span>Death {ph.death}{R?.death ? ` · #${R.death.rank}` : ""}</span>
                </div>
              </div>
            )}
            {dna && dna.bowling.length > 0 ? (
              <ul className="mt-4">{dna.bowling.map((a) => <DnaBar key={a.label} a={a} on={on} />)}</ul>
            ) : (
              <p className="mt-5 text-[13px] text-jcc-text-muted">Bowl 5 overs in this scope to see how you compare with the league.</p>
            )}
          </Panel>
        </div>

        <Panel title={`Badges · ${s.badges?.length ?? 0}`} icon={Award}>
          {s.badges && s.badges.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {s.badges.map((b) => {
                const t = TONE[b.tone] ?? TONE.team;
                const Icon = t.icon;
                return (
                  <li key={b.label} className={`flex items-start gap-3 rounded-2xl border p-3.5 ${t.cls}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${t.dot}1f`, color: t.dot }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold tracking-tight text-jcc-blue">{b.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-jcc-text-muted">{b.why}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-jcc-text-muted">No badges in this scope yet — they unlock as your numbers climb the league.</p>
          )}
        </Panel>

        {s.mom && s.mom.length > 0 && (
          <Panel title={`Player of the Match · ${s.mom.length}`} icon={Trophy}>
            <ol className="mt-3">
              {s.mom.map((m) => (
                <li key={`${m.date}-${m.opp}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-jcc-border py-3 last:border-b-0">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-jcc-accent/15 text-jcc-accent-dark">
                    <Trophy className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold tracking-tight text-jcc-blue">v {m.opp}</span>
                    <span className="block font-mono text-[11px] text-jcc-text-muted">{m.line}</span>
                  </span>
                  <span className="font-mono text-[11px] text-jcc-text-muted">{fmtDay(m.date)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <p className="text-[12px] text-jcc-text-muted">Phases come from the over each wicket fell in. Ranks are within {s.label.toLowerCase()}.</p>
          <Link href={`/stats#${data.cardHash}`} className="btn-gold group">
            Open my full player card
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
