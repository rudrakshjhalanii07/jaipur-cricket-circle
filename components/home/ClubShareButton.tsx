"use client";

// "The Circle, counted" as a story card: the club's own numbers, ready for
// WhatsApp Status or Instagram Stories.

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareSheet } from "@/app/stats/ShareSheet";
import type { ShareCardSpec } from "@/lib/share-card";

export type ClubNumbers = {
  since: string;
  stats: { value: string; label: string }[];
  facts: { value: string; label: string }[];
};

export default function ClubShareButton({ numbers }: { numbers: ClubNumbers }) {
  const [open, setOpen] = useState(false);
  const spec = (): ShareCardSpec => ({
    kicker: `The Circle, counted · since ${numbers.since}`,
    title: "Five friends and a ball, then this.",
    stats: numbers.stats.slice(0, 6),
    facts: numbers.facts.slice(0, 3),
    team: "Jaipur Cricket Circle",
    footer: window.location.host,
  });
  const text = () =>
    `Jaipur Cricket Circle, since ${numbers.since}:\n${numbers.stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(" · ")}\n${window.location.origin}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-jcc-blue/15 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-jcc-blue transition-colors duration-300 hover:border-jcc-blue hover:bg-jcc-blue hover:text-[#FCFBF8]"
      >
        <Share2 size={13} /> Share the numbers
      </button>
      {open && <ShareSheet cards={[{ id: "club", label: "JCC in numbers", spec: spec(), text: text() }]} fileBase="jcc-in-numbers" onClose={() => setOpen(false)} />}
    </>
  );
}
