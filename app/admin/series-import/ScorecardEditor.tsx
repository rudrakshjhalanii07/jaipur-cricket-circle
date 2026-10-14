"use client";

// Edit a match that's already saved — imported from CricHeroes or scored
// earlier. Loads the full scorecard from the database and lets every field be
// corrected: toss, captains, result, Player of the Match, each batter
// (including the rest of the squad as "did not bat"), each bowler, extras and
// totals. Saving goes through /api/series/save, which replaces the match's
// innings wholesale (save_series_match upserts on series + match number).

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { TEAMS as TEAM_CONFIG } from "@/lib/teams";

const DISMISSALS = ["not_out", "bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket", "retired_hurt", "did_not_bat"] as const;
type Dismissal = (typeof DISMISSALS)[number];
const DISMISSAL_LABEL: Record<Dismissal, string> = {
  not_out: "Not out", bowled: "Bowled", caught: "Caught", lbw: "LBW", run_out: "Run out",
  stumped: "Stumped", hit_wicket: "Hit wicket", retired_hurt: "Retired hurt", did_not_bat: "Did not bat",
};
const teamLabel = (id: string) => TEAM_CONFIG[id as keyof typeof TEAM_CONFIG]?.name ?? id;

type BatRow = { player_name: string; runs: number; balls_faced: number | null; fours: number; sixes: number; dismissal_type: Dismissal; dismissed_by: string; caught_by: string };
type BowlRow = { player_name: string; overs: number; maidens: number; runs_conceded: number; wickets: number; wides: number; no_balls: number };
type Inn = {
  innings_no: 1 | 2;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  all_out: boolean;
  extras_wides: number;
  extras_no_balls: number;
  extras_byes: number;
  extras_leg_byes: number;
  fall_of_wickets: Array<{ wkt: number; score: number; overs: string; player: string }>;
  batting: BatRow[];
  bowling: BowlRow[];
};
type Match = {
  id: string;
  series_id: string;
  match_no: number;
  stage: string;
  match_date: string | null;
  venue: string | null;
  team1_id: string;
  team2_id: string;
  toss_winner_id: string | null;
  toss_decision: "bat" | "bowl" | null;
  team1_captain: string | null;
  team2_captain: string | null;
  winner_id: string | null;
  margin_type: "runs" | "wickets" | null;
  margin_value: number | null;
  is_tie: boolean;
  super_over: Record<string, unknown> | null;
  player_of_match: string | null;
  match_notes: string | null;
  innings: Inn[];
};

async function loadMatch(id: string): Promise<Match> {
  const { data, error } = await supabase
    .from("series_matches")
    .select("*, series_innings(*, series_batting(*), series_bowling(*))")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Match not found");
  type RawInn = Inn & { series_batting: (BatRow & { batting_order: number })[]; series_bowling: (BowlRow & { bowling_order: number })[] };
  const innings = ((data.series_innings ?? []) as RawInn[])
    .sort((a, b) => a.innings_no - b.innings_no)
    .map((i) => ({
      innings_no: i.innings_no,
      batting_team_id: i.batting_team_id,
      bowling_team_id: i.bowling_team_id,
      total_runs: i.total_runs ?? 0,
      total_wickets: i.total_wickets ?? 0,
      total_overs: Number(i.total_overs ?? 0),
      all_out: !!i.all_out,
      extras_wides: i.extras_wides ?? 0,
      extras_no_balls: i.extras_no_balls ?? 0,
      extras_byes: i.extras_byes ?? 0,
      extras_leg_byes: i.extras_leg_byes ?? 0,
      fall_of_wickets: i.fall_of_wickets ?? [],
      batting: [...(i.series_batting ?? [])]
        .sort((a, b) => a.batting_order - b.batting_order)
        .map((b) => ({
          player_name: b.player_name, runs: b.runs ?? 0, balls_faced: b.balls_faced ?? null, fours: b.fours ?? 0, sixes: b.sixes ?? 0,
          dismissal_type: (b.dismissal_type ?? "not_out") as Dismissal, dismissed_by: b.dismissed_by ?? "", caught_by: b.caught_by ?? "",
        })),
      bowling: [...(i.series_bowling ?? [])]
        .sort((a, b) => a.bowling_order - b.bowling_order)
        .map((w) => ({
          player_name: w.player_name, overs: Number(w.overs ?? 0), maidens: w.maidens ?? 0, runs_conceded: w.runs_conceded ?? 0,
          wickets: w.wickets ?? 0, wides: w.wides ?? 0, no_balls: w.no_balls ?? 0,
        })),
    }));
  // A match saved without innings still gets two blank ones to fill in.
  const t1 = data.team1_id as string, t2 = data.team2_id as string;
  const blank = (n: 1 | 2, bat: string, bowl: string): Inn => ({
    innings_no: n, batting_team_id: bat, bowling_team_id: bowl, total_runs: 0, total_wickets: 0, total_overs: 0, all_out: false,
    extras_wides: 0, extras_no_balls: 0, extras_byes: 0, extras_leg_byes: 0, fall_of_wickets: [], batting: [], bowling: [],
  });
  if (!innings[0]) innings.push(blank(1, t1, t2));
  if (!innings[1]) innings.push(blank(2, innings[0].bowling_team_id, innings[0].batting_team_id));
  return { ...(data as Omit<Match, "innings">), innings: innings.slice(0, 2) as Inn[] };
}

