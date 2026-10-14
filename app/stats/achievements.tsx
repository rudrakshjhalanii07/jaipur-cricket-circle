"use client";

import { createElement, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Anchor,
  Award,
  BadgeCheck,
  Banknote,
  Bomb,
  BrickWall,
  CalendarCheck,
  CircleSlash,
  Clover,
  Coins,
  Crosshair,
  Crown,
  Egg,
  Flag,
  Flame,
  Footprints,
  Frown,
  Gauge,
  Gem,
  Hand,
  Handshake,
  Hourglass,
  Infinity,
  Medal,
  Moon,
  Mountain,
  Percent,
  Repeat,
  Rocket,
  Ruler,
  Scale,
  Shield,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  Sunrise,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Turtle,
  Wind,
  Zap,
  Lock,
  X,
  type LucideIcon,
} from "lucide-react";
import { BADGE_CATALOG, plural, type Badge, type BadgeTone } from "@/lib/scorecard-dashboard/profile";
import { Avatar } from "./Avatar";
import { usePill } from "./motion";
import { SectionShare, listCard, playerRow, usePhotoOf } from "./SectionShare";

const TIER_NAME: Record<Tier, string> = { legendary: "Legendary", epic: "Epic", rare: "Rare", common: "Common", banter: "Banter", locked: "Locked" };
import { teamByName } from "@/lib/teams";

// ─── Rarity ──────────────────────────────────────────────────────────────────
// Crowns are one-of-a-kind; the rest are graded by how many players hold them.
// Banter badges (the "warn" tone) get their own look, whatever their count.

export type Tier = "legendary" | "epic" | "rare" | "common" | "banter" | "locked";

export function tierOf(tone: BadgeTone, holders: number): Tier {
  if (!holders) return "locked";
  if (tone === "warn") return "banter";
  if (tone === "crown") return "legendary";
  if (holders <= 3) return "epic";
  if (holders <= 7) return "rare";
  return "common";
}

const TIER: Record<Tier, { label: string; ring: [string, string, string]; core: string; icon: string; chip: string; glow: string }> = {
  legendary: { label: "Legendary", ring: ["#FBE7A6", "#D4AF37", "#8E6417"], core: "#12233F", icon: "#F3C96A", chip: "bg-jcc-accent text-jcc-seam", glow: "rgba(212,175,55,.55)" },
  epic: { label: "Epic", ring: ["#F4F5F7", "#B8BFCB", "#6E7787"], core: "#12233F", icon: "#E9ECF1", chip: "bg-[#B8BFCB] text-jcc-seam", glow: "rgba(184,191,203,.45)" },
  rare: { label: "Rare", ring: ["#F1C99A", "#B07A3F", "#6B4520"], core: "#1B1A1F", icon: "#F1C99A", chip: "bg-[#B07A3F] text-[#FCFBF8]", glow: "rgba(176,122,63,.4)" },
  common: { label: "Common", ring: ["#E4E7EC", "#8A94A6", "#4F5868"], core: "#202A3B", icon: "#D0D5DD", chip: "bg-[#8A94A6] text-[#FCFBF8]", glow: "rgba(93,102,119,.3)" },
  banter: { label: "Banter", ring: ["#F2C7BF", "#B0473F", "#6E2620"], core: "#2A1412", icon: "#F2C7BF", chip: "bg-jcc-danger text-[#FCFBF8]", glow: "rgba(176,71,63,.35)" },
  locked: { label: "Locked", ring: ["#EAECF0", "#D0D5DD", "#B5BCC8"], core: "#F2F4F7", icon: "#98A2B3", chip: "bg-jcc-navy-light text-jcc-text-muted", glow: "transparent" },
};

type Category = "all" | BadgeTone | "captain";
const CATEGORY: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "crown", label: "Crowns" },
  { key: "bat", label: "Batting" },
  { key: "ball", label: "Bowling" },
  { key: "field", label: "Fielding" },
  { key: "team", label: "Team" },
  { key: "captain", label: "Captaincy" },
  { key: "warn", label: "Banter" },
];

