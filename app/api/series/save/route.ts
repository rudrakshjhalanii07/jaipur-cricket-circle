import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface NewSeriesInput {
  name: string;
  series_no: number;
  season_id: string | null;
  overs_per_innings: number;
  venue?: string;
  started_at?: string;
  ended_at?: string;
  notes?: string;
  articles?: Array<{ title: string; url: string }>;
}

interface InningsInput {
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
  batting: Array<{
    batting_order: number;
    player_name: string;
    runs: number;
    balls_faced?: number | null;
    fours: number;
    sixes: number;
    dismissal_type: string;
    dismissed_by?: string | null;
    caught_by?: string | null;
  }>;
  bowling: Array<{
    bowling_order: number;
    player_name: string;
    overs: number;
    maidens: number;
    runs_conceded: number;
    wickets: number;
    wides: number;
    no_balls: number;
  }>;
}

interface SaveBody {
  series_id?: string;
  new_series?: NewSeriesInput;
  match_no: number;
  stage: "league" | "final";
  match_date?: string | null;
  venue?: string | null;
  team1_id: string;
  team2_id: string;
  toss_winner_id?: string | null;
  toss_decision?: "bat" | "bowl" | null;
  team1_captain?: string | null;
  team2_captain?: string | null;
  winner_id?: string | null;
  margin_type?: "runs" | "wickets" | null;
  margin_value?: number | null;
  is_tie: boolean;
  super_over?: Record<string, unknown> | null;
  player_of_match?: string | null;
  match_notes?: string | null;
  innings: InningsInput[];
}

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as SaveBody;
    if (!body.series_id && !body.new_series) {
      return NextResponse.json({ error: "series_id or new_series required" }, { status: 400 });
    }

    // The entire save (series, match, innings, batting, bowling) runs inside
    // a single Postgres function call, so it's one atomic transaction: any
    // failure partway through discards everything the call made, instead of
    // leaving an orphaned series_matches row with no innings behind.
    const { data, error } = await supabaseAdmin.rpc("save_series_match", { payload: body });

    if (error || !data) {
      return NextResponse.json({ error: "Failed to save match", detail: error?.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, match_id: data.match_id, series_id: data.series_id });
  } catch (err) {
    console.error("series/save error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
