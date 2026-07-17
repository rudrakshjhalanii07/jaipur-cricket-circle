// JCC-template-only reads. Freely couples to JCC's `players` table — that
// coupling is the whole point of keeping it inside the template instead of
// the generic engine.

import { supabase } from "@/lib/supabase";

export interface EligiblePlayer {
  id: string;
  name: string;
  cricket_role: string | null;
  image: string | null;
}

// For the admin's pool-builder — active, approved club members eligible to
// be added as an auction lot.
export async function fetchEligiblePlayers(): Promise<EligiblePlayer[]> {
  try {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, cricket_role, image_url")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) return [];
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      cricket_role: p.cricket_role,
      image: p.image_url,
    }));
  } catch {
    return [];
  }
}
