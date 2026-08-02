// Career stat tables, indexed by player name.
//
// The leaderboards are keyed by whatever the scorecard called the player, so a
// member profile finds his own rows by normalised name plus the aliases below.
// Shared by /members (the directory cards and the career modal) and /seasons
// (the same modal, opened off a scorecard row) so both read one index.

import type {
  BattingLeaderRow,
  BowlingLeaderRow,
  MVPRow,
  FieldingRow,
} from "@/lib/series";

/** Scorecard name → member profile name aliases confirmed by admin. */
export const NAME_ALIASES: Record<string, string[]> = {
  "bhairav deep": ["bhairav neurostrikers"],
  "naman saini": ["naman mavericks"],
  "nitesh jhurani": ["nitesh"],
  "rudraksh jhalani": ["rudraksh"],
  "sagar sharma": ["sagar"],
  "sarthak s rathore": ["sarthak rathore"],
};

export type PlayerStatsTables = {
  batting?: BattingLeaderRow;
  bowling?: BowlingLeaderRow;
  mvp?: MVPRow;
  fielding?: FieldingRow;
};

export type StatsLookup = {
  battingByName: Map<string, BattingLeaderRow>;
  bowlingByName: Map<string, BowlingLeaderRow>;
  mvpByName: Map<string, MVPRow>;
  fieldingByName: Map<string, FieldingRow>;
};

const norm = (n: string) => n.toLowerCase().trim();

export function buildStatsLookup(sets: {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  mvp: MVPRow[];
  fielding: FieldingRow[];
}): StatsLookup {
  return {
    battingByName: new Map(sets.batting.map((r) => [norm(r.player_name), r])),
    bowlingByName: new Map(sets.bowling.map((r) => [norm(r.player_name), r])),
    mvpByName: new Map(sets.mvp.map((r) => [norm(r.player_name), r])),
    fieldingByName: new Map(sets.fielding.map((r) => [norm(r.player_name), r])),
  };
}

/**
 * The stat rows a name owns. Aliases are tried in order and the first hit wins,
 * so a member whose scorecards are spelled two ways still reads as one career.
 */
export function lookupPlayerStats(
  lookup: StatsLookup | null,
  name: string,
): PlayerStatsTables | undefined {
  if (!lookup) return undefined;
  const key = norm(name);
  const candidates = [key, ...(NAME_ALIASES[key] ?? [])];
  const find = <T,>(map: Map<string, T>) =>
    candidates.map((c) => map.get(c)).find((v) => v !== undefined);
  return {
    batting: find(lookup.battingByName),
    bowling: find(lookup.bowlingByName),
    mvp: find(lookup.mvpByName),
    fielding: find(lookup.fieldingByName),
  };
}
