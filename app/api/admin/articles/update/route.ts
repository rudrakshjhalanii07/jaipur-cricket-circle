import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    const body = await request.json();
    const { 
      id,
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

    if (!id || !slug || !title || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get current status to see if we're publishing for the first time
    const { data: currentArt } = await supabaseAdmin
      .from("chewvana_articles")
      .select("status, published_at")
      .eq("id", id)
      .single();

    const updateData: any = {
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
      closing_verdict,
      updated_at: new Date().toISOString()
    };

    // Update published_at if status changed to published and it wasn't published before
    if (status === 'published' && (!currentArt?.published_at)) {
      updateData.published_at = new Date().toISOString();
    } else if (status === 'draft') {
      // Should we clear published_at if moved back to draft? 
      // Usually yes, or keep it to show "previously published". 
      // Let's clear it for simplicity of "published" status.
      updateData.published_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from("chewvana_articles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("API Update Article Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
