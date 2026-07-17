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
  const hasPhoto = !!member.image && !photoError;

  return (
    <div className="group h-full max-w-77.5 sm:max-w-80 mx-auto w-full transition-transform duration-500 ease-out hover:-translate-y-1.5 will-change-transform">
      <div
        onClick={onClick}
        className={`id-card${cardTier} relative flex flex-col h-full cursor-pointer select-none`}
      >
        {/* Portrait fills the whole card; identity details reveal on hover */}
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
          {isFounder && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/jcc_logo.png"
              alt=""
              aria-hidden="true"
              className="id-crest top-2.5 left-2.5 sm:top-3 sm:left-3 w-5 h-5 sm:w-6 sm:h-6 rounded z-10"
            />
          )}
        </div>

        {/* Identity overlay — a sibling of .portrait-frame (not a child), so
            it sits in .id-card's own isolated stacking context rather than
            the one .portrait-frame uses for its blue multiply wash (::after).
            Nesting it inside .portrait-frame let that blend mute the text to
            an unreadable navy in some browsers even with a higher z-index. */}
        <div className={`absolute inset-x-0 bottom-0 z-20 bg-linear-to-t pt-14 pb-4 px-4 sm:px-5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-300 ease-out ${hasPhoto ? "from-black/70 via-black/40 to-transparent" : "from-[rgba(255,255,255,0.95)] via-[rgba(255,255,255,0.7)] to-transparent"}`}>
          <h3
            className={`font-heading text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight text-center ${hasPhoto ? "text-[#ffffff] drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" : "text-jcc-blue"}`}
          >
            {member.name}
          </h3>

          <span
            className={`block text-center text-[10px] sm:text-[11px] font-black uppercase tracking-[0.28em] mt-2 ${
              isFounder || isCaptain ? "text-jcc-accent" : hasPhoto ? "text-[rgba(255,255,255,0.9)]" : "text-jcc-blue/60"
            }`}
          >
            {member.role}
          </span>

          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`h-px w-3.5 sm:w-4 ${hasPhoto ? "bg-[rgba(255,255,255,0.4)]" : "bg-jcc-blue/15"}`} />
            <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] ${hasPhoto ? "text-[rgba(255,255,255,0.75)]" : "text-jcc-blue/40"}`}>
              {member.team}
            </span>
            <span className={`h-px w-3.5 sm:w-4 ${hasPhoto ? "bg-[rgba(255,255,255,0.4)]" : "bg-jcc-blue/15"}`} />
          </div>

          <div className={`flex items-center justify-between text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] mt-3 pt-2 ${hasPhoto ? "text-[rgba(255,255,255,0.5)] border-t border-[rgba(255,255,255,0.2)]" : "text-jcc-blue/30 border-t border-jcc-blue/15"}`}>
            <span>Est. 2026</span>
            <span>No. {memberNo}</span>
            <span>JCC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
