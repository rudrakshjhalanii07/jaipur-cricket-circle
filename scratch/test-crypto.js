const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment manually to ensure we mimic the exact environment
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

// Mock key derivation
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY || "jcc-default-fallback-key-2026-secret";
const KEY = crypto.createHash("sha256").update(SECRET).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

const statePayload = JSON.stringify({
  phone: "8058364186",
  code: "123456",
  expiresAt: Date.now() + 5 * 60 * 1000
});

try {
  console.log("State Payload:", statePayload);
  const token = encrypt(statePayload);
  console.log("Encrypted Token:", token);
} catch (e) {
  console.error("Encryption failed:", e);
}
