"use client";

import { createElement, useMemo, useState } from "react";
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
  Crosshair,
  Crown,
  Egg,
  Flag,
  Flame,
  Footprints,
  Gauge,
  Gem,
  Hand,
  Handshake,
  Hourglass,
  Infinity,
  Medal,
  Moon,
  Mountain,
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
import { BADGE_CATALOG, type Badge, type BadgeTone } from "@/lib/scorecard-dashboard/profile";
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
  epic: { label: "Epic", ring: ["#B9CBFF", "#2B59C3", "#14275E"], core: "#0D1728", icon: "#C9D7FF", chip: "bg-[#2B59C3] text-white", glow: "rgba(43,89,195,.45)" },
  rare: { label: "Rare", ring: ["#A7E8C8", "#1A7A5E", "#0C4434"], core: "#0E211B", icon: "#A7E8C8", chip: "bg-[#1A7A5E] text-white", glow: "rgba(26,122,94,.4)" },
  common: { label: "Common", ring: ["#F2F4F7", "#A3ABB8", "#5D6677"], core: "#28303D", icon: "#E4E7EC", chip: "bg-[#5D6677] text-white", glow: "rgba(93,102,119,.3)" },
  banter: { label: "Banter", ring: ["#FFD0C4", "#C2563F", "#6E2620"], core: "#2A1412", icon: "#FFC2B3", chip: "bg-jcc-danger text-white", glow: "rgba(176,71,63,.4)" },
  locked: { label: "Locked", ring: ["#EAECF0", "#D0D5DD", "#B5BCC8"], core: "#F2F4F7", icon: "#98A2B3", chip: "bg-jcc-navy-light text-jcc-text-muted", glow: "transparent" },
};

const CATEGORY: { key: "all" | BadgeTone; label: string }[] = [
  { key: "all", label: "All" },
  { key: "crown", label: "Crowns" },
  { key: "bat", label: "Batting" },
  { key: "ball", label: "Bowling" },
  { key: "field", label: "Fielding" },
  { key: "team", label: "Team" },
  { key: "warn", label: "Banter" },
];

const ICONS: Record<string, LucideIcon> = { Anchor, Award, BadgeCheck, Banknote, Bomb, BrickWall, CalendarCheck, CircleSlash, Clover, Crosshair, Crown, Egg, Flag, Flame, Footprints, Gauge, Gem, Hand, Handshake, Hourglass, Infinity, Medal, Moon, Mountain, Repeat, Rocket, Ruler, Scale, Shield, ShieldCheck, Snowflake, Sparkles, Star, Sunrise, Swords, Target, TrendingUp, Trophy, Turtle, Wind, Zap };
const iconFor = (name: string) => ICONS[name] ?? Award;
const catalogEntry = (label: string) => BADGE_CATALOG.find((b) => b.label === label);

// ─── Emblem ──────────────────────────────────────────────────────────────────

