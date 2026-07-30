import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TEAMS, type TeamId } from "@/lib/teams";

interface SeasonTeamInput {
  team_id: string;
  captain?: string | null;
}

interface ArchiveAndCreateBody {
  old_season_id: string;
  new_title: string;
  new_season_label?: string | null;
  new_started_at: string;
  teams: SeasonTeamInput[];
}

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ArchiveAndCreateBody;

    if (!body.old_season_id || !body.new_title || !body.new_started_at) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const teams = body.teams ?? [];
    if (teams.length < 2) {
      return NextResponse.json({ error: "A season needs at least 2 teams" }, { status: 400 });
    }

    const unknown = teams.filter((t) => !(t.team_id in TEAMS));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown team(s): ${unknown.map((t) => t.team_id).join(", ")}` },
        { status: 400 },
      );
    }

    const ids = teams.map((t) => t.team_id as TeamId);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Duplicate team in roster" }, { status: 400 });
    }

    if (teams.some((t) => !t.captain?.trim())) {
      return NextResponse.json({ error: "Every team needs a captain" }, { status: 400 });
    }

    // Archive-old + insert-new + the season_teams rows all run inside a single
    // Postgres function call, so it's one atomic transaction — a failure on any
    // step can't leave the club with zero active seasons or a team-less season.
    const { data, error } = await supabaseAdmin.rpc("archive_and_create_season", {
      p_old_season_id: body.old_season_id,
      p_new_title: body.new_title,
      p_new_season_label: body.new_season_label ?? null,
      p_new_started_at: body.new_started_at,
      p_teams: teams.map((t, i) => ({
        team_id: t.team_id,
        captain: t.captain?.trim() ?? null,
        display_order: i,
      })),
    });

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to transition season", detail: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, new_season_id: data });
  } catch (err) {
    console.error("admin/seasons/archive-and-create error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
