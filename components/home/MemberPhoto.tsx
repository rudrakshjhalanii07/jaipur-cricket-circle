"use client";

import { useState } from "react";
import Image from "next/image";
import { getDiceBearUrl } from "@/lib/avatar";

export function MemberPhoto({
  src,
  name,
  team,
  className,
}: {
  src?: string | null;
  name: string;
  team?: string | null;
  className?: string;
}) {
  const [photoError, setPhotoError] = useState(false);
  const fallback = getDiceBearUrl(name, team);

  if (src && !photoError) {
    return (
      <Image
        src={src}
        alt={name}
        width={320}
        height={320}
        loading="lazy"
        className={className}
        onError={() => setPhotoError(true)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback} alt={name} className={className} />;
}