const n = (v: string) => (v === "" ? 0 : Number(v));

// Compact controls for the scorecard grids. Deliberately not .admin-input:
// that class is unlayered and forces width:100% + roomy padding, which is
// what made every number box stretch across the card.
const field =
  "h-9 w-full min-w-0 rounded-lg border border-jcc-accent/25 bg-[#FAF8F4] px-2.5 text-[13px] font-semibold text-jcc-blue outline-none transition-colors " +
  "placeholder:text-[#8A94A6] placeholder:font-medium hover:border-jcc-accent/45 focus:border-jcc-accent focus:bg-[#FFFFFF] focus:ring-4 focus:ring-jcc-accent/10 " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#F1F2F4] disabled:text-[#9AA1AE]";
const numField = `${field} text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
const selectField = "admin-select !h-9 !rounded-lg !py-0 !pl-2.5 !pr-7 !text-[13px] ![background-position:right_10px_center]";
const smallBtn =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-jcc-accent/30 bg-[#FFFFFF] px-3 text-[11px] font-black uppercase tracking-widest text-jcc-blue transition-colors hover:border-jcc-accent hover:bg-jcc-accent/10";
const iconBtn = "grid h-7 w-7 place-items-center rounded-md text-jcc-text-muted transition-colors hover:bg-jcc-accent/10 hover:text-jcc-blue disabled:opacity-25 disabled:hover:bg-transparent";
const th = "pb-2 text-[10px] font-black uppercase tracking-widest text-jcc-text-muted";

function Num({ value, onChange, step = 1, className = "" }: { value: number | null; onChange: (v: number) => void; step?: number; className?: string }) {
  return <input type="number" inputMode="decimal" min={0} step={step} value={value ?? ""} onChange={(e) => onChange(n(e.target.value))} className={`${numField} ${className}`} />;
}

const blankBat = (player_name: string, dismissal_type: Dismissal): BatRow => ({
  player_name, runs: 0, balls_faced: dismissal_type === "did_not_bat" ? null : 0, fours: 0, sixes: 0, dismissal_type, dismissed_by: "", caught_by: "",
});

function InningsEditor({ inn, onChange, names }: { inn: Inn; onChange: (i: Inn) => void; names: string[] }) {
  const [adding, setAdding] = useState("");
  const set = (p: Partial<Inn>) => onChange({ ...inn, ...p });
  const setBat = (i: number, p: Partial<BatRow>) => set({ batting: inn.batting.map((b, k) => (k === i ? { ...b, ...p } : b)) });
  const setBowl = (i: number, p: Partial<BowlRow>) => set({ bowling: inn.bowling.map((b, k) => (k === i ? { ...b, ...p } : b)) });
  const swap = <T,>(list: T[], i: number, j: number) => {
    if (j < 0 || j >= list.length) return list;
    const out = [...list];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  };
  const extras = inn.extras_wides + inn.extras_no_balls + inn.extras_byes + inn.extras_leg_byes;
  const batSum = inn.batting.reduce((s, b) => s + (b.dismissal_type === "did_not_bat" ? 0 : b.runs), 0);
  const outs = inn.batting.filter((b) => !["not_out", "did_not_bat", "retired_hurt"].includes(b.dismissal_type)).length;
  const has = (nm: string) => inn.batting.some((b) => b.player_name.toLowerCase() === nm.toLowerCase());
  const addDnb = (raw: string) => {
    const nm = raw.trim().replace(/\s+/g, " ");
    setAdding("");
    if (!nm || has(nm)) return;
    set({ batting: [...inn.batting, blankBat(nm, "did_not_bat")] });
  };
  // Batters who batted are the table; the rest of the squad sits below as chips.
  // Reordering moves a batter past its neighbour in the table, skipping DNB rows.
  const batted = inn.batting.map((b, i) => ({ b, i })).filter(({ b }) => b.dismissal_type !== "did_not_bat");
  const dnb = inn.batting.map((b, i) => ({ b, i })).filter(({ b }) => b.dismissal_type === "did_not_bat");
  const suggestions = names.filter((nm) => !has(nm)).slice(0, 12);
  const color = TEAM_CONFIG[inn.batting_team_id as keyof typeof TEAM_CONFIG]?.primary ?? "var(--color-jcc-blue)";
  const mismatch = batSum + extras !== inn.total_runs || outs !== inn.total_wickets;

  return (
    <section className="premium-card overflow-hidden !p-0">
      {/* Header: team + the innings total as one scoreline */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-jcc-border px-5 py-4" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">Innings {inn.innings_no}</p>
          <p className="mt-0.5 text-lg font-black leading-tight" style={{ color }}>{teamLabel(inn.batting_team_id)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-black text-jcc-text-muted">
          <Num value={inn.total_runs} onChange={(v) => set({ total_runs: v })} className="!h-11 !w-16 !text-lg" />
          <span className="text-lg">/</span>
          <Num value={inn.total_wickets} onChange={(v) => set({ total_wickets: v })} className="!h-11 !w-12 !text-lg" />
          <span className="ml-1 text-[11px] uppercase tracking-widest">Overs</span>
          <Num value={inn.total_overs} step={0.1} onChange={(v) => set({ total_overs: v })} className="!h-11 !w-16" />
          <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-jcc-border px-2.5 py-2 text-[11px] uppercase tracking-widest">
            <input type="checkbox" checked={inn.all_out} onChange={(e) => set({ all_out: e.target.checked })} className="accent-jcc-blue" /> All out
          </label>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {mismatch && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] font-bold text-amber-700">
            Batters + extras make {batSum + extras}/{outs}, the total says {inn.total_runs}/{inn.total_wickets}.
            <button type="button" className="rounded-md bg-amber-600/15 px-2 py-0.5 font-black hover:bg-amber-600/25" onClick={() => set({ total_runs: batSum + extras, total_wickets: outs })}>
              Use {batSum + extras}/{outs}
            </button>
          </p>
        )}

        {/* Batting */}
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest" style={{ color }}>Batting</p>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[880px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1 text-xs">
              <colgroup>
                <col className="w-[60px]" /><col /><col className="w-[58px]" /><col className="w-[58px]" /><col className="w-[50px]" /><col className="w-[50px]" />
                <col className="w-[128px]" /><col className="w-[150px]" /><col className="w-[150px]" /><col className="w-[36px]" />
              </colgroup>
              <thead>
                <tr>
                  <th /><th className={`${th} text-left`}>Batter</th><th className={th}>R</th><th className={th}>B</th><th className={th}>4s</th><th className={th}>6s</th>
                  <th className={`${th} text-left`}>How out</th><th className={`${th} text-left`}>Bowler</th><th className={`${th} text-left`}>Fielder</th><th />
                </tr>
              </thead>
              <tbody>
                {batted.map(({ b, i }, k) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">
                      <span className="flex items-center">
                        <button type="button" className={iconBtn} disabled={k === 0} onClick={() => set({ batting: swap(inn.batting, i, batted[k - 1]?.i ?? -1) })} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" className={iconBtn} disabled={k === batted.length - 1} onClick={() => set({ batting: swap(inn.batting, i, batted[k + 1]?.i ?? -1) })} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </span>
                    </td>
                    <td><input list="jcc-player-names" value={b.player_name} onChange={(e) => setBat(i, { player_name: e.target.value })} className={field} placeholder="Name" /></td>
                    <td><Num value={b.runs} onChange={(v) => setBat(i, { runs: v })} className="font-black" /></td>
                    <td><Num value={b.balls_faced} onChange={(v) => setBat(i, { balls_faced: v })} /></td>
                    <td><Num value={b.fours} onChange={(v) => setBat(i, { fours: v })} /></td>
                    <td><Num value={b.sixes} onChange={(v) => setBat(i, { sixes: v })} /></td>
                    <td>
                      <select value={b.dismissal_type} onChange={(e) => setBat(i, { dismissal_type: e.target.value as Dismissal, ...(e.target.value === "did_not_bat" ? { runs: 0, balls_faced: null, fours: 0, sixes: 0 } : {}) })} className={selectField}>
                        {DISMISSALS.map((d) => <option key={d} value={d}>{DISMISSAL_LABEL[d]}</option>)}
                      </select>
                    </td>
                    <td><input list="jcc-player-names" disabled={["not_out", "retired_hurt"].includes(b.dismissal_type)} value={b.dismissed_by} onChange={(e) => setBat(i, { dismissed_by: e.target.value })} className={field} title={b.dismissed_by} /></td>
                    <td><input list="jcc-player-names" disabled={!["caught", "stumped", "run_out"].includes(b.dismissal_type)} value={b.caught_by} onChange={(e) => setBat(i, { caught_by: e.target.value })} className={field} title={b.caught_by} /></td>
                    <td><button type="button" onClick={() => set({ batting: inn.batting.filter((_, x) => x !== i) })} className={`${iconBtn} hover:!text-jcc-danger`} title="Remove"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => set({ batting: [...inn.batting.filter((b) => b.dismissal_type !== "did_not_bat"), blankBat("", "not_out"), ...inn.batting.filter((b) => b.dismissal_type === "did_not_bat")] })} className={`${smallBtn} mt-2`}>
            <Plus className="h-4 w-4" /> Add batter
          </button>
        </div>

        {/* Did not bat: the rest of the squad */}
        <div className="rounded-xl border border-dashed border-jcc-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">Did not bat</p>
            {dnb.length === 0 && <span className="text-[12px] text-jcc-text-muted">Nobody yet</span>}
            {dnb.map(({ b, i }) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-jcc-border bg-[#FFFFFF] py-1 pl-3 pr-1 text-[12px] font-bold text-jcc-blue">
                {b.player_name}
                <button type="button" title="Move into the batting card" onClick={() => setBat(i, { dismissal_type: "not_out", balls_faced: 0 })} className="grid h-5 w-5 place-items-center rounded-full text-jcc-text-muted hover:bg-jcc-accent/15 hover:text-jcc-blue"><ArrowUp className="h-3 w-3" /></button>
                <button type="button" title="Remove from squad" onClick={() => set({ batting: inn.batting.filter((_, x) => x !== i) })} className="grid h-5 w-5 place-items-center rounded-full text-jcc-text-muted hover:bg-jcc-danger/10 hover:text-jcc-danger"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              list="jcc-player-names"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDnb(adding); } }}
              placeholder="Add a squad player…"
              className={`${field} !w-56`}
            />
            <button type="button" onClick={() => addDnb(adding)} className={smallBtn}><UserPlus className="h-4 w-4" /> Add</button>
            {suggestions.map((nm) => (
              <button key={nm} type="button" onClick={() => addDnb(nm)} className="rounded-full border border-jcc-border px-2.5 py-1 text-[11px] font-bold text-jcc-blue/70 transition-colors hover:border-jcc-accent/60 hover:text-jcc-blue">
                + {nm}
              </button>
            ))}
          </div>
        </div>

        {/* Extras */}
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">
            Extras <span className="ml-1 rounded-full bg-jcc-accent/10 px-2 py-0.5 text-jcc-accent-dark tabular-nums">{extras}</span>
          </p>
          <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Wides", "extras_wides"], ["No-balls", "extras_no_balls"], ["Byes", "extras_byes"], ["Leg byes", "extras_leg_byes"]] as const).map(([l, k]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">{l}</span>
                <Num value={inn[k]} onChange={(v) => set({ [k]: v } as Partial<Inn>)} />
              </label>
            ))}
          </div>
        </div>

        {/* Bowling */}
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">{teamLabel(inn.bowling_team_id)} bowling</p>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1 text-xs">
              <colgroup>
                <col className="w-[60px]" /><col /><col className="w-[64px]" /><col className="w-[54px]" /><col className="w-[58px]" /><col className="w-[54px]" /><col className="w-[54px]" /><col className="w-[54px]" /><col className="w-[36px]" />
              </colgroup>
              <thead>
                <tr><th /><th className={`${th} text-left`}>Bowler</th><th className={th}>O</th><th className={th}>M</th><th className={th}>R</th><th className={th}>W</th><th className={th}>Wd</th><th className={th}>Nb</th><th /></tr>
              </thead>
              <tbody>
                {inn.bowling.map((w, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">
                      <span className="flex items-center">
                        <button type="button" className={iconBtn} disabled={i === 0} onClick={() => set({ bowling: swap(inn.bowling, i, i - 1) })} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" className={iconBtn} disabled={i === inn.bowling.length - 1} onClick={() => set({ bowling: swap(inn.bowling, i, i + 1) })} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </span>
                    </td>
                    <td><input list="jcc-player-names" value={w.player_name} onChange={(e) => setBowl(i, { player_name: e.target.value })} className={field} placeholder="Name" /></td>
                    <td><Num value={w.overs} step={0.1} onChange={(v) => setBowl(i, { overs: v })} /></td>
                    <td><Num value={w.maidens} onChange={(v) => setBowl(i, { maidens: v })} /></td>
                    <td><Num value={w.runs_conceded} onChange={(v) => setBowl(i, { runs_conceded: v })} /></td>
                    <td><Num value={w.wickets} onChange={(v) => setBowl(i, { wickets: v })} className="font-black" /></td>
                    <td><Num value={w.wides} onChange={(v) => setBowl(i, { wides: v })} /></td>
                    <td><Num value={w.no_balls} onChange={(v) => setBowl(i, { no_balls: v })} /></td>
                    <td><button type="button" onClick={() => set({ bowling: inn.bowling.filter((_, k) => k !== i) })} className={`${iconBtn} hover:!text-jcc-danger`} title="Remove"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => set({ bowling: [...inn.bowling, { player_name: "", overs: 0, maidens: 0, runs_conceded: 0, wickets: 0, wides: 0, no_balls: 0 }] })} className={`${smallBtn} mt-2`}>
            <Plus className="h-4 w-4" /> Add bowler
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ScorecardEditor({ matchId, password, onClose, onSaved }: { matchId: string; password: string; onClose: () => void; onSaved: () => void }) {
  const [m, setM] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    loadMatch(matchId).then((x) => live && setM(x)).catch((e) => live && setError(String(e)));
    return () => { live = false; };
  }, [matchId]);

  // Everyone who appears for a team in this match: quick "did not bat" chips for the other innings.
  const teamNames = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!m) return map;
    for (const inn of m.innings) {
      const bat = map.get(inn.batting_team_id) ?? map.set(inn.batting_team_id, new Set()).get(inn.batting_team_id)!;
      inn.batting.forEach((b) => b.player_name && bat.add(b.player_name));
      const bowl = map.get(inn.bowling_team_id) ?? map.set(inn.bowling_team_id, new Set()).get(inn.bowling_team_id)!;
      inn.bowling.forEach((w) => w.player_name && bowl.add(w.player_name));
    }
    return map;
  }, [m]);

  if (error) return <div className="premium-card p-6 text-sm font-bold text-jcc-danger">{error} <button className="ml-3 underline" onClick={onClose}>Back</button></div>;
  if (!m) return <div className="premium-card grid place-items-center p-10"><Loader2 className="h-6 w-6 animate-spin text-jcc-accent" /></div>;

  const set = (p: Partial<Match>) => setM({ ...m, ...p });
  const setInn = (k: number, inn: Inn) => setM({ ...m, innings: m.innings.map((x, i) => (i === k ? inn : x)) });
  const teams = [m.team1_id, m.team2_id];
  const squad = (t: string) => [...(teamNames.get(t) ?? [])].sort();

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        series_id: m.series_id,
        match_no: m.match_no,
        stage: m.stage,
        match_date: m.match_date,
        venue: m.venue,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        toss_winner_id: m.toss_winner_id || null,
        toss_decision: m.toss_winner_id ? m.toss_decision : null,
        team1_captain: m.team1_captain || null,
        team2_captain: m.team2_captain || null,
        winner_id: m.is_tie ? null : m.winner_id || null,
        margin_type: m.is_tie ? null : m.margin_type,
        margin_value: m.is_tie ? null : m.margin_value,
        is_tie: m.is_tie,
        super_over: m.super_over,
        player_of_match: m.player_of_match || null,
        match_notes: m.match_notes || null,
        innings: m.innings.map((inn) => ({
          ...inn,
          batting: inn.batting
            .filter((b) => b.player_name.trim())
            .map((b, i) => ({ ...b, batting_order: i + 1, balls_faced: b.dismissal_type === "did_not_bat" ? null : b.balls_faced, dismissed_by: b.dismissed_by || null, caught_by: b.caught_by || null })),
          bowling: inn.bowling.filter((w) => w.player_name.trim()).map((w, i) => ({ ...w, bowling_order: i + 1 })),
        })),
      };
      const res = await fetch("/api/series/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);
      setDone(true);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="premium-card flex flex-wrap items-center justify-between gap-3 !p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-jcc-accent-dark">Edit scorecard · M{m.match_no} · {m.stage}</p>
          <p className="mt-1 text-xl font-black">{teamLabel(m.team1_id)} <span className="font-bold text-jcc-text-muted">v</span> {teamLabel(m.team2_id)}</p>
        </div>
        <button type="button" onClick={onClose} className={smallBtn}><X className="h-4 w-4" /> Close</button>
      </div>

      {/* Match details */}
      <div className="premium-card grid gap-4 !p-5 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="admin-label">Date</label><input type="date" value={m.match_date ?? ""} onChange={(e) => set({ match_date: e.target.value || null })} className="admin-input" /></div>
        <div>
          <label className="admin-label">Toss won by</label>
          <select value={m.toss_winner_id ?? ""} onChange={(e) => set({ toss_winner_id: e.target.value || null })} className="admin-select">
            <option value="">— Not recorded —</option>
            {teams.map((t) => <option key={t} value={t}>{teamLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="admin-label">Chose to</label>
          <select value={m.toss_decision ?? "bat"} onChange={(e) => set({ toss_decision: e.target.value as "bat" | "bowl" })} className="admin-select" disabled={!m.toss_winner_id}>
            <option value="bat">Bat</option>
            <option value="bowl">Bowl</option>
          </select>
        </div>
        {teams.map((t, i) => (
          <div key={t}>
            <label className="admin-label">{teamLabel(t)} captain</label>
            <input list="jcc-player-names" value={(i === 0 ? m.team1_captain : m.team2_captain) ?? ""} onChange={(e) => set(i === 0 ? { team1_captain: e.target.value } : { team2_captain: e.target.value })} className="admin-input" />
          </div>
        ))}
        <div><label className="admin-label">Player of the Match</label><input list="jcc-player-names" value={m.player_of_match ?? ""} onChange={(e) => set({ player_of_match: e.target.value })} className="admin-input" /></div>
        <div>
          <label className="admin-label">Result</label>
          <select value={m.is_tie ? "tie" : m.winner_id ?? ""} onChange={(e) => (e.target.value === "tie" ? set({ is_tie: true, winner_id: null }) : set({ is_tie: false, winner_id: e.target.value || null }))} className="admin-select">
            <option value="">— None —</option>
            {teams.map((t) => <option key={t} value={t}>{teamLabel(t)} won</option>)}
            <option value="tie">Tie</option>
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="admin-label">Margin</label><input type="number" min={0} value={m.margin_value ?? ""} onChange={(e) => set({ margin_value: e.target.value === "" ? null : Number(e.target.value) })} className="admin-input" disabled={m.is_tie} /></div>
          <div className="flex-1">
            <label className="admin-label">By</label>
            <select value={m.margin_type ?? ""} onChange={(e) => set({ margin_type: (e.target.value || null) as Match["margin_type"] })} className="admin-select" disabled={m.is_tie}>
              <option value="">—</option><option value="runs">Runs</option><option value="wickets">Wickets</option>
            </select>
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-3"><label className="admin-label">Notes</label><input value={m.match_notes ?? ""} onChange={(e) => set({ match_notes: e.target.value })} className="admin-input" /></div>
      </div>

      {m.innings.map((inn, k) => (
        <InningsEditor key={k} inn={inn} onChange={(x) => setInn(k, x)} names={squad(inn.batting_team_id)} />
      ))}

      {error && <p className="rounded-xl bg-jcc-danger/10 px-4 py-3 text-sm font-bold text-jcc-danger">{error}</p>}
      {done && <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">Saved. The scorecard has been replaced with these numbers.</p>}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-jcc-border bg-[#FFFFFF]/90 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={onClose} className={smallBtn}>Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-jcc-blue px-4 text-[11px] font-black uppercase tracking-widest !text-[#FFFFFF] transition-opacity hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save scorecard
        </button>
      </div>
    </div>
  );
}
