// Gentle clean-up of member photos: lighting, white balance and softness.
//
// Someone looks at each photo and decides whether it needs help and how much
// (done by Claude in a Claude Code session, so no API key or per-photo cost);
// sharp applies those fixes. Nothing is generated or redrawn: it's the same
// photo with levels, colour and sharpening adjusted, and the pixel size and
// orientation never change, so players.image_focus stays valid.
//
//   1. Fetch. Downloads every photo, measures brightness and sharpness, and
//      writes previews to judge from. Read-only against Supabase.
//        node scripts/enhance-photos.mjs --fetch [--only "Name,Name"] [--out <folder>]
//
//   2. Judge. Write <folder>/verdicts.json: { "<player id>": Verdict }, the
//      shape below. Anyone missing counts as "fine".
//
//   3. Render. Applies the verdicts and builds <folder>/review.html, before
//      and after side by side. Still nothing uploaded.
//        node scripts/enhance-photos.mjs --render --out <folder>
//
//   4. Apply, after reviewing the page. Uploads the enhanced files under new
//      paths (originals stay in the bucket) and points players.image_url at
//      them. The manifest keeps every original URL, so --undo puts them back.
//        node scripts/enhance-photos.mjs --apply --out <folder> [--skip "Name,Name"]
//        node scripts/enhance-photos.mjs --undo  --out <folder>
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
//
// Verdict:
//   verdict     "fine" | "fix" | "beyond_repair"  (beyond repair = ask for a new photo)
//   note        one sentence for the admin
//   issues      e.g. ["underexposed", "colour_cast_warm", "soft"]
//   exposure    -2 … +2     shadows  0 … 2     contrast  -1 … +2
//   warmth      -2 (cool a warm cast) … +2 (warm a cold cast)
//   saturation  -1 … +1     sharpen  0 … 2

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ── Env + args ──────────────────────────────────────────────────────────────

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const list = (f) => (opt(f) ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const OUT = path.resolve(opt("--out") ?? `photo-review/${new Date().toISOString().slice(0, 10)}`);
const ONLY = list("--only");
const SKIP = list("--skip");
const BUCKET = "player-profile-images";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v ?? 0));

// ── The fix ─────────────────────────────────────────────────────────────────

/** Applies a verdict with sharp. Same pixel size and orientation as the source. */
async function enhance(buf, v) {
  const e = clamp(v.exposure, -2, 2), sh = clamp(v.shadows, 0, 2), c = clamp(v.contrast, -1, 2);
  const w = clamp(v.warmth, -2, 2), s = clamp(v.saturation, -1, 1), sp = clamp(v.sharpen, 0, 2);

  // Bake EXIF orientation so the browser shows what we judged, then work on raw pixels.
  const { data, info } = await sharp(buf).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // Shadow lift: a gamma curve brightens darks far more than highlights.
  // (sharp's own .gamma() only acts around a resize, so this is a lookup table.)
  if (sh > 0) {
    const g = 1 / (1 + sh * 0.25);
    const lut = Uint8Array.from({ length: 256 }, (_, i) => Math.round(255 * Math.pow(i / 255, g)));
    for (let i = 0; i < data.length; i++) data[i] = lut[data[i]];
  }
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  // Exposure and saturation.
  img = img.modulate({ brightness: 1 + e * 0.07, saturation: 1 + s * 0.12 });
  // Contrast around mid-grey.
  if (c !== 0) {
    const a = 1 + c * 0.08;
    img = img.linear(a, 128 * (1 - a));
  }
  // White balance: nudge red/blue in opposite directions.
  if (w !== 0) {
    const k = w * 0.035;
    img = img.recomb([
      [1 + k, 0, 0],
      [0, 1, 0],
      [0, 0, 1 - k],
    ]);
  }
  // Unsharp mask, gentle on flat areas so skin doesn't turn gritty.
  if (sp > 0) img = img.sharpen({ sigma: 0.6 + sp * 0.35, m1: 0.4, m2: 1.2 + sp * 0.6 });
  return img.webp({ quality: 92 }).toBuffer();
}

async function measure(buf) {
  const meta = await sharp(buf).rotate().metadata();
  const stats = await sharp(buf).rotate().resize(512, 512, { fit: "inside" }).greyscale().stats();
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    width: swap ? meta.height : meta.width,
    height: swap ? meta.width : meta.height,
    brightness: Math.round(stats.channels[0].mean),
    sharpness: Number(stats.sharpness.toFixed(2)),
  };
}

