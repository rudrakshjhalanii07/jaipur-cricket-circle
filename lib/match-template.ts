// Canonical JCC match JSON template.
// This is the single source of truth for the match import format.
// Update this file whenever the schema changes — the import page copies from here.
//
// RULES:
//   - overs notation: X.Y where Y is balls (0–5). "9.4" = 9 overs 4 balls.
//   - All squad members MUST appear in their team's batting array.
//     Players who didn't bat use dismissal_type: "did_not_bat".
//     This is how match counts are tracked for player stats.
//   - wides / no_balls in bowling: always 0 (never null).
//   - super_over: null for normal matches. Fill it only when is_tie: true
//     and the match was decided by a super over.
//   - "caught and bowled" has no separate dismissal_type — use "caught" and
//     set BOTH dismissed_by and caught_by to the bowler's own name.
//   - null means "not known yet". Anything a PDF/scorecard extraction can't
//     find should stay null and be typed into the review form before saving —
//     never guess a value into the JSON. Only the fields marked REQUIRED below
//     have to be filled for a save to go through.
//   - Season fixtures are seeded ahead of time. Pick the week in the import
//     form; the fixture is identified from team1_id/team2_id, so match_no is
//     derived for you. The save fills in the seeded row, and re-uploading the
//     same fixture replaces that scorecard — corrections are just another upload.
//   - venue stays null: the ground is set per week in Admin → Seasons →
//     Week Venues. Fill match_info.venue only for a one-off match played
//     somewhere other than the rest of its week.

export const MATCH_TEMPLATE = {
  // Optional convenience: a week_no here preselects that week in the import
  // form. The week is otherwise chosen from the dropdown.
  series: {
    week_no: null,
  },
  match_info: {
    match_no: 1,                  // REQUIRED — fixture number within the week
    stage: "league",              // REQUIRED — league | eliminator | qualifier | final
    match_date: null,             // YYYY-MM-DD
    venue: null,                  // set per week in admin; override only if split
    team1_id: "mavericks",        // REQUIRED
    team2_id: "neurostrikers",    // REQUIRED
    toss_winner_id: null,
    toss_decision: null,          // bat | bowl
    team1_captain: null,          // exact name as in team1 batting lineup
    team2_captain: null,          // exact name as in team2 batting lineup
    winner_id: null,
    margin_type: null,            // runs | wickets
    margin_value: null,
    is_tie: false,                // REQUIRED
    super_over: null,
    player_of_match: null,
    match_notes: null,
  },
  innings: [
    {
      innings_no: 1,
      batting_team_id: "mavericks",
      bowling_team_id: "neurostrikers",
      total_runs: 0,
      total_wickets: 0,
      total_overs: 0.0,
      all_out: false,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      fall_of_wickets: [
        { wkt: 1, score: 0, overs: "0.1", player: "Player Name" },
      ],
      batting: [
        {
          batting_order: 1,
          player_name: "Player Name",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "not_out",
          dismissed_by: null,
          caught_by: null,
        },
        {
          batting_order: 2,
          player_name: "Another Player",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "bowled",
          dismissed_by: "Bowler Name",
          caught_by: null,
        },
        {
          batting_order: 3,
          player_name: "Caught Player",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "caught",
          dismissed_by: "Bowler Name",
          caught_by: "Fielder Name",
        },
        {
          batting_order: 4,
          player_name: "Caught And Bowled Player",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "caught",
          dismissed_by: "Bowler Name",
          caught_by: "Bowler Name",
        },
        {
          batting_order: 5,
          player_name: "Squad member who did not bat",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "did_not_bat",
          dismissed_by: null,
          caught_by: null,
        },
      ],
      bowling: [
        {
          bowling_order: 1,
          player_name: "Bowler Name",
          overs: 2.0,
          maidens: 0,
          runs_conceded: 0,
          wickets: 0,
          wides: 0,
          no_balls: 0,
        },
      ],
    },
    {
      innings_no: 2,
      batting_team_id: "neurostrikers",
      bowling_team_id: "mavericks",
      total_runs: 0,
      total_wickets: 0,
      total_overs: 0.0,
      all_out: false,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      fall_of_wickets: [],
      batting: [
        {
          batting_order: 1,
          player_name: "Player Name",
          runs: 0,
          balls_faced: null,
          fours: 0,
          sixes: 0,
          dismissal_type: "not_out",
          dismissed_by: null,
          caught_by: null,
        },
      ],
      bowling: [
        {
          bowling_order: 1,
          player_name: "Bowler Name",
          overs: 2.0,
          maidens: 0,
          runs_conceded: 0,
          wickets: 0,
          wides: 0,
          no_balls: 0,
        },
      ],
    },
  ],
} as const;

// Super over shape — replace super_over: null with this when is_tie: true.
export const SUPER_OVER_TEMPLATE = {
  played: true as const,
  team1_runs: 0,
  team2_runs: 0,
  winner_id: "mavericks",
};

export const MATCH_TEMPLATE_JSON = JSON.stringify(MATCH_TEMPLATE, null, 2);