/** Captaincy and toss badges (from the Captains tab's records, app/stats/captains.ts). */
export const CAPTAIN_CATALOG: { label: string; tone: BadgeTone; icon: string; rule: string }[] = [
  { label: "Skipper Supreme", tone: "crown", icon: "Crown", rule: "Most wins as captain (min 4 matches)." },
  { label: "Winning Habit", tone: "team", icon: "Shield", rule: "Best win rate as captain (min 6 matches)." },
  { label: "Chase Captain", tone: "team", icon: "Target", rule: "Best record chasing as captain (min 3 chases)." },
  { label: "Fortress Captain", tone: "team", icon: "ShieldCheck", rule: "Best record defending as captain (min 3)." },
  { label: "Toss King", tone: "crown", icon: "Coins", rule: "Most tosses won." },
  { label: "Coin Whisperer", tone: "team", icon: "Percent", rule: "Best toss-win rate (min 4 tosses)." },
  { label: "Toss Converter", tone: "team", icon: "Trophy", rule: "Best win rate after winning the toss (min 3)." },
  { label: "Toss Jinx", tone: "warn", icon: "Frown", rule: "Most tosses lost." },
];
const CAPTAIN_LABELS = new Set(CAPTAIN_CATALOG.map((b) => b.label));
const inCategory = (b: { label: string; tone: BadgeTone }, cat: Category) =>
  cat === "all" || (cat === "captain" ? CAPTAIN_LABELS.has(b.label) : b.tone === cat && !(CAPTAIN_LABELS.has(b.label) && cat !== "warn"));

const ICONS: Record<string, LucideIcon> = { Anchor, Award, BadgeCheck, Banknote, Bomb, BrickWall, CalendarCheck, CircleSlash, Clover, Coins, Crosshair, Crown, Egg, Flag, Flame, Footprints, Frown, Gauge, Gem, Hand, Handshake, Hourglass, Infinity, Medal, Moon, Mountain, Percent, Repeat, Rocket, Ruler, Scale, Shield, ShieldCheck, Snowflake, Sparkles, Star, Sunrise, Swords, Target, TrendingUp, Trophy, Turtle, Wind, Zap };
const iconFor = (name: string) => ICONS[name] ?? Award;
const catalogEntry = (label: string) => BADGE_CATALOG.find((b) => b.label === label) ?? CAPTAIN_CATALOG.find((b) => b.label === label);

// ─── Emblem ──────────────────────────────────────────────────────────────────

/**
 * The emblem as a standalone SVG image (data URL), for story cards: same
 * hexagon, metal and icon as <Emblem>, drawn without CSS so a canvas can paint it.
 */
