// Seeds the Season 3 fixture list: 12 `series` rows (one per week) and all 45
// `series_matches` rows, inserted before any of them are played.
//
// This works because computeSeriesStandings skips any match without a result,
// so unplayed fixtures are invisible to the points table until the import flow
// fills one in — which it does by updating these rows in place, keyed on
// (series_id, match_no).
//
// Usage:
//   SEASON_ID=<uuid> node scripts/seed-season-3.mjs
//   SEASON_ID=<uuid> node scripts/seed-season-3.mjs --dry-run
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env
// (the repo's .env.local is loaded automatically if present).
//
// Idempotent: re-running skips weeks that already exist rather than
// duplicating them, so a partial failure is safe to retry.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ── Config ──────────────────────────────────────────────────────────────────

const FIRST_MATCH_DATE = process.env.FIRST_MATCH_DATE ?? "2026-07-24"; // Friday — JCC plays Fridays
const OVERS_PER_INNINGS = Number(process.env.OVERS_PER_INNINGS ?? 10);
const VENUE = process.env.VENUE ?? null;

const NS = "neurostrikers";
const MAV = "mavericks";
const OUT = "outliers";
const VIK = "vikings";

// Transcribed verbatim from the published Season 3 schedule poster.
// Kept in sync with lib/season-schedule.ts — see the note there on why this
// list is fixed data rather than generated.
const LEAGUE_WEEKS = [
  [[NS, VIK], [NS, OUT], [MAV, VIK], [OUT, MAV]],
  [[OUT, VIK], [NS, VIK], [OUT, MAV], [NS, MAV]],
  [[NS, OUT], [OUT, VIK], [NS, MAV], [MAV, VIK]],
  [[MAV, VIK], [OUT, MAV], [NS, VIK], [NS, OUT]],
  [[OUT, MAV], [NS, MAV], [OUT, VIK], [NS, VIK]],
  [[NS, OUT], [MAV, VIK], [NS, MAV], [OUT, VIK]],
  [[OUT, MAV], [NS, VIK], [NS, OUT], [MAV, VIK]],
  [[NS, MAV], [OUT, VIK], [OUT, MAV], [NS, VIK]],
  [[MAV, VIK], [NS, OUT], [OUT, VIK], [NS, MAV]],
  [[NS, OUT], [MAV, VIK], [NS, VIK], [OUT, MAV]],
  [[OUT, VIK], [NS, MAV]],
];

const PLAYOFF_WEEK_NO = 12;

const PLAYOFF_FIXTURES = [
  { match_no: 1, stage: "eliminator", team1_seed: 3, team2_seed: 4, team2_from_match_no: null },
  { match_no: 2, stage: "qualifier", team1_seed: 2, team2_seed: null, team2_from_match_no: 1 },
  { match_no: 3, stage: "final", team1_seed: 1, team2_seed: null, team2_from_match_no: 2 },
];

// ── Sanity checks on the transcription ──────────────────────────────────────
// A typo in the table above would be near-impossible to spot by eye but would
// quietly produce an unbalanced season, so verify the invariants up front.

