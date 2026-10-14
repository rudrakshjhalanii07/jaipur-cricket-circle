import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt } from "@/lib/auth-crypto";

// Member photo upload.
//
// Two callers: a signed-in member changing their photo (sends the profile
// session token in x-session-token), and a sign-up, which happens before any
// account or session exists. Sign-ups can't be authenticated, so they're held
// to what our own client produces (lib/image-optimize.ts): at most 1.5MB, a
// few per IP in a window. Every file's bytes are checked against its
// claimed type, so nothing but a real image lands in the bucket. (Safari can't
// encode WebP, so its sign-ups arrive as JPEG.)

const BUCKET = "player-profile-images";
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MEMBER_MAX = 2 * 1024 * 1024;
const SIGNUP_MAX = 1.5 * 1024 * 1024;

// Best-effort per-IP limit for anonymous uploads. In-memory, so it resets
// with the function instance; it slows a flood rather than guaranteeing a cap.
const WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_LIMIT = 6;
const recent = new Map<string, number[]>();

function signupAllowed(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= SIGNUP_LIMIT) return false;
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return true;
}

function validSession(token: string | null) {
  if (!token) return false;
  try {
    const { playerId, expiresAt } = JSON.parse(decrypt(token)) as { playerId?: unknown; expiresAt?: unknown };
    return typeof playerId === "string" && typeof expiresAt === "number" && Date.now() < expiresAt;
  } catch {
    return false;
  }
}

// Checked once per function instance, not on every upload: listing buckets
// cost a round trip to storage before each photo.
let bucketReady: Promise<void> | null = null;
function ensureBucket() {
  bucketReady ??= (async () => {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;
    if (buckets.some((b) => b.name === BUCKET)) return;
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ALLOWED });
    if (error) throw error;
  })().catch((err) => {
    bucketReady = null;
    console.error("Avatar bucket check error:", err);
    throw err;
  });
  return bucketReady;
}

/** The image type the bytes actually are, or null. */
function sniff(b: Buffer): string | null {
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  return null;
}

export async function POST(request: Request) {
  try {
    const member = validSession(request.headers.get("x-session-token"));
    if (!member) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!signupAllowed(ip)) {
        return NextResponse.json({ error: "Too many uploads. Please wait a few minutes and try again." }, { status: 429 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed." }, { status: 400 });
    }
    const max = member ? MEMBER_MAX : SIGNUP_MAX;
    if (file.size > max) {
      return NextResponse.json({ error: `File size exceeds the ${member ? "2MB" : "1.5MB"} limit.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = sniff(buffer);
    if (!kind) {
      return NextResponse.json({ error: "That file isn't a valid image." }, { status: 400 });
    }

    await ensureBucket();

    // The extension comes from the sniffed type, never the client's file name.
    const ext = kind === "image/jpeg" ? "jpg" : kind.split("/")[1];
    const filePath = `profiles/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, buffer, {
      contentType: kind,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) {
      console.error("Upload file error:", uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
    return NextResponse.json({ publicUrl });
  } catch (error: unknown) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload avatar" }, { status: 500 });
  }
}
