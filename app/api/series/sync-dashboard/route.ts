import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { refreshScorecards } from "@/lib/scorecards-cache";
import { buildDashboardMatches, type DashboardMatch } from "@/lib/scorecard-dashboard/series-sync";

// Copies the CricHeroes matches behind /stats into a season's fixtures, so the
// database holds them too. The export is the
// standard: with overwrite, a fixture that already has a scorecard is rewritten
// from it.
//
// Each export match is placed in two passes:
//  1. A fixture of the season on the same date between the same two teams. If
//     the pair met twice that day (a league game and the final), the innings
//     totals pick the right one; a fixture that already has a scorecard must
//     share at least one innings total to count as the same match.
//  2. Anything left is a seeded fixture not yet played on its date. Matchdays
//     are walked in order and each fills the next seeded week whose fixtures
//     include every pairing played that day — the schedule slips (Week 6 was
//     played on 9 Sep, not 28 Aug), but the order of weeks holds.
// A database match with no export counterpart is never touched.
//
// POST { apply?, overwrite?, season?, only? }
//   apply      false (default) = dry run, reports what would be written
//   overwrite  also rewrite fixtures that already have a result
//   season     season number to sync (default: the active season)
//   only       CricHeroes match IDs to limit the writes to

interface Fixture {
  id: string;
  match_no: number;
  stage: string;
  match_date: string | null;
  team1_id: string | null;
  team2_id: string | null;
  winner_id: string | null;
  is_tie: boolean;
  player_of_match: string | null;
  super_over: Record<string, unknown> | null;
  series_innings: Array<{ innings_no: number; total_runs: number }>;
}

interface SeriesRow {
  id: string;
  name: string;
  week_no: number | null;
  series_matches: Fixture[];
}

type Status = "new" | "recorded" | "unmatched" | "saved" | "error";

interface Row {
  source_id: string;
  date: string;
  teams: string;
  result: string;
  series: string | null;
  week_no: number | null;
  match_no: number | null;
  status: Status;
  detail?: string;
  warnings: string[];
}

const samePair = (f: Fixture, m: DashboardMatch) =>
  (f.team1_id === m.team1_id && f.team2_id === m.team2_id) ||
  (f.team1_id === m.team2_id && f.team2_id === m.team1_id);

const hasResult = (f: Fixture) => !!(f.winner_id || f.is_tie);

/** Innings totals the fixture shares with the export match (0–2). */
const sharedTotals = (f: Fixture, m: DashboardMatch) =>
  m.innings.filter((i) => f.series_innings.some((x) => x.innings_no === i.innings_no && x.total_runs === i.total_runs)).length;

const SEASON_NO_BY_LABEL = /(\d+)/;

