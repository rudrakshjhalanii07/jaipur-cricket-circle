// The home page's analytics: leaders, stat stories and the table, read from
// the same scorecard engine /stats uses (the CricHeroes export plus anything
// scored in the admin since). Only finished numbers leave the server — no
// row-level data — and only the photos the page actually shows.

import { buildCardData, computeScorecardDashboard, type ScopeStats } from "@/lib/scorecard-dashboard/compute";
import { fetchDbOnlyMatches } from "@/lib/scorecard-dashboard/db-matches.server";
import { statStories, type Story } from "@/lib/scorecard-dashboard/stories";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { photoFor } from "@/lib/player-photos";

export type IntelPlayer = { name: string; team: string | null; photo: string | null };
export type IntelBoardRow = IntelPlayer & { value: number; sub: string };
export type IntelCap = IntelPlayer & { value: number; unit: string; detail: string };

export type HomeIntel = {
  seasonLabel: string;
  /** Both seasons with scorecards, combined. */
  career: { matches: number; runs: number; wickets: number; sixes: number; fours: number; players: number };
  orange: IntelCap | null;
  purple: IntelCap | null;
  batting: IntelBoardRow[];
  bowling: IntelBoardRow[];
  stories: (Story & { photo: string | null })[];
  standings: { team: string; played: number; won: number; lost: number; points: number; nrr: number; form: ("W" | "L" | "T")[] }[];
  chaseShare: number;
};

export async function getHomeIntel(): Promise<HomeIntel | null> {
  try {
    const [extra, photos] = await Promise.all([fetchDbOnlyMatches(), fetchPlayerPhotos()]);
    const scopes = computeScorecardDashboard(extra);
    const season = scopes.find((s) => s.key === "s3");
    const all = scopes.find((s) => s.key === "all");
    if (!season || !all) return null;
    const card = buildCardData(extra);
    const photo = (name: string) => photoFor(photos, name);
    const who = (name: string, teams: string[]): IntelPlayer => ({ name, team: teams[0] ?? null, photo: photo(name) });

    const players = new Set([...all.batting.map((b) => b.id), ...all.bowling.map((b) => b.id)]).size;
    const bat = season.batting[0];
    const bowl = season.bowling[0];
    const decided = season.summary.chasesWon + season.summary.defendsWon;

    return {
      seasonLabel: season.label,
      career: {
        matches: all.summary.matches,
        runs: all.summary.runs,
        wickets: all.summary.wickets,
        sixes: all.summary.sixes,
        fours: all.summary.fours,
        players,
      },
      orange: bat
        ? { ...who(bat.name, bat.teams), value: bat.runs, unit: "runs", detail: `SR ${bat.strikeRate.toFixed(1)} · HS ${bat.highest} · ${bat.innings} inns` }
        : null,
      purple: bowl
        ? { ...who(bowl.name, bowl.teams), value: bowl.wickets, unit: "wickets", detail: `Econ ${bowl.economy.toFixed(2)} · best ${bowl.best} · ${bowl.overs} ov` }
        : null,
      batting: season.batting.slice(0, 5).map((b) => ({ ...who(b.name, b.teams), value: b.runs, sub: `SR ${b.strikeRate.toFixed(1)}` })),
      bowling: season.bowling.slice(0, 5).map((b) => ({ ...who(b.name, b.teams), value: b.wickets, sub: `Econ ${b.economy.toFixed(2)}` })),
      stories: statStories(card, [3]).map((s) => ({ ...s, photo: s.player ? photo(s.player) : null })),
      standings: standingsOf(season),
      chaseShare: decided ? Math.round((100 * season.summary.chasesWon) / decided) : 50,
    };
  } catch (error) {
    console.error("Home intel failed:", error);
    return null;
  }
}

function standingsOf(s: ScopeStats): HomeIntel["standings"] {
  return s.standings.map((t) => ({ team: t.team, played: t.played, won: t.won, lost: t.lost, points: t.points, nrr: t.nrr, form: t.form.slice(-5) }));
}
