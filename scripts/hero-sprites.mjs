import sharp from 'sharp';

/**
 * Cut a region out of the hero plate and turn it into a transparent sprite.
 *
 * The artwork is dark ink on cream paper, so alpha comes from how far a pixel
 * departs from the paper. The paper is estimated *locally* — a heavy blur of
 * the crop, which smears the linework away and leaves the plate's vignette and
 * tone — because a single flat paper colour cannot cancel a gradient, and the
 * residue shows up as a visible rectangle where the sprite's bounding box ends.
 *
 * RGB is then un-premultiplied against that local paper (C = B + (P - B)/a) so
 * compositing over the hero's cream reproduces the ink at full strength rather
 * than washing it out. Only pixels *darker* than their local paper count as
 * ink; the plate's own vignette is deliberately dropped, since the hero paints
 * its own.
 */
const BLUR = 60;  // radius the paper is estimated over
const FLOOR = 5;  // below this, a pixel is paper grain rather than ink
const GAIN = 46;  // channel distance at which ink becomes fully opaque

async function cut(name, left, top, width, height) {
  const region = { left, top, width, height };
  const { data, info } = await sharp('public/hero_bg.png')
    .extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // Paper field: same crop, blurred past the point where any linework survives.
  const { data: paper } = await sharp('public/hero_bg.png')
    .extract(region).removeAlpha().blur(BLUR).raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;

  const out = Buffer.alloc(n * 4);
  let inked = 0;
  for (let i = 0; i < n; i++) {
    const p = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const B = [paper[i * 3], paper[i * 3 + 1], paper[i * 3 + 2]];
    // Ink darkens the paper; anything lighter is the plate's own highlight.
    const d = Math.max(...B.map((b, c) => b - p[c]));
    let a = Math.min(1, Math.max(0, (d - FLOOR) / (GAIN - FLOOR)));
    // Anything fainter than this is residue, not linework — and residue gets
    // amplified by the un-premultiply into a visible tint over the crop's
    // whole rectangle, which is exactly what betrays the sprite's edges.
    if (a < 0.07) a = 0;
    if (a > 0) inked++;
    for (let c = 0; c < 3; c++) {
      const v = a === 0 ? B[c] : B[c] + (p[c] - B[c]) / a;
      out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    out[i * 4 + 3] = Math.round(a * 255);
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(`public/hero-art/${name}.png`);
  console.log(name, `${width}x${height}`, 'ink', (inked / n * 100).toFixed(1) + '%');
}

await cut('corner-tl', 0, 0, 440, 330);
await cut('corner-tr', 1210, 0, 473, 300);
await cut('stadium', 0, 300, 560, 634);
await cut('hawa-mahal', 1120, 250, 563, 684);
