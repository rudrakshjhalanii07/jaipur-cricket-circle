import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { profilePayload } from "@/lib/player-profile.server";
import { decrypt } from "@/lib/auth-crypto";
import { parseFocus } from "@/lib/photo-focus";
import { refreshMembers } from "@/lib/members-cache";

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

    // Photo framing: validated, or cleared when a new photo arrives unframed.
    if (updates.image_focus !== undefined) {
      filteredUpdates.image_focus = updates.image_focus === null ? null : parseFocus(updates.image_focus);
      if (updates.image_focus !== null && !filteredUpdates.image_focus) {
        return NextResponse.json({ error: "Invalid photo framing." }, { status: 400 });
      }
    } else if (filteredUpdates.image_url !== undefined) {
      filteredUpdates.image_focus = null;
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
    const save = (fields: typeof filteredUpdates) =>
      supabaseAdmin
        .from("players")
        .update(fields)
        .eq("id", playerId)
        // select("*") rather than an explicit column list so this keeps working
        // whether or not supabase/add_governance_fields.sql has been run yet.
        .select("*")
        .maybeSingle();
    let { data: updatedPlayer, error } = await save(filteredUpdates);
    // Before supabase/add_player_image_focus.sql is run there's no image_focus
    // column: save everything else rather than failing the whole edit.
    if (error && "image_focus" in filteredUpdates && /image_focus/i.test(error.message)) {
      const rest = { ...filteredUpdates };
      delete rest.image_focus;
      ({ data: updatedPlayer, error } = await save(rest));
    }

    if (error) {
      console.error("Player DB update error:", error);
      return NextResponse.json({ error: "Database error: Failed to persist profile changes." }, { status: 500 });
    }

    if (!updatedPlayer) {
      return NextResponse.json({ error: "Target player record not found." }, { status: 404 });
    }

    // 5. Return success and new player state; photo changes reach /stats and the home page now.
    if ("image_url" in filteredUpdates || "image_focus" in filteredUpdates) refreshMembers();
    return NextResponse.json({
      success: true,
      // Captaincy from the active season, not the stale group_role.
      player: await profilePayload(updatedPlayer),
    });
  } catch (error) {
    console.error("Profile update server error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
