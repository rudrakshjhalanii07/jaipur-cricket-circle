"use client";

// The live scoring panel for one innings. It owns no match data: the ball log
// lives in the page (and its saved draft), and everything shown here is
// replayed from it by lib/ball-by-ball.ts.

import { useMemo, useState } from "react";
import { ArrowLeftRight, Undo2, Flag, UserMinus } from "lucide-react";
import {
  ballLabel,
  inningsOver,
  oversLabel,
  replayInnings,
  type BallEvent,
  type Extra,
  type InningsLimits,
  type ScoreEvent,
  type WicketKind,
} from "@/lib/ball-by-ball";

const EXTRA_LABELS: Record<Extra, string> = { wd: "Wide", nb: "No ball", b: "Bye", lb: "Leg bye" };
const WICKET_KINDS: { kind: WicketKind; label: string }[] = [
  { kind: "bowled", label: "Bowled" },
  { kind: "caught", label: "Caught" },
  { kind: "lbw", label: "LBW" },
  { kind: "run_out", label: "Run out" },
  { kind: "stumped", label: "Stumped" },
  { kind: "hit_wicket", label: "Hit wicket" },
];

interface Props {
  inningsNo: 1 | 2;
  events: ScoreEvent[];
  onChange: (events: ScoreEvent[]) => void;
  battingTeam: string;
  bowlingTeam: string;
  battingSquad: string[];
  bowlingSquad: string[];
  limits: InningsLimits;
  onEnd: () => void;
}

interface WicketDraft {
  kind: WicketKind;
  out: "striker" | "nonStriker";
  fielder: string;
  fielder2: string;
  runs: number;
}

const emptyWicket = (): WicketDraft => ({ kind: "bowled", out: "striker", fielder: "", fielder2: "", runs: 0 });

