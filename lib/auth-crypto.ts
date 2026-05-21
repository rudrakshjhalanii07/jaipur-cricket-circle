import crypto from "crypto";

// Derived symmetric 32-byte key from our environment secret role key
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "jcc-default-fallback-key-2026-secret";
const KEY = crypto.createHash("sha256").update(SECRET).digest();

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a colon-separated string format: "iv:encryptedText:authTag"
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 12 bytes standard IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * Decrypts a colon-separated AES-256-GCM token back into its original string.
 * Throws an error if the token has been tampered with or is invalid.
 */
export function decrypt(token: string): string {
  const parts = token.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  
  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = encryptedHex;
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
