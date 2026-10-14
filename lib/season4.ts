// Season 4's opener — one date for every place that counts down to it (the
// home ticker, the hero's invitation). Both drop their Season 4 copy by
// themselves once the day has passed.

export const SEASON_4_START = "2026-11-13";

/** Whole days from today (local) to the opener; negative once it has passed. */
export function daysToSeason4(now = new Date()): number {
  const [y, m, d] = SEASON_4_START.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start.getTime() - today.getTime()) / 86400000);
}
