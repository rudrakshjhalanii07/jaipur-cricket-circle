import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Deliberately NO admin-password gate — this route is used during the
// Identity step (Step 1, before a `draft` auction and its admin password
// even exist) as well as the Franchises step (after a draft exists). Kept
// open, but validates the upload is actually an image and caps size to
// ~2MB, matching lib/image-optimize.ts's own optimized-output cap (the
// client is expected to have already run the file through optimizeImage()
// before it reaches here — this is a defensive re-check, not the primary
// compression step).
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!file.type || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "file must be an image" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "file is too large (max 2MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const path = `${randomUUID()}.webp`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("auctionos-logos")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Failed to upload logo" }, { status: 400 });
    }

    const { data } = supabaseAdmin.storage.from("auctionos-logos").getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error("auctionos/upload-logo error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
