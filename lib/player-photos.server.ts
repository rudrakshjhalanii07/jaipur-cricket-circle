import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  playerPhotoIndexKeys,
  playerFirstName,
  type PlayerPhotoMap,
} from "@/lib/player-photos";
import { parseFocus, withFocus } from "@/lib/photo-focus";

/**
 * Every approved player's photo, indexed for photoFor(). Server-only.
 *
 * `image_url` is the same column the members page renders. A first-name key is
 * written only when exactly one player answers to it, so "Naman" never resolves
 * to the wrong Naman. A framed photo's URL carries its face position as a
 * fragment (lib/photo-focus.ts), so every surface can centre on the face.
 */
export const fetchPlayerPhotos = unstable_cache(
  async (): Promise<PlayerPhotoMap> => {
    const read = (cols: string) =>
      supabaseAdmin.from("players").select(cols).eq("approval_status", "approved");
    let res = await read("name, image_url, image_focus");
    // Before supabase/add_player_image_focus.sql is run: photos without framing.
    if (res.error) res = await read("name, image_url");
    const { data, error } = res;

    if (error || !data) return {};

    const rows = data as unknown as { name: string | null; image_url: string | null; image_focus?: unknown }[];
    const withPhoto = rows
      .filter((p): p is { name: string; image_url: string; image_focus?: unknown } => !!p.name && !!p.image_url)
      .map((p) => ({ ...p, image_url: withFocus(p.image_url, parseFocus(p.image_focus)) }));

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
  ["player-scorecard-photos-v3"],
  { revalidate: 300, tags: ["members"] },
);