/** A hexagonal medal: graded metal ring, dark core, icon. */
export function Emblem({ label, tone, tier, size = 72 }: { label: string; tone: BadgeTone; tier: Tier; size?: number }) {
  const t = TIER[tier];
  const icon = tier === "locked" ? Lock : iconFor(catalogEntry(label)?.icon ?? "Award");
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
      @media (prefers-reduced-motion: reduce) { .ach-legendary::after, .ach-tile { animation: none; } }
    `}</style>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

type Holder = { p: number; team: string; why: string };
type Row = { p: number; team: string; role: string; badges: Badge[] };

function Avatars({ holders, names }: { holders: Holder[]; names: string[] }) {
  const shown = holders.slice(0, 5);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((h) => (
          <span
            key={h.p}
            title={names[h.p]}
            className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-jcc-navy"
            style={{ background: teamByName(h.team)?.primary ?? "#5D6677" }}
          >
            {names[h.p].split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
        ))}
      </div>
      {holders.length > shown.length && <span className="ml-1.5 text-[11px] font-semibold text-jcc-text-muted">+{holders.length - shown.length}</span>}
    </div>
  );
}

export default function AchievementsTab({ rows, names, players, onOpenPlayer }: { rows: Row[]; names: string[]; players: number; onOpenPlayer: (p: number, card?: string) => void }) {
  const [view, setView] = useState<"badges" | "cabinets">("badges");
  const [cat, setCat] = useState<"all" | BadgeTone>("all");
  const [open, setOpen] = useState<string | null>(null);

  const holders = useMemo(() => {
    const m = new Map<string, Holder[]>();
    for (const r of rows) for (const b of r.badges) (m.get(b.label) ?? m.set(b.label, []).get(b.label)!).push({ p: r.p, team: r.team, why: b.why });
    return m;
  }, [rows]);

  const order: Tier[] = ["legendary", "epic", "rare", "common", "banter", "locked"];
  const badges = BADGE_CATALOG.map((b) => {
    const hs = holders.get(b.label) ?? [];
    return { ...b, holders: hs, tier: tierOf(b.tone, hs.length) };
  })
    .filter((b) => cat === "all" || b.tone === cat)
    .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.holders.length - b.holders.length);

  const unlocked = BADGE_CATALOG.filter((b) => holders.get(b.label)?.length).length;
  const total = rows.reduce((s, r) => s + r.badges.filter((b) => b.tone !== "warn").length, 0);
  const counts = Object.fromEntries(CATEGORY.map((c) => [c.key, BADGE_CATALOG.filter((b) => c.key === "all" || b.tone === c.key).length]));
  const selected = open ? badges.find((b) => b.label === open) ?? null : null;

  const cabinets = [...rows]
    .map((r) => ({ ...r, earned: r.badges.filter((b) => b.tone !== "warn"), banter: r.badges.filter((b) => b.tone === "warn") }))
    .sort((a, b) => b.earned.length - a.earned.length || b.earned.filter((x) => x.tone === "crown").length - a.earned.filter((x) => x.tone === "crown").length);

  return (
    <div>
      <AchievementStyles />

      {/* Header band */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-jcc-blue px-5 py-6 text-[#FCFBF8] sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-jcc-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            <Emblem label="Orange Cap" tone="crown" tier="legendary" size={64} />
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-jcc-accent-highlight">Achievements</p>
              <h3 className="font-heading text-3xl font-bold leading-none text-[#FCFBF8]">Hall of Badges</h3>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
            {([
              [`${unlocked}/${BADGE_CATALOG.length}`, "badges unlocked"],
              [total, "achievements earned"],
              [rows.length, `of ${players} players decorated`],
            ] as const).map(([v, l]) => (
              <div key={l}>
                <div className="font-heading text-3xl font-bold tabular-nums leading-none text-[#FCFBF8]">{v}</div>
                <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#FCFBF8]/60">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-jcc-accent-highlight" style={{ width: `${(100 * unlocked) / BADGE_CATALOG.length}%` }} />
        </div>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-jcc-border bg-jcc-navy p-0.5">
          {(["badges", "cabinets"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${view === v ? "bg-jcc-blue text-[#FCFBF8]" : "text-jcc-text-muted hover:text-white"}`}
            >
              {v === "badges" ? "Badges" : "Trophy cabinets"}
            </button>
          ))}
        </div>
        {view === "badges" && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORY.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                aria-pressed={cat === c.key}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  cat === c.key ? "border-jcc-accent bg-jcc-accent/15 text-white" : "border-jcc-border bg-jcc-navy text-jcc-text-muted hover:text-white"
                }`}
              >
                {c.label} <span className="opacity-50">{counts[c.key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "badges" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((b, i) => {
            const locked = b.tier === "locked";
            return (
              <button
                key={b.label}
                onClick={() => !locked && setOpen(b.label)}
                className={`ach-tile group relative flex flex-col items-center overflow-hidden rounded-2xl border p-4 text-center transition ${
                  locked
                    ? "cursor-default border-dashed border-jcc-border bg-jcc-navy-light/50"
                    : "border-jcc-border bg-jcc-navy hover:-translate-y-1 hover:border-jcc-accent/60 hover:shadow-[0_16px_32px_-18px_rgba(18,35,63,0.45)]"
                }`}
                style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }}
              >
                {b.tier === "legendary" && <span className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-jcc-accent/15 to-transparent" />}
                <div className="absolute right-2.5 top-2.5"><TierChip tier={b.tier} /></div>
                <div className="mt-3"><Emblem label={b.label} tone={b.tone} tier={b.tier} size={76} /></div>
                <div className={`mt-3 font-heading text-[17px] font-bold leading-tight ${locked ? "text-jcc-text-muted" : "text-white"}`}>{b.label}</div>
                <p className="mt-1 min-h-[2.6em] text-[11.5px] leading-snug text-jcc-text-muted">{b.rule}</p>
                <div className="mt-3 flex min-h-6 items-center justify-center">
                  {locked ? (
                    <span className="text-[11px] font-semibold text-jcc-text-muted">Not unlocked yet</span>
                  ) : b.holders.length === 1 ? (
                    <span className="text-[12px] font-bold text-white">{names[b.holders[0].p]}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatars holders={b.holders} names={names} />
                      <span className="text-[11px] font-semibold text-jcc-text-muted">{b.holders.length} unlocked</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "cabinets" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cabinets.map((r, i) => (
            <button
              key={r.p}
              onClick={() => onOpenPlayer(r.p, "labels")}
              className="ach-tile rounded-2xl border border-jcc-border bg-jcc-navy p-4 text-left transition hover:-translate-y-0.5 hover:border-jcc-accent/60"
              style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl font-heading text-lg font-bold text-white" style={{ background: teamByName(r.team)?.primary ?? "#5D6677" }}>
                  {names[r.p].split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{names[r.p]}</div>
                  <div className="text-[11px] text-jcc-text-muted">{r.team} · {r.role}</div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl font-bold leading-none text-white">{r.earned.length}</div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-jcc-text-muted">badges</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...r.earned, ...r.banter].map((b) => (
                  <span key={b.label} title={`${b.label}: ${b.why}`}>
                    <Emblem label={b.label} tone={b.tone} tier={tierOf(b.tone, holders.get(b.label)?.length ?? 1)} size={34} />
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Badge detail */}
      {selected && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0D1728]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={selected.label} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-jcc-navy p-6 shadow-2xl">
            <button onClick={() => setOpen(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-jcc-text-muted hover:bg-jcc-navy-light hover:text-white"><X size={18} /></button>
            <div className="flex flex-col items-center text-center">
              <Emblem label={selected.label} tone={selected.tone} tier={selected.tier} size={112} />
              <div className="mt-4"><TierChip tier={selected.tier} /></div>
              <h3 className="mt-2 font-heading text-3xl font-bold text-white">{selected.label}</h3>
              <p className="mt-1 text-sm text-jcc-text-muted">{selected.rule}</p>
              <p className="mt-1 text-xs font-semibold text-jcc-accent-dark">
                {selected.holders.length === 1 ? "Held by one player" : `Unlocked by ${selected.holders.length} of ${players} players`}
              </p>
            </div>
            <ol className="mt-5 divide-y divide-jcc-border">
              {selected.holders.map((h) => (
                <li key={h.p}>
                  <button onClick={() => { setOpen(null); onOpenPlayer(h.p, "labels"); }} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-jcc-navy-light/60">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: teamByName(h.team)?.primary ?? "#5D6677" }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{names[h.p]}</div>
                      <div className="text-[12px] text-jcc-text-muted">{h.why}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-jcc-accent-dark">Cards →</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
