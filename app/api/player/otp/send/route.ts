import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { encrypt } from "@/lib/auth-crypto";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    // Clean up the phone number for consistent lookup
    const searchPhone = phone.trim();

    // 1. Lookup player by exact phone match using admin client to retrieve restricted fields
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, name, phone, is_active, approval_status")
      .eq("phone", searchPhone)
      .maybeSingle();

    if (error) {
      console.error("Player DB lookup error:", error);
      return NextResponse.json({ 
        error: "Database error during player lookup.",
        details: error.message,
        hint: error.hint,
        code: error.code
      }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json(
        { error: "No registered member found with this phone number. Please check the number or register as a new member." },
        { status: 404 }
      );
    }

    // 2. Validate member active status and approval status
    if (player.approval_status !== "approved" || !player.is_active) {
      return NextResponse.json(
        { error: "Your membership is pending admin approval or has been deactivated. Please contact JCC Support." },
        { status: 403 }
      );
    }

    // 3. Generate a secure random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Create encrypted state payload with 5 minutes expiration
    const statePayload = JSON.stringify({
      phone: player.phone,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    const sessionToken = encrypt(statePayload);

    // 5. Simulate SMS Delivery by printing it to Server/Terminal Logs
    console.log("\n=======================================================");
    console.log("⚡ [JCC OTP SIMULATION] ⚡");
    console.log(`Recipient Name: ${player.name}`);
    console.log(`Phone Number:   ${player.phone}`);
    console.log(`Verification:   ${code}`);
    console.log("=======================================================\n");

    // 6. Return response with session token. We also return debugCode to render premium toast/modal simulation in dev environment
    return NextResponse.json({
      success: true,
      token: sessionToken,
      debugCode: code // Dev mockup SMS helper
    });
  } catch (error: any) {
    console.error("OTP send server error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error?.message || String(error),
      stack: error?.stack 
    }, { status: 500 });
  }
}
