"use client";

import { useState } from "react";
import Image from "next/image";
import { getMonogramAvatar } from "@/lib/avatar";

export function MemberPhoto({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  team?: string | null;
  className?: string;
}) {
  const [photoError, setPhotoError] = useState(false);
  const fallback = getMonogramAvatar(name);

  if (src && !photoError) {
    return (
      <Image
        src={src}
        alt={name}
        fill
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 18vw"
        loading="lazy"
        className={`${className} portrait-photo`}
        onError={() => setPhotoError(true)}
      />
    );
  }
  // An engraved-initials placeholder reads as paper stock, not a photo —
  // never grayscale/sepia it like a real portrait.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback} alt={name} className={className} />;
}
