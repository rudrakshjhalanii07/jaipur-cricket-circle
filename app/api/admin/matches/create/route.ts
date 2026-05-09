import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const adminPassword = req.headers.get("x-admin-password");
  
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { match_date, match_time, location_name, location_map_url, player_limit, status } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("matches")
      .insert([
        {
          match_date,
          match_time,
          location_name,
          location_map_url,
          player_limit,
          status: status || 'open'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error: any) {
    console.error("Match creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
