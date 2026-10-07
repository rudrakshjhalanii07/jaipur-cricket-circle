// Turns the CricHeroes scorecard export (data/JCC_Scorecard_Master.csv) into
// the compact JSON the /stats-preview dashboard imports.
//
//   node scripts/build-scorecard-dashboard.mjs [path/to/export.csv]
//
// This step only extracts the columns the dashboard reads. Player identity
// (merging duplicate IDs, canonical names) is decided in
// lib/scorecard-dashboard/compute.ts, next to the stats that depend on it.

import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const input = process.argv[2] ?? path.join(root, "data/JCC_Scorecard_Master.csv");
const output = path.join(root, "lib/scorecard-dashboard/data.json");

const { data: rows, errors } = Papa.parse(fs.readFileSync(input, "utf8"), {
  header: true,
  skipEmptyLines: true,
});
if (errors.length) {
  console.error(errors.slice(0, 5));
  process.exit(1);
}

const num = (v) => (v === "" || v == null ? 0 : Number(v));

// Matches CricHeroes has under the wrong date, keyed by match ID. Corrected
// here rather than in the CSV so the fix survives the next export.
// Confirmed with the club, 7 Oct 2026.
const DATE_FIX = {
  26486511: "2026-07-31", // Neuro strikers v VIKINGS, scored as 6 Aug
  26486329: "2026-07-31", // Mavericks v Neuro strikers, scored as 6 Aug
  26326478: "2026-07-24", // Neuro strikers v VIKINGS, scored as 26 Jul
};

const matches = [];
const innings = [];
const batting = [];
const bowling = [];
const fallOfWickets = [];

for (const r of rows) {
  const season = num(r.season);
  const matchId = r.match_id;
  switch (r.record_type) {
    case "MATCH":
      matches.push({
        season,
        matchId,
        date: DATE_FIX[r.match_id] ?? r.match_date,
        venue: r.venue,
        overs: num(r.match_overs),
        teamA: r.team_a,
        teamB: r.team_b,
        winner: r.winner || null,
        result: r.result.toLowerCase(),
        winBy: r.win_by,
      });
      break;
    case "INNINGS":
      innings.push({
        matchId,
        inning: num(r.inning),
        team: r.inning_team,
        runs: num(r.innings_runs),
        wickets: num(r.innings_wickets),
        overs: r.innings_overs,
        extras: num(r.innings_extras),
      });
      break;
    case "BATTING":
      batting.push({
        matchId,
        inning: num(r.inning),
        playerId: r.player_id,
        name: r.player,
        team: r.batting_team,
        runs: num(r.runs),
        balls: num(r.balls),
        fours: num(r.fours),
        sixes: num(r.sixes),
        howOut: r.how_to_out,
      });
      break;
    case "BOWLING":
      bowling.push({
        matchId,
        inning: num(r.inning),
        playerId: r.player_id,
        name: r.player,
        // In BOWLING rows `bowling_team` is the bowler's own side.
        team: r.bowling_team,
        overs: r.overs,
        maidens: num(r.maidens),
        runs: num(r.runs),
        wickets: num(r.wickets),
        dots: num(r.dots),
        wides: num(r.wides),
        noBalls: num(r.no_balls),
        fours: num(r.fours),
        sixes: num(r.sixes),
      });
      break;
    case "FALL_OF_WICKET":
      fallOfWickets.push({
        matchId,
        inning: num(r.inning),
        playerId: r.dismiss_player_id,
        wicket: num(r.wicket_number),
        score: num(r.wicket_score),
        over: r.wicket_over,
      });
      break;
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ matches, innings, batting, bowling, fallOfWickets }));
console.log(
  `wrote ${path.relative(root, output)}: ${matches.length} matches, ${innings.length} innings, ${batting.length} batting, ${bowling.length} bowling, ${fallOfWickets.length} fall of wickets`,
);