export default function Scorer({
  inningsNo,
  events,
  onChange,
  battingTeam,
  bowlingTeam,
  battingSquad,
  bowlingSquad,
  limits,
  onEnd,
}: Props) {
  const s = useMemo(() => replayInnings(events), [events]);
  const over = inningsOver(s, limits);

  // Who's in for the next ball: the replay's answer, unless the scorer has
  // overridden it (new batter, swap, change of bowler) since the last event.
  // An override is tied to the log length it was made at, so it lapses as
  // soon as a ball is recorded or undone.
  const [override, setOverride] = useState<{ at: number; striker: string; nonStriker: string; bowler: string } | null>(null);
  const crease =
    override && override.at === events.length
      ? override
      : { striker: s.striker ?? "", nonStriker: s.nonStriker ?? "", bowler: s.bowler ?? "" };
  const { striker, nonStriker, bowler } = crease;
  const setCrease = (p: Partial<typeof crease>) => setOverride({ ...crease, ...p, at: events.length });
  const setStriker = (v: string) => setCrease({ striker: v });
  const setNonStriker = (v: string) => setCrease({ nonStriker: v });
  const setBowler = (v: string) => setCrease({ bowler: v });

  const [extra, setExtra] = useState<Extra | null>(null);
  const [wicket, setWicket] = useState<WicketDraft | null>(null);

  const outNames = new Set(s.batters.filter((b) => b.out).map((b) => b.name));
  const available = battingSquad.filter((p) => !outNames.has(p));
  const ready = !!striker && !!nonStriker && !!bowler && striker !== nonStriker && !over;

  const record = (bat: number, w: BallEvent["wicket"] = null) => {
    if (!ready) return;
    let ball: BallEvent;
    switch (extra) {
      case "wd":
        ball = { t: "ball", striker, nonStriker, bowler, bat: 0, extra, extraRuns: 1 + bat, wicket: w };
        break;
      case "nb":
        ball = { t: "ball", striker, nonStriker, bowler, bat, extra, extraRuns: 1, wicket: w };
        break;
      case "b":
      case "lb":
        ball = { t: "ball", striker, nonStriker, bowler, bat: 0, extra, extraRuns: bat, wicket: w };
        break;
      default:
        ball = { t: "ball", striker, nonStriker, bowler, bat, extra: null, extraRuns: 0, wicket: w };
    }
    onChange([...events, ball]);
    setOverride(null);
    setExtra(null);
    setWicket(null);
  };

  const confirmWicket = () => {
    if (!wicket) return;
    const outName = wicket.out === "striker" ? striker : nonStriker;
    let fielders: string[] = [];
    if (wicket.kind === "caught" || wicket.kind === "stumped") {
      // Caught and bowled: the bowler is the catcher too.
      fielders = [wicket.fielder || (wicket.kind === "caught" ? bowler : "")].filter(Boolean);
    } else if (wicket.kind === "run_out") {
      fielders = [wicket.fielder, wicket.fielder2].filter(Boolean);
    }
    record(wicket.kind === "run_out" ? wicket.runs : 0, { kind: wicket.kind, out: outName, fielders });
  };

  const retire = (player: string) => {
    if (!player) return;
    onChange([...events, { t: "retire", player }]);
  };

  const undo = () => {
    onChange(events.slice(0, -1));
    setOverride(null);
  };

  const target = limits.target;
  const crr = s.legalBalls ? (s.runs / s.legalBalls) * 6 : 0;
  const ballsLeft = limits.overs * 6 - s.legalBalls;

  const sel = (value: string, onSet: (v: string) => void, options: string[], placeholder: string) => (
    <select className="admin-select" value={value} onChange={(e) => onSet(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );

  const runOptions = extra === "b" || extra === "lb" ? [1, 2, 3, 4] : [0, 1, 2, 3, 4, 6];
  const recent = events.slice(-12);

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="premium-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">
              Innings {inningsNo} · {battingTeam} batting
            </p>
            <p className="text-4xl font-black tabular-nums text-jcc-blue leading-none mt-1">
              {s.runs}/{s.wickets}
              <span className="text-lg text-jcc-text-muted font-bold ml-2">
                ({oversLabel(s.legalBalls)} / {limits.overs})
              </span>
            </p>
          </div>
          <div className="text-right text-xs text-jcc-text-muted font-bold space-y-0.5">
            <p>CRR {crr.toFixed(2)}</p>
            {target != null && (
              <p className="text-jcc-accent-dark">
                Need {Math.max(0, target - s.runs)} off {Math.max(0, ballsLeft)}
              </p>
            )}
            <p>
              Extras {s.extras.wd + s.extras.nb + s.extras.b + s.extras.lb} (wd {s.extras.wd}, nb {s.extras.nb}, b{" "}
              {s.extras.b}, lb {s.extras.lb})
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 flex-wrap min-h-7">
          <span className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mr-1">This over</span>
          {s.thisOver.length === 0 && <span className="text-xs text-jcc-text-muted/60">—</span>}
          {s.thisOver.map((l, i) => (
            <span
              key={i}
              className={`min-w-7 h-7 px-1.5 rounded-full flex items-center justify-center text-[11px] font-black tabular-nums ${
                l.includes("W")
                  ? "bg-jcc-danger text-white"
                  : l === "4" || l === "6"
                    ? "bg-jcc-accent text-white"
                    : /[a-z]/.test(l)
                      ? "bg-jcc-navy-light text-jcc-accent-dark border border-jcc-border"
                      : "bg-jcc-navy-light text-jcc-blue border border-jcc-border"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      {over ? (
        <div className="premium-card p-5 flex flex-wrap items-center justify-between gap-3 border-jcc-accent/30">
          <p className="text-sm font-black text-jcc-blue">
            Innings complete —{" "}
            {over === "target" ? "target reached" : over === "all_out" ? "all out" : "overs done"}.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={undo} className="btn-ghost px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Undo2 className="w-3.5 h-3.5" /> Undo last
            </button>
            <button type="button" onClick={onEnd} className="px-5 py-2.5 rounded-xl btn-vibrant-blue font-black text-xs uppercase tracking-widest">
              {inningsNo === 1 ? "Start 2nd innings" : "Review & save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Crease */}
          <div className="premium-card p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_1fr] gap-3 items-end">
            <div>
              <label className="admin-label">Striker *</label>
              {sel(striker, setStriker, available.filter((p) => p !== nonStriker), "— New batter —")}
            </div>
            <button
              type="button"
              onClick={() => setCrease({ striker: nonStriker, nonStriker: striker })}
              title="Swap strike"
              className="btn-ghost h-10 px-3 rounded-xl flex items-center justify-center"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <div>
              <label className="admin-label">Non-striker</label>
              {sel(nonStriker, setNonStriker, available.filter((p) => p !== striker), "— New batter —")}
            </div>
            <div>
              <label className="admin-label">
                Bowler{!s.bowler && s.lastOverBowler ? " (new over)" : ""}
              </label>
              {sel(
                bowler,
                setBowler,
                // The same bowler can't bowl back-to-back overs.
                bowlingSquad.filter((p) => s.bowler === p || p !== s.lastOverBowler),
                "— Bowler —",
              )}
            </div>
          </div>

          {/* Pad */}
          <div className="premium-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EXTRA_LABELS) as Extra[]).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setExtra(extra === x ? null : x)}
                  className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors ${
                    extra === x
                      ? "bg-jcc-accent text-white border-jcc-accent"
                      : "border-jcc-border text-jcc-blue/70 hover:border-jcc-accent/50"
                  }`}
                >
                  {EXTRA_LABELS[x]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWicket(wicket ? null : emptyWicket())}
                className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors ${
                  wicket ? "bg-jcc-danger text-white border-jcc-danger" : "border-jcc-danger/40 text-jcc-danger hover:bg-jcc-danger/10"
                }`}
              >
                Wicket
              </button>
            </div>
            <p className="text-[10px] text-jcc-text-muted">
              {extra === "wd"
                ? "Wide: tap the runs taken beyond the 1 (0 for a plain wide)."
                : extra === "nb"
                  ? "No ball: tap the runs off the bat. The 1 is added for you."
                  : extra
                    ? `${EXTRA_LABELS[extra]}: tap the runs taken.`
                    : "Tap the runs off the bat. Pick an extra first for wides, no balls, byes and leg byes."}
            </p>

            {wicket ? (
              <div className="rounded-xl border border-jcc-danger/30 bg-jcc-danger/5 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="admin-label">How out</label>
                  <select
                    className="admin-select"
                    value={wicket.kind}
                    onChange={(e) => setWicket({ ...wicket, kind: e.target.value as WicketKind, out: "striker" })}
                  >
                    {WICKET_KINDS.map((k) => (
                      <option key={k.kind} value={k.kind}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                {wicket.kind === "run_out" && (
                  <div>
                    <label className="admin-label">Who&apos;s out</label>
                    <select
                      className="admin-select"
                      value={wicket.out}
                      onChange={(e) => setWicket({ ...wicket, out: e.target.value as WicketDraft["out"] })}
                    >
                      <option value="striker">{striker || "Striker"}</option>
                      <option value="nonStriker">{nonStriker || "Non-striker"}</option>
                    </select>
                  </div>
                )}
                {(wicket.kind === "caught" || wicket.kind === "stumped" || wicket.kind === "run_out") && (
                  <div>
                    <label className="admin-label">
                      {wicket.kind === "caught" ? "Catcher (blank = c&b)" : wicket.kind === "stumped" ? "Keeper" : "Fielder"}
                    </label>
                    {sel(wicket.fielder, (v) => setWicket({ ...wicket, fielder: v }), bowlingSquad, "—")}
                  </div>
                )}
                {wicket.kind === "run_out" && (
                  <>
                    <div>
                      <label className="admin-label">2nd fielder</label>
                      {sel(wicket.fielder2, (v) => setWicket({ ...wicket, fielder2: v }), bowlingSquad.filter((p) => p !== wicket.fielder), "—")}
                    </div>
                    <div>
                      <label className="admin-label">Runs completed</label>
                      <input
                        type="number"
                        min={0}
                        className="admin-input"
                        value={wicket.runs}
                        onChange={(e) => setWicket({ ...wicket, runs: Math.max(0, +e.target.value) })}
                      />
                    </div>
                  </>
                )}
                <button
                  type="button"
                  disabled={!ready || (wicket.kind === "stumped" && !wicket.fielder) || (wicket.kind === "run_out" && !wicket.fielder)}
                  onClick={confirmWicket}
                  className="h-10 rounded-xl bg-jcc-danger text-white font-black text-xs uppercase tracking-widest disabled:opacity-40"
                >
                  Confirm wicket
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {runOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!ready}
                    onClick={() => record(n)}
                    className={`h-14 rounded-xl text-xl font-black tabular-nums transition-transform active:scale-95 disabled:opacity-30 ${
                      n === 4 || n === 6 ? "btn-vibrant-blue" : "bg-jcc-navy-light border border-jcc-border text-jcc-blue hover:border-jcc-accent/50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {!ready && (
              <p className="text-xs text-jcc-danger font-bold">
                {striker && striker === nonStriker ? "Striker and non-striker must be different." : "Pick the striker, non-striker and bowler."}
              </p>
            )}
          </div>
        </>
      )}

      {/* Figures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="premium-card p-4 overflow-x-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mb-2">Batting — {battingTeam}</p>
          <table className="w-full text-xs text-jcc-blue/80">
            <thead>
              <tr className="text-[10px] text-jcc-text-muted uppercase">
                <th className="text-left pb-1">Batter</th>
                <th className="text-right pb-1 w-9">R</th>
                <th className="text-right pb-1 w-9">B</th>
                <th className="text-right pb-1 w-8">4s</th>
                <th className="text-right pb-1 w-8">6s</th>
              </tr>
            </thead>
            <tbody>
              {s.batters.map((b) => (
                <tr key={b.name} className={b.out ? "text-jcc-text-muted" : ""}>
                  <td className="py-0.5">
                    <span className="font-bold">{b.name}</span>
                    {!b.out && (b.name === s.striker || b.name === striker) && " *"}
                    <span className="block text-[10px] text-jcc-text-muted">
                      {b.out ? describeOut(b.out) : "not out"}
                    </span>
                  </td>
                  <td className="text-right font-black tabular-nums">{b.runs}</td>
                  <td className="text-right tabular-nums">{b.balls}</td>
                  <td className="text-right tabular-nums">{b.fours}</td>
                  <td className="text-right tabular-nums">{b.sixes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="premium-card p-4 overflow-x-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mb-2">Bowling — {bowlingTeam}</p>
          <table className="w-full text-xs text-jcc-blue/80">
            <thead>
              <tr className="text-[10px] text-jcc-text-muted uppercase">
                <th className="text-left pb-1">Bowler</th>
                <th className="text-right pb-1 w-9">O</th>
                <th className="text-right pb-1 w-8">M</th>
                <th className="text-right pb-1 w-9">R</th>
                <th className="text-right pb-1 w-8">W</th>
                <th className="text-right pb-1 w-12">Econ</th>
              </tr>
            </thead>
            <tbody>
              {s.bowlers.map((b) => (
                <tr key={b.name}>
                  <td className="py-0.5 font-bold">{b.name}</td>
                  <td className="text-right tabular-nums">{oversLabel(b.balls)}</td>
                  <td className="text-right tabular-nums">{b.maidens}</td>
                  <td className="text-right tabular-nums">{b.runs}</td>
                  <td className="text-right font-black tabular-nums">{b.wickets}</td>
                  <td className="text-right tabular-nums">{b.balls ? ((b.runs / b.balls) * 6).toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log + controls */}
      <div className="premium-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap text-[11px] text-jcc-text-muted">
          <span className="text-[10px] font-black uppercase tracking-widest mr-1">Recent</span>
          {recent.length === 0 && "—"}
          {recent.map((e, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-jcc-navy-light border border-jcc-border tabular-nums">
              {e.t === "retire" ? `${e.player} retd` : ballLabel(e)}
            </span>
          ))}
        </div>
        <button
          type="button"
          disabled={events.length === 0}
          onClick={undo}
          className="btn-ghost px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        {!over && (
          <>
            <select
              className="admin-select w-auto text-xs"
              value=""
              onChange={(e) => retire(e.target.value)}
              title="Retire a batter"
            >
              <option value="">Retire…</option>
              {[striker, nonStriker].filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (confirm(`End innings ${inningsNo} at ${s.runs}/${s.wickets}?`)) onEnd();
              }}
              className="btn-ghost px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1.5"
            >
              <Flag className="w-3.5 h-3.5" /> End innings
            </button>
          </>
        )}
      </div>
      {s.batters.some((b) => b.out?.type === "retired_hurt") && (
        <p className="text-[10px] text-jcc-text-muted flex items-center gap-1">
          <UserMinus className="w-3 h-3" /> Retired batters are listed as retired out, as the club scores them.
        </p>
      )}
    </div>
  );
}

function describeOut(o: NonNullable<ReturnType<typeof replayInnings>["batters"][number]["out"]>): string {
  switch (o.type) {
    case "bowled":
      return `b ${o.bowler}`;
    case "lbw":
      return `lbw b ${o.bowler}`;
    case "caught":
      return o.fielders === o.bowler ? `c & b ${o.bowler}` : `c ${o.fielders} b ${o.bowler}`;
    case "stumped":
      return `st ${o.fielders} b ${o.bowler}`;
    case "hit_wicket":
      return `hit wicket b ${o.bowler}`;
    case "run_out":
      return `run out${o.fielders ? ` (${o.fielders})` : ""}`;
    case "retired_hurt":
      return "retired";
    default:
      return o.type;
  }
}
