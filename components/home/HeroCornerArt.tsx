import Image from "next/image";

/**
 * The hero's drawn corner art, cut out of the single wide backdrop plate
 * (`public/hero_bg.png`, kept as the source of truth) into four transparent
 * sprites by `scripts/hero-sprites.mjs`.
 *
 * Why corners instead of one full-bleed image: `object-cover` on a 16:9 plate
 * in a portrait viewport scales to fill the height, which threw away roughly
 * three quarters of the width — every drawing lives in the outer thirds, so
 * phones got blank paper. Anchoring each piece to its own corner and sizing it
 * as a percentage of the viewport means the composition scales continuously
 * across every screen instead of switching at a breakpoint, and each piece can
 * be tuned on its own (the landmarks stay large on a phone while the halftone
 * corners shrink out of the headline's way).
 *
 * The sprites are un-premultiplied against the plate's paper colour, so they
 * must sit on the matching cream that `.jcc-luxury-hero` paints.
 */

const SPRITES = [
  {
    src: "/hero-art/corner-tl.png",
    width: 440,
    height: 330,
    // Halftone + the start of the sweep. Small on a phone: it shares the top
    // of the section with the tagline.
    className: "hero-art-tl top-0 left-0 w-[42%] sm:w-[26%] max-w-[440px]",
    sizes: "(max-width: 640px) 42vw, 26vw",
  },
  {
    src: "/hero-art/corner-tr.png",
    width: 473,
    height: 300,
    className: "hero-art-tr top-0 right-0 w-[42%] sm:w-[27%] max-w-[473px]",
    sizes: "(max-width: 640px) 42vw, 27vw",
  },
  {
    src: "/hero-art/stadium.png",
    width: 560,
    height: 634,
    // The landmarks hold the foot of the section, and are proportionally
    // larger on a phone so they still read at that width.
    className: "hero-art-bl bottom-0 left-0 w-[56%] sm:w-[33%] max-w-[560px]",
    sizes: "(max-width: 640px) 56vw, 33vw",
  },
  {
    src: "/hero-art/hawa-mahal.png",
    width: 563,
    height: 684,
    className: "hero-art-br bottom-0 right-0 w-[58%] sm:w-[34%] max-w-[563px]",
    sizes: "(max-width: 640px) 58vw, 34vw",
  },
];

export default function HeroCornerArt() {
  return (
    <div className="hero-corner-art absolute inset-0 z-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {SPRITES.map((s) => (
        <Image
          key={s.src}
          src={s.src}
          alt=""
          width={s.width}
          height={s.height}
          sizes={s.sizes}
          priority
          className={`absolute h-auto ${s.className}`}
        />
      ))}
    </div>
  );
}