export async function POST(request: Request) {
  const password = request.headers.get("x-admin-password");
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { apply = false, overwrite = false, season: seasonArg, only } = (await request.json().catch(() => ({}))) as {
    apply?: boolean;
    overwrite?: boolean;
    season?: number;
    only?: string[];
  };
  const onlySet = only?.length ? new Set(only.map(String)) : null;

  try {
    const { data: seasons, error: seasonErr } = await supabaseAdmin
      .from("rivalry_seasons")
      .select("id, title, season_label, status");
    if (seasonErr || !seasons) throw new Error(seasonErr?.message ?? "No seasons");
    const numberOf = (s: { title: string; season_label: string | null }) =>
      Number((s.season_label ?? s.title).match(SEASON_NO_BY_LABEL)?.[1]);
    const season = seasonArg
      ? seasons.find((s) => numberOf(s) === seasonArg)
      : seasons.find((s) => s.status === "active");
    if (!season) throw new Error(seasonArg ? `No Season ${seasonArg}` : "No active season");
    const seasonNo = numberOf(season);

    const { data: seriesRows, error: seriesErr } = await supabaseAdmin
      .from("series")
      .select(
        "id, name, week_no, series_matches(id, match_no, stage, match_date, team1_id, team2_id, winner_id, is_tie, player_of_match, super_over, series_innings(innings_no, total_runs))",
      )
      .eq("season_id", season.id)
      .order("series_no");
    if (seriesErr) throw new Error(seriesErr.message);
    const allSeries = (seriesRows ?? []) as SeriesRow[];
    const seriesOf = new Map<string, SeriesRow>();
    for (const s of allSeries) for (const f of s.series_matches) seriesOf.set(f.id, s);
    const fixtures = allSeries.flatMap((s) => s.series_matches);

    const matches = buildDashboardMatches(seasonNo);
    const placed = new Map<DashboardMatch, Fixture>();
    const taken = new Set<string>();

    // Pass 1 — same date, same teams.
    for (const m of matches) {
      const cands = fixtures
        .filter((f) => !taken.has(f.id) && f.match_date === m.date && samePair(f, m))
        .filter((f) => !hasResult(f) || sharedTotals(f, m) > 0)
        .sort((a, b) => sharedTotals(b, m) - sharedTotals(a, m) || a.match_no - b.match_no);
      if (cands[0]) {
        placed.set(m, cands[0]);
        taken.add(cands[0].id);
      }
    }

    // Pass 2 — unplayed seeded fixtures, matchday by matchday.
    const weeks = allSeries.filter((s) => s.week_no != null);
    const byDate = new Map<string, DashboardMatch[]>();
    for (const m of matches) if (!placed.has(m)) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
    let next = 0;
    for (const day of byDate.values()) {
      for (let k = next; k < weeks.length; k++) {
        const hit = new Map<DashboardMatch, Fixture>();
        const used = new Set<string>();
        for (const m of day) {
          const f = weeks[k].series_matches.find((x) => !taken.has(x.id) && !used.has(x.id) && !hasResult(x) && samePair(x, m));
          if (!f) break;
          used.add(f.id);
          hit.set(m, f);
        }
        if (hit.size === day.length) {
          for (const [m, f] of hit) {
            placed.set(m, f);
            taken.add(f.id);
          }
          next = k + 1;
          break;
        }
      }
    }

    // Names the database has never seen. Usually a debutant, but a new spelling
    // of an existing player would split his stats in two — worth a look before
    // applying (add the alias to lib/player-names.ts).
    const known = new Set<string>();
    for (const table of ["series_batting", "series_bowling"]) {
      const { data } = await supabaseAdmin.from(table).select("player_name");
      for (const r of data ?? []) known.add(r.player_name);
    }

    const rows: Row[] = [];
    const newNames = new Set<string>();
    for (const m of matches) {
      const f = placed.get(m) ?? null;
      const s = f ? seriesOf.get(f.id)! : null;
      const row: Row = {
        source_id: m.source_id,
        date: m.date,
        teams: `${m.team1_id} v ${m.team2_id}`,
        result: m.is_tie ? "tie" : `${m.winner_id} by ${m.margin_value} ${m.margin_type}`,
        series: s?.name ?? null,
        week_no: s?.week_no ?? null,
        match_no: f?.match_no ?? null,
        status: !f ? "unmatched" : hasResult(f) ? "recorded" : "new",
        warnings: m.warnings,
      };
      rows.push(row);

      const write =
        f && s &&
        (!onlySet || onlySet.has(m.source_id)) &&
        (row.status === "new" || (row.status === "recorded" && overwrite));
      if (!write) continue;
      for (const inn of m.innings) {
        for (const p of [...inn.batting, ...inn.bowling]) if (!known.has(p.player_name)) newNames.add(p.player_name);
      }
      if (!apply) continue;

      // Keep the fixture's own orientation; only the innings carry who batted
      // first. Toss, notes and venue survive the upsert on their own (COALESCE
      // in save_series_match); player of the match and the super over don't,
      // and the export has neither, so they're carried over.
      const flipped = f.team1_id !== m.team1_id;
      const { error } = await supabaseAdmin.rpc("save_series_match", {
        payload: {
          series_id: s.id,
          match_no: f.match_no,
          stage: f.stage,
          match_date: m.date,
          venue: null,
          team1_id: f.team1_id,
          team2_id: f.team2_id,
          toss_winner_id: null,
          toss_decision: null,
          team1_captain: flipped ? m.team2_captain : m.team1_captain,
          team2_captain: flipped ? m.team1_captain : m.team2_captain,
          winner_id: m.winner_id,
          margin_type: m.margin_type,
          margin_value: m.margin_value,
          is_tie: m.is_tie,
          super_over: f.super_over,
          player_of_match: f.player_of_match,
          match_notes: null,
          innings: m.innings,
        },
      });
      row.status = error ? "error" : "saved";
      if (error) row.detail = error.message;
    }

    if (apply && rows.some((r) => r.status === "saved")) refreshScorecards();

    // Database matches of this season the export doesn't have — left alone.
    const untouched = fixtures
      .filter((f) => hasResult(f) && !taken.has(f.id))
      .map((f) => ({ series: seriesOf.get(f.id)!.name, match_no: f.match_no, date: f.match_date, teams: `${f.team1_id} v ${f.team2_id}` }));

    const count = (st: Status) => rows.filter((r) => r.status === st).length;
    return NextResponse.json({
      ok: true,
      apply,
      season: season.title,
      summary: {
        new: count("new"),
        saved: count("saved"),
        recorded: count("recorded"),
        unmatched: count("unmatched"),
        error: count("error"),
      },
      new_names: [...newNames].sort(),
      untouched,
      rows,
    });
  } catch (err) {
    console.error("series/sync-dashboard error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