function verifySchedule() {
  const all = LEAGUE_WEEKS.flat();
  const errors = [];

  if (all.length !== 42) {
    errors.push(`Expected 42 league matches, found ${all.length}`);
  }

  const pairCounts = new Map();
  for (const [a, b] of all) {
    if (a === b) errors.push(`Team plays itself: ${a}`);
    const key = [a, b].sort().join(" v ");
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  if (pairCounts.size !== 6) {
    errors.push(`Expected 6 distinct pairings, found ${pairCounts.size}`);
  }
  for (const [pair, count] of pairCounts) {
    if (count !== 7) errors.push(`${pair} scheduled ${count} times, expected 7`);
  }

  // Every team plays the same number of matches each week — twice in a normal
  // 4-match week, once in the 2-match week 11. An unbalanced week would mean a
  // team sitting out while another plays three times.
  LEAGUE_WEEKS.forEach((week, i) => {
    const perTeam = new Map();
    for (const [a, b] of week) {
      for (const t of [a, b]) perTeam.set(t, (perTeam.get(t) ?? 0) + 1);
    }
    const expected = (week.length * 2) / 4;
    if (perTeam.size !== 4) {
      errors.push(`Week ${i + 1}: ${perTeam.size} teams featured, expected 4`);
    }
    for (const [team, count] of perTeam) {
      if (count !== expected) {
        errors.push(`Week ${i + 1}: ${team} plays ${count} times, expected ${expected}`);
      }
    }
  });

  if (errors.length) {
    console.error("Schedule verification failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `Schedule verified: ${all.length} league + ${PLAYOFF_FIXTURES.length} playoff = ` +
      `${all.length + PLAYOFF_FIXTURES.length} matches, each of the 6 pairs meeting 7 times.`,
  );
}

// ── Env ─────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function weeksAfter(isoDate, weeksLater) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeksLater * 7);
  return d.toISOString().slice(0, 10);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  verifySchedule();

  loadEnvLocal();
  const seasonId = process.env.SEASON_ID;
  if (!seasonId && !dryRun) {
    console.error("SEASON_ID is required — pass the Season 3 uuid from rivalry_seasons.");
    process.exit(1);
  }

  const weeks = [
    ...LEAGUE_WEEKS.map((fixtures, i) => ({
      week_no: i + 1,
      matches: fixtures.map(([t1, t2], j) => ({
        match_no: j + 1,
        stage: "league",
        team1_id: t1,
        team2_id: t2,
        team1_seed: null,
        team2_seed: null,
        team1_from_match_no: null,
        team2_from_match_no: null,
      })),
    })),
    {
      week_no: PLAYOFF_WEEK_NO,
      matches: PLAYOFF_FIXTURES.map((f) => ({
        match_no: f.match_no,
        stage: f.stage,
        // Participants are unknown until the league table settles; the seed
        // and feeder-match columns carry the bracket shape instead.
        team1_id: null,
        team2_id: null,
        team1_seed: f.team1_seed,
        team2_seed: f.team2_seed,
        team1_from_match_no: null,
        team2_from_match_no: f.team2_from_match_no,
      })),
    },
  ];

  if (dryRun) {
    for (const w of weeks) {
      const label = w.week_no === PLAYOFF_WEEK_NO ? "Final Week" : `Week ${w.week_no}`;
      console.log(`\n${label} — ${weeksAfter(FIRST_MATCH_DATE, w.week_no - 1)}`);
      for (const m of w.matches) {
        const side = (id, seed, from) =>
          id ?? (seed ? `[seed ${seed}]` : from ? `[winner M${from}]` : "TBD");
        console.log(
          `  M${m.match_no} (${m.stage}): ` +
            `${side(m.team1_id, m.team1_seed, m.team1_from_match_no)} v ` +
            `${side(m.team2_id, m.team2_seed, m.team2_from_match_no)}`,
        );
      }
    }
    console.log("\nDry run — nothing written.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingErr } = await supabase
    .from("series")
    .select("week_no")
    .eq("season_id", seasonId)
    .not("week_no", "is", null);

  if (existingErr) {
    console.error("Could not read existing weeks:", existingErr.message);
    process.exit(1);
  }
  const alreadySeeded = new Set((existing ?? []).map((r) => r.week_no));

  for (const w of weeks) {
    if (alreadySeeded.has(w.week_no)) {
      console.log(`Week ${w.week_no}: already seeded, skipping.`);
      continue;
    }

    const isPlayoff = w.week_no === PLAYOFF_WEEK_NO;
    const { data: series, error: seriesErr } = await supabase
      .from("series")
      .insert({
        name: isPlayoff ? "Final Week" : `Week ${w.week_no}`,
        series_no: w.week_no,
        week_no: w.week_no,
        season_id: seasonId,
        overs_per_innings: OVERS_PER_INNINGS,
        venue: VENUE,
        started_at: weeksAfter(FIRST_MATCH_DATE, w.week_no - 1),
        status: "upcoming",
      })
      .select("id")
      .single();

    if (seriesErr) {
      console.error(`Week ${w.week_no}: failed to create series — ${seriesErr.message}`);
      process.exit(1);
    }

    const rows = w.matches.map((m) => ({
      ...m,
      series_id: series.id,
      match_date: weeksAfter(FIRST_MATCH_DATE, w.week_no - 1),
      venue: VENUE,
    }));

    const { error: matchErr } = await supabase.from("series_matches").insert(rows);
    if (matchErr) {
      console.error(`Week ${w.week_no}: failed to create matches — ${matchErr.message}`);
      process.exit(1);
    }

    console.log(`Week ${w.week_no}: created ${rows.length} fixtures.`);
  }

  console.log("\nSeason 3 schedule seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
