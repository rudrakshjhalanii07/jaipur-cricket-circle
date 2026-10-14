import { revalidateTag } from "next/cache";

/**
 * Drops every cache built from the players table — the /members list, the club
 * roster, the scorecard photo index — so an admin approval, edit or removal
 * shows up on the next page load instead of up to five minutes later.
 */
export function refreshMembers() {
  revalidateTag("members", { expire: 0 });
  revalidateTag("club-stats", { expire: 0 });
}
