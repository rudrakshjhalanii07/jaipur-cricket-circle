import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    const body = await request.json();
    const { 
      slug, 
      title, 
      subtitle, 
      excerpt, 
      cover_image_url, 
      category, 
      match_date, 
      author, 
      content, 
      status,
      editor_name,
      reporter_alias,
      tone,
      match_summary,
      key_question,
      accused_moment,
      player_of_the_match,
      turning_point,
      closing_verdict
    } = body;

    // Validate Admin Password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!slug || !title || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("chewvana_articles")
      .insert([
        { 
          slug, 
          title, 
          subtitle, 
          excerpt, 
          cover_image_url, 
          category, 
          match_date, 
          author, 
          content, 
          status: status || 'draft',
          published_at: status === 'published' ? new Date().toISOString() : null,
          editor_name,
          reporter_alias,
          tone: tone || 'Sarcastic Investigative',
          match_summary,
          key_question,
          accused_moment,
          player_of_the_match,
          turning_point,
          closing_verdict
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("API Create Article Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server Error" }, { status: 500 });
  }
}
