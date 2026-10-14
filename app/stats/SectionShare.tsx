"use client";

// The share kit for /stats sections: a small "Share" button that opens the
// story-card gallery (ShareSheet) with whatever cards a section builds, plus
// helpers that turn a section's own numbers into cards. Cards follow the
// share-card rules: good news only (see app/stats/share-cards.ts).

import { useContext, useState } from "react";
import { Share2 } from "lucide-react";
import { photoFor } from "@/lib/player-photos";
import type { CardRow, ShareCardSpec } from "@/lib/share-card";
import { teamByName } from "@/lib/teams";
import { PhotoContext } from "./Avatar";
import { ShareSheet, type SheetCard } from "./ShareSheet";

export const JCC_CREST = "/jcc_logo.png";
export const GOLD: [string, string] = ["#F3C96A", "#A97824"];
export const ORANGE: [string, string] = ["#F59E0B", "#EA580C"];
export const PURPLE: [string, string] = ["#A78BFA", "#7C3AED"];
export const GREEN: [string, string] = ["#6EE7B7", "#2E8B57"];
export const BLUE: [string, string] = ["#6E9BE6", "#3B6FC4"];

/** Name → member photo, from the page's photo index. */
export function usePhotoOf() {
  const photos = useContext(PhotoContext);
  return (name: string | null | undefined) => photoFor(photos, name);
}

const footer = () => `${window.location.host}/stats`;
const link = (hash?: string) => `${window.location.origin}/stats${hash ? `#${hash}` : ""}`;

/** One headline number about one player. */
export function statCard(o: {
  id: string;
  label: string;
  kicker: string;
  title: string;
  value: string;
  unit: string;
  colors?: [string, string];
  body?: string;
  facts?: { label: string; value: string }[];
  chips?: string[];
  name: string;
  photo: string | null;
  team?: string | null;
  hash?: string;
}): SheetCard {
  const team = teamByName(o.team ?? null);
  const spec: ShareCardSpec = {
    kicker: o.kicker,
    title: o.title,
    hero: { value: o.value, unit: o.unit, colors: o.colors ?? GOLD },
    body: o.body,
    facts: o.facts,
    chips: o.chips,
    person: { name: o.name, photo: o.photo, color: team?.primary },
    accent: team?.primary,
    teamLogo: team?.logo,
    team: o.team ?? undefined,
    footer: footer(),
  };
  return { id: o.id, label: o.label, spec, text: `${o.title} ${o.value} ${o.unit}\n${link(o.hash)}` };
}

/** A ranked list: a leaderboard, a record table, an XI. */
export function listCard(o: {
  id: string;
  label: string;
  kicker: string;
  title: string;
  body?: string;
  rows: CardRow[];
  /** Most rows to show (default 6). */
  max?: number;
  facts?: { label: string; value: string }[];
  chips?: string[];
  team?: string | null;
  hash?: string;
}): SheetCard {
  const team = teamByName(o.team ?? null);
  const lead = o.rows[0];
  // Story cards stay readable at six rows; an XI asks for all eleven.
  const rows = o.rows.slice(0, o.max ?? 6);
  // The No. 1's photo leads a player list.
  const feature = lead && !lead.logo && !lead.plain && lead.photo ? { name: lead.name, photo: lead.photo, color: lead.color } : null;
  const spec: ShareCardSpec = {
    kicker: o.kicker,
    title: o.title,
    body: o.body,
    person: feature,
    // No face to lead with: the top team's crest, or the club's.
    emblem: feature ? undefined : lead?.logo && lead.photo ? lead.photo : JCC_CREST,
    list: rows,
    facts: o.facts,
    chips: o.chips,
    accent: team?.primary,
    teamLogo: team?.logo,
    team: o.team ?? "Jaipur Cricket Circle",
    byline: o.team ?? "JCC Stats",
    footer: footer(),
  };
  const lines = o.rows.slice(0, 5).map((r, i) => `${i + 1}. ${r.name} ${r.value}`);
  return { id: o.id, label: o.label, spec, text: `${o.title}\n${lines.join("\n")}\n${link(o.hash)}` };
}

/** A player row for listCard, with photo and team colour. */
export function playerRow(name: string, value: string, note: string | undefined, photo: string | null, team?: string | null): CardRow {
  return { name, value, note, photo, color: teamByName(team ?? null)?.primary };
}

/** A team row for listCard, with its crest. */
export function teamRow(name: string, value: string, note?: string): CardRow {
  const team = teamByName(name);
  return { name, value, note, photo: team?.logo ?? null, logo: true, color: team?.primary };
}

/** "Share" for a section: builds its cards when tapped, then opens the gallery. */
export function SectionShare({ build, fileBase, label = "Share", dark, className = "" }: { build: () => SheetCard[]; fileBase: string; label?: string; dark?: boolean; className?: string }) {
  const [cards, setCards] = useState<SheetCard[] | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Buttons can sit inside a link-wrapped card: share, don't navigate.
          e.preventDefault();
          e.stopPropagation();
          const built = build().filter((c) => c);
          if (built.length) setCards(built);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 ${
          dark ? "border-[#FCFBF8]/25 text-[#FCFBF8]/85 hover:border-jcc-accent hover:text-jcc-accent" : "border-jcc-blue/15 text-jcc-blue/80 hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8]"
        } ${className}`}
      >
        <Share2 size={12} /> {label}
      </button>
      {cards && <ShareSheet cards={cards} fileBase={fileBase} onClose={() => setCards(null)} />}
    </>
  );
}
