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
    const { innings: inningsInput, new_series, ...matchFields } = body;

    // Resolve series ID
    let seriesId = matchFields.series_id;
    if (!seriesId) {
      if (!new_series) {
        return NextResponse.json({ error: "series_id or new_series required" }, { status: 400 });
      }
      const { data: created, error: ce } = await supabaseAdmin
        .from("series")
        .insert({
          name: new_series.name,
          series_no: new_series.series_no,
          season_id: new_series.season_id ?? null,
          overs_per_innings: new_series.overs_per_innings,
          venue: new_series.venue ?? null,
          started_at: new_series.started_at ?? null,
          ended_at: new_series.ended_at ?? null,
          notes: new_series.notes ?? null,
          articles: new_series.articles ?? [],
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (ce || !created) {
        return NextResponse.json({ error: "Failed to create series", detail: ce?.message }, { status: 500 });
      }
      seriesId = created.id;
    }

    // Insert match
    const { data: match, error: me } = await supabaseAdmin
      .from("series_matches")
      .insert({
        series_id: seriesId,
        match_no: matchFields.match_no,
        stage: matchFields.stage,
        match_date: matchFields.match_date ?? null,
        venue: matchFields.venue ?? null,
        team1_id: matchFields.team1_id,
        team2_id: matchFields.team2_id,
        toss_winner_id: matchFields.toss_winner_id ?? null,
        toss_decision: matchFields.toss_decision ?? null,
        team1_captain: matchFields.team1_captain ?? null,
        team2_captain: matchFields.team2_captain ?? null,
        winner_id: matchFields.winner_id ?? null,
        margin_type: matchFields.margin_type ?? null,
        margin_value: matchFields.margin_value ?? null,
        is_tie: matchFields.is_tie,
        super_over: matchFields.super_over ?? null,
        player_of_match: matchFields.player_of_match ?? null,
        match_notes: matchFields.match_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (me || !match) {
      return NextResponse.json({ error: "Failed to save match", detail: me?.message }, { status: 500 });
    }

    const matchId = match.id;

    // Insert innings + batting + bowling
    for (const inn of inningsInput) {
      const { data: innings, error: ie } = await supabaseAdmin
        .from("series_innings")
        .insert({
          match_id: matchId,
          innings_no: inn.innings_no,
          batting_team_id: inn.batting_team_id,
          bowling_team_id: inn.bowling_team_id,
          total_runs: inn.total_runs,
          total_wickets: inn.total_wickets,
          total_overs: inn.total_overs,
          all_out: inn.all_out,
          extras_wides: inn.extras_wides,
          extras_no_balls: inn.extras_no_balls,
          extras_byes: inn.extras_byes,
          extras_leg_byes: inn.extras_leg_byes,
          fall_of_wickets: inn.fall_of_wickets ?? [],
        })
        .select("id")
        .single();

      if (ie || !innings) {
        return NextResponse.json({ error: `Failed to save innings ${inn.innings_no}`, detail: ie?.message }, { status: 500 });
      }

      const inningsId = innings.id;

      if (inn.batting.length > 0) {
        const { error: be } = await supabaseAdmin.from("series_batting").insert(
          inn.batting.map((b, idx) => ({
            innings_id: inningsId,
            team_id: inn.batting_team_id,
            player_name: b.player_name,
            batting_order: b.batting_order ?? idx + 1,
            runs: b.runs,
            balls_faced: b.balls_faced ?? null,
            fours: b.fours ?? 0,
            sixes: b.sixes ?? 0,
            dismissal_type: b.dismissal_type ?? null,
            dismissed_by: b.dismissed_by ?? null,
            caught_by: b.caught_by ?? null,
          }))
        );
        if (be) console.error("Batting insert error:", be);
      }

      if (inn.bowling.length > 0) {
        const { error: bwe } = await supabaseAdmin.from("series_bowling").insert(
          inn.bowling.map((bw, idx) => ({
            innings_id: inningsId,
            team_id: inn.bowling_team_id,
            player_name: bw.player_name,
            bowling_order: bw.bowling_order ?? idx + 1,
            overs: bw.overs,
            maidens: bw.maidens ?? 0,
            runs_conceded: bw.runs_conceded,
            wickets: bw.wickets,
            wides: bw.wides ?? 0,
            no_balls: bw.no_balls ?? 0,
          }))
        );
        if (bwe) console.error("Bowling insert error:", bwe);
      }
    }

    return NextResponse.json({ ok: true, match_id: matchId, series_id: seriesId });
  } catch (err) {
    console.error("series/save error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
