"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";
import { photoFor, type PlayerPhotoMap } from "@/lib/player-photos";

/** Member photos from `players.image_url`, keyed for photoFor(). */
export const PhotoContext = createContext<PlayerPhotoMap>({});

export function usePhoto(name: string | null | undefined) {
  return photoFor(useContext(PhotoContext), name);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Round player photo; a navy monogram when the member has no photo yet.
 * `ring` draws a hairline in a team colour (or gold) around it.
 */
export function Avatar({ name, size = 28, ring, className = "" }: { name: string; size?: number; ring?: string; className?: string }) {
  const photo = usePhoto(name);
  const [failed, setFailed] = useState<string | null>(null);
  const src = photo && failed !== photo ? photo : null;
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 ${size >= 48 ? 2 : 1.5}px ${ring}` : undefined };
  if (!src) {
    return (
      <span
        aria-hidden
        className={`inline-grid shrink-0 place-items-center rounded-full bg-jcc-blue font-heading font-bold tracking-tight text-jcc-accent-highlight ${className}`}
        style={{ ...style, fontSize: Math.max(9, size * 0.36) }}
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-jcc-navy-light ${className}`} style={style}>
      {/* Member photos are already small webp files: load them straight from
          storage rather than through the image optimiser, and drop to the
          monogram if one fails. */}
      <Image src={src} alt={name} fill unoptimized onError={() => setFailed(src)} className="object-cover object-top" />
    </span>
  );
}

/**
 * A large editorial portrait that dissolves into the page on its left edge.
 * Renders nothing without a photo, so the caller can fall back.
 */
export function Portrait({ name, className = "" }: { name: string; className?: string }) {
  const photo = usePhoto(name);
  const [failed, setFailed] = useState<string | null>(null);
  const src = photo && failed !== photo ? photo : null;
  if (!src) return null;
  return (
    <div
      className={`pointer-events-none overflow-hidden ${className}`}
      style={{
        maskImage: "linear-gradient(to left, #000 35%, transparent 95%), linear-gradient(to top, transparent 0%, #000 22%)",
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    >
      <Image src={src} alt="" fill unoptimized onError={() => setFailed(src)} className="object-cover object-top grayscale-[35%] transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0" />
    </div>
  );
}
