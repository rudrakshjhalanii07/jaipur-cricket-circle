import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");
    const body = await request.json();
    const { registration_id } = body;

    // 1. Validate Admin Password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!registration_id) {
      return NextResponse.json({ error: "Missing registration ID" }, { status: 400 });
    }

    // 2. Delete Registration
    const { error } = await supabaseAdmin
      .from("registrations")
      .delete()
      .eq("id", registration_id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Registration removed" });
  } catch (error: any) {
    console.error("API Remove Registration Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
