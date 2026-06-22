import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TEAMS } from "@/lib/teams";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

function teamName(id: string): string {
  return TEAMS[id as keyof typeof TEAMS]?.name ?? id;
}

function fmtOvers(overs: number): string {
  const full = Math.floor(overs);
  const balls = Math.round((overs - full) * 10);
  return balls === 0 ? `${full} overs` : `${full}.${balls} overs`;
}

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { match_id } = await request.json() as { match_id: string };
    if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

    // Fetch match + series context
    const { data: match } = await supabaseAdmin
      .from("series_matches")
      .select("*, series(name, series_no, overs_per_innings)")
      .eq("id", match_id)
      .single();
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    // Fetch innings
    const { data: innings } = await supabaseAdmin
      .from("series_innings")
      .select("*")
      .eq("match_id", match_id)
      .order("innings_no");

    const fullInnings = [];
    for (const inn of innings ?? []) {
      const [{ data: batting }, { data: bowling }] = await Promise.all([
        supabaseAdmin.from("series_batting").select("*").eq("innings_id", inn.id).order("batting_order"),
        supabaseAdmin.from("series_bowling").select("*").eq("innings_id", inn.id).order("bowling_order"),
      ]);
      fullInnings.push({ ...inn, batting: batting ?? [], bowling: bowling ?? [] });
    }

    // Build scorecard text for the prompt
    const series = match.series as { name: string; series_no: number; overs_per_innings: number };
    let scorecardText = `JCC ${series.name} — Match ${match.match_no} (${match.stage})\n`;
    scorecardText += `${teamName(match.team1_id)} vs ${teamName(match.team2_id)}\n`;
    if (match.match_date) scorecardText += `Date: ${match.match_date}\n`;
    if (match.venue) scorecardText += `Venue: ${match.venue}\n`;
    if (match.toss_winner_id)
      scorecardText += `Toss: ${teamName(match.toss_winner_id)} elected to ${match.toss_decision}\n`;
    scorecardText += "\n";

    for (const inn of fullInnings) {
      scorecardText += `─── Innings ${inn.innings_no}: ${teamName(inn.batting_team_id)} batting ───\n`;
      scorecardText += `Total: ${inn.total_runs}/${inn.total_wickets} (${fmtOvers(inn.total_overs)})${inn.all_out ? " All out" : ""}\n`;
      const extras = inn.extras_wides + inn.extras_no_balls + inn.extras_byes + inn.extras_leg_byes;
      if (extras > 0)
        scorecardText += `Extras: ${extras} (W:${inn.extras_wides} NB:${inn.extras_no_balls} B:${inn.extras_byes} LB:${inn.extras_leg_byes})\n`;

      scorecardText += "\nBatting:\n";
      for (const b of inn.batting) {
        const how = b.dismissal_type === "not_out" ? "not out"
          : b.dismissal_type === "did_not_bat" ? "dnb"
          : b.dismissal_type === "caught"
          ? `c ${b.caught_by ?? "?"} b ${b.dismissed_by ?? "?"}`
          : b.dismissal_type === "run_out" ? `run out (${b.dismissed_by ?? "?"})`
          : `${b.dismissal_type} b ${b.dismissed_by ?? "?"}`;
        scorecardText += `  ${b.player_name.padEnd(20)} ${String(b.runs).padStart(3)}  (${b.balls_faced ?? "?"}b ${b.fours}x4 ${b.sixes}x6)  ${how}\n`;
      }

      scorecardText += "\nBowling:\n";
      for (const bw of inn.bowling) {
        scorecardText += `  ${bw.player_name.padEnd(20)} ${fmtOvers(bw.overs).padEnd(10)} ${bw.maidens}M  ${bw.runs_conceded}R  ${bw.wickets}W`;
        if (bw.wides > 0 || bw.no_balls > 0)
          scorecardText += `  (W:${bw.wides} NB:${bw.no_balls})`;
        scorecardText += "\n";
      }

      if (inn.fall_of_wickets?.length > 0) {
        scorecardText += "\nFall of Wickets: ";
        scorecardText += (inn.fall_of_wickets as Array<{wkt:number;score:number;overs:string;player:string}>)
          .map((f) => `${f.wkt}/${f.score} (${f.player}, ${f.overs} ov)`)
          .join(", ");
        scorecardText += "\n";
      }
      scorecardText += "\n";
    }

    const matchResult = match.is_tie
      ? "Match tied"
      : match.winner_id
      ? `${teamName(match.winner_id)} won by ${match.margin_value} ${match.margin_type}`
      : "Result unknown";
    scorecardText += `Result: ${matchResult}\n`;
    if (match.player_of_match) scorecardText += `Player of the Match: ${match.player_of_match}\n`;
    if (match.match_notes) scorecardText += `Notes: ${match.match_notes}\n`;

    const prompt = `You are a cricket analyst writing for the JCC (Jaipur Cricket Circle), a community cricket group in Jaipur.
Write a vivid, engaging match analysis report for the following scorecard.
The tone should be like a professional match report — celebratory of good performances, honest about the flow of the game.
Structure the report as 4 paragraphs:
1. Match summary (teams, toss, result)
2. Batting highlights from both innings (standout performances, key partnerships, notable shots)
3. Bowling highlights and key dismissals (game-changing spells, turning-point wickets)
4. The turning point of the match and a brief conclusion

Keep the total length to ~250-300 words. Write in present tense. Do not use bullet points.

SCORECARD:
${scorecardText}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const analysis = (response.text ?? "").trim();

    // Save analysis back to the match
    const { error: ue } = await supabaseAdmin
      .from("series_matches")
      .update({ ai_analysis: analysis, updated_at: new Date().toISOString() })
      .eq("id", match_id);

    if (ue) console.error("Failed to save analysis:", ue);

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error("series/analyze error:", err);
    return NextResponse.json({ error: "Analysis failed", detail: String(err) }, { status: 500 });
  }
}
