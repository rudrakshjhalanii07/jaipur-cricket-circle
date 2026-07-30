import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  playerPhotoIndexKeys,
  playerFirstName,
  type PlayerPhotoMap,
} from "@/lib/player-photos";

/**
 * Every approved player's photo, indexed for photoFor(). Server-only.
 *
 * `image_url` is the same column the members page renders. A first-name key is
 * written only when exactly one player answers to it, so "Naman" never resolves
 * to the wrong Naman.
 */
export const fetchPlayerPhotos = unstable_cache(
  async (): Promise<PlayerPhotoMap> => {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("name, image_url")
      .eq("approval_status", "approved");

    if (error || !data) return {};

    const withPhoto = data.filter(
      (p): p is { name: string; image_url: string } => !!p.name && !!p.image_url,
    );

    const firstNameCount = new Map<string, number>();
    for (const p of withPhoto) {
      const first = playerFirstName(p.name);
      if (first) firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
    }

    const map: PlayerPhotoMap = {};
    for (const p of withPhoto) {
      for (const key of playerPhotoIndexKeys(p.name)) {
        if (key.startsWith("first:") && firstNameCount.get(key.slice(6)) !== 1) {
          continue;
        }
        // First writer wins, so a fuller name never loses its key to a partial.
        if (!(key in map)) map[key] = p.image_url;
      }
    }
    return map;
  },
  ["player-scorecard-photos-v2"],
  { revalidate: 300 },
);
