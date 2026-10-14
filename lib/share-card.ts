// Story cards: a 1080×1920 (9:16) PNG drawn on a canvas in the browser, sized
// for WhatsApp Status and Instagram Stories. Everything is drawn client-side,
// so a member's private player card never leaves their phone until they
// choose to share it.
//
// Layout, top to bottom: a full-bleed visual (the player's photo fading into
// navy, a split-screen face-off, or a big monogram), then the content stack
// anchored to the bottom, then a footer. The stack is measured first and the
// visual fills whatever height is left, so no card has a dead gap.
//
// Instagram covers roughly the top and bottom 250px with its own UI, so the
// content that matters sits below SAFE_TOP and above the footer (FOOT_TOP).

import { focusOf, type PhotoFocus } from "@/lib/photo-focus";

export const CARD_W = 1080;
export const CARD_H = 1920;
const SAFE_TOP = 250;
const PAD = 88;
const WIDTH = CARD_W - PAD * 2;

const NAVY = "#0B1424";
const GOLD = "#D4AF37";
const GOLD_HI = "#F3C96A";
const GOLD_DK = "#A97824";
const WHITE = "#FCFBF8";
// Secondary text: bright enough to read over a photo and on a phone in daylight.
const SOFT = "rgba(252,251,248,0.8)";
const MUTED = "rgba(252,251,248,0.7)";
const RULE = "rgba(252,251,248,0.2)";

/** Soft shadow under display text so it holds up over busy photos. */
function lift(ctx: CanvasRenderingContext2D, on: boolean) {
  ctx.shadowColor = on ? "rgba(4,8,16,0.55)" : "transparent";
  ctx.shadowBlur = on ? 28 : 0;
  ctx.shadowOffsetY = on ? 4 : 0;
}

export type CardStat = { label: string; value: string; note?: string };
export type CardPerson = { name: string; photo?: string | null; color?: string };
/** One line of a ranked list: a player (round photo) or a team (crest, `logo`). */
export type CardRow = { name: string; value: string; note?: string; photo?: string | null; color?: string; logo?: boolean; plain?: boolean };

export type ShareCardSpec = {
  /** Pill above the headline, e.g. "Player of the Match · 14 Jun". */
  kicker: string;
  title: string;
  subtitle?: string;
  /** One headline number, drawn huge. */
  hero?: { value: string; unit: string; colors: [string, string] };
  /** Two or three headline numbers side by side (e.g. bat & ball figures). */
  figures?: { value: string; unit: string }[];
  body?: string;
  /** 3×2 stat grid (the overview card). */
  stats?: CardStat[];
  /** A ruled row of up to three small facts under everything else. */
  facts?: { label: string; value: string }[];
  chips?: string[];
  /** The person the card is about: photo when there is one, else a monogram. */
  person?: CardPerson | null;
  /** Head-to-head cards: two portraits facing off. */
  versus?: { left: CardPerson; right: CardPerson };
  /** Team colour for glows, tints and rings. */
  accent?: string;
  teamLogo?: string | null;
  /** Team name for the footer. */
  team?: string;
  /** A ranked list (leaderboards, records, an XI); up to 11 rows. */
  list?: CardRow[];
  /** A team crest drawn large up top, for cards about a team. */
  emblem?: string | null;
  /** Footer name when the card isn't about one person ("JCC Stats", a team). */
  byline?: string;
  /** Domain/path printed in the footer. */
  footer: string;
};

