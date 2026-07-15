"use client";

import { useState } from "react";
import Image from "next/image";
import type { Member } from "@/lib/types";
import { getMonogramAvatar } from "@/lib/avatar";
import type { BattingLeaderRow, BowlingLeaderRow, AllRounderRow, FieldingRow } from "@/lib/series";

export type PlayerStats = {
  batting?: BattingLeaderRow;
  bowling?: BowlingLeaderRow;
  allRounder?: AllRounderRow;
  fielding?: FieldingRow;
};

export default function MemberCard({
  member,
  index,
  onClick,
  priority = false,
}: {
  member: Member;
  index: number;
  playerStats?: PlayerStats;
  onClick?: () => void;
  priority?: boolean;
}) {
  const [photoError, setPhotoError] = useState(false);
  const monogram = getMonogramAvatar(member.name);
  const memberNo = String(index + 1).padStart(3, "0");
  const isFounder = member.tags.includes("founding-member");
  const isCaptain = member.tags.includes("captain") || member.tags.includes("vice-captain");
  const cardTier = isFounder ? " id-card--founder" : isCaptain ? " id-card--captain" : "";
  const roleColor = isFounder || isCaptain ? "text-jcc-accent-dark" : "text-jcc-blue/60";

  return (
    <div className="group h-full max-w-77.5 sm:max-w-none mx-auto w-full transition-transform duration-500 ease-out hover:-translate-y-1.5 will-change-transform">
      <div
        onClick={onClick}
        className={`id-card${cardTier} relative flex flex-col h-full cursor-pointer select-none`}
      >
        {/* Portrait — the dominant element, ~70-75% of the card */}
        <div className="portrait-frame relative w-full aspect-4/5 overflow-hidden shrink-0">
          {member.image && !photoError ? (
            <Image
              src={member.image}
              alt={member.name}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover portrait-photo group-hover:scale-[1.03] transition-transform duration-1400 ease-out"
              onError={() => setPhotoError(true)}
            />
          ) : (
            // An engraved-initials placeholder reads as paper stock, not a
            // photo — never grayscale/sepia it like a real portrait.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={monogram}
              alt={member.name}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-white/80 to-transparent pointer-events-none" />
          {isFounder && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/jcc_logo.png"
              alt=""
              aria-hidden="true"
              className="id-crest top-2.5 left-2.5 sm:top-3 sm:left-3 w-5 h-5 sm:w-6 sm:h-6 rounded"
            />
          )}
        </div>

        {/* Identity panel */}
        <div className="relative flex-1 flex flex-col items-center text-center px-4 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-5">
          <h3 className="id-card-name font-heading text-lg sm:text-xl font-black uppercase tracking-tight text-jcc-blue leading-tight">
            {member.name}
          </h3>

          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.28em] mt-2 sm:mt-2.5 ${roleColor}`}>
            {member.role}
          </span>

          <div className="flex items-center justify-center gap-2 mt-2 sm:mt-2.5">
            <span className="h-px w-3.5 sm:w-4 bg-jcc-blue/15" />
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.22em] text-jcc-blue/40">
              {member.team}
            </span>
            <span className="h-px w-3.5 sm:w-4 bg-jcc-blue/15" />
          </div>

          {/* Signed & sealed */}
          <div className="mt-auto pt-4 sm:pt-5 w-full">
            <div className="h-px w-full bg-linear-to-r from-transparent via-jcc-blue/12 to-transparent mb-2.5" />
            <div className="flex items-center justify-between text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.15em] text-jcc-blue/30">
              <span>Est. 2026</span>
              <span>No. {memberNo}</span>
              <span>JCC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
