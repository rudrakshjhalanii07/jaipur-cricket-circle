"use client";

// Match entry, ball by ball. Pick the seeded fixture, set the toss and the two
// squads, then score every delivery; the scorecard is replayed from the ball
// log (lib/ball-by-ball.ts) and saved through /api/series/save like any other.
//
// The draft lives in this browser's localStorage, keyed by fixture, after every
// ball — a refresh or a dead phone battery mid-match loses nothing.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle, AlertCircle,
  Loader2, ArrowLeft, ExternalLink, Link2, RefreshCw, Play, RotateCcw,
} from "lucide-react";
import {
  fetchAllSeries,
  fetchSeriesMatches,
  type MatchStage,
  type Series,
  type SeriesMatch,
} from "@/lib/series";
import { fetchSeasons, type Season } from "@/lib/seasons";
import { TEAMS as TEAM_CONFIG, TEAM_ORDER_ALL } from "@/lib/teams";
import { AUCTION_SIGNINGS } from "@/lib/auction-squads";
import {
  inningsOver,
  matchResult,
  oversLabel,
  replayInnings,
  toSaveInnings,
  type ScoreEvent,
} from "@/lib/ball-by-ball";
import Scorer from "./Scorer";

const TEAM_LABELS: Record<string, string> = Object.fromEntries(
  TEAM_ORDER_ALL.map((id) => [id, TEAM_CONFIG[id].name]),
);
const teamLabel = (id: string | null | undefined) => (id ? (TEAM_LABELS[id] ?? id) : "TBD");

const ALL_SIGNING_NAMES = [...new Set(AUCTION_SIGNINGS.map((s) => s.name))].sort();

// ── Draft ─────────────────────────────────────────────────────────────────────

type Phase = "setup" | "innings1" | "innings2" | "review";

interface Draft {
  v: 1;
  weekId: string;
  fixtureId: string;
  matchNo: number;
  stage: MatchStage;
  team1: string;
  team2: string;
  date: string;
  overs: number;
  /** Last man stands: the final batter bats on alone. Absent on older drafts = off. */
  lastManStands?: boolean;
  tossWinner: string;
  tossDecision: "bat" | "bowl";
  squads: Record<string, string[]>;
  captains: Record<string, string>;
  innings: [ScoreEvent[], ScoreEvent[]];
  phase: Phase;
  result: { winner: string; marginType: "runs" | "wickets" | ""; marginValue: number | null; tie: boolean } | null;
  potm: string;
  notes: string;
}

const draftKey = (fixtureId: string) => `jcc_bbb_draft_${fixtureId}`;

function loadDraft(fixtureId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(fixtureId));
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    return d?.v === 1 ? d : null;
  } catch {
    return null;
  }
}

function storeDraft(d: Draft) {
  try {
    localStorage.setItem(draftKey(d.fixtureId), JSON.stringify(d));
  } catch {
    // Storage blocked — scoring still works, it just won't survive a reload.
  }
}

function clearDraft(fixtureId: string) {
  try {
    localStorage.removeItem(draftKey(fixtureId));
  } catch {}
}

/** Season 3 squads from the auction, captain first. */
function defaultSquad(team: string): string[] {
  return AUCTION_SIGNINGS.filter((s) => s.teamId === team)
    .sort((a, b) => Number(b.captain) - Number(a.captain) || a.name.localeCompare(b.name))
    .map((s) => s.name);
}

function newDraft(week: Series, f: SeriesMatch): Draft {
  const team1 = f.team1_id ?? "";
  const team2 = f.team2_id ?? "";
  // The current captain, not the auction-day one — those can differ (Vikings).
  const captainOf = (t: string) => TEAM_CONFIG[t as keyof typeof TEAM_CONFIG]?.captain ?? "";
  return {
    v: 1,
    weekId: week.id,
    fixtureId: f.id,
    matchNo: f.match_no,
    stage: f.stage,
    team1,
    team2,
    date: f.match_date ?? week.started_at?.slice(0, 10) ?? "",
    overs: week.overs_per_innings,
    tossWinner: "",
    tossDecision: "bat",
    // Nobody is ticked to start — a fixture is rarely the full auction squad.
    squads: { [team1]: [], [team2]: [] },
    captains: { [team1]: captainOf(team1), [team2]: captainOf(team2) },
    innings: [[], []],
    phase: "setup",
    result: null,
    potm: "",
    notes: "",
  };
}

