import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt, encrypt } from "@/lib/auth-crypto";

export async function POST(request: Request) {
  try {
    const { token, code } = await request.json();

    if (!token || !code) {
      return NextResponse.json({ error: "Missing required verification fields." }, { status: 400 });
    }

    // 1. Decrypt state payload and parse
    let payload;
    try {
      const decryptedText = decrypt(token);
      payload = JSON.parse(decryptedText);
    } catch (decryptError) {
      return NextResponse.json(
        { error: "Invalid or tampered verification session. Please request a new OTP." },
        { status: 400 }
      );
    }

    const { phone, code: expectedCode, expiresAt } = payload;

    // 2. Validate OTP expiry
    if (Date.now() > expiresAt) {
      return NextResponse.json(
        { error: "The verification code has expired (valid for 5 minutes). Please request a new one." },
        { status: 400 }
      );
    }

    // 3. Validate OTP matching
    if (code.trim() !== expectedCode) {
      return NextResponse.json(
        { error: "Incorrect verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // 4. Fetch complete player details
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id, name, phone, cricket_role, batting_style, bowling_style, short_bio, image_url, team, member_tag, approval_status, is_active")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("Player DB fetch error during verify:", error);
      return NextResponse.json({ error: "Failed to load player profile records." }, { status: 500 });
    }

    if (!player) {
      return NextResponse.json({ error: "Registered profile not found." }, { status: 404 });
    }

    if (!player.is_active || player.approval_status !== "approved") {
      return NextResponse.json(
        { error: "Membership is no longer approved or active. Please contact the JCC Admin." },
        { status: 403 }
      );
    }

    // 5. Generate secure 1-hour verified profile-edit session token
    const sessionPayload = JSON.stringify({
      playerId: player.id,
      phone: player.phone,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour session validity
    });

    const sessionToken = encrypt(sessionPayload);

    // 6. Return response containing token and full editable profile details
    return NextResponse.json({
      success: true,
      sessionToken,
      player: {
        id: player.id,
        name: player.name,
        phone: player.phone,
        cricket_role: player.cricket_role,
        batting_style: player.batting_style || "Right-hand Bat",
        bowling_style: player.bowling_style || "N/A",
        bio: player.short_bio || "",
        image_url: player.image_url || null,
        team: player.team || "Unassigned",
        member_tag: player.member_tag || "member",
        approval_status: player.approval_status
      }
    });
  } catch (error) {
    console.error("OTP verification server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
