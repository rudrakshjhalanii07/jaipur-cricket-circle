"use client";

import { useState } from "react";
import Image from "next/image";
import { getDiceBearUrl } from "@/lib/avatar";

interface PlayerAvatarProps {
  /** The player's uploaded image URL (from Supabase). Null/undefined triggers DiceBear fallback. */
  src?: string | null;
  /** Player name — used as the DiceBear seed for a deterministic avatar. */
  name: string;
  /**
   * Team name — drives DiceBear's background & shape colors:
   *  • "Mavericks"     → blue palette
   *  • "NeuroStrikers" → red/crimson palette
   *  • anything else   → dark charcoal palette
   */
  team?: string | null;
  /** Extra Tailwind classes applied to the wrapping container (controls size/shape). */
  className?: string;
  /** Extra Tailwind classes for the <img> element. */
  imgClassName?: string;
  /** Alt text override; defaults to player name. */
  alt?: string;
  /** Logical display size in px used as next/image width & height hint (default 80). */
  displaySize?: number;
}

/**
 * Renders a player's profile picture.
 *
 * • If `src` is truthy → optimised via next/image (Vercel CDN, srcset, WebP/AVIF).
 * • Otherwise / on error → deterministic DiceBear SVG avatar (rendered as plain <img>
 *   because next/image doesn't handle SVGs without dangerouslyAllowSVG).
 */
export default function PlayerAvatar({
  src,
  name,
  team,
  className = "w-12 h-12 rounded-xl overflow-hidden",
  imgClassName = "w-full h-full object-cover",
  alt,
  displaySize = 80,
}: PlayerAvatarProps) {
  const [photoError, setPhotoError] = useState(false);
  const fallbackUrl = getDiceBearUrl(name, team);
  const displayAlt = alt ?? name;
  const showRealPhoto = !!src && !photoError;

  return (
    <div className={`bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${className}`}>
      {showRealPhoto ? (
        <Image
          src={src}
          alt={displayAlt}
          width={displaySize}
          height={displaySize}
          loading="lazy"
          className={imgClassName}
          onError={() => setPhotoError(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackUrl}
          alt={displayAlt}
          className={imgClassName}
        />
      )}
    </div>
  );
}