export function emblemImage(label: string, tone: BadgeTone, tier: Tier): string {
  const t = TIER[tier];
  const icon = tier === "locked" ? Lock : iconFor(catalogEntry(label)?.icon ?? "Award");
  const hex = (r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    }).join(" ");
  const glyph = renderToStaticMarkup(createElement(icon, { x: 32, y: 32, width: 36, height: 36, color: t.icon, strokeWidth: 2.1 }));
  const crown = tone === "crown" && tier !== "locked" ? `<g fill="${t.ring[0]}"><circle cx="50" cy="6" r="2.4"/><circle cx="88" cy="28" r="1.8"/><circle cx="12" cy="28" r="1.8"/></g>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="600" height="600"><defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.ring[0]}"/><stop offset=".5" stop-color="${t.ring[1]}"/><stop offset="1" stop-color="${t.ring[2]}"/></linearGradient></defs><polygon points="${hex(48)}" fill="url(#r)"/><polygon points="${hex(40)}" fill="${t.core}"/><polygon points="${hex(40)}" fill="none" stroke="${t.ring[0]}" stroke-opacity=".35" stroke-width="1.2"/>${crown}${glyph}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Story-card sunburst: each badge in a colour its name suggests (bright top,
 * deeper below). Anything unlisted falls back to its family's colour.
 */
const BADGE_COLORS: Record<string, [string, string]> = {
  // Crowns
  "Orange Cap": ["#FB923C", "#C2410C"],
  "Purple Cap": ["#C084FC", "#6B21A8"],
  "Six Machine": ["#F87171", "#B91C1C"],
  "Boundary King": ["#FCD34D", "#B45309"],
  "Fastest Scorer": ["#FDE047", "#CA8A04"],
  "Most Economical": ["#5EEAD4", "#0F766E"],
  "Dot-Ball Monster": ["#7DD3FC", "#0369A1"],
  "Death-Over King": ["#818CF8", "#312E81"],
  "Powerplay Striker": ["#FDBA74", "#DB2777"],
  "Gold Glove": ["#FDE68A", "#A16207"],
  "Man of the Moment": ["#F9A8D4", "#BE185D"],
  // Batting
  "Power Hitter": ["#FB7185", "#9F1239"],
  "Strike-Rate Beast": ["#FDBA74", "#DC2626"],
  "Mr Consistent": ["#93C5FD", "#1E40AF"],
  "Anchor": ["#67E8F9", "#155E75"],
  "Finisher": ["#A3E635", "#3F6212"],
  "Strike Rotator": ["#5EEAD4", "#0E7490"],
  "Boundary or Bust": ["#FCA5A5", "#B91C1C"],
  "Hard to Bowl": ["#CBD5E1", "#475569"],
  "Chase Master": ["#6EE7B7", "#047857"],
  "Total Builder": ["#D6D3D1", "#57534E"],
  "Top-Order Rock": ["#C4B5FD", "#5B21B6"],
  "Big Scorer": ["#FDE047", "#B45309"],
  // Bowling
  "Strike Bowler": ["#F87171", "#991B1B"],
  "Run-Stopper": ["#7DD3FC", "#075985"],
  "Dependable Bowler": ["#93C5FD", "#1E3A8A"],
  "Pressure Builder": ["#F0ABFC", "#86198F"],
  "Line & Length": ["#A5B4FC", "#3730A3"],
  "Holding Bowler": ["#99F6E4", "#115E59"],
  "Stump Hunter": ["#FCA5A5", "#7F1D1D"],
  "Death-Over Specialist": ["#A78BFA", "#3B0764"],
  "New-Ball Threat": ["#FDE68A", "#EA580C"],
  "Duck Maker": ["#FEF08A", "#CA8A04"],
  "Multi-Wicket Man": ["#E879F9", "#7E22CE"],
  "Maiden Maker": ["#E2E8F0", "#64748B"],
  // Fielding
  "Gloveman": ["#FCD34D", "#92400E"],
  "Run-Out Specialist": ["#FCA5A5", "#DC2626"],
  "Safe Hands": ["#86EFAC", "#15803D"],
  // Team
  "Genuine All-Rounder": ["#C4B5FD", "#4338CA"],
  "Ever-Present": ["#6EE7B7", "#065F46"],
  "Lucky Charm": ["#4ADE80", "#166534"],
  "Two-Season Regular": ["#93C5FD", "#1D4ED8"],
  "Match Winner": ["#FCD34D", "#C2410C"],
  // Captaincy
  "Skipper Supreme": ["#FDE68A", "#B45309"],
  "Winning Habit": ["#93C5FD", "#1E40AF"],
  "Chase Captain": ["#67E8F9", "#0E7490"],
  "Fortress Captain": ["#CBD5E1", "#334155"],
  "Toss King": ["#FDE047", "#A16207"],
  "Coin Whisperer": ["#C4B5FD", "#6D28D9"],
  "Toss Converter": ["#86EFAC", "#15803D"],
};

export function burstFor(tone: BadgeTone, label?: string): [string, string] {
  if (label && BADGE_COLORS[label]) return BADGE_COLORS[label];
  switch (tone) {
    case "crown": return ["#FBBF24", "#B45309"];
    case "bat": return ["#FB923C", "#C2410C"];
    case "ball": return ["#A78BFA", "#6D28D9"];
    case "field": return ["#34D399", "#047857"];
    default: return ["#60A5FA", "#1D4ED8"];
  }
}

/** The emblem's metal colour, for the card's glow. */
export const tierColor = (tier: Tier) => TIER[tier].ring[1];

/** A hexagonal medal: graded metal ring, dark core, icon. */
export function Emblem({ label, tone, tier, size = 72, icon: given }: { label: string; tone: BadgeTone; tier: Tier; size?: number; icon?: LucideIcon }) {
  const t = TIER[tier];
  const icon = tier === "locked" ? Lock : given ?? iconFor(catalogEntry(label)?.icon ?? "Award");
  const id = `emb-${tier}`;
  const hex = (r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    }).join(" ");
  return (
    <span
      className={`ach-emblem relative inline-grid shrink-0 place-items-center ${tier === "legendary" ? "ach-legendary" : ""}`}
      style={{ width: size, height: size, filter: tier === "locked" ? undefined : `drop-shadow(0 6px 14px ${t.glow})` }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={t.ring[0]} />
            <stop offset=".5" stopColor={t.ring[1]} />
            <stop offset="1" stopColor={t.ring[2]} />
          </linearGradient>
        </defs>
        <polygon points={hex(48)} fill={`url(#${id})`} />
        <polygon points={hex(40)} fill={t.core} />
        <polygon points={hex(40)} fill="none" stroke={t.ring[0]} strokeOpacity=".35" strokeWidth="1.2" />
        {tone === "crown" && tier !== "locked" && (
          <g fill={t.ring[0]}>
            <circle cx="50" cy="6" r="2.4" />
            <circle cx="88" cy="28" r="1.8" />
            <circle cx="12" cy="28" r="1.8" />
          </g>
        )}
      </svg>
      {createElement(icon, { className: "relative", style: { width: size * 0.36, height: size * 0.36, color: t.icon }, strokeWidth: 2.1 })}
    </span>
  );
}

