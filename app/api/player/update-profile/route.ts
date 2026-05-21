import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt } from "@/lib/auth-crypto";

export async function POST(request: Request) {
  try {
    const { sessionToken, updates } = await request.json();

    if (!sessionToken || !updates) {
      return NextResponse.json({ error: "Missing session token or profile update data." }, { status: 400 });
    }

    // 1. Decrypt verified profile session token and parse
    let payload;
    try {
      const decryptedText = decrypt(sessionToken);
      payload = JSON.parse(decryptedText);
    } catch (decryptError) {
      return NextResponse.json(
        { error: "Unauthorized session. Please log in again to update your details." },
        { status: 401 }
      );
    }

    const { playerId, phone, expiresAt } = payload;

    // 2. Validate session expiration
    if (Date.now() > expiresAt) {
      return NextResponse.json(
        { error: "Your session has expired. Please verify your phone number again." },
        { status: 401 }
      );
    }

    // 3. Sanitize and validate permissible fields to prevent SQL injection or privilege escalation
    const allowedFields = ["name", "cricket_role", "batting_style", "bowling_style", "bio", "image_url"];
    const filteredUpdates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const val = typeof updates[field] === "string" ? updates[field].trim() : updates[field];
        if (field === "bio") {
          filteredUpdates.short_bio = val;
        } else {
          filteredUpdates[field] = val;
        }
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "No valid profile update fields provided." }, { status: 400 });
    }

    // Additional validations
    if (filteredUpdates.name === "") {
      return NextResponse.json({ error: "Player name cannot be empty." }, { status: 400 });
    }

    if (filteredUpdates.cricket_role && !["all-rounder", "batter", "bowler", "wicketkeeper"].includes(filteredUpdates.cricket_role)) {
      return NextResponse.json({ error: "Invalid cricket role selected." }, { status: 400 });
    }

    // 4. Safely execute update in Supabase players table using the admin client scoped ONLY to the validated playerId
    const { data: updatedPlayer, error } = await supabaseAdmin
      .from("players")
      .update(filteredUpdates)
      .eq("id", playerId)
      .select("id, name, phone, cricket_role, batting_style, bowling_style, short_bio, image_url, team, member_tag, approval_status")
      .maybeSingle();

    if (error) {
      console.error("Player DB update error:", error);
      return NextResponse.json({ error: "Database error: Failed to persist profile changes." }, { status: 500 });
    }

    if (!updatedPlayer) {
      return NextResponse.json({ error: "Target player record not found." }, { status: 404 });
    }

    // 5. Return success and new player state
    return NextResponse.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        name: updatedPlayer.name,
        phone: updatedPlayer.phone,
        cricket_role: updatedPlayer.cricket_role,
        batting_style: updatedPlayer.batting_style,
        bowling_style: updatedPlayer.bowling_style,
        bio: updatedPlayer.short_bio,
        image_url: updatedPlayer.image_url,
        team: updatedPlayer.team,
        member_tag: updatedPlayer.member_tag,
        approval_status: updatedPlayer.approval_status
      }
    });
  } catch (error) {
    console.error("Profile update server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
