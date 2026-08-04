"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileJson, X, Save, ChevronDown, ChevronUp,
  Plus, Trash2, CheckCircle, AlertCircle, Loader2, ArrowLeft, ExternalLink,
  RefreshCw, Link2, RotateCcw, Copy, Check,
} from "lucide-react";
import {
  fetchAllSeries,
  fetchSeriesMatches,
  oversToDecimal,
  type Series,
  type SeriesMatch,
} from "@/lib/series";
import { fetchSeasons, type Season } from "@/lib/seasons";
import { MATCH_TEMPLATE_JSON } from "@/lib/match-template";
import { TEAMS as TEAM_CONFIG, TEAM_ORDER_ALL } from "@/lib/teams";

// ── Types mirroring the save API body ────────────────────────────────────────

// Driven off lib/teams.ts rather than a local copy, so a new team shows up in
// every dropdown here the moment it's added to the team config.
const TEAMS = TEAM_ORDER_ALL;
const TEAM_LABELS: Record<string, string> = Object.fromEntries(
  TEAM_ORDER_ALL.map((id) => [id, TEAM_CONFIG[id].name]),
);
const TEAM_ID_LIST = TEAM_ORDER_ALL.join(" | ");

const STAGES = ["league", "eliminator", "qualifier", "final"] as const;
const STAGE_LABELS: Record<string, string> = {
  league: "League",
  eliminator: "Eliminator",
  qualifier: "Qualifier",
  final: "Final",
};
const DISMISSAL_TYPES = [
  "bowled", "caught", "lbw", "run_out", "stumped",
  "hit_wicket", "retired_hurt", "not_out", "did_not_bat",
] as const;

interface BatterRow {
  batting_order: number;
  player_name: string;
  runs: number;
  balls_faced: number | null;
  fours: number;
  sixes: number;
  dismissal_type: string;
  dismissed_by: string;
  caught_by: string;
}

interface BowlerRow {
  bowling_order: number;
  player_name: string;
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
}

interface FoW {
  wkt: number;
  score: number;
  overs: string;
  player: string;
}

interface InningsForm {
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
  fall_of_wickets: FoW[];
  batting: BatterRow[];
  bowling: BowlerRow[];
}

