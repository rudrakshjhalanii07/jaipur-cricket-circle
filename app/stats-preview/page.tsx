import type { Metadata } from "next";
import { buildCardData, computeScorecardDashboard } from "@/lib/scorecard-dashboard/compute";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import StatsPreviewClient from "./StatsPreviewClient";

// Temporary review page for the CricHeroes scorecard export (Seasons 2 + 3).
// Unlinked and kept out of search until the numbers are signed off.
export const metadata: Metadata = {
  title: "Stats Preview · Seasons 2 & 3",
  robots: { index: false, follow: false },
};

export default async function StatsPreviewPage() {
  const scopes = computeScorecardDashboard();
  const photos = await fetchPlayerPhotos();
  return <StatsPreviewClient scopes={scopes} cardData={buildCardData()} photos={photos} />;
}
