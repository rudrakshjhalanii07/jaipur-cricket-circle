import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Everything built from scorecards — /stats, the Boundary Banter matchday
 * reports, the home page's numbers and latest stories — rebuilt on the next
 * visit. Called when a match is saved and by the Sunday cron.
 */
export function refreshScorecards() {
  revalidateTag("scorecards", { expire: 0 });
  revalidateTag("club-stats", { expire: 0 });
  revalidatePath("/", "layout");
}
