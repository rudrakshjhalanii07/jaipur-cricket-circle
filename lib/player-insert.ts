import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Inserts a sign-up's `players` row. If supabase/add_player_image_focus.sql
 * hasn't been run yet the image_focus column doesn't exist, so the row goes in
 * again without it rather than failing the whole sign-up.
 */
export async function insertPendingPlayer(supabase: SupabaseClient, row: Record<string, unknown>) {
  const first = await supabase.from("players").insert([row]);
  if (first.error && "image_focus" in row && /image_focus/i.test(first.error.message)) {
    const rest = { ...row };
    delete rest.image_focus;
    return supabase.from("players").insert([rest]);
  }
  return first;
}
