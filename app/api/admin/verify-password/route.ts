import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const password = request.headers.get("x-admin-password");

    if (!password) {
      return NextResponse.json({ valid: false, error: "Password required" }, { status: 400 });
    }

    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    console.error("API Verify Password Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
