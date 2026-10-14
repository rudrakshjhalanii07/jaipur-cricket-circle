// Cover photos for Boundary Banter articles: stock cricket photography from
// Unsplash only — never members' own photos and never an uploaded cover.
// Each was checked by eye to be cricket (2026-10-14). An article always gets
// the same photo (picked from its slug), and neighbours rarely share one.

const UNSPLASH = [
  "1540747913346-19e32dc3e97e", // floodlit stadium at night
  "1589801258579-18e091f4ca26", // batter driving, umpire behind
  "1531415074968-036ba1b575da", // red ball in the grass
  "1607734834519-d8576ae60ea6", // packed stadium, daylight
  "1593341646782-e0b495cff86d", // bat meets ball, close up
  "1512719994953-eabf50895df7", // stadium under a dusk sky
  "1624526267942-ab0ff8a3e972", // batter at the crease
  "1562077772-3bd90403f7f0", // net session
  "1629285483773-6b5cde2171d7", // pink ball on blue
];

export const unsplashCover = (id: string, width = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=70&fm=webp&auto=format&fit=crop`;

/** The cover for an article, stable per slug. */
export function articleCover(slug: string, width = 1600): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return unsplashCover(UNSPLASH[h % UNSPLASH.length], width);
}

/** Covers for a list shown together: no photo repeats until all nine are used. */
export function articleCovers(slugs: string[], width = 1600): string[] {
  const used = new Set<number>();
  return slugs.map((slug) => {
    let h = 0;
    for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let i = h % UNSPLASH.length;
    if (used.size >= UNSPLASH.length) used.clear();
    while (used.has(i)) i = (i + 1) % UNSPLASH.length;
    used.add(i);
    return unsplashCover(UNSPLASH[i], width);
  });
}
