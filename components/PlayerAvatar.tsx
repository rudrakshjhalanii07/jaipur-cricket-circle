"use client";

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
}

/**
 * Renders a player's profile picture.
 *
 * • If `src` is truthy → shows the uploaded photo.
 * • Otherwise → shows a deterministic DiceBear "thumbs" avatar seeded by name,
 *   with team-aware colors matching JCC's brand palette.
 */
export default function PlayerAvatar({
  src,
  name,
  team,
  className = "w-12 h-12 rounded-xl overflow-hidden",
  imgClassName = "w-full h-full object-cover",
  alt,
}: PlayerAvatarProps) {
  const fallbackUrl = getDiceBearUrl(name, team);
  const displayAlt = alt ?? name;

  return (
    <div className={`bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || fallbackUrl}
        alt={displayAlt}
        className={imgClassName}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== fallbackUrl) {
            img.src = fallbackUrl;
          }
        }}
      />
    </div>
  );
}
