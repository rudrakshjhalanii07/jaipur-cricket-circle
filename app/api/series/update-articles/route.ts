import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function authCheck(request: Request) {
  const password = request.headers.get("x-admin-password");
  return password && password === process.env.ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const series_id = searchParams.get("series_id");
  if (!series_id) {
    return NextResponse.json({ error: "series_id required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("series")
    .select("id, name, articles")
    .eq("id", series_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Series not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, name: data.name, articles: data.articles ?? [] });
}

export async function PATCH(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { series_id, articles } = await request.json() as { series_id: string; articles: Array<{ title: string; url: string }> };
  if (!series_id) {
    return NextResponse.json({ error: "series_id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("series")
    .update({ articles: articles ?? [], updated_at: new Date().toISOString() })
    .eq("id", series_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