interface MatchForm {
  match_no: number;
  stage: (typeof STAGES)[number];
  match_date: string;
  venue: string;
  team1_id: string;
  team2_id: string;
  toss_winner_id: string;
  toss_decision: string;
  team1_captain: string;
  team2_captain: string;
  winner_id: string;
  margin_type: string;
  margin_value: number | null;
  is_tie: boolean;
  player_of_match: string;
  match_notes: string;
  innings: InningsForm[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyBatter(order: number): BatterRow {
  return { batting_order: order, player_name: "", runs: 0, balls_faced: null, fours: 0, sixes: 0, dismissal_type: "not_out", dismissed_by: "", caught_by: "" };
}

function emptyBowler(order: number): BowlerRow {
  return { bowling_order: order, player_name: "", overs: 0, maidens: 0, runs_conceded: 0, wickets: 0, wides: 0, no_balls: 0 };
}

function emptyInnings(no: 1 | 2, t1: string, t2: string): InningsForm {
  return {
    innings_no: no,
    batting_team_id: no === 1 ? t1 : t2,
    bowling_team_id: no === 1 ? t2 : t1,
    total_runs: 0, total_wickets: 0, total_overs: 0,
    all_out: false, extras_wides: 0, extras_no_balls: 0, extras_byes: 0, extras_leg_byes: 0,
    fall_of_wickets: [],
    batting: Array.from({ length: 6 }, (_, i) => emptyBatter(i + 1)),
    bowling: Array.from({ length: 4 }, (_, i) => emptyBowler(i + 1)),
  };
}

function defaultMatch(): MatchForm {
  return {
    match_no: 1, stage: "league",
    match_date: "", venue: "", team1_id: "mavericks", team2_id: "neurostrikers",
    toss_winner_id: "", toss_decision: "bat", team1_captain: "", team2_captain: "", winner_id: "", margin_type: "runs",
    margin_value: null, is_tie: false, player_of_match: "", match_notes: "",
    innings: [emptyInnings(1, "mavericks", "neurostrikers"), emptyInnings(2, "neurostrikers", "mavericks")],
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="admin-label">{children}</label>;
}

function Input({ className = "", compact, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }) {
  return (
    <input
      className={`admin-input ${className}`}
      style={compact ? { padding: "6px 8px", borderRadius: 10 } : undefined}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`admin-select ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="premium-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-jcc-navy-light hover:bg-jcc-border/20 transition-colors"
      >
        <span className="text-xs font-black uppercase tracking-widest text-jcc-blue/70">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-jcc-text-muted" /> : <ChevronDown className="w-4 h-4 text-jcc-text-muted" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BattingTable({ rows, onChange }: {
  rows: BatterRow[];
  onChange: (rows: BatterRow[]) => void;
}) {
  const update = (i: number, field: keyof BatterRow, val: unknown) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const add = () => onChange([...rows, emptyBatter(rows.length + 1)]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-jcc-blue/80 min-w-[700px]">
          <thead>
            <tr className="text-[10px] text-jcc-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 w-6">#</th>
              <th className="text-left pb-2">Player</th>
              <th className="text-center pb-2 w-12">R</th>
              <th className="text-center pb-2 w-12">B</th>
              <th className="text-center pb-2 w-10">4s</th>
              <th className="text-center pb-2 w-10">6s</th>
              <th className="text-center pb-2 w-12">SR</th>
              <th className="text-left pb-2 w-32">Dismissal</th>
              <th className="text-left pb-2">Bowler</th>
              <th className="text-left pb-2">Catcher</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody className="space-y-1">
            {rows.map((r, i) => {
              const noWkt = ["not_out", "did_not_bat", "retired_hurt"].includes(r.dismissal_type);
              // A run out has no bowler, but it does have fielders — and they
              // are the only ones who earn anything for it. Locking this column
              // to catches is what sent them into the bowler field instead, so
              // stumpings and run outs open it too.
              const isRunOut = r.dismissal_type === "run_out";
              const noCatch = !["caught", "stumped", "run_out"].includes(r.dismissal_type);
              const fielderHint = isRunOut ? "Fielder / Fielder" : "Fielder";
              return (
              <tr key={i} className="group">
                <td className="py-0.5 pr-2 text-jcc-text-muted/70">{i + 1}</td>
                <td className="py-0.5 pr-1"><Input value={r.player_name} onChange={(e) => update(i, "player_name", e.target.value)} placeholder="Name" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.runs} onChange={(e) => update(i, "runs", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.balls_faced ?? ""} onChange={(e) => update(i, "balls_faced", e.target.value ? +e.target.value : null)} className="text-center" placeholder="—" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.fours} onChange={(e) => update(i, "fours", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.sixes} onChange={(e) => update(i, "sixes", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1 text-center text-jcc-accent/80 font-black tabular-nums">{r.balls_faced && r.balls_faced > 0 ? ((r.runs / r.balls_faced) * 100).toFixed(1) : "—"}</td>
                <td className="py-0.5 px-1">
                  <Select value={r.dismissal_type} onChange={(e) => update(i, "dismissal_type", e.target.value)}>
                    {DISMISSAL_TYPES.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
                  </Select>
                </td>
                <td className="py-0.5 px-1"><Input value={r.dismissed_by} onChange={(e) => update(i, "dismissed_by", e.target.value)} placeholder="Bowler" disabled={noWkt || isRunOut} className={noWkt || isRunOut ? "opacity-20 cursor-not-allowed" : ""} /></td>
                <td className="py-0.5 px-1"><Input value={r.caught_by} onChange={(e) => update(i, "caught_by", e.target.value)} placeholder={fielderHint} disabled={noCatch} className={noCatch ? "opacity-20 cursor-not-allowed" : ""} /></td>
                <td className="py-0.5 pl-1">
                  <button type="button" onClick={() => remove(i)} className="text-jcc-text-muted/70 hover:text-jcc-danger transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="text-xs text-jcc-accent/70 hover:text-jcc-accent flex items-center gap-1 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add batter
      </button>
    </div>
  );
}

function BowlingTable({ rows, onChange }: { rows: BowlerRow[]; onChange: (rows: BowlerRow[]) => void }) {
  const update = (i: number, field: keyof BowlerRow, val: unknown) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const add = () => onChange([...rows, emptyBowler(rows.length + 1)]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-jcc-blue/80 min-w-[500px]">
          <thead>
            <tr className="text-[10px] text-jcc-text-muted uppercase tracking-wider">
              <th className="text-left pb-2">Bowler</th>
              <th className="text-center pb-2 w-14">Ov</th>
              <th className="text-center pb-2 w-10">M</th>
              <th className="text-center pb-2 w-12">R</th>
              <th className="text-center pb-2 w-10">W</th>
              <th className="text-center pb-2 w-12">Econ</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-1"><Input value={r.player_name} onChange={(e) => update(i, "player_name", e.target.value)} placeholder="Name" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" step="0.1" value={r.overs} onChange={(e) => update(i, "overs", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.maidens} onChange={(e) => update(i, "maidens", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.runs_conceded} onChange={(e) => update(i, "runs_conceded", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1"><Input compact type="number" value={r.wickets} onChange={(e) => update(i, "wickets", +e.target.value)} className="text-center" /></td>
                <td className="py-0.5 px-1 text-center text-jcc-accent/80 font-black tabular-nums">{r.overs && r.overs > 0 ? (r.runs_conceded / oversToDecimal(r.overs)).toFixed(1) : "—"}</td>
                <td className="py-0.5 pl-1">
                  <button type="button" onClick={() => remove(i)} className="text-jcc-text-muted/70 hover:text-jcc-danger transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="text-xs text-jcc-accent/70 hover:text-jcc-accent flex items-center gap-1 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add bowler
      </button>
    </div>
  );
}

function FoWEditor({ rows, onChange }: { rows: FoW[]; onChange: (rows: FoW[]) => void }) {
  const update = (i: number, field: keyof FoW, val: unknown) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val as string & number };
    onChange(next);
  };
  const add = () => onChange([...rows, { wkt: rows.length + 1, score: 0, overs: "0.0", player: "" }]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="flex items-center gap-2 text-[9px] text-jcc-text-muted/70 uppercase tracking-widest mb-0.5 ml-10">
          <span className="w-20">Score</span>
          <span className="w-16">Over (4.6)</span>
          <span className="flex-1">Dismissed player</span>
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-jcc-text-muted w-8 shrink-0">{r.wkt}wkt</span>
          <div className="w-20 shrink-0"><Input compact type="number" value={r.score} onChange={(e) => update(i, "score", +e.target.value)} placeholder="0" /></div>
          <div className="w-16 shrink-0"><Input compact value={r.overs} onChange={(e) => update(i, "overs", e.target.value)} placeholder="0.0" /></div>
          <div className="flex-1 min-w-0"><Input value={r.player} onChange={(e) => update(i, "player", e.target.value)} placeholder="Player name" /></div>
          <button type="button" onClick={() => remove(i)} className="text-jcc-text-muted/70 hover:text-jcc-danger transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-jcc-accent/70 hover:text-jcc-accent flex items-center gap-1 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add wicket
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeriesImportPage() {
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // JSON import
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [templateCopied, setTemplateCopied] = useState(false);

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(MATCH_TEMPLATE_JSON);
      setTemplateCopied(true);
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      // ignore — clipboard write blocked
    }
  };

  // JCC is season-based now: every match belongs to a seeded week of the active
  // season, so there is nothing to create here — only a week to pick. Series
  // from earlier eras (the old tri-series) still hold their stats in the DB,
  // they're just not import targets any more, so they're filtered out below.
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [weekId, setWeekId] = useState("");

  useEffect(() => {
    fetchAllSeries().then(setAllSeries).catch(() => {});
    fetchSeasons().then(setSeasons).catch(() => {});
  }, []);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const weeks = allSeries
    .filter((s) => s.week_no != null && s.season_id === activeSeason?.id)
    .sort((a, b) => (a.week_no ?? 0) - (b.week_no ?? 0));
  const selectedWeek = weeks.find((w) => w.id === weekId) ?? null;

  // Match form
  const [matchForm, setMatchForm] = useState<MatchForm>(defaultMatch());
  const [showForm, setShowForm] = useState(false);

  // ── Fixture auto-match ──────────────────────────────────────────────────────
  // Season weeks are seeded with all their fixtures, and a pair of teams meets
  // at most once in a week — so the two team dropdowns are enough to identify
  // which seeded fixture this scorecard belongs to. Deriving match_no from the
  // opponents beats typing it: a wrong number silently overwrites a different
  // fixture's result.
  const [seededMatches, setSeededMatches] = useState<SeriesMatch[]>([]);

  useEffect(() => {
    if (!weekId) {
      setSeededMatches([]);
      return;
    }
    let cancelled = false;
    fetchSeriesMatches(weekId)
      .then((rows) => {
        if (!cancelled) setSeededMatches(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekId]);

  const fixtureCandidates = seededMatches.filter(
    (m) =>
      (m.team1_id === matchForm.team1_id && m.team2_id === matchForm.team2_id) ||
      (m.team1_id === matchForm.team2_id && m.team2_id === matchForm.team1_id),
  );
  // An unplayed fixture is the one being imported; a played one means this is a
  // correction. Prefer the former when a pair somehow appears twice.
  const matchedFixture =
    fixtureCandidates.find((m) => !m.winner_id && !m.is_tie) ??
    fixtureCandidates[0] ??
    null;

  useEffect(() => {
    if (!matchedFixture) return;
    setMatchForm((p) =>
      p.match_no === matchedFixture.match_no && p.stage === matchedFixture.stage
        ? p
        : { ...p, match_no: matchedFixture.match_no, stage: matchedFixture.stage },
    );
  }, [matchedFixture]);

  // Save
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveResult, setSaveResult] = useState<{ match_id: string; series_id: string } | null>(null);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState("");

  // Update articles panel
  const [artSeriesId, setArtSeriesId] = useState("");
  const [artItems, setArtItems] = useState<Array<{ title: string; url: string }>>([]);
  const [artBusy, setArtBusy] = useState(false);
  const [artMsg, setArtMsg] = useState("");

  // Auth check
  useEffect(() => {
    const stored = sessionStorage.getItem("jcc_admin_password");
    if (stored) {
      setPassword(stored);
      setIsAuthed(true);
    } else {
      setIsAuthed(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwInput) return;
    setPassword(pwInput);
    sessionStorage.setItem("jcc_admin_password", pwInput);
    setIsAuthed(true);
  };

  const handleJsonLoad = useCallback(() => {
    setJsonError("");
    try {
      const d = JSON.parse(jsonText);
      const info = d.match_info;
      if (!info) throw new Error('JSON must have a "match_info" key at the top level.');
      const t1 = info.team1_id || "mavericks";
      const t2 = info.team2_id || "neurostrikers";
      const inningsData: InningsForm[] = (d.innings ?? []).map((inn: InningsForm & {
        batting: BatterRow[]; bowling: BowlerRow[];
      }, i: number) => ({
        innings_no: (i + 1) as 1 | 2,
        batting_team_id: inn.batting_team_id || (i === 0 ? t1 : t2),
        bowling_team_id: inn.bowling_team_id || (i === 0 ? t2 : t1),
        total_runs: inn.total_runs || 0,
        total_wickets: inn.total_wickets || 0,
        total_overs: inn.total_overs || 0,
        all_out: inn.all_out || false,
        extras_wides: inn.extras_wides || 0,
        extras_no_balls: inn.extras_no_balls || 0,
        extras_byes: inn.extras_byes || 0,
        extras_leg_byes: inn.extras_leg_byes || 0,
        fall_of_wickets: (inn.fall_of_wickets || []).map((f: FoW) => ({
          wkt: f.wkt ?? 0,
          score: f.score ?? 0,
          overs: f.overs ?? "0.0",
          player: f.player ?? "",
        })),
        batting: (inn.batting || []).map((b: BatterRow) => ({
          ...b,
          dismissed_by: b.dismissed_by ?? "",
          caught_by: b.caught_by ?? "",
          player_name: b.player_name ?? "",
          runs: b.runs ?? 0,
          fours: b.fours ?? 0,
          sixes: b.sixes ?? 0,
        })),
        bowling: (inn.bowling || []).map((b: BowlerRow) => ({
          ...b,
          player_name: b.player_name ?? "",
          overs: b.overs ?? 0,
          maidens: b.maidens ?? 0,
          runs_conceded: b.runs_conceded ?? 0,
          wickets: b.wickets ?? 0,
          wides: b.wides ?? 0,
          no_balls: b.no_balls ?? 0,
        })),
      }));

      // A pasted week_no picks the week for you when it matches a seeded one —
      // otherwise the dropdown stays as-is and the admin chooses.
      const pastedWeek = d.series?.week_no;
      if (pastedWeek != null) {
        const hit = weeks.find((w) => w.week_no === Number(pastedWeek));
        if (hit) setWeekId(hit.id);
      }

      setMatchForm((prev) => ({
        match_no: info.match_no ?? prev.match_no,
        stage: info.stage || "league",
        match_date: info.match_date || "",
        venue: info.venue || "",
        team1_id: t1,
        team2_id: t2,
        toss_winner_id: info.toss_winner_id || "",
        team1_captain: info.team1_captain || "",
        team2_captain: info.team2_captain || "",
        toss_decision: info.toss_decision === "field" ? "bowl" : info.toss_decision || "bat",
        winner_id: info.winner_id || "",
        margin_type: info.margin_type || "runs",
        margin_value: info.margin_value ?? null,
        is_tie: info.is_tie || false,
        player_of_match: info.player_of_match || "",
        match_notes: info.match_notes || "",
        innings: inningsData.length ? inningsData : [emptyInnings(1, t1, t2), emptyInnings(2, t2, t1)],
      }));
      setShowForm(true);
    } catch (err) {
      setJsonError(String(err));
    }
  }, [jsonText, weeks]);

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText((ev.target?.result as string) ?? "");
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!weekId) {
      setError("Pick the season week this match belongs to.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        series_id: weekId,
        match_no: matchForm.match_no,
        stage: matchForm.stage,
        match_date: matchForm.match_date || null,
        venue: matchForm.venue || null,
        team1_id: matchForm.team1_id,
        team2_id: matchForm.team2_id,
        toss_winner_id: matchForm.toss_winner_id || null,
        team1_captain: matchForm.team1_captain || null,
        team2_captain: matchForm.team2_captain || null,
        toss_decision: matchForm.toss_decision || null,
        winner_id: matchForm.winner_id || null,
        margin_type: matchForm.margin_type || null,
        margin_value: matchForm.margin_value,
        is_tie: matchForm.is_tie,
        player_of_match: matchForm.player_of_match || null,
        match_notes: matchForm.match_notes || null,
        innings: matchForm.innings.map((inn) => ({
          ...inn,
          batting: inn.batting.filter((b) => b.player_name.trim()),
          bowling: inn.bowling.filter((b) => b.player_name.trim()),
        })),
      };

      const res = await fetch("/api/series/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);

      setSaveResult({ match_id: json.match_id, series_id: json.series_id });

      fetchAllSeries().then(setAllSeries).catch(() => {});

      // Auto-trigger analysis
      setAnalyzing(true);
      const ar = await fetch("/api/series/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ match_id: json.match_id }),
      });
      const aj = await ar.json();
      if (aj.ok) setAnalysisText(aj.analysis);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
      setAnalyzing(false);
    }
  };

  const handleLoadArticles = async () => {
    if (!artSeriesId.trim()) return;
    setArtBusy(true);
    setArtMsg("");
    try {
      const res = await fetch(`/api/series/update-articles?series_id=${encodeURIComponent(artSeriesId.trim())}`, {
        headers: { "x-admin-password": password },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);
      setArtItems(json.articles ?? []);
      setArtMsg(`Loaded: ${json.name}`);
    } catch (err) {
      setArtMsg(String(err));
    } finally {
      setArtBusy(false);
    }
  };

  const handleSaveArticles = async () => {
    if (!artSeriesId.trim()) return;
    setArtBusy(true);
    setArtMsg("");
    try {
      const res = await fetch("/api/series/update-articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ series_id: artSeriesId.trim(), articles: artItems }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);
      setArtMsg("Articles saved!");
    } catch (err) {
      setArtMsg(String(err));
    } finally {
      setArtBusy(false);
    }
  };

  const resetForNext = () => {
    setJsonText("");
    setJsonError("");
    setShowForm(false);
    setSaveResult(null);
    setAnalysisText("");
    setError("");
    fetchAllSeries().then(setAllSeries).catch(() => {}); // keep the week list in sync
    if (saveResult) {
      // Stay on the same week — the next scorecard is almost always another
      // fixture from the same night.
      setWeekId(saveResult.series_id);
      setMatchForm((prev) => ({ ...defaultMatch(), match_no: prev.match_no + 1 }));
      // The match just saved now has a result — refetch so the next import's
      // fixture banner doesn't call it unplayed.
      fetchSeriesMatches(saveResult.series_id).then(setSeededMatches).catch(() => {});
    }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────

  if (isAuthed === null) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--jcc-bg)]"><Loader2 className="w-8 h-8 text-jcc-accent animate-spin" /></div>;
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--jcc-bg)] px-4">
        <div className="w-full max-w-sm premium-card p-8">
          <h1 className="text-2xl font-black text-jcc-blue uppercase tracking-tight mb-6 text-center">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input type="password" placeholder="Admin password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} />
            {pwError && <p className="text-jcc-danger text-xs">Incorrect password</p>}
            <button type="submit" className="w-full py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest">
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (saveResult) {
    return (
      <div className="min-h-screen bg-[var(--jcc-bg)] px-4 page-top pb-16">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-jcc-accent" />
            <h1 className="text-2xl font-black text-jcc-blue uppercase tracking-tight">Match Saved</h1>
          </div>

          {analyzing && (
            <div className="flex items-center gap-2 text-sm text-jcc-text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-jcc-accent" />
              Generating AI match analysis…
            </div>
          )}

          {analysisText && (
            <div className="premium-card border-jcc-accent/20 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-jcc-accent-dark mb-3">AI Match Analysis</p>
              <p className="text-sm text-jcc-blue/70 leading-relaxed whitespace-pre-wrap">{analysisText}</p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button onClick={resetForNext} className="px-5 py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest">
              Import Next Match
            </button>
            <Link href="/seasons" className="btn-ghost px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2">
              View Seasons Page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--jcc-bg)] text-jcc-blue">
      <div className="max-w-4xl mx-auto px-4 page-top pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-jcc-text-muted hover:text-jcc-blue transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-[26px] font-black uppercase tracking-tight text-jcc-accent-dark">Series Import</h1>
            <p className="text-xs text-jcc-text-muted font-medium mt-0.5">Paste match JSON → Review → Save to database</p>
          </div>
        </div>

        {/* Step 1: JSON Import */}
        <CollapsibleSection title="Step 1 — Paste Match JSON">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border cursor-pointer transition-colors"
                  style={{ color: "color-mix(in srgb, var(--jcc-text-soft) 50%, transparent)", borderColor: "color-mix(in srgb, var(--jcc-text-soft) 15%, transparent)" }}
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Browse .json file
                  <input type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFile} />
                </label>
                <span className="text-xs" style={{ color: "color-mix(in srgb, var(--jcc-text-soft) 25%, transparent)" }}>or paste below</span>
              </div>
              <button
                type="button"
                onClick={handleCopyTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors shrink-0"
                style={templateCopied
                  ? { color: "var(--jcc-accent)", borderColor: "color-mix(in srgb, var(--jcc-accent) 40%, transparent)" }
                  : { color: "color-mix(in srgb, var(--jcc-text-soft) 55%, transparent)", borderColor: "color-mix(in srgb, var(--jcc-text-soft) 20%, transparent)" }}
              >
                {templateCopied
                  ? <><Check className="w-3.5 h-3.5" /> Copied!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy Template</>}
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "match_info": { ... }, "innings": [ ... ] }'
              rows={8}
              className="admin-textarea text-xs font-mono"
            />

            {jsonError && (
              <div className="flex items-start gap-2 text-xs text-jcc-danger bg-jcc-danger/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-all">{jsonError}</span>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleJsonLoad}
                disabled={!jsonText.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest disabled:opacity-40"
              >
                <FileJson className="w-4 h-4" /> Load JSON
              </button>
              <button
                onClick={() => { setShowForm(true); setMatchForm(defaultMatch()); }}
                className="btn-ghost px-4 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest"
              >
                Fill Manually
              </button>
            </div>

            <details className="group">
              <summary className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted hover:text-jcc-blue cursor-pointer select-none">JSON format reference</summary>
              <div className="mt-2 rounded-lg border border-jcc-border/60 bg-jcc-navy-light/60 px-3 py-2 text-[10px] leading-relaxed text-jcc-text-muted">
                <span className="font-black uppercase tracking-widest text-jcc-accent-dark">Season fixtures are pre-seeded.</span>{" "}
                Pick the week in step 2a; the fixture is then identified from the two
                teams, so <span className="font-mono">match_no</span> fills itself in. The
                save fills in the seeded row instead of creating a new match, and
                re-uploading the same fixture replaces that scorecard — a correction is
                just another upload.
              </div>
              <pre className="mt-2 p-3 bg-jcc-navy-light rounded-lg text-[10px] text-jcc-text-muted overflow-x-auto leading-relaxed">{JSON.stringify({
                match_info: {
                  match_no: 1,
                  stage: STAGES.join(" | "),
                  match_date: "YYYY-MM-DD",
                  venue: "string or null (leave null — venue is set per week in Admin → Seasons)",
                  team1_id: TEAM_ID_LIST,
                  team2_id: TEAM_ID_LIST,
                  toss_winner_id: "team_id",
                  team1_captain: "captain name (gets a (C) in scorecard)",
                  team2_captain: "captain name (gets a (C) in scorecard)",
                  toss_decision: "bat | bowl",
                  winner_id: "team_id",
                  margin_type: "runs | wickets",
                  margin_value: 0,
                  is_tie: false,
                  player_of_match: "string",
                  match_notes: "string or null",
                },
                innings: [{
                  innings_no: 1,
                  batting_team_id: "team_id",
                  bowling_team_id: "team_id",
                  total_runs: 0, total_wickets: 0, total_overs: 7.0, all_out: false,
                  extras_wides: 0, extras_no_balls: 0, extras_byes: 0, extras_leg_byes: 0,
                  fall_of_wickets: [{ wkt: 1, score: 0, overs: "0.0", player: "name" }],
                  batting: [{
                    batting_order: 1, player_name: "string", runs: 0, balls_faced: 0,
                    fours: 0, sixes: 0,
                    dismissal_type: "bowled|caught|lbw|run_out|stumped|hit_wicket|retired_hurt|not_out|did_not_bat",
                    dismissed_by: "bowler or null", caught_by: "fielder or null",
                  }],
                  bowling: [{
                    bowling_order: 1, player_name: "string", overs: 2.0,
                    maidens: 0, runs_conceded: 0, wickets: 0, wides: 0, no_balls: 0,
                  }],
                }],
              }, null, 2)}</pre>
            </details>
          </div>
        </CollapsibleSection>

        {/* Step 2: Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Week */}
              <CollapsibleSection title="Step 2a — Week">
                <Label>Season Week</Label>
                <Select value={weekId} onChange={(e) => setWeekId(e.target.value)}>
                  <option value="">— Choose a week —</option>
                  {weeks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.venue ? ` — ${s.venue}` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-[10px] text-jcc-text-muted mt-1">
                  {weeks.length === 0
                    ? `No seeded weeks found for ${activeSeason?.title ?? "the active season"}.`
                    : selectedWeek
                      ? `${activeSeason?.title ?? "Active season"} · ${selectedWeek.venue ?? "venue not set — see Admin → Seasons → Week Venues &amp; Timings"}`
                      : "Every match belongs to a seeded week of the active season."}
                </p>
              </CollapsibleSection>


              {/* Match Info */}
              <CollapsibleSection title="Step 2b — Match Info">
                {/* Which seeded fixture the chosen opponents resolve to. */}
                {seededMatches.length > 0 && (
                  <div
                    className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                      !matchedFixture
                        ? "bg-jcc-danger/10 text-jcc-danger"
                        : matchedFixture.winner_id || matchedFixture.is_tie
                          ? "bg-jcc-accent/10 text-jcc-accent-dark"
                          : "bg-jcc-blue/10 text-jcc-blue"
                    }`}
                  >
                    {matchedFixture ? (
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>
                      {!matchedFixture ? (
                        <>
                          No fixture in this week is{" "}
                          <b>{TEAM_LABELS[matchForm.team1_id]} v {TEAM_LABELS[matchForm.team2_id]}</b>.
                          Check the teams above, or set Match # by hand. This week has:{" "}
                          {seededMatches
                            .map((m) => `M${m.match_no} ${TEAM_LABELS[m.team1_id ?? ""] ?? "TBD"} v ${TEAM_LABELS[m.team2_id ?? ""] ?? "TBD"}`)
                            .join(", ")}
                          .
                        </>
                      ) : matchedFixture.winner_id || matchedFixture.is_tie ? (
                        <>
                          Matched <b>M{matchedFixture.match_no}</b>, which already has a
                          result. Saving <b>replaces</b> its scorecard.
                        </>
                      ) : (
                        <>
                          Matched seeded fixture <b>M{matchedFixture.match_no}</b> — saving
                          fills it in rather than creating a new match.
                        </>
                      )}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <Label>Match #{matchedFixture ? " (auto)" : ""}</Label>
                    <Input type="number" value={matchForm.match_no} onChange={(e) => setMatchForm((p) => ({ ...p, match_no: +e.target.value }))} />
                  </div>
                  <div>
                    <Label>Stage</Label>
                    <Select value={matchForm.stage} onChange={(e) => setMatchForm((p) => ({ ...p, stage: e.target.value as (typeof STAGES)[number] }))}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={matchForm.match_date} onChange={(e) => setMatchForm((p) => ({ ...p, match_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Venue</Label>
                    <Input value={matchForm.venue} onChange={(e) => setMatchForm((p) => ({ ...p, venue: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Team 1</Label>
                    <Select value={matchForm.team1_id} onChange={(e) => setMatchForm((p) => ({ ...p, team1_id: e.target.value }))}>
                      {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Team 2</Label>
                    <Select value={matchForm.team2_id} onChange={(e) => setMatchForm((p) => ({ ...p, team2_id: e.target.value }))}>
                      {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Toss Winner</Label>
                    <Select value={matchForm.toss_winner_id} onChange={(e) => setMatchForm((p) => ({ ...p, toss_winner_id: e.target.value }))}>
                      <option value="">—</option>
                      {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Toss Decision</Label>
                    <Select value={matchForm.toss_decision} onChange={(e) => setMatchForm((p) => ({ ...p, toss_decision: e.target.value }))}>
                      <option value="bat">Bat</option>
                      <option value="bowl">Bowl</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Winner</Label>
                    <Select value={matchForm.winner_id} onChange={(e) => setMatchForm((p) => ({ ...p, winner_id: e.target.value }))}>
                      <option value="">—</option>
                      {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Margin Type</Label>
                    <Select value={matchForm.margin_type} onChange={(e) => setMatchForm((p) => ({ ...p, margin_type: e.target.value }))}>
                      <option value="runs">Runs</option>
                      <option value="wickets">Wickets</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Margin Value</Label>
                    <Input type="number" value={matchForm.margin_value ?? ""} onChange={(e) => setMatchForm((p) => ({ ...p, margin_value: e.target.value ? +e.target.value : null }))} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={matchForm.is_tie} onChange={(e) => setMatchForm((p) => ({ ...p, is_tie: e.target.checked }))} className="accent-jcc-accent" />
                      <span className="text-xs text-jcc-blue/70 font-bold">Tie?</span>
                    </label>
                  </div>
                  <div>
                    <Label>{TEAM_LABELS[matchForm.team1_id] ?? "Team 1"} Captain</Label>
                    <Input value={matchForm.team1_captain} onChange={(e) => setMatchForm((p) => ({ ...p, team1_captain: e.target.value }))} placeholder="Captain name (C)" />
                  </div>
                  <div>
                    <Label>{TEAM_LABELS[matchForm.team2_id] ?? "Team 2"} Captain</Label>
                    <Input value={matchForm.team2_captain} onChange={(e) => setMatchForm((p) => ({ ...p, team2_captain: e.target.value }))} placeholder="Captain name (C)" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Player of the Match</Label>
                    <Input value={matchForm.player_of_match} onChange={(e) => setMatchForm((p) => ({ ...p, player_of_match: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Match Notes</Label>
                    <Input value={matchForm.match_notes} onChange={(e) => setMatchForm((p) => ({ ...p, match_notes: e.target.value }))} placeholder="Key moments, context…" />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Innings */}
              {matchForm.innings.map((inn, innIdx) => (
                <CollapsibleSection key={innIdx} title={`Step 2c — Innings ${inn.innings_no} (${TEAM_LABELS[inn.batting_team_id] ?? inn.batting_team_id} batting)`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label>Batting Team</Label>
                      <Select value={inn.batting_team_id} onChange={(e) => {
                        const next = [...matchForm.innings];
                        next[innIdx] = { ...next[innIdx], batting_team_id: e.target.value };
                        setMatchForm((p) => ({ ...p, innings: next }));
                      }}>
                        {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Bowling Team</Label>
                      <Select value={inn.bowling_team_id} onChange={(e) => {
                        const next = [...matchForm.innings];
                        next[innIdx] = { ...next[innIdx], bowling_team_id: e.target.value };
                        setMatchForm((p) => ({ ...p, innings: next }));
                      }}>
                        {TEAMS.map((t) => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Total</Label>
                      <div className="flex gap-1">
                        <Input type="number" value={inn.total_runs} onChange={(e) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], total_runs: +e.target.value };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }} placeholder="Runs" />
                        <span className="text-jcc-text-muted self-center">/</span>
                        <Input type="number" value={inn.total_wickets} onChange={(e) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], total_wickets: +e.target.value };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }} placeholder="Wkts" className="w-16" />
                      </div>
                    </div>
                    <div>
                      <Label>Overs</Label>
                      <Input type="number" step="0.1" value={inn.total_overs} onChange={(e) => {
                        const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], total_overs: +e.target.value };
                        setMatchForm((p) => ({ ...p, innings: next }));
                      }} />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={inn.all_out} onChange={(e) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], all_out: e.target.checked };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }} className="accent-jcc-accent" />
                        <span className="text-xs text-jcc-blue/70 font-bold">All out</span>
                      </label>
                    </div>
                    {(["extras_wides", "extras_no_balls", "extras_byes", "extras_leg_byes"] as const).map((field) => (
                      <div key={field}>
                        <Label>{field.replace("extras_", "").replace("_", " ")}</Label>
                        <Input type="number" value={inn[field]} onChange={(e) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], [field]: +e.target.value };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }} />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mb-2">Batting</p>
                      <BattingTable
                        rows={inn.batting}
                        onChange={(rows) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], batting: rows };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mb-2">Bowling</p>
                      <BowlingTable
                        rows={inn.bowling}
                        onChange={(rows) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], bowling: rows };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted mb-2">Fall of Wickets</p>
                      <FoWEditor
                        rows={inn.fall_of_wickets}
                        onChange={(rows) => {
                          const next = [...matchForm.innings]; next[innIdx] = { ...next[innIdx], fall_of_wickets: rows };
                          setMatchForm((p) => ({ ...p, innings: next }));
                        }}
                      />
                    </div>
                  </div>
                </CollapsibleSection>
              ))}

              {/* Save */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Match</>}
                </button>
                {error && (
                  <div className="flex items-center gap-2 text-xs text-jcc-danger">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Admin Tools ───────────────────────────────────────────────── */}
        <div className="mt-8 pt-8 border-t border-jcc-border space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-jcc-text-muted/70">Admin Tools</p>

          {/* Update Series Articles */}
          <CollapsibleSection title="Update Series Articles" defaultOpen={false}>
            <p className="text-xs text-jcc-text-muted mb-3">Load an existing series by its UUID and update its Boundary Banter article links.</p>
            <div className="flex gap-2 items-end mb-3">
              <div className="flex-1">
                <Label>Series UUID</Label>
                <Input value={artSeriesId} onChange={(e) => setArtSeriesId(e.target.value)} placeholder="Paste series UUID from Supabase" />
              </div>
              <button onClick={handleLoadArticles} disabled={artBusy || !artSeriesId.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-jcc-blue/70 border border-jcc-border hover:border-jcc-accent/40 disabled:opacity-40 transition-colors whitespace-nowrap mb-0.5">
                {artBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Load
              </button>
            </div>

            {artMsg && (
              <p className={`text-xs mb-3 ${artMsg.startsWith("Error") || artMsg.startsWith("Fetch") ? "text-jcc-danger" : artMsg === "Articles saved!" ? "text-jcc-accent" : "text-jcc-text-muted"}`}>
                {artMsg}
              </p>
            )}

            {artItems.length > 0 || artSeriesId ? (
              <div className="space-y-2">
                <Label>Articles</Label>
                {artItems.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={a.title} onChange={(e) => {
                      const next = [...artItems]; next[i] = { ...next[i], title: e.target.value };
                      setArtItems(next);
                    }} placeholder="Article title" className="flex-1" />
                    <Input value={a.url} onChange={(e) => {
                      const next = [...artItems]; next[i] = { ...next[i], url: e.target.value };
                      setArtItems(next);
                    }} placeholder="https://…" className="flex-1" />
                    <button type="button" onClick={() => setArtItems(artItems.filter((_, j) => j !== i))}
                      className="text-jcc-text-muted hover:text-jcc-danger transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <button type="button"
                    onClick={() => setArtItems([...artItems, { title: "", url: "" }])}
                    className="text-xs text-jcc-accent-dark hover:text-jcc-accent flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add article
                  </button>
                  <button onClick={handleSaveArticles} disabled={artBusy || !artSeriesId.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-vibrant-blue text-xs font-black uppercase tracking-widest disabled:opacity-40">
                    {artBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Articles
                  </button>
                </div>
              </div>
            ) : null}
          </CollapsibleSection>

        </div>
      </div>
    </div>
  );
}