// ── Fetch ───────────────────────────────────────────────────────────────────

async function fetchAll() {
  const { data: players, error } = await supabase.from("players").select("id, name, image_url").not("image_url", "is", null).order("name");
  if (error) throw error;
  const pool = players.filter((p) => p.image_url && (!ONLY.length || ONLY.includes(p.name.toLowerCase())));
  for (const d of ["original", "before", "preview"]) mkdirSync(path.join(OUT, d), { recursive: true });
  console.log(`Fetching ${pool.length} photos → ${OUT}`);

  const rows = [];
  for (const p of pool) {
    const url = p.image_url.split("#")[0];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const file = `${p.id}.webp`;
      writeFileSync(path.join(OUT, "original", p.id), buf);
      writeFileSync(path.join(OUT, "before", file), await sharp(buf).rotate().webp({ quality: 92 }).toBuffer());
      writeFileSync(path.join(OUT, "preview", `${p.id}.jpg`), await sharp(buf).rotate().resize(900, 900, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer());
      const metrics = await measure(buf);
      rows.push({ id: p.id, name: p.name, original_url: p.image_url, file, metrics });
      console.log(`  ${p.name.padEnd(26)} ${metrics.width}×${metrics.height}  brightness ${metrics.brightness}  sharpness ${metrics.sharpness}`);
    } catch (e) {
      rows.push({ id: p.id, name: p.name, original_url: p.image_url, verdict: "error", note: String(e.message ?? e) });
      console.log(`  ${p.name.padEnd(26)} error: ${e.message ?? e}`);
    }
  }
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ created: new Date().toISOString(), rows }, null, 2));
  console.log(`\nNext: write ${path.join(OUT, "verdicts.json")}, then --render.`);
}

// ── Render ──────────────────────────────────────────────────────────────────

