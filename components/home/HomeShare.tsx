"use client";

// Story cards for the home page's headline numbers: the Orange and Purple
// Caps, and the top-five races. Same gallery and card kit as /stats.

import { ORANGE, PURPLE, SectionShare, listCard, playerRow, statCard } from "@/app/stats/SectionShare";
import type { IntelBoardRow, IntelCap } from "@/lib/home-intel.server";

/** "SR 156.6 · HS 54* · 14 inns" → facts row. */
const factsOf = (detail: string) =>
  detail.split(" · ").slice(0, 3).map((part) => {
    const m = part.match(/^(\D+?)\s+(\S+)$/) ?? part.match(/^(\S+)\s+(\D+)$/);
    if (!m) return { label: "", value: part };
    // "SR 156.6" → SR / 156.6 ; "14 inns" → inns / 14
    return /^\d/.test(m[1]) ? { label: m[2], value: m[1] } : { label: m[1], value: m[2] };
  });

const capCard = (cap: IntelCap, kind: "orange" | "purple", season: string) =>
  statCard({
    id: kind,
    label: kind === "orange" ? "Orange Cap" : "Purple Cap",
    kicker: `${kind === "orange" ? "Orange Cap" : "Purple Cap"} · ${season}`,
    title: kind === "orange" ? `${cap.name} leads the run charts` : `${cap.name} leads the wicket charts`,
    value: String(cap.value),
    unit: cap.unit,
    colors: kind === "orange" ? ORANGE : PURPLE,
    facts: factsOf(cap.detail),
    name: cap.name,
    photo: cap.photo,
    team: cap.team,
    hash: "leaders",
  });

export function CapsShare({ orange, purple, season, dark }: { orange: IntelCap | null; purple: IntelCap | null; season: string; dark?: boolean }) {
  return (
    <SectionShare
      build={() => [orange && capCard(orange, "orange", season), purple && capCard(purple, "purple", season)].filter((c): c is NonNullable<typeof c> => !!c)}
      fileBase="jcc-caps"
      label="Share the caps"
      dark={dark}
    />
  );
}

export function TopFiveShare({ title, rows, kind, season }: { title: string; rows: IntelBoardRow[]; unit: string; kind: "orange" | "purple"; season: string }) {
  return (
    <SectionShare
      build={() => [
        listCard({
          id: kind,
          label: title,
          kicker: `${kind === "orange" ? "Orange" : "Purple"} Cap race · ${season}`,
          title: kind === "orange" ? "Most runs" : "Most wickets",
          rows: rows.map((r) => playerRow(r.name, `${r.value}`, r.sub, r.photo, r.team)),
          hash: "leaderboards",
        }),
      ]}
      fileBase={`jcc-${kind}-cap-race`}
    />
  );
}
