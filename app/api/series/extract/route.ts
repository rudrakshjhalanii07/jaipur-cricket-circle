import { NextResponse } from "next/server";

const EXTRACTION_PROMPT = `You are a cricket scorecard digitizer for JCC (Jaipur Cricket Circle).
Extract structured match data from the provided scorecard images/documents.

Team ID mappings (use exactly these strings):
- "mavericks"     → Mavericks / Mavs
- "neurostrikers" → NeuroStrikers / Neuro strikers / Neuro Strikers
- "outliers"      → The Outliers / Outliers
- "vikings"       → Vikings / The Vikings

Return ONLY valid JSON matching this exact structure — no markdown, no extra text, no code fences:

{
  "match_info": {
    "stage": "league or eliminator or qualifier or final",
    "match_date": "YYYY-MM-DD or null",
    "venue": "string or null — leave null unless the scorecard names a ground",
    "team1_id": "mavericks or neurostrikers or outliers or vikings",
    "team2_id": "mavericks or neurostrikers or outliers or vikings",
    "toss_winner_id": "team_id or null",
    "toss_decision": "bat or bowl or null",
    "winner_id": "team_id or null",
    "margin_type": "runs or wickets or null",
    "margin_value": 0,
    "is_tie": false,
    "player_of_match": "string or null",
    "match_notes": "string or null"
  },
  "innings": [
    {
      "innings_no": 1,
      "batting_team_id": "team_id",
      "bowling_team_id": "team_id",
      "total_runs": 0,
      "total_wickets": 0,
      "total_overs": 0.0,
      "all_out": false,
      "extras_wides": 0,
      "extras_no_balls": 0,
      "extras_byes": 0,
      "extras_leg_byes": 0,
      "fall_of_wickets": [{ "wkt": 1, "score": 0, "overs": "0.0", "player": "name" }],
      "batting": [
        {
          "batting_order": 1,
          "player_name": "string",
          "runs": 0,
          "balls_faced": "number or null",
          "fours": 0,
          "sixes": 0,
          "dismissal_type": "bowled or caught or lbw or run_out or stumped or hit_wicket or retired_hurt or not_out or did_not_bat",
          "dismissed_by": "bowler name or null",
          "caught_by": "fielder name or null — for caught and bowled, repeat the bowler's name here (see rules)"
        }
      ],
      "bowling": [
        {
          "bowling_order": 1,
          "player_name": "string",
          "overs": 0.0,
          "maidens": 0,
          "runs_conceded": 0,
          "wickets": 0,
          "wides": 0,
          "no_balls": 0
        }
      ]
    }
  ]
}

Important rules:
- Anything the scorecard does not state must be null — never guess or infer a
  value. Missing fields get filled in by hand in the review form afterwards.
- For overs, use decimal notation: 9 overs 4 balls = 9.4
- If the toss winner opted to field, toss_decision is "bowl"
- "retired_hurt" is NOT a wicket — do not count it in total_wickets
- Include ALL batters and bowlers shown in the scorecard
- winner_id = the team with more runs; margin = difference in runs
- There is no separate dismissal type for "caught and bowled" — use dismissal_type
  "caught" and set BOTH dismissed_by and caught_by to the bowler's name (e.g. a
  scorecard line "c & b Sagar" becomes dismissed_by: "Sagar", caught_by: "Sagar")`;

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { files } = await request.json() as {
      files: Array<{ data: string; mime_type: string }>;
    };

    if (!files?.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    void files;           // file uploads received — wire up an AI provider here when ready
    void EXTRACTION_PROMPT;

    return NextResponse.json({ error: "AI extraction not available" }, { status: 503 });
  } catch (err) {
    console.error("series/extract error:", err);
    return NextResponse.json({ error: "Extraction failed", detail: String(err) }, { status: 500 });
  }
}