/** Batting first / second, from the toss. */
function battingOrder(d: Draft): [string, string] {
  const other = d.tossWinner === d.team1 ? d.team2 : d.team1;
  return d.tossDecision === "bat" ? [d.tossWinner, other] : [other, d.tossWinner];
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="admin-label">{children}</label>;
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`admin-input ${className}`} {...props} />;
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`admin-select ${className}`} {...props}>
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

function SquadPicker({
  team,
  squad,
  captain,
  onSquad,
  onCaptain,
}: {
  team: string;
  squad: string[];
  captain: string;
  onSquad: (s: string[]) => void;
  onCaptain: (c: string) => void;
}) {
  const [guest, setGuest] = useState("");
  const signed = defaultSquad(team);
  const extras = squad.filter((p) => !signed.includes(p));
  const toggle = (p: string) => onSquad(squad.includes(p) ? squad.filter((x) => x !== p) : [...squad, p]);
  const addGuest = () => {
    const n = guest.trim().replace(/\s+/g, " ");
    if (n && !squad.includes(n)) onSquad([...squad, n]);
    setGuest("");
  };
  const color = TEAM_CONFIG[team as keyof typeof TEAM_CONFIG]?.primary;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-wide" style={{ color }}>{teamLabel(team)}</p>
        <span className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">{squad.length} playing</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...signed, ...extras].map((p) => {
          const on = squad.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                on ? "bg-jcc-blue text-white border-jcc-blue" : "border-jcc-border text-jcc-blue/60 hover:border-jcc-accent/50"
              }`}
            >
              {p}
              {!signed.includes(p) && <span className="opacity-60"> · guest</span>}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={guest}
          list="jcc-player-names"
          onChange={(e) => setGuest(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGuest();
            }
          }}
          placeholder="Add a guest / unlisted player"
        />
        <button type="button" onClick={addGuest} className="btn-ghost px-3 rounded-xl" title="Add player">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div>
        <Label>Captain</Label>
        <Select value={captain} onChange={(e) => onCaptain(e.target.value)}>
          <option value="">—</option>
          {squad.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SeriesImportPage() {
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [pwInput, setPwInput] = useState("");

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

  // Season weeks are pre-seeded with their fixtures; scoring fills one in.
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [pickedWeekId, setWeekId] = useState("");

  const refreshSeries = useCallback(() => {
    fetchAllSeries().then(setAllSeries).catch(() => {});
  }, []);

  useEffect(() => {
    refreshSeries();
    fetchSeasons().then(setSeasons).catch(() => {});
  }, [refreshSeries]);

  const activeSeason = seasons.find((s) => s.status === "active") ?? null;
  const weeks = allSeries
    .filter((s) => s.week_no != null && s.season_id === activeSeason?.id)
    .sort((a, b) => (a.week_no ?? 0) - (b.week_no ?? 0));
  // Until one is picked, open on this week's matchday: the first week starting
  // no more than a few days ago, else the last one.
  const [today] = useState(() => new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
  const weekId =
    pickedWeekId ||
    (weeks.find((w) => (w.started_at ?? "") >= today) ?? weeks[weeks.length - 1])?.id ||
    "";
  const week = weeks.find((w) => w.id === weekId) ?? null;

  const [fixtureRows, setFixtureRows] = useState<{ weekId: string; rows: SeriesMatch[] }>({ weekId: "", rows: [] });
  const [fixturesVersion, setFixturesVersion] = useState(0);
  const refreshFixtures = () => setFixturesVersion((v) => v + 1);
  useEffect(() => {
    if (!weekId) return;
    let cancelled = false;
    fetchSeriesMatches(weekId)
      .then((rows) => {
        if (!cancelled) setFixtureRows({ weekId, rows });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weekId, fixturesVersion]);
  const fixtures = fixtureRows.weekId === weekId ? fixtureRows.rows : [];

  // ── Draft ──
  const [draft, setDraftState] = useState<Draft | null>(null);
  const setDraft = useCallback((d: Draft | null) => {
    setDraftState(d);
    if (d) storeDraft(d);
  }, []);
  const patch = (p: Partial<Draft>) => draft && setDraft({ ...draft, ...p });

  const openFixture = (f: SeriesMatch) => {
    if (!week) return;
    const saved = loadDraft(f.id);
    if (f.winner_id || f.is_tie) {
      if (!confirm(`M${f.match_no} already has a result. Scoring it again replaces that scorecard. Continue?`)) return;
    }
    setDraft(saved ?? newDraft(week, f));
  };

  const discardDraft = () => {
    if (!draft) return;
    if (!confirm("Discard this match's draft, including every ball scored?")) return;
    clearDraft(draft.fixtureId);
    setDraftState(null);
  };

  // ── Derived match state ──
  const [bat1, bat2] = draft ? battingOrder(draft) : ["", ""];
  const inn1 = useMemo(() => replayInnings(draft?.innings[0] ?? []), [draft?.innings]);
  const inn2 = useMemo(() => replayInnings(draft?.innings[1] ?? []), [draft?.innings]);
  const squadOf = (t: string) => draft?.squads[t] ?? [];

  const autoResult = draft
    ? matchResult(
        { team: bat1, runs: inn1.runs },
        { team: bat2, runs: inn2.runs, wickets: inn2.wickets, squadSize: squadOf(bat2).length, lastManStands: !!draft.lastManStands },
      )
    : null;

  const setupProblems: string[] = [];
  if (draft) {
    if (!draft.team1 || !draft.team2 || draft.team1 === draft.team2) setupProblems.push("Pick two different teams.");
    if (!draft.tossWinner) setupProblems.push("Who won the toss?");
    for (const t of [draft.team1, draft.team2]) {
      if (t && squadOf(t).length < 2) setupProblems.push(`${teamLabel(t)} needs at least 2 players.`);
    }
    const both = [...squadOf(draft.team1), ...squadOf(draft.team2)];
    const dup = both.find((p, i) => both.indexOf(p) !== i);
    if (dup) setupProblems.push(`${dup} is in both squads.`);
    if (!draft.overs || draft.overs < 1) setupProblems.push("Set the overs per innings.");
  }

  const startReview = () => {
    if (!draft || !autoResult) return;
    setDraft({
      ...draft,
      phase: "review",
      result: draft.result ?? {
        winner: autoResult.winner ?? "",
        marginType: autoResult.marginType ?? "",
        marginValue: autoResult.marginValue,
        tie: autoResult.tie,
      },
    });
  };

  // ── Save ──
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveResult, setSaveResult] = useState<{ match_id: string; series_id: string } | null>(null);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!draft || !draft.result) return;
    setSaving(true);
    setError("");
    try {
      const r = draft.result;
      const limits = (team: string) => ({ overs: draft.overs, squadSize: squadOf(team).length, lastManStands: !!draft.lastManStands, target: null });
      const body = {
        series_id: draft.weekId,
        match_no: draft.matchNo,
        stage: draft.stage,
        match_date: draft.date || null,
        venue: null,
        team1_id: draft.team1,
        team2_id: draft.team2,
        toss_winner_id: draft.tossWinner || null,
        toss_decision: draft.tossDecision,
        team1_captain: draft.captains[draft.team1] || null,
        team2_captain: draft.captains[draft.team2] || null,
        winner_id: r.tie ? null : r.winner || null,
        margin_type: r.tie ? null : r.marginType || null,
        margin_value: r.tie ? null : r.marginValue,
        is_tie: r.tie,
        player_of_match: draft.potm || null,
        match_notes: draft.notes || null,
        innings: [
          toSaveInnings(inn1, {
            inningsNo: 1, battingTeam: bat1, bowlingTeam: bat2, squad: squadOf(bat1),
            allOut: inningsOver(inn1, limits(bat1)) === "all_out",
          }),
          toSaveInnings(inn2, {
            inningsNo: 2, battingTeam: bat2, bowlingTeam: bat1, squad: squadOf(bat2),
            allOut: inningsOver(inn2, limits(bat2)) === "all_out",
          }),
        ],
      };

      const res = await fetch("/api/series/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);

      clearDraft(draft.fixtureId);
      setSaveResult({ match_id: json.match_id, series_id: json.series_id });
      refreshSeries();

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

  const resetForNext = () => {
    setDraftState(null);
    setSaveResult(null);
    setAnalysisText("");
    setError("");
    refreshFixtures();
  };

  // ── Admin tools: articles ──
  const [artSeriesId, setArtSeriesId] = useState("");
  const [artItems, setArtItems] = useState<Array<{ title: string; url: string }>>([]);
  const [artBusy, setArtBusy] = useState(false);
  const [artMsg, setArtMsg] = useState("");

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

  // ── Admin tools: CricHeroes export sync ──
  interface SyncReport {
    apply: boolean;
    summary: Record<string, number>;
    new_names: string[];
    rows: Array<{ source_id: string; date: string; teams: string; result: string; week_no: number | null; match_no: number | null; status: string; detail?: string; warnings: string[] }>;
  }
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncError, setSyncError] = useState("");

  const runSync = async (apply: boolean) => {
    setSyncBusy(true);
    setSyncError("");
    try {
      const res = await fetch("/api/series/sync-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ apply }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error);
      setSyncReport(json);
      if (apply) {
        refreshSeries();
        refreshFixtures();
      }
    } catch (err) {
      setSyncError(String(err));
    } finally {
      setSyncBusy(false);
    }
  };

  // ── Auth gate ──

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
            <button type="submit" className="w-full py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest">
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Saved ──

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
              Score Next Match
            </button>
            <Link href="/stats" className="btn-ghost px-5 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center gap-2">
              View Stats Page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ──

  const phaseSteps: { key: Phase; label: string }[] = [
    { key: "setup", label: "Setup" },
    { key: "innings1", label: "1st innings" },
    { key: "innings2", label: "2nd innings" },
    { key: "review", label: "Review & save" },
  ];

  return (
    <div className="min-h-screen bg-[var(--jcc-bg)] text-jcc-blue">
      <datalist id="jcc-player-names">
        {ALL_SIGNING_NAMES.map((n) => <option key={n} value={n} />)}
      </datalist>
      <div className="max-w-4xl mx-auto px-4 page-top pb-12 space-y-6">

        <div className="flex items-center gap-4">
          <a href="/admin" className="text-jcc-text-muted hover:text-jcc-blue transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-[26px] font-black uppercase tracking-tight text-jcc-accent-dark">Match Scorer</h1>
            <p className="text-xs text-jcc-text-muted font-medium mt-0.5">Pick a fixture → score it ball by ball → save to the database</p>
          </div>
        </div>

        {!draft ? (
          // ── Fixture picker ──
          <CollapsibleSection title="Choose a fixture">
            <div>
              <Label>Season Week</Label>
              <Select value={weekId} onChange={(e) => setWeekId(e.target.value)}>
                <option value="">— Choose a week —</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.started_at ? ` — ${w.started_at.slice(0, 10)}` : ""}
                  </option>
                ))}
              </Select>
              {weeks.length === 0 && (
                <p className="text-[10px] text-jcc-text-muted mt-1">No seeded weeks found for {activeSeason?.title ?? "the active season"}.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fixtures.map((f) => {
                const played = !!(f.winner_id || f.is_tie);
                const hasDraft = typeof window !== "undefined" && loadDraft(f.id) !== null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openFixture(f)}
                    className="text-left rounded-xl border border-jcc-border hover:border-jcc-accent/50 bg-jcc-navy-light/40 p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">
                        M{f.match_no} · {f.stage}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          hasDraft ? "bg-jcc-blue/10 text-jcc-blue" : played ? "bg-jcc-accent/10 text-jcc-accent-dark" : "bg-jcc-border/40 text-jcc-text-muted"
                        }`}
                      >
                        {hasDraft ? "Draft in progress" : played ? "Result in" : "To play"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-black">
                      {teamLabel(f.team1_id)} <span className="text-jcc-text-muted font-bold">v</span> {teamLabel(f.team2_id)}
                    </p>
                    {played && (
                      <p className="text-[11px] text-jcc-text-muted mt-0.5">
                        {f.is_tie ? "Tied" : `${teamLabel(f.winner_id)} won by ${f.margin_value} ${f.margin_type}`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>
        ) : (
          <>
            {/* Fixture header + progress */}
            <div className="premium-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">
                  {week?.name} · M{draft.matchNo} · {draft.stage}
                </p>
                <p className="text-lg font-black">
                  {teamLabel(draft.team1)} <span className="text-jcc-text-muted">v</span> {teamLabel(draft.team2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDraftState(null)} className="btn-ghost px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest">
                  Fixtures
                </button>
                <button type="button" onClick={discardDraft} className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-jcc-danger border border-jcc-danger/30 hover:bg-jcc-danger/10 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Discard
                </button>
              </div>
              <div className="w-full flex gap-1.5">
                {phaseSteps.map((p, i) => {
                  const idx = phaseSteps.findIndex((x) => x.key === draft.phase);
                  return (
                    <div key={p.key} className="flex-1">
                      <div className={`h-1 rounded-full ${i <= idx ? "bg-jcc-accent" : "bg-jcc-border"}`} />
                      <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${i === idx ? "text-jcc-blue" : "text-jcc-text-muted/70"}`}>{p.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {draft.phase === "setup" && (
              <>
                <CollapsibleSection title="Match">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[draft.team1, draft.team2].map((t, i) => (
                      <div key={i}>
                        <Label>Team {i + 1}</Label>
                        <Select
                          value={t}
                          onChange={(e) => {
                            const key = i === 0 ? "team1" : "team2";
                            const v = e.target.value;
                            patch({ [key]: v, squads: { ...draft.squads, [v]: draft.squads[v] ?? [] } });
                          }}
                        >
                          <option value="">—</option>
                          {TEAM_ORDER_ALL.map((id) => <option key={id} value={id}>{TEAM_LABELS[id]}</option>)}
                        </Select>
                      </div>
                    ))}
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Overs per innings</Label>
                      <Input type="number" min={1} value={draft.overs} onChange={(e) => patch({ overs: +e.target.value })} />
                    </div>
                    <div>
                      <Label>Toss won by</Label>
                      <Select value={draft.tossWinner} onChange={(e) => patch({ tossWinner: e.target.value })}>
                        <option value="">—</option>
                        {[draft.team1, draft.team2].filter(Boolean).map((t) => <option key={t} value={t}>{teamLabel(t)}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Elected to</Label>
                      <Select value={draft.tossDecision} onChange={(e) => patch({ tossDecision: e.target.value as "bat" | "bowl" })}>
                        <option value="bat">Bat</option>
                        <option value="bowl">Bowl</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Last batter</Label>
                      <Select
                        value={draft.lastManStands ? "lms" : "pair"}
                        onChange={(e) => patch({ lastManStands: e.target.value === "lms" })}
                      >
                        <option value="pair">All out at squad − 1</option>
                        <option value="lms">Last batter standing bats on</option>
                      </Select>
                    </div>
                    {draft.tossWinner && (
                      <div className="col-span-2 flex items-end pb-2 text-xs font-bold text-jcc-text-muted">
                        {teamLabel(bat1)} bat first.
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Playing squads">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[draft.team1, draft.team2].filter(Boolean).map((t) => (
                      <SquadPicker
                        key={t}
                        team={t}
                        squad={squadOf(t)}
                        captain={draft.captains[t] ?? ""}
                        onSquad={(s) => patch({ squads: { ...draft.squads, [t]: s } })}
                        onCaptain={(c) => patch({ captains: { ...draft.captains, [t]: c } })}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-jcc-text-muted">
                    Everyone ticked gets a match appearance, batting or not. A side is all out at squad size − 1 wickets.
                  </p>
                </CollapsibleSection>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    disabled={setupProblems.length > 0}
                    onClick={() => patch({ phase: "innings1" })}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest disabled:opacity-40"
                  >
                    <Play className="w-4 h-4" /> Start scoring
                  </button>
                  {setupProblems.length > 0 && (
                    <p className="text-xs text-jcc-danger font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> {setupProblems[0]}
                    </p>
                  )}
                </div>
              </>
            )}

            {(draft.phase === "innings1" || draft.phase === "innings2") && (() => {
              const second = draft.phase === "innings2";
              const batting = second ? bat2 : bat1;
              const bowling = second ? bat1 : bat2;
              const idx = second ? 1 : 0;
              return (
                <>
                  {second && (
                    <p className="text-xs font-bold text-jcc-text-muted">
                      {teamLabel(bat1)} made {inn1.runs}/{inn1.wickets} ({oversLabel(inn1.legalBalls)}).{" "}
                      <button type="button" className="underline" onClick={() => patch({ phase: "innings1" })}>
                        Back to 1st innings
                      </button>
                    </p>
                  )}
                  <Scorer
                    key={draft.phase}
                    inningsNo={second ? 2 : 1}
                    events={draft.innings[idx]}
                    onChange={(ev) => {
                      const innings: Draft["innings"] = [...draft.innings];
                      innings[idx] = ev;
                      // Any change to the balls invalidates a result already reviewed.
                      setDraft({ ...draft, innings, result: null });
                    }}
                    battingTeam={teamLabel(batting)}
                    bowlingTeam={teamLabel(bowling)}
                    battingSquad={squadOf(batting)}
                    bowlingSquad={squadOf(bowling)}
                    limits={{ overs: draft.overs, squadSize: squadOf(batting).length, lastManStands: !!draft.lastManStands, target: second ? inn1.runs + 1 : null }}
                    onEnd={() => (second ? startReview() : patch({ phase: "innings2" }))}
                  />
                  {!second && (
                    <button type="button" onClick={() => patch({ phase: "setup" })} className="text-xs font-bold text-jcc-text-muted underline">
                      Back to setup
                    </button>
                  )}
                </>
              );
            })()}

            {draft.phase === "review" && draft.result && (
              <>
                {[
                  { s: inn1, team: bat1, opp: bat2 },
                  { s: inn2, team: bat2, opp: bat1 },
                ].map(({ s, team }, i) => (
                  <CollapsibleSection key={i} title={`Innings ${i + 1} — ${teamLabel(team)} ${s.runs}/${s.wickets} (${oversLabel(s.legalBalls)})`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[10px] text-jcc-text-muted uppercase">
                            <th className="text-left">Batter</th><th className="text-right">R</th><th className="text-right">B</th><th className="text-right">4s</th><th className="text-right">6s</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.batters.map((b) => (
                            <tr key={b.name}>
                              <td className="py-0.5 font-bold">{b.name}<span className="font-normal text-jcc-text-muted"> — {b.out ? b.out.type.replace("_", " ") : "not out"}</span></td>
                              <td className="text-right font-black">{b.runs}</td><td className="text-right">{b.balls}</td><td className="text-right">{b.fours}</td><td className="text-right">{b.sixes}</td>
                            </tr>
                          ))}
                          {squadOf(team).filter((p) => !s.batters.some((b) => b.name === p)).length > 0 && (
                            <tr>
                              <td colSpan={5} className="pt-1 text-jcc-text-muted">
                                Did not bat: {squadOf(team).filter((p) => !s.batters.some((b) => b.name === p)).join(", ")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[10px] text-jcc-text-muted uppercase">
                            <th className="text-left">Bowler</th><th className="text-right">O</th><th className="text-right">M</th><th className="text-right">R</th><th className="text-right">W</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.bowlers.map((b) => (
                            <tr key={b.name}>
                              <td className="py-0.5 font-bold">{b.name}</td>
                              <td className="text-right">{oversLabel(b.balls)}</td><td className="text-right">{b.maidens}</td><td className="text-right">{b.runs}</td><td className="text-right font-black">{b.wickets}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-jcc-text-muted">
                      Extras: wd {s.extras.wd}, nb {s.extras.nb}, b {s.extras.b}, lb {s.extras.lb}
                      {s.fow.length > 0 && ` · FoW: ${s.fow.map((f) => `${f.score}-${f.wkt} (${f.player}, ${f.overs})`).join(", ")}`}
                    </p>
                  </CollapsibleSection>
                ))}

                <CollapsibleSection title="Result">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label>Winner</Label>
                      <Select
                        value={draft.result.winner}
                        disabled={draft.result.tie}
                        onChange={(e) => patch({ result: { ...draft.result!, winner: e.target.value } })}
                      >
                        <option value="">—</option>
                        {[draft.team1, draft.team2].map((t) => <option key={t} value={t}>{teamLabel(t)}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Margin</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          disabled={draft.result.tie}
                          value={draft.result.marginValue ?? ""}
                          onChange={(e) => patch({ result: { ...draft.result!, marginValue: e.target.value ? +e.target.value : null } })}
                        />
                        <Select
                          value={draft.result.marginType}
                          disabled={draft.result.tie}
                          onChange={(e) => patch({ result: { ...draft.result!, marginType: e.target.value as "runs" | "wickets" } })}
                        >
                          <option value="runs">runs</option>
                          <option value="wickets">wkts</option>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.result.tie}
                          onChange={(e) => patch({ result: { ...draft.result!, tie: e.target.checked } })}
                          className="accent-jcc-accent"
                        />
                        <span className="text-xs font-bold text-jcc-blue/70">Tie</span>
                      </label>
                    </div>
                    <div>
                      <Label>Player of the Match</Label>
                      <Select value={draft.potm} onChange={(e) => patch({ potm: e.target.value })}>
                        <option value="">—</option>
                        {[...squadOf(draft.team1), ...squadOf(draft.team2)].map((p) => <option key={p} value={p}>{p}</option>)}
                      </Select>
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      <Label>Match Notes</Label>
                      <Input value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Key moments, context…" />
                    </div>
                  </div>
                  <p className="text-[10px] text-jcc-text-muted">
                    Worked out from the scoring: {autoResult?.tie ? "a tie" : `${teamLabel(autoResult?.winner)} by ${autoResult?.marginValue} ${autoResult?.marginType}`}.
                    {(() => {
                      const f = fixtures.find((x) => x.id === draft.fixtureId);
                      return f && (f.winner_id || f.is_tie) ? " Saving replaces this fixture's existing scorecard." : "";
                    })()}
                  </p>
                </CollapsibleSection>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl btn-vibrant-blue font-black text-sm uppercase tracking-widest disabled:opacity-50"
                  >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Match</>}
                  </button>
                  <button type="button" onClick={() => patch({ phase: "innings2" })} className="btn-ghost px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest">
                    Back to scoring
                  </button>
                  {error && (
                    <div className="flex items-center gap-2 text-xs text-jcc-danger">
                      <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Admin Tools ───────────────────────────────────────────────── */}
        <div className="mt-8 pt-8 border-t border-jcc-border space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-jcc-text-muted/70">Admin Tools</p>

          <CollapsibleSection title="Sync CricHeroes export to database" defaultOpen={false}>
            <p className="text-xs text-jcc-text-muted">
              Copies the CricHeroes matches behind /stats into the active season&apos;s seeded fixtures, so the database
              holds them too. Fixtures that already have a result are left alone. Check first, then sync.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => runSync(false)}
                disabled={syncBusy}
                className="btn-ghost px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-40"
              >
                {syncBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Check
              </button>
              <button
                type="button"
                onClick={() => runSync(true)}
                disabled={syncBusy || !syncReport || syncReport.apply || (syncReport.summary.new ?? 0) === 0}
                className="px-4 py-2 rounded-lg btn-vibrant-blue text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                Sync {syncReport && !syncReport.apply ? syncReport.summary.new : ""} matches
              </button>
            </div>
            {syncError && <p className="text-xs text-jcc-danger">{syncError}</p>}
            {syncReport && (
              <div className="space-y-2 text-xs">
                <p className="font-bold">
                  {syncReport.apply
                    ? `Saved ${syncReport.summary.saved}, already recorded ${syncReport.summary.recorded}, unmatched ${syncReport.summary.unmatched}, errors ${syncReport.summary.error}.`
                    : `${syncReport.summary.new} to add, ${syncReport.summary.recorded} already recorded, ${syncReport.summary.unmatched} with no matching fixture.`}
                </p>
                {syncReport.new_names.length > 0 && (
                  <p className="text-jcc-text-muted">
                    Names new to the database (check none is a respelling): {syncReport.new_names.join(", ")}
                  </p>
                )}
                <div className="max-h-64 overflow-y-auto rounded-lg border border-jcc-border">
                  <table className="w-full">
                    <tbody>
                      {syncReport.rows.filter((r) => r.status !== "recorded").map((r) => (
                        <tr key={r.source_id} className="border-b border-jcc-border/50 last:border-0">
                          <td className="px-2 py-1 tabular-nums">{r.date}</td>
                          <td className="px-2 py-1">{r.teams}</td>
                          <td className="px-2 py-1 text-jcc-text-muted">{r.result}</td>
                          <td className="px-2 py-1">{r.week_no ? `W${r.week_no} M${r.match_no}` : "—"}</td>
                          <td className={`px-2 py-1 font-black uppercase ${r.status === "error" || r.status === "unmatched" ? "text-jcc-danger" : "text-jcc-accent-dark"}`}>
                            {r.status}{r.detail ? `: ${r.detail}` : ""}{r.warnings.length ? ` (${r.warnings.join("; ")})` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CollapsibleSection>

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