async function render() {
  const manifest = readManifest();
  const vf = path.join(OUT, "verdicts.json");
  const verdicts = existsSync(vf) ? JSON.parse(readFileSync(vf, "utf8")) : {};
  mkdirSync(path.join(OUT, "after"), { recursive: true });
  for (const r of manifest.rows) {
    if (r.verdict === "error" && !r.file) continue;
    const v = verdicts[r.id] ?? { verdict: "fine", note: "Looks good as it is." };
    Object.assign(r, { verdict: v.verdict, note: v.note, issues: v.issues ?? [] });
    for (const k of ["exposure", "shadows", "contrast", "warmth", "saturation", "sharpen"]) r[k] = v[k] ?? 0;
    if (r.verdict === "fix") writeFileSync(path.join(OUT, "after", r.file), await enhance(readFileSync(path.join(OUT, "original", r.id)), r));
  }
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(OUT, "review.html"), reviewPage(manifest.rows));
  const count = (k) => manifest.rows.filter((r) => r.verdict === k).length;
  console.log(`${count("fix")} to fix · ${count("fine")} fine · ${count("beyond_repair")} beyond repair · ${count("error")} errors`);
  console.log(`Review: open "${path.join(OUT, "review.html")}"`);
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function reviewPage(rows) {
  const order = { fix: 0, beyond_repair: 1, error: 2, fine: 3 };
  const sorted = [...rows].sort((a, b) => order[a.verdict] - order[b.verdict] || a.name.localeCompare(b.name));
  const card = (r) => {
    const params = r.verdict === "fix" ? ["exposure", "shadows", "contrast", "warmth", "saturation", "sharpen"].filter((k) => r[k]).map((k) => `${k} ${r[k] > 0 ? "+" : ""}${r[k]}`).join(" · ") : "";
    const imgs = r.verdict === "fix"
      ? `<figure><img src="before/${r.file}" loading="lazy"><figcaption>Before</figcaption></figure><figure><img src="after/${r.file}" loading="lazy"><figcaption>After</figcaption></figure>`
      : r.file ? `<figure><img src="before/${r.file}" loading="lazy"><figcaption>Unchanged</figcaption></figure>` : "";
    return `<article class="${r.verdict}">
  <header><h2>${esc(r.name)}</h2><span class="tag">${r.verdict.replace("_", " ")}</span></header>
  <div class="pair">${imgs}</div>
  <p>${esc(r.note)}</p>
  ${r.issues?.length ? `<p class="meta">${r.issues.map(esc).join(", ")}</p>` : ""}
  ${params ? `<p class="meta">${esc(params)}</p>` : ""}
  ${r.metrics ? `<p class="meta">${r.metrics.width}×${r.metrics.height} · brightness ${r.metrics.brightness} · sharpness ${r.metrics.sharpness}</p>` : ""}
</article>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Photo review</title>
<style>
:root{--bg:#FCFBF8;--ink:#12233F;--muted:#6B7280;--line:#E7E2D6;--gold:#A97824}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;padding:32px 16px}
main{max-width:1100px;margin:0 auto}h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em}.lead{color:var(--muted);margin:0 0 28px}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
article{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}
article header{display:flex;justify-content:space-between;align-items:center;gap:8px}h2{font-size:16px;margin:0}
.tag{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;border-radius:99px;background:#F1EFE9;color:var(--muted)}
.fix .tag{background:#F6EBD3;color:var(--gold)}.beyond_repair .tag,.error .tag{background:#F7E1DE;color:#B0473F}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;margin:12px 0}
figure{margin:0}img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;background:#EEE;display:block}
figcaption{font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.1em}
p{margin:6px 0 0}.meta{font-size:12px;color:var(--muted);font-family:ui-monospace,monospace}
</style></head><body><main>
<h1>Photo review</h1>
<p class="lead">${rows.filter((r) => r.verdict === "fix").length} to fix, ${rows.filter((r) => r.verdict === "fine").length} left as they are, ${rows.filter((r) => r.verdict === "beyond_repair").length} that need a new photo. Nothing has been uploaded. Click an image to open it full size.</p>
<div class="grid">${sorted.map(card).join("\n")}</div>
</main><script>document.querySelectorAll("img").forEach(i=>i.onclick=()=>open(i.src))</script></body></html>`;
}

// ── Apply / undo ────────────────────────────────────────────────────────────

function readManifest() {
  const f = path.join(OUT, "manifest.json");
  if (!existsSync(f)) {
    console.error(`No manifest at ${f}. Run --fetch first, and pass the same --out.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(f, "utf8"));
}

async function apply() {
  const manifest = readManifest();
  const todo = manifest.rows.filter((r) => r.verdict === "fix" && !SKIP.includes(r.name.toLowerCase()));
  console.log(`Uploading ${todo.length} enhanced photos (originals stay in the bucket)…`);
  const stamp = Date.now();
  for (const r of todo) {
    const { data: cur } = await supabase.from("players").select("image_url").eq("id", r.id).single();
    if (cur?.image_url !== r.original_url) {
      console.log(`  skipped  ${r.name} — photo changed since the dry run`);
      continue;
    }
    const key = `enhanced/${r.id}-${stamp}.webp`;
    const body = readFileSync(path.join(OUT, "after", r.file));
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, body, { contentType: "image/webp", upsert: false });
    if (upErr) {
      console.log(`  failed   ${r.name} — ${upErr.message}`);
      continue;
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(key);
    // Keep the #f=… framing fragment, if the URL carried one.
    const frag = r.original_url.includes("#") ? r.original_url.slice(r.original_url.indexOf("#")) : "";
    const { error } = await supabase.from("players").update({ image_url: publicUrl + frag }).eq("id", r.id);
    if (error) console.log(`  failed   ${r.name} — ${error.message}`);
    else {
      r.applied_url = publicUrl + frag;
      console.log(`  updated  ${r.name}`);
    }
  }
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Done. To revert: node scripts/enhance-photos.mjs --undo --out " + JSON.stringify(OUT));
}

async function undo() {
  const manifest = readManifest();
  for (const r of manifest.rows.filter((x) => x.applied_url)) {
    const { error } = await supabase.from("players").update({ image_url: r.original_url }).eq("id", r.id).eq("image_url", r.applied_url);
    console.log(error ? `  failed   ${r.name} — ${error.message}` : `  restored ${r.name}`);
    if (!error) delete r.applied_url;
  }
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
}

if (flag("--fetch")) await fetchAll();
else if (flag("--render")) await render();
else if (flag("--apply")) await apply();
else if (flag("--undo")) await undo();
else console.log("Pass one of --fetch, --render, --apply, --undo (see the top of this file).");
