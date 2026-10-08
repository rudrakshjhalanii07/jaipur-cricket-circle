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
import { Avatar } from "./Avatar";
import { usePill } from "./motion";
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

export default function AchievementsTab({ rows, names, players, onOpenPlayer }: { rows: Row[]; names: string[]; players: number; onOpenPlayer: (p: number, card?: string) => void }) {
  const [view, setView] = useState<"badges" | "cabinets">("badges");
  const [cat, setCat] = useState<"all" | BadgeTone>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { box: viewBox, pill: viewPill } = usePill(view);
  const { box: catBox, pill: catPill } = usePill(`${view}|${cat}`, "line");

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
  const byTier = order.map((tier) => ({ tier, items: badges.filter((b) => b.tier === tier) })).filter((g) => g.items.length);

  const unlocked = BADGE_CATALOG.filter((b) => holders.get(b.label)?.length).length;
  const total = rows.reduce((s, r) => s + r.badges.filter((b) => b.tone !== "warn").length, 0);
  const counts = Object.fromEntries(CATEGORY.map((c) => [c.key, BADGE_CATALOG.filter((b) => c.key === "all" || b.tone === c.key).length]));
  const selected = open ? badges.find((b) => b.label === open) ?? null : null;

  const cabinets = [...rows]
    .map((r) => ({ ...r, earned: r.badges.filter((b) => b.tone !== "warn"), banter: r.badges.filter((b) => b.tone === "warn") }))
    .sort((a, b) => b.earned.length - a.earned.length || b.earned.filter((x) => x.tone === "crown").length - a.earned.filter((x) => x.tone === "crown").length);
  const maxEarned = Math.max(1, ...cabinets.map((c) => c.earned.length));

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
          </div>
        </div>
        <div>
          <dl className="grid grid-cols-3 gap-6">
            {([
              [`${unlocked}`, `/${BADGE_CATALOG.length}`, "Badges unlocked"],
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
            <div data-bar className="h-full rounded-full bg-gradient-to-r from-jcc-accent-dark via-jcc-accent to-jcc-accent-highlight" style={{ width: `${(100 * unlocked) / BADGE_CATALOG.length}%` }} />
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
                    <button
                      key={b.label}
                      onClick={() => !locked && setOpen(b.label)}
                      className={`ach-tile group flex flex-col items-center text-center ${locked ? "cursor-default" : ""}`}
                      style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}
                    >
                      <span className={`transition duration-500 ${locked ? "opacity-60 grayscale" : "group-hover:-translate-y-1.5 group-hover:rotate-6 group-hover:scale-105"}`}>
                        <Emblem label={b.label} tone={b.tone} tier={b.tier} size={88} />
                      </span>
                      <span aria-hidden className={`mt-3 h-px w-16 transition-all duration-500 ${locked ? "bg-jcc-border" : "bg-jcc-accent/50 group-hover:w-24"}`} />
                      <div className={`mt-3 font-heading text-lg font-bold leading-tight tracking-tight ${locked ? "text-jcc-text-muted" : "text-white"}`}>{b.label}</div>
                      <p className="mt-1 min-h-[2.6em] max-w-[220px] text-[12px] leading-snug text-jcc-text-muted">{b.rule}</p>
                      <div className="mt-3 min-h-7">{locked ? <span className="font-mono text-[10.5px] text-jcc-text-muted">Not unlocked yet</span> : <Holders holders={b.holders} names={names} />}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Trophy cabinets: one shelf per player ── */}
      {view === "cabinets" && (
        <ol className="mt-4">
          {cabinets.map((r, i) => (
            <li key={r.p} className="ach-tile" style={{ animationDelay: `${Math.min(i, 16) * 30}ms` }}>
              <button onClick={() => onOpenPlayer(r.p, "labels")} className="group grid w-full grid-cols-[minmax(0,1fr)_64px] items-center gap-x-6 gap-y-4 border-b border-jcc-border py-6 text-left md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_72px]">
                <span className="flex min-w-0 items-center gap-4">
                  <Avatar name={names[r.p]} size={52} ring={i === 0 ? "#D4AF37" : teamColor(r.team)} className="transition-transform duration-500 group-hover:scale-105" />
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-xl font-bold tracking-tight text-white decoration-jcc-accent decoration-2 underline-offset-4 group-hover:underline">{names[r.p]}</span>
                    <span className="block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-jcc-text-muted">{r.team} · {r.role}</span>
                  </span>
                </span>
                <span className="relative col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                  <span className="flex flex-wrap items-end gap-1.5 pb-2">
                    {[...r.earned, ...r.banter].map((b) => (
                      <span key={b.label} title={`${b.label}: ${b.why}`} className="transition-transform duration-300 hover:-translate-y-1">
                        <Emblem label={b.label} tone={b.tone} tier={tierOf(b.tone, holders.get(b.label)?.length ?? 1)} size={36} />
                      </span>
                    ))}
                  </span>
                  {/* the shelf */}
                  <span aria-hidden className="block h-[3px] rounded-full bg-gradient-to-r from-jcc-accent-dark/60 via-jcc-accent/40 to-transparent" style={{ width: `${Math.max(20, (100 * r.earned.length) / maxEarned)}%` }} />
                </span>
                <span className="text-right">
                  <span className="block font-heading text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums text-white">{r.earned.length}</span>
                  <span className={LABEL}>badges</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Badge detail */}
      {selected && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0D1728]/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={selected.label} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-jcc-navy p-7 shadow-2xl">
            <button onClick={() => setOpen(null)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-jcc-text-muted hover:bg-jcc-navy-light hover:text-white"><X size={18} /></button>
            <div className="flex flex-col items-center text-center">
              <Emblem label={selected.label} tone={selected.tone} tier={selected.tier} size={120} />
              <div className="mt-5"><TierChip tier={selected.tier} /></div>
              <h3 className="mt-2 font-heading text-4xl font-bold tracking-[-0.03em] text-white">{selected.label}</h3>
              <p className="mt-1 text-sm text-jcc-text-muted">{selected.rule}</p>
              <p className="mt-2 font-mono text-[11px] text-jcc-accent-dark">
                {selected.holders.length === 1 ? "Held by one player" : `Unlocked by ${selected.holders.length} of ${players} players`}
              </p>
            </div>
            <ol className="mt-6 border-t border-jcc-blue/80">
              {selected.holders.map((h) => (
                <li key={h.p}>
                  <button onClick={() => { setOpen(null); onOpenPlayer(h.p, "labels"); }} className="group flex w-full items-center gap-3 border-b border-jcc-border py-3 text-left">
                    <Avatar name={names[h.p]} size={36} ring={teamColor(h.team)} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{names[h.p]}</div>
                      <div className="text-[12px] text-jcc-text-muted">{h.why}</div>
                    </div>
                    <span className="font-mono text-[10.5px] text-jcc-accent-dark transition-transform group-hover:translate-x-1">Cards →</span>
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