/** Pull the hex stops out of a CSS linear-gradient string. */
export function gradientStops(css: string, fallback: [string, string] = [GOLD_HI, GOLD_DK]): [string, string] {
  const hex = css.match(/#[0-9a-f]{6}/gi);
  return hex && hex.length >= 2 ? [hex[0], hex[hex.length - 1]] : fallback;
}

function cssFont(variable: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src.split("#")[0]; // focus fragments (lib/photo-focus.ts) aren't part of the file
  });
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** `#rrggbb` + alpha → `#rrggbbaa`; anything else falls back to gold. */
const alpha = (hex: string | undefined, a: number) =>
  `${hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : GOLD}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Greedy word wrap; the last allowed line ends in an ellipsis if text runs over. */
function wrap(ctx: Ctx, text: string, width: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** Largest font size (stepping down) at which `text` fits `width` on one line. */
function fit(ctx: Ctx, text: string, font: (px: number) => string, width: number, max: number, min: number) {
  let px = max;
  for (; px > min; px -= 4) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = font(px);
  return px;
}

function tracked(ctx: Ctx, tracking: number, fn: () => void) {
  // letterSpacing is newer than most of the canvas API; without it, plain text.
  const has = "letterSpacing" in ctx;
  if (has) ctx.letterSpacing = `${tracking}px`;
  fn();
  if (has) ctx.letterSpacing = "0px";
}

/** Draw an image to cover a box, anchored to its top (faces sit high in photos). */
function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, anchorX = 0.5) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) * anchorX, y + Math.min(0, (h - dh) * 0.15), dw, dh);
}

/**
 * The photo drawn into its own w×h layer. With a known face it's scaled so the
 * face is `face.h` tall and centred on (face.x, face.y), never leaving a gap;
 * without one it's a top-anchored cover. Dark photos (backlit, evening) are
 * then lifted with a gamma curve measured on the face, or the upper middle.
 */
function photoLayer(img: HTMLImageElement, w: number, h: number, focus: PhotoFocus | null, face: { x: number; y: number; h: number }) {
  const layer = document.createElement("canvas");
  layer.width = Math.round(w);
  layer.height = Math.round(h);
  const c = layer.getContext("2d")!;
  c.imageSmoothingQuality = "high";
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const fill = Math.max(w / iw, h / ih);
  let box: [number, number, number, number];
  if (focus) {
    // Zoom toward the face, but not so far that a small photo turns to mush.
    const zoom = Math.min(face.h / (focus.s * ih), fill * 1.8, 2.4);
    // Enough scale that the face can actually reach its spot without the
    // photo leaving a gap: a photo that exactly fills the box can't move.
    const fx = Math.min(0.97, Math.max(0.03, focus.x)), fy = Math.min(0.97, Math.max(0.03, focus.y));
    const room = Math.max((h - face.y) / ((1 - fy) * ih), face.y / (fy * ih), (w - face.x) / ((1 - fx) * iw), face.x / (fx * iw));
    // A close-up whose face is already big just fills the box: zooming it
    // further to reposition would crop the face itself.
    const closeUp = focus.s * ih * fill > face.h * 1.4;
    const s = closeUp ? fill : Math.max(fill, zoom, Math.min(room, fill * 2.2));
    const dw = iw * s, dh = ih * s;
    const dx = Math.min(0, Math.max(w - dw, face.x - focus.x * dw));
    const dy = Math.min(0, Math.max(h - dh, face.y - focus.y * dh));
    c.drawImage(img, dx, dy, dw, dh);
    const fh = focus.s * dh;
    box = [dx + focus.x * dw - fh * 0.5, dy + focus.y * dh - fh * 0.6, fh, fh * 1.2];
  } else {
    const dw = iw * fill, dh = ih * fill;
    c.drawImage(img, (w - dw) / 2, Math.min(0, (h - dh) * 0.15), dw, dh);
    box = [w * 0.25, h * 0.08, w * 0.5, h * 0.5];
  }
  // Exposure: mean luma of the face box; lift anything darker than ~0.42.
  const [bx, by, bw, bh] = box.map((n) => Math.round(n));
  const sx = Math.max(0, bx), sy = Math.max(0, by);
  const sw = Math.max(1, Math.min(layer.width - sx, bw)), sh = Math.max(1, Math.min(layer.height - sy, bh));
  const sample = c.getImageData(sx, sy, sw, sh).data;
  let sum = 0, n = 0;
  for (let i = 0; i < sample.length; i += 16) {
    sum += 0.2126 * sample[i] + 0.7152 * sample[i + 1] + 0.0722 * sample[i + 2];
    n++;
  }
  const mean = n ? sum / n / 255 : 0.5;
  if (mean > 0.02 && mean < 0.42) {
    const gamma = Math.min(1, Math.max(0.55, Math.log(0.46) / Math.log(mean)));
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(v / 255, gamma);
    const all = c.getImageData(0, 0, layer.width, layer.height);
    const d = all.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    c.putImageData(all, 0, 0);
  }
  return layer;
}

function circle(ctx: Ctx, img: HTMLImageElement | null, name: string, cx: number, cy: number, r: number, ring: string, font: (w: number, px: number) => string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) cover(ctx, img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#1B3157";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = GOLD_HI;
    ctx.font = font(800, Math.round(r * 0.8));
    ctx.textAlign = "center";
    ctx.fillText(initials(name), cx, cy + r * 0.28);
    ctx.textAlign = "left";
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(3, r / 14);
  ctx.stroke();
}

type Block = { h: number; gap: number; draw: (y: number) => void };

/**
 * Face position for a photo with none saved yet (players.image_focus empty):
 * found on the spot with the same detector the upload step uses, loaded only
 * now, and remembered per URL for the rest of the visit.
 */
const detected = new Map<string, Promise<PhotoFocus | null>>();
function faceFor(person: CardPerson | null | undefined, img: HTMLImageElement | null): Promise<PhotoFocus | null> {
  if (!person?.photo || !img) return Promise.resolve(null);
  const saved = focusOf(person.photo);
  if (saved) return Promise.resolve(saved);
  const key = person.photo.split("#")[0];
  let p = detected.get(key);
  if (!p) {
    p = import("@/lib/face-detect").then((m) => m.detectFocus(img)).catch(() => null);
    detected.set(key, p);
  }
  return p;
}

async function draw(spec: ShareCardSpec, withPhoto: boolean): Promise<HTMLCanvasElement> {
  const heading = cssFont("--font-grotesk", "system-ui, sans-serif");
  const body = cssFont("--font-inter", "system-ui, sans-serif");
  const mono = cssFont("--font-plex-mono", "ui-monospace, monospace");
  const H = (w: number, px: number) => `${w} ${px}px ${heading}`;
  const B = (w: number, px: number) => `${w} ${px}px ${body}`;
  const M = (w: number, px: number) => `${w} ${px}px ${mono}`;
  await Promise.all([H(800, 100), H(700, 60), B(400, 36), B(600, 36), M(500, 26), M(600, 26)].map((f) => document.fonts.load(f).catch(() => null)));

  const accent = spec.accent ?? GOLD;
  const photoOf = (x?: CardPerson | null) => (withPhoto && x?.photo ? loadImage(x.photo, true) : null);
  const [logo, crest, photo, left, right] = await Promise.all([
    loadImage("/jcc_logo.png", false),
    spec.teamLogo ? loadImage(spec.teamLogo, false) : null,
    photoOf(spec.person),
    photoOf(spec.versus?.left),
    photoOf(spec.versus?.right),
  ]);
  const rows = (spec.list ?? []).slice(0, 11);
  const [emblem, ...rowImgs] = await Promise.all([
    spec.emblem ? loadImage(spec.emblem, false) : null,
    ...rows.map((r) => (r.photo && (withPhoto || r.logo) ? loadImage(r.photo, !r.logo) : null)),
  ]);
  const [face, leftFace, rightFace] = await Promise.all([
    faceFor(spec.person, photo),
    faceFor(spec.versus?.left, left),
    faceFor(spec.versus?.right, right),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")! as Ctx;
  ctx.textBaseline = "alphabetic";

  // ── Measure the content stack (bottom-anchored) ───────────────────────────
  const blocks: Block[] = [];
  const push = (h: number, gap: number, fn: (y: number) => void) => blocks.push({ h, gap, draw: fn });

  // Kicker pill
  ctx.font = M(600, 28);
  const kick = spec.kicker.toUpperCase();
  let kw = 0;
  tracked(ctx, 4, () => { kw = Math.min(WIDTH, ctx.measureText(kick).width + 48); });
  push(66, 34, (y) => {
    ctx.beginPath();
    ctx.roundRect(PAD, y, kw, 66, 33);
    ctx.fillStyle = "rgba(11,20,36,0.72)";
    ctx.fill();
    ctx.strokeStyle = alpha(GOLD, 0.65);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GOLD_HI;
    ctx.font = M(600, 28);
    tracked(ctx, 4, () => ctx.fillText(wrap(ctx, kick, WIDTH - 48, 1)[0] ?? kick, PAD + 24, y + 43));
  });

  // Headline number
  if (spec.hero) {
    const { value, unit, colors } = spec.hero;
    const px = fit(ctx, value, (n) => H(800, n), WIDTH + 10, spec.versus ? 300 : 360, 120);
    const cap = px * 0.74;
    const under = Math.max(52, px * 0.2); // clears descenders like the "/" in 4/24
    push(cap + under + 26, 44, (y) => {
      ctx.font = H(800, px);
      const g = ctx.createLinearGradient(PAD, y, PAD + ctx.measureText(value).width, y + cap);
      g.addColorStop(0, colors[0]);
      g.addColorStop(1, colors[1]);
      ctx.fillStyle = g;
      lift(ctx, true);
      tracked(ctx, -px * 0.035, () => ctx.fillText(value, PAD - px * 0.04, y + cap));
      lift(ctx, false);
      ctx.fillStyle = SOFT;
      ctx.font = M(600, 30);
      tracked(ctx, 5, () => ctx.fillText(unit.toUpperCase(), PAD, y + cap + under + 22));
    });
  }

  // Side-by-side figures
  if (spec.figures?.length) {
    const n = Math.min(3, spec.figures.length);
    const cw = WIDTH / n;
    let px = 220;
    for (const f of spec.figures.slice(0, n)) px = Math.min(px, fit(ctx, f.value, (s) => H(800, s), cw - 40, 220, 90));
    const cap = px * 0.74;
    push(cap + 74, 44, (y) => {
      spec.figures!.slice(0, n).forEach((f, i) => {
        const x = PAD + i * cw;
        if (i) {
          ctx.fillStyle = alpha(GOLD, 0.35);
          ctx.fillRect(x - 22, y + 6, 2, cap + 56);
        }
        ctx.font = H(800, px);
        const g = ctx.createLinearGradient(x, y, x + cw * 0.8, y + cap);
        g.addColorStop(0, GOLD_HI);
        g.addColorStop(1, GOLD_DK);
        ctx.fillStyle = g;
        lift(ctx, true);
        tracked(ctx, -px * 0.03, () => ctx.fillText(f.value, x - 4 + (i ? 4 : 0), y + cap));
        lift(ctx, false);
        ctx.fillStyle = SOFT;
        ctx.font = M(600, 27);
        tracked(ctx, 4, () => ctx.fillText(f.unit.toUpperCase(), x + (i ? 4 : 0), y + cap + 60));
      });
    });
  }

  // Title
  const big = !spec.hero && !spec.figures?.length && !spec.list?.length;
  const tpx = big ? 124 : 84;
  ctx.font = H(800, tpx);
  const tlines = wrap(ctx, spec.title, WIDTH, big ? 2 : 3);
  const tsize = tlines.map((l) => fit(ctx, l, (n) => H(800, n), WIDTH, tpx, Math.round(tpx * 0.7)));
  const lh = (px: number) => px * 1.1;
  push(tsize.reduce((s, px) => s + lh(px), 0), spec.subtitle ? 22 : 44, (y) => {
    ctx.fillStyle = WHITE;
    lift(ctx, true);
    let yy = y;
    tlines.forEach((l, i) => {
      yy += lh(tsize[i]) * 0.86;
      ctx.font = H(800, tsize[i]);
      tracked(ctx, -tsize[i] * 0.012, () => ctx.fillText(l, PAD - 3, yy));
      yy += lh(tsize[i]) * 0.14;
    });
    lift(ctx, false);
  });

  if (spec.subtitle) {
    push(44, 40, (y) => {
      ctx.fillStyle = SOFT;
      ctx.font = B(500, 36);
      ctx.fillText(wrap(ctx, spec.subtitle!, WIDTH, 1)[0] ?? "", PAD, y + 34);
    });
  }

  if (spec.body) {
    ctx.font = B(400, 40);
    const lines = wrap(ctx, spec.body, WIDTH, 3);
    push(lines.length * 56, 44, (y) => {
      ctx.fillStyle = SOFT;
      ctx.font = B(400, 40);
      lines.forEach((l, i) => ctx.fillText(l, PAD, y + 40 + i * 56));
    });
  }

  if (spec.stats?.length) {
    const rows = Math.ceil(Math.min(6, spec.stats.length) / 3);
    const cw = WIDTH / 3;
    push(rows * 200 + 4, 40, (y) => {
      ctx.fillStyle = RULE;
      ctx.fillRect(PAD, y, WIDTH, 2);
      spec.stats!.slice(0, 6).forEach((s, i) => {
        const cx = PAD + (i % 3) * cw;
        const cy = y + 54 + Math.floor(i / 3) * 200;
        ctx.fillStyle = SOFT;
        ctx.font = M(600, 25);
        tracked(ctx, 3, () => ctx.fillText(wrap(ctx, s.label.toUpperCase(), cw - 24, 1)[0] ?? "", cx, cy));
        const g = ctx.createLinearGradient(cx, cy, cx + cw * 0.8, cy + 90);
        g.addColorStop(0, i < 3 ? GOLD_HI : WHITE);
        g.addColorStop(1, i < 3 ? GOLD : "rgba(252,251,248,0.85)");
        ctx.fillStyle = g;
        fit(ctx, s.value, (n) => H(800, n), cw - 24, 88, 48);
        tracked(ctx, -2, () => ctx.fillText(s.value, cx - 2, cy + 90));
        if (s.note) {
          ctx.fillStyle = SOFT;
          ctx.font = M(600, 25);
          ctx.fillText(s.note, cx, cy + 128);
        }
      });
    });
  }

  if (spec.chips?.length) {
    ctx.font = B(600, 31);
    const rows: { text: string; x: number; w: number }[][] = [[]];
    let cx = PAD;
    for (const chip of spec.chips) {
      const w = ctx.measureText(chip).width + 52;
      if (cx + w > CARD_W - PAD) {
        if (rows.length === 2) break;
        rows.push([]);
        cx = PAD;
      }
      rows[rows.length - 1].push({ text: chip, x: cx, w });
      cx += w + 14;
    }
    push(rows.length * 74 - 14, 44, (y) => {
      rows.forEach((row, r) => row.forEach((c) => {
        const cy = y + r * 74;
        ctx.beginPath();
        ctx.roundRect(c.x, cy, c.w, 60, 30);
        ctx.fillStyle = "rgba(212,175,55,0.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(212,175,55,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = GOLD_HI;
        ctx.font = B(600, 31);
        ctx.fillText(c.text, c.x + 26, cy + 40);
      }));
    });
  }

  if (rows.length) {
    const n = rows.length;
    const rh = n > 9 ? 74 : n > 7 ? 88 : n > 5 ? 108 : 122;
    const av = rh - (n > 9 ? 22 : 34);
    const big = n > 9 ? 34 : n > 7 ? 38 : 44;
    push(n * rh, 32, (y) => {
      rows.forEach((r, i) => {
        const cy = y + i * rh + rh / 2;
        // Plain rows (a day's numbers) aren't a ranking: no position numbers.
        const ranked = !rows.every((x) => x.plain);
        if (ranked) {
          ctx.fillStyle = i === 0 ? GOLD_HI : MUTED;
          ctx.font = M(600, 26);
          tracked(ctx, 2, () => ctx.fillText(String(i + 1).padStart(2, "0"), PAD, cy + 9));
        }
        const ax = ranked ? PAD + 64 : PAD;
        const img = rowImgs[i] as HTMLImageElement | null;
        if (r.plain) {
          // No picture: the text takes the avatar's place.
        } else if (r.logo) {
          if (img) {
            const k = Math.min(av / img.width, av / img.height);
            ctx.drawImage(img, ax + (av - img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
          }
        } else {
          circle(ctx, img, r.name, ax + av / 2, cy, av / 2, r.color ?? alpha(GOLD, 0.7), H);
        }
        const tx = r.plain ? ax : ax + av + 24;
        ctx.font = H(800, big + 6);
        const vw = ctx.measureText(r.value).width;
        const room = CARD_W - PAD - vw - 28 - tx;
        ctx.fillStyle = WHITE;
        ctx.font = H(700, big);
        ctx.fillText(wrap(ctx, r.name, room, 1)[0] ?? r.name, tx, r.note ? cy - (n > 9 ? 2 : 6) : cy + big * 0.35);
        if (r.note) {
          ctx.fillStyle = SOFT;
          ctx.font = B(500, n > 9 ? 23 : 27);
          ctx.fillText(wrap(ctx, r.note, room, 1)[0] ?? "", tx, cy + (n > 9 ? 26 : 34));
        }
        ctx.font = H(800, big + 6);
        ctx.textAlign = "right";
        if (i === 0) {
          const g = ctx.createLinearGradient(CARD_W - PAD - vw, cy - big, CARD_W - PAD, cy + big);
          g.addColorStop(0, GOLD_HI);
          g.addColorStop(1, GOLD_DK);
          ctx.fillStyle = g;
        } else ctx.fillStyle = WHITE;
        ctx.fillText(r.value, CARD_W - PAD, cy + big * 0.38);
        ctx.textAlign = "left";
        if (i < n - 1) {
          ctx.fillStyle = "rgba(252,251,248,0.1)";
          ctx.fillRect(tx, y + (i + 1) * rh - 1, CARD_W - PAD - tx, 2);
        }
      });
    });
  }

  if (spec.facts?.length) {
    const n = Math.min(3, spec.facts.length);
    const cw = WIDTH / n;
    // A value that won't fit at a readable size wraps onto a second line
    // (breaking at " · " first) rather than shrinking.
    const MIN = 34;
    const values = spec.facts.slice(0, n).map((f) => {
      const px = fit(ctx, f.value, (z) => H(700, z), cw - 32, 46, MIN);
      if (ctx.measureText(f.value).width <= cw - 32) return { px, lines: [f.value] };
      ctx.font = H(700, MIN);
      const parts = f.value.split(" · ");
      const lines = parts.length > 1 ? [parts[0], parts.slice(1).join(" · ")].map((l) => wrap(ctx, l, cw - 32, 1)[0] ?? l) : wrap(ctx, f.value, cw - 32, 2);
      return { px: MIN, lines };
    });
    const twoLines = values.some((v) => v.lines.length > 1);
    push(twoLines ? 178 : 134, 30, (y) => {
      ctx.fillStyle = RULE;
      ctx.fillRect(PAD, y, WIDTH, 2);
      spec.facts!.slice(0, n).forEach((f, i) => {
        const x = PAD + i * cw;
        ctx.fillStyle = SOFT;
        ctx.font = M(600, 25);
        tracked(ctx, 3, () => ctx.fillText(wrap(ctx, f.label.toUpperCase(), cw - 32, 1)[0] ?? "", x, y + 54));
        ctx.fillStyle = WHITE;
        ctx.font = H(700, values[i].px);
        values[i].lines.forEach((l, k) => ctx.fillText(l, x, y + 116 + k * (values[i].px + 10)));
      });
    });
  }

  // The footer sits low, just above the strip Instagram's reply bar covers;
  // everything else stacks up from it.
  const FOOT_TOP = CARD_H - 300;
  const stack = blocks.reduce((s, b, i) => s + b.h + (i < blocks.length - 1 ? b.gap : 0), 0);
  // Text-only cards may start higher; a photo or crest needs room up top.
  const visual = !!(spec.person || spec.versus || spec.emblem);
  const top = Math.max(SAFE_TOP + (visual ? 130 : 40), FOOT_TOP - 56 - stack);

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alpha(color, a));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  };

  // ── Visual: fills everything above the stack ─────────────────────────────
  const zone = Math.min(CARD_H, top + 260); // runs under the stack, then fades out
  const photoZone = Math.min(CARD_H, top + 600); // a photo runs longer, for a soft fade
  const monogram = (name: string, color: string, x: number, w: number) => {
    const g = ctx.createLinearGradient(x, 0, x + w, zone);
    g.addColorStop(0, alpha(color, 0.55));
    g.addColorStop(1, alpha(NAVY, 1));
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, zone);
    ctx.save();
    ctx.globalAlpha = 0.95;
    // Centred in the open space between the masthead and the content.
    const room = Math.max(200, top - 300);
    const px = Math.max(220, Math.min(560, room * 1.2, w * 0.9));
    ctx.font = H(800, px);
    ctx.textAlign = "center";
    const tg = ctx.createLinearGradient(x, 280, x + w, top);
    tg.addColorStop(0, alpha(GOLD_HI, 0.55));
    tg.addColorStop(1, alpha(GOLD_DK, 0.15));
    ctx.fillStyle = tg;
    tracked(ctx, -px * 0.04, () => ctx.fillText(initials(name), x + w / 2, 280 + (room + px * 0.72) / 2));
    ctx.textAlign = "left";
    ctx.restore();
  };

  if (spec.versus) {
    // Split screen on a diagonal, gold seam between, VS badge on the seam.
    const tilt = 120;
    const halves: [CardPerson, HTMLImageElement | null, number[]][] = [
      [spec.versus.left, left, [0, 0, CARD_W / 2 + tilt / 2, 0, CARD_W / 2 - tilt / 2, zone, 0, zone]],
      [spec.versus.right, right, [CARD_W / 2 + tilt / 2, 0, CARD_W, 0, CARD_W, zone, CARD_W / 2 - tilt / 2, zone]],
    ];
    halves.forEach(([p, img, pts], i) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.closePath();
      ctx.clip();
      const x = i ? CARD_W / 2 - tilt / 2 : 0, w = CARD_W / 2 + tilt / 2;
      if (img) ctx.drawImage(photoLayer(img, w, zone, i ? rightFace : leftFace, { x: i ? w / 2 + tilt / 4 : w / 2 - tilt / 4, y: zone * 0.36, h: zone * 0.26 }), x, 0);
      else monogram(p.name, p.color ?? (i ? "#7C3AED" : accent), x, w);
      ctx.restore();
    });
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 + tilt / 2, 0);
    ctx.lineTo(CARD_W / 2 - tilt / 2, zone);
    ctx.stroke();
  } else if (spec.person) {
    if (photo) {
      const room = Math.max(240, top - 270);
      // The photo fills the top of the card and runs on under the copy, where
      // the long fade below melts it away.
      ctx.drawImage(photoLayer(photo, CARD_W, photoZone, face, { x: CARD_W / 2, y: 270 + room * 0.45, h: Math.min(440, Math.max(170, room * 0.4)) }), 0, 0);
    } else monogram(spec.person.name, accent, 0, CARD_W);
  } else if (emblem && top - 300 >= 180) {
    // A team card: the crest, large, in the open space above the copy.
    const room = Math.max(200, top - 300);
    const size = Math.min(620, room * 0.95);
    glow(CARD_W / 2, 290 + room / 2, size * 1.1, accent, 0.5);
    const k = Math.min(size / emblem.width, size / emblem.height);
    ctx.drawImage(emblem, (CARD_W - emblem.width * k) / 2, 290 + (room - emblem.height * k) / 2, emblem.width * k, emblem.height * k);
  } else {
    glow(CARD_W + 80, -60, 900, GOLD, 0.3);
  }
  glow(-120, CARD_H - 200, 1000, accent, 0.3);

  // Crest watermark when there's no photo to look at
  if (crest && !(spec.person && photo) && !spec.versus && !emblem) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.translate(CARD_W - 230, SAFE_TOP + 260);
    ctx.rotate(-0.14);
    ctx.drawImage(crest, -320, -320, 640, 640);
    ctx.restore();
  }

  // Fades: dark under the masthead, and the visual melting into navy. Both
  // kept short and light so the face reads; the masthead and the kicker pill
  // carry their own contrast.
  let g = ctx.createLinearGradient(0, 0, 0, SAFE_TOP + 90);
  g.addColorStop(0, alpha(NAVY, 0.66));
  g.addColorStop(0.55, alpha(NAVY, 0.38));
  g.addColorStop(1, alpha(NAVY, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, SAFE_TOP + 90);
  if (spec.person && photo && !spec.versus) {
    // The photo's lower part stays about half visible behind the kicker and
    // the number, then eases into navy over a long stretch (no visible edge).
    const from = top - 260, to = photoZone, span = to - from;
    // Rows of names need a darker ground than a single big number does.
    const under = rows.length ? 0.78 : 0.5;
    g = ctx.createLinearGradient(0, from, 0, to);
    const at = (y: number) => Math.min(1, Math.max(0, (y - from) / span));
    const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep
    // 0 → 0.5 easing in over the face's lower edge down to the kicker…
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      g.addColorStop(at(from + t * 300), alpha(NAVY, under * ease(t)));
    }
    // …then 0.5 → 1 gently across the number and below it.
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      g.addColorStop(at(top + 40 + t * (to - top - 40)), alpha(NAVY, under + (1 - under) * ease(t)));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, from, CARD_W, CARD_H);
  } else {
    g = ctx.createLinearGradient(0, top - 225, 0, top + 90);
    g.addColorStop(0, alpha(NAVY, 0));
    g.addColorStop(0.65, alpha(NAVY, 0.8));
    g.addColorStop(1, alpha(NAVY, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 225, CARD_W, CARD_H);
  }

  glow(-120, CARD_H - 200, 900, accent, 0.22);
  ctx.strokeStyle = "rgba(252,251,248,0.03)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= CARD_W; x += 90) { ctx.beginPath(); ctx.moveTo(x, top - 100); ctx.lineTo(x, CARD_H); ctx.stroke(); }
  for (let y = Math.ceil((top - 100) / 90) * 90; y <= CARD_H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke(); }

  if (spec.versus) {
    // VS badge on the seam, names pinned to each half's lower edge.
    const cy = Math.min(zone - 300, top - 170);
    circle(ctx, null, "", CARD_W / 2, cy, 78, GOLD, H);
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(CARD_W / 2, cy, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD_HI;
    ctx.font = H(800, 64);
    ctx.textAlign = "center";
    tracked(ctx, -2, () => ctx.fillText("VS", CARD_W / 2, cy + 23));
    ctx.font = H(800, 46);
    const name = (p: CardPerson, x: number, align: CanvasTextAlign) => {
      ctx.textAlign = align;
      ctx.fillStyle = WHITE;
      ctx.fillText(wrap(ctx, p.name, 360, 1)[0] ?? p.name, x, cy + 150);
      ctx.fillStyle = p.color ?? GOLD;
      ctx.fillRect(align === "left" ? x : x - 64, cy + 172, 64, 6);
    };
    name(spec.versus.left, PAD, "left");
    name(spec.versus.right, CARD_W - PAD, "right");
    ctx.textAlign = "left";
  }

  // ── Masthead ──────────────────────────────────────────────────────────────
  const my = 150;
  if (logo) ctx.drawImage(logo, PAD, my, 74, 76);
  ctx.fillStyle = WHITE;
  ctx.font = H(700, 38);
  ctx.fillText("Jaipur Cricket Circle", PAD + 94, my + 36);
  ctx.fillStyle = GOLD;
  ctx.font = M(600, 25);
  tracked(ctx, 5, () => ctx.fillText("JCC STATS", PAD + 94, my + 68));

  // ── Content stack ─────────────────────────────────────────────────────────
  let y = top;
  for (const b of blocks) {
    b.draw(y);
    y += b.h + b.gap;
  }

  // ── Footer: who, which team, where ────────────────────────────────────────
  ctx.fillStyle = RULE;
  ctx.fillRect(PAD, FOOT_TOP, WIDTH, 2);
  const fy = FOOT_TOP + 44;
  let fx = PAD;
  const who = spec.byline ?? spec.person?.name ?? (spec.versus ? `${spec.versus.left.name.split(/\s+/)[0]} v ${spec.versus.right.name.split(/\s+/)[0]}` : "JCC Stats");
  if (crest) {
    ctx.drawImage(crest, fx, fy - 8, 72, 72);
    fx += 92;
  } else if (spec.person && !spec.byline) {
    circle(ctx, photo, spec.person.name, fx + 32, fy + 28, 32, accent, H);
    fx += 84;
  }
  ctx.fillStyle = WHITE;
  ctx.font = H(700, 38);
  ctx.fillText(wrap(ctx, who, 380, 1)[0] ?? who, fx, fy + 24);
  ctx.fillStyle = MUTED;
  ctx.fillStyle = SOFT;
  ctx.font = M(600, 24);
  tracked(ctx, 3, () => ctx.fillText(wrap(ctx, (spec.team ?? "Jaipur Cricket Circle").toUpperCase(), 420, 1)[0] ?? "", fx, fy + 62));
  ctx.textAlign = "right";
  ctx.fillStyle = GOLD;
  ctx.font = M(600, 26);
  tracked(ctx, 4, () => ctx.fillText("#JCC", CARD_W - PAD, fy + 24));
  ctx.fillStyle = MUTED;
  ctx.fillStyle = SOFT;
  ctx.font = M(600, 23);
  tracked(ctx, 2, () => ctx.fillText(spec.footer.toUpperCase(), CARD_W - PAD, fy + 60));
  ctx.textAlign = "left";

  return canvas;
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty canvas"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

/** Render the card to a PNG. A photo without CORS headers taints the canvas, so retry without it. */
export async function renderShareCard(spec: ShareCardSpec): Promise<Blob> {
  try {
    return await toBlob(await draw(spec, true));
  } catch {
    return toBlob(await draw(spec, false));
  }
}
