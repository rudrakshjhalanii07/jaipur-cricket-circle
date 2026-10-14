import type { Metadata } from "next";
import { buildCardData, computeScorecardDashboard } from "@/lib/scorecard-dashboard/compute";
import { fetchDbOnlyMatches } from "@/lib/scorecard-dashboard/db-matches.server";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { fetchSeasons } from "@/lib/seasons";
import { getSignedInMember } from "@/lib/member-session";
import { getStatsAccess, isLocalDev } from "@/lib/stats-access";
import StatsClient, { type ArchivedSeason } from "./StatsClient";
import StatsGate, { type GateTeaser } from "./StatsGate";
import { memberCardIndex } from "@/lib/scorecard-dashboard/member-card.server";
import AccessBanner from "./AccessBanner";

// JCC's stats home: every scorecard, ranked the IPL way. Members only — the
// numbers are the club's, so the page asks for the same phone login as
// /profile before it renders anything.
export const metadata: Metadata = {
  title: "Stats · Jaipur Cricket Circle",
  description: "Every JCC scorecard, ranked the IPL way. Members only.",
  robots: { index: false, follow: false },
};

export default async function StatsPage() {
  // Locally the page opens without a login, so it can be worked on.
  const member = (await getSignedInMember()) ?? (isLocalDev ? { id: "local-dev", name: "Local preview" } : null);
  if (!member) return <StatsGate teaser={await gateTeaser()} />;
  const access = await getStatsAccess(member.id);
  if (access.kind === "expired") return <StatsGate expiredOn={access.endsAt} />;

  // The export plus anything scored in the admin since it was taken.
  const [extra, photos, seasons] = await Promise.all([fetchDbOnlyMatches(), fetchPlayerPhotos(), fetchSeasons()]);

  // Seasons with no scorecards on record — today just Season 1, kept as a
  // summary because its match-by-match records were never maintained.
  const archive: ArchivedSeason[] = seasons
    .filter((s) => s.status === "archived" && /legacy|season 1/i.test(`${s.season_label} ${s.title}`))
    .map((s) => ({
      title: s.title,
      label: s.season_label ?? "Legacy Season",
      matches: s.total_matches_played,
      notes: s.notes,
      teams: s.teams.map((t) => ({
        id: t.team_id,
        captain: t.captain,
        leagueWins: t.main_wins,
        playoffWins: t.playoff_wins,
        ties: t.main_ties + t.playoff_ties,
      })),
    }));

  // Player cards are personal: a member can open only their own. The local
  // preview (no login) is nobody, so it opens none.
  const cardData = buildCardData(extra);
  const mine = member.id === "local-dev" ? null : await memberCardIndex(cardData, member.id);

  return (
    <>
    {access.kind === "trial" && <AccessBanner daysLeft={access.daysLeft} endsAt={access.endsAt} />}
    <StatsClient
      scopes={computeScorecardDashboard(extra)}
      cardData={cardData}
      mine={mine}
      photos={photos}
      archive={archive}
      memberName={member.name}
    />
    </>
  );
}

/** The career totals the gate shows to visitors; nothing per-player. */
async function gateTeaser(): Promise<GateTeaser | undefined> {
  try {
    const all = computeScorecardDashboard(await fetchDbOnlyMatches()).find((s) => s.key === "all");
    if (!all) return undefined;
    const players = new Set([...all.batting.map((b) => b.id), ...all.bowling.map((b) => b.id)]).size;
    return { matches: all.summary.matches, runs: all.summary.runs, sixes: all.summary.sixes, players };
  } catch {
    return undefined;
  }
}