export function TierChip({ tier }: { tier: Tier }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] ${TIER[tier].chip}`}>
      {TIER[tier].label}
    </span>
  );
}

/** Shine and entrance animations, shared by the tab and the player deck. */
export function AchievementStyles() {
  return (
    <style>{`
      @keyframes ach-shine { 0%,70% { transform: translateX(-130%) rotate(20deg); } 100% { transform: translateX(130%) rotate(20deg); } }
      @keyframes ach-pop { from { transform: translateY(6px) scale(.97); opacity: .4; } to { transform: none; opacity: 1; } }
      .ach-legendary { overflow: hidden; clip-path: polygon(50% 2%, 92% 26%, 92% 74%, 50% 98%, 8% 74%, 8% 26%); }
      .ach-legendary::after { content: ""; position: absolute; inset: -20%; background: linear-gradient(90deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%); animation: ach-shine 3.6s ease-in-out infinite; }
      .ach-tile { animation: ach-pop .35s ease-out both; }
      @keyframes ach-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
      .ach-rays { animation: ach-spin 40s linear infinite; }
      @media (prefers-reduced-motion: reduce) { .ach-legendary::after, .ach-tile, .ach-rays { animation: none; } }
    `}</style>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

type Holder = { p: number; team: string; why: string };
type Row = { p: number; team: string; role: string; badges: Badge[] };

const LABEL = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-jcc-text-muted";
const teamColor = (t: string) => teamByName(t)?.primary ?? "#8A94A6";

function Holders({ holders, names }: { holders: Holder[]; names: string[] }) {
  const shown = holders.slice(0, 5);
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex -space-x-2.5">
        {shown.map((h) => (
          <span key={h.p} title={names[h.p]} className="flex shrink-0 rounded-full ring-2 ring-jcc-navy-deep">
            <Avatar name={names[h.p]} size={26} />
          </span>
        ))}
      </div>
      <span className="font-mono text-[10.5px] text-jcc-text-muted">
        {holders.length === 1 ? names[holders[0].p] : `${holders.length} players`}
      </span>
    </div>
  );
}

/** Badges that only exist when more than one season is in view. */
const MULTI_SEASON_ONLY = new Set(["Two-Season Regular"]);

export default function AchievementsTab({ rows: baseRows, names, players, onOpenPlayer, multiSeason = true, captainBadges = [] }: { rows: Row[]; names: string[]; players: number; onOpenPlayer: (p: number, card?: string) => void; multiSeason?: boolean; captainBadges?: { p: number; team: string; label: string; tone: BadgeTone; why: string }[] }) {
  // A one-season view can't award a two-season badge: leave it out rather than show it locked.
  const base = multiSeason ? BADGE_CATALOG : BADGE_CATALOG.filter((b) => !MULTI_SEASON_ONLY.has(b.label));
  const CATALOG = captainBadges.length ? [...base, ...CAPTAIN_CATALOG] : base;
  // Captaincy badges join each holder's shelf.
  const rows = useMemo(() => {
    if (!captainBadges.length) return baseRows;
    const out = new Map(baseRows.map((r) => [r.p, { ...r, badges: [...r.badges] }]));
    for (const c of captainBadges) {
      const r = out.get(c.p) ?? out.set(c.p, { p: c.p, team: c.team, role: "", badges: [] }).get(c.p)!;
      r.badges.push({ label: c.label, tone: c.tone, why: c.why });
    }
    return [...out.values()];
  }, [baseRows, captainBadges]);
  const [view, setView] = useState<"badges" | "cabinets">("badges");
  const [cat, setCat] = useState<Category>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { box: viewBox, pill: viewPill } = usePill(view);
  const { box: catBox, pill: catPill } = usePill(`${view}|${cat}`, "line");

  const holders = useMemo(() => {
    const m = new Map<string, Holder[]>();
    for (const r of rows) for (const b of r.badges) (m.get(b.label) ?? m.set(b.label, []).get(b.label)!).push({ p: r.p, team: r.team, why: b.why });
    return m;
  }, [rows]);

  const order: Tier[] = ["legendary", "epic", "rare", "common", "banter", "locked"];
  const badges = CATALOG.map((b) => {
    const hs = holders.get(b.label) ?? [];
    return { ...b, holders: hs, tier: tierOf(b.tone, hs.length) };
  })
    .filter((b) => inCategory(b, cat))
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.holders.length - b.holders.length);
  const byTier = order.map((tier) => ({ tier, items: badges.filter((b) => b.tier === tier) })).filter((g) => g.items.length);

  const unlocked = CATALOG.filter((b) => holders.get(b.label)?.length).length;
  const total = rows.reduce((s, r) => s + r.badges.filter((b) => b.tone !== "warn").length, 0);
  const counts = Object.fromEntries(CATEGORY.map((c) => [c.key, CATALOG.filter((b) => inCategory(b, c.key)).length]));
  const selected = open ? badges.find((b) => b.label === open) ?? null : null;

  const cabinets = [...rows]
    .map((r) => ({ ...r, earned: r.badges.filter((b) => b.tone !== "warn"), banter: r.badges.filter((b) => b.tone === "warn") }))
    .sort((a, b) => b.earned.length - a.earned.length || b.earned.filter((x) => x.tone === "crown").length - a.earned.filter((x) => x.tone === "crown").length);

  // Story cards: the most decorated, then every earned badge, rarest first.
  // Banter ("warn") badges never make a card.
  const photoOf = usePhotoOf();
  const share = () => {
    const earned = CATALOG.filter((b) => b.tone !== "warn")
      .map((b) => ({ ...b, holders: holders.get(b.label) ?? [] }))
      .filter((b) => b.holders.length)
      .map((b) => ({ ...b, tier: tierOf(b.tone, b.holders.length) }))
      .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.holders.length - b.holders.length);
    return [
      listCard({
        id: "decorated",
        label: "Most decorated",
        kicker: "Hall of Badges",
        title: "The most decorated players",
        rows: cabinets.slice(0, 6).map((c) => playerRow(names[c.p], String(c.earned.length), c.earned.slice(0, 3).map((b) => b.label).join(" · "), photoOf(names[c.p]), c.team)),
        facts: [{ label: "Badges unlocked", value: `${unlocked}/${CATALOG.length}` }, { label: "Earned", value: String(total) }, { label: "Players", value: `${rows.length}/${players}` }],
        hash: "analytics",
      }),
      ...earned.map(badgeCard),
    ].filter((c) => c.spec.list?.length);
  };
  /** One player's trophy cabinet: their photo up top, every badge with its emblem. */
  const cabinetCard = (p: number, team: string, shelf: Badge[]) => {
    const c = listCard({
      id: `cabinet-${p}`,
      label: names[p],
      kicker: `Trophy cabinet · ${plural(shelf.length, "badge")}`,
      title: names[p],
      rows: shelf.slice(0, 6).map((b) => {
        const n = holders.get(b.label)?.length ?? 1;
        return { name: b.label, value: n === 1 ? "Only one" : `1 of ${n}`, note: b.why, photo: emblemImage(b.label, b.tone, tierOf(b.tone, n)), logo: true };
      }),
      hash: "analytics",
    });
    c.spec = { ...c.spec, person: { name: names[p], photo: photoOf(names[p]) }, emblem: undefined, byline: names[p], team };
    c.text = `${names[p]}'s trophy cabinet: ${shelf.map((b) => b.label).join(", ")}\n${window.location.origin}/stats#analytics`;
    return c;
  };
  /** A badge and everyone who holds it: the emblem leads. */
  const badgeCard = (b: { label: string; rule: string; tier: Tier; tone: BadgeTone; holders: Holder[] }) => {
    const c = listCard({
      id: `badge-${b.label}`,
      label: b.label,
      kicker: `${TIER_NAME[b.tier]} badge · ${b.holders.length === 1 ? "one holder" : `${b.holders.length} holders`}`,
      title: b.label,
      body: b.rule,
      rows: b.holders.slice(0, 5).map((h) => playerRow(names[h.p], "", h.why, photoOf(names[h.p]), h.team)),
      hash: "analytics",
    });
    c.spec = { ...c.spec, person: null, emblem: emblemImage(b.label, b.tone, b.tier), burst: burstFor(b.tone, b.label), accent: burstFor(b.tone, b.label)[1] };
    return c;
  };
  /** The badge's card first, then one per holder: the emblem big, the holder under it. */
  const badgeCards = (b: { label: string; rule: string; tier: Tier; tone: BadgeTone; holders: Holder[] }) => [
    badgeCard(b),
    ...b.holders.map((h) => {
      const c = listCard({ id: `holder-${h.p}`, label: names[h.p], kicker: "", title: "", rows: [], hash: "analytics" });
      c.spec = {
        ...c.spec,
        kicker: `${b.label} · ${TIER_NAME[b.tier]} badge`,
        title: names[h.p],
        body: h.why,
        list: undefined,
        person: { name: names[h.p], photo: photoOf(names[h.p]) },
        emblem: emblemImage(b.label, b.tone, b.tier),
        burst: burstFor(b.tone, b.label),
        accent: burstFor(b.tone, b.label)[1],
        facts: [
          { label: "Badge", value: b.label },
          { label: "Tier", value: TIER_NAME[b.tier] },
          { label: "Holders", value: b.holders.length === 1 ? "Only one" : `1 of ${b.holders.length}` },
        ],
        byline: names[h.p],
        team: h.team,
      };
      c.text = `${names[h.p]} unlocked ${b.label}: ${h.why}\n${window.location.origin}/stats#analytics`;
      return c;
    }),
  ];

  return (
    <div data-apanel>
      <AchievementStyles />

      {/* ── Spread ── */}
      <div className="grid items-end gap-10 border-y border-jcc-blue/80 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex items-center gap-6">
          <Emblem label="Orange Cap" tone="crown" tier="legendary" size={112} />
          <div>
            <p className={LABEL}>Achievements</p>
            <h3 className="mt-2 font-heading text-5xl font-bold leading-[0.92] tracking-[-0.045em] text-white md:text-6xl">Hall of Badges</h3>
            <SectionShare build={share} fileBase="jcc-achievements" className="mt-4" />
          </div>
        </div>
        <div>
          <dl className="grid grid-cols-3 gap-6">
            {([
              [`${unlocked}`, `/${CATALOG.length}`, "Badges unlocked"],
              [`${total}`, "", "Achievements earned"],
              [`${rows.length}`, `/${players}`, "Players decorated"],
            ] as const).map(([v, of, l]) => (
              <div key={l}>
                <dd className="font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums text-white">
                  {v}
                  <span className="text-2xl text-jcc-text-muted">{of}</span>
                </dd>
                <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-jcc-text-muted">{l}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-jcc-navy-light">
            <div data-bar className="h-full rounded-full bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-jcc-accent-highlight" style={{ width: `${(100 * unlocked) / CATALOG.length}%` }} />
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-b border-jcc-border">
        <div ref={catBox} className={`no-scrollbar relative flex gap-6 overflow-x-auto ${view === "badges" ? "" : "invisible"}`}>
          {CATEGORY.map((c) => (
            <button
              key={c.key}
              data-active={view === "badges" && cat === c.key}
              onClick={() => setCat(c.key)}
              className={`relative whitespace-nowrap pb-4 text-[14px] font-semibold tracking-tight transition-colors duration-300 ${cat === c.key ? "text-white" : "text-jcc-text-muted hover:text-white"}`}
            >
              {c.label} <span className="font-mono text-[10px] opacity-50">{counts[c.key]}</span>
            </button>
          ))}
          <span ref={catPill} aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-jcc-accent" style={{ opacity: 0 }} />
        </div>
        <div ref={viewBox} className="relative mb-3 inline-flex rounded-full bg-jcc-navy p-1 shadow-[0_10px_30px_-20px_rgba(18,35,63,0.5)]">
          <span ref={viewPill} aria-hidden className="pointer-events-none absolute left-0 top-0 rounded-full bg-jcc-blue" style={{ opacity: 0 }} />
          {(["badges", "cabinets"] as const).map((v) => (
            <button
              key={v}
              data-active={view === v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`relative z-10 rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight transition-colors duration-300 ${view === v ? "text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
            >
              {v === "badges" ? "Badges" : "Trophy cabinets"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Badges, shelved by tier ── */}
      {view === "badges" && (
        <div className="mt-4">
          {byTier.map((g) => (
            <section key={g.tier} className="grid gap-6 border-b border-jcc-border py-10 last:border-b-0 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <TierChip tier={g.tier} />
                <div className="mt-3 font-heading text-4xl font-bold tracking-[-0.04em] text-white">{g.items.length}</div>
                <div className={LABEL}>{g.tier === "locked" ? "still to unlock" : g.items.length === 1 ? "badge" : "badges"}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
                {g.items.map((b, i) => {
                  const locked = b.tier === "locked";
                  return (
                    <div key={b.label} className="ach-tile flex flex-col items-center" style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
                    <button
                      onClick={() => !locked && setOpen(b.label)}
                      className={`group flex flex-col items-center text-center ${locked ? "cursor-default" : ""}`}
                    >
                      <span className={`transition duration-500 ${locked ? "opacity-60 grayscale" : "group-hover:-translate-y-1.5 group-hover:rotate-6 group-hover:scale-105"}`}>
                        <Emblem label={b.label} tone={b.tone} tier={b.tier} size={88} />
                      </span>
                      <span aria-hidden className={`mt-3 h-px w-16 transition-all duration-500 ${locked ? "bg-jcc-border" : "bg-jcc-accent/50 group-hover:w-24"}`} />
                      <div className={`mt-3 font-heading text-lg font-bold leading-tight tracking-tight ${locked ? "text-jcc-text-muted" : "text-white"}`}>{b.label}</div>
                      <p className="mt-1 min-h-[2.6em] max-w-[220px] text-[12px] leading-snug text-jcc-text-muted">{b.rule}</p>
                      <div className="mt-3 min-h-7">{locked ? <span className="font-mono text-[10.5px] text-jcc-text-muted">Not unlocked yet</span> : <Holders holders={b.holders} names={names} />}</div>
                    </button>
                    {!locked && b.tone !== "warn" && (
                      <SectionShare build={() => badgeCards(b)} fileBase={`jcc-badge-${b.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="mt-3" />
                    )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Trophy cabinets: one shelf per player ── */}
      {view === "cabinets" && (
        <ol className="mt-8 grid gap-5 lg:grid-cols-2">
          {cabinets.map((r, i) => {
            const medal = i === 0 ? ["#FBE7A6", "#D4AF37"] : i === 1 ? ["#F4F5F7", "#9AA3B2"] : i === 2 ? ["#F1C99A", "#B07A3F"] : null;
            const shelf = [...r.earned].sort((a, b) => Number(b.tone === "crown") - Number(a.tone === "crown") || (holders.get(a.label)?.length ?? 1) - (holders.get(b.label)?.length ?? 1));
            const color = teamColor(r.team);
            return (
              <li key={r.p} className="ach-tile" style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
                <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-jcc-blue/10 bg-jcc-navy shadow-[0_24px_50px_-36px_rgba(18,35,63,0.5)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(18,35,63,0.55)]">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: medal ? `linear-gradient(90deg, ${medal[0]}, ${medal[1]})` : color }} />
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[70px]" style={{ background: `${medal?.[1] ?? color}33` }} />

                  {/* Who */}
                  <button onClick={() => onOpenPlayer(r.p, "labels")} className="group relative flex items-center gap-4 px-5 pb-4 pt-6 text-left md:px-6">
                    <span className="relative">
                      <span className="block rounded-full p-[3px]" style={{ background: medal ? `linear-gradient(135deg, ${medal[0]}, ${medal[1]})` : color }}>
                        <Avatar name={names[r.p]} size={64} className="ring-2 ring-jcc-navy transition-transform duration-500 group-hover:scale-105" />
                      </span>
                      <span className="absolute -left-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-jcc-blue font-mono text-[11px] font-bold text-[#FCFBF8] ring-2 ring-jcc-navy">{i + 1}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-2xl font-bold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[r.p]}</span>
                      <span className="block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-jcc-text-muted">{r.team}{r.role ? ` · ${r.role}` : ""}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-heading text-5xl font-bold leading-none tracking-[-0.05em] tabular-nums" style={medal ? { backgroundImage: `linear-gradient(135deg, ${medal[0]}, ${medal[1]})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: "var(--color-jcc-blue)" }}>
                        {r.earned.length}
                      </span>
                      <span className={LABEL}>badges</span>
                    </span>
                  </button>

                  {/* The shelf: a dark cabinet, crowns first */}
                  <div className="relative mx-5 rounded-2xl bg-gradient-to-b from-jcc-blue to-[#0D1728] px-4 pb-3 pt-4 md:mx-6">
                    <div className="flex flex-wrap gap-2">
                      {shelf.map((b) => (
                        <button key={b.label} type="button" title={`${b.label}: ${b.why}`} onClick={() => setOpen(b.label)} className="transition-transform duration-300 hover:-translate-y-1 hover:scale-110">
                          <Emblem label={b.label} tone={b.tone} tier={tierOf(b.tone, holders.get(b.label)?.length ?? 1)} size={44} />
                        </button>
                      ))}
                      {shelf.length === 0 && <span className="py-3 text-[12px] text-[#FCFBF8]/60">Nothing on the shelf yet.</span>}
                    </div>
                    <span aria-hidden className="mt-3 block h-[3px] rounded-full bg-gradient-to-r from-jcc-accent/70 via-jcc-accent/30 to-transparent" />
                  </div>

                  {/* Highlights + share */}
                  <div className="relative mt-auto flex flex-wrap items-center gap-2 px-5 pb-5 pt-4 md:px-6">
                    {shelf.slice(0, 3).map((b) => (
                      <span key={b.label} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: burstFor(b.tone, b.label)[1] }}>
                        {b.label}
                      </span>
                    ))}
                    {shelf.length > 3 && <span className="text-[11px] font-semibold text-jcc-text-muted">+{shelf.length - 3} more</span>}
                    {shelf.length > 0 && (
                      <SectionShare
                        build={() => [cabinetCard(r.p, r.team, shelf)]}
                        fileBase={`jcc-cabinet-${names[r.p].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className="ml-auto"
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Badge detail */}
      {/* Portalled to <body>: the analytics panel is transformed by its
          entrance animation, which would trap a fixed overlay inside it. */}
      {selected &&
        createPortal(
        <div className="fixed inset-0 z-[85] grid place-items-center bg-[#0D1728]/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={selected.label} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-jcc-navy shadow-2xl">
            {(() => {
              const [c1, c2] = burstFor(selected.tone, selected.label);
              return (
                <>
                  {/* Header: the badge in its own colour, bursting with light */}
                  <div className="relative overflow-hidden px-7 pb-8 pt-10 text-center" style={{ background: `linear-gradient(180deg, ${c1} 0%, ${c2} 100%)` }}>
                    <div aria-hidden className="ach-rays pointer-events-none absolute left-1/2 top-[38%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" style={{ background: "repeating-conic-gradient(rgba(255,255,255,0.16) 0deg 7deg, rgba(255,255,255,0) 7deg 14deg)", maskImage: "radial-gradient(circle, #000 0%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 62%)" }} />
                    <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/45 blur-[60px]" />
                    <button onClick={() => setOpen(null)} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/35"><X size={17} /></button>
                    <div className="relative inline-block drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)]">
                      <Emblem label={selected.label} tone={selected.tone} tier={selected.tier} size={136} />
                    </div>
                    <div className="relative mt-5"><TierChip tier={selected.tier} /></div>
                    <h3 className="relative mt-2 font-heading text-4xl font-bold tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)] sm:text-5xl">{selected.label}</h3>
                    <p className="relative mt-2 text-[15px] font-medium text-white/90">{selected.rule}</p>
                    <p className="relative mt-4 inline-flex rounded-full bg-black/25 px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                      {selected.holders.length === 1 ? "Held by one player" : `Unlocked by ${selected.holders.length} of ${players} players`}
                    </p>
                  </div>

                  {/* Holders */}
                  <div className="px-6 pb-6 pt-5">
                    <ol className="space-y-2.5">
                      {selected.holders.map((h) => (
                        <li key={h.p}>
                          <button
                            onClick={() => { setOpen(null); onOpenPlayer(h.p, "labels"); }}
                            className="group flex w-full items-center gap-4 rounded-2xl border border-jcc-border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(18,35,63,0.5)]"
                            style={{ background: `linear-gradient(90deg, ${c1}1f 0%, transparent 60%)` }}
                          >
                            <span className="rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                              <Avatar name={names[h.p]} size={52} className="ring-2 ring-jcc-navy" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-heading text-lg font-bold tracking-tight text-white">{names[h.p]}</div>
                              <div className="text-[13px] leading-snug text-jcc-text-muted">{h.why}</div>
                            </div>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-transform group-hover:translate-x-0.5" style={{ background: c2 }}>→</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    {selected.tone !== "warn" && selected.holders.length > 0 && (
                      <div className="mt-5 flex justify-center">
                        <SectionShare build={() => badgeCards(selected)} fileBase={`jcc-badge-${selected.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} label="Share this badge" />
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
