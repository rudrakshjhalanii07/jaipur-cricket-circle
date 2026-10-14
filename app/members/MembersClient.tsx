"use client";

// The members directory. The server (page.tsx) decides who everyone is —
// standing, current team, captaincy, cap number, appearances — and this lays
// it out: a hero with the live counts, the leadership strip, then the whole
// Circle as cards or a list, searchable and filterable. Tapping anyone opens
// his stats card.

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, LayoutGrid, List, Search, Shield, Trophy, Users, X } from "lucide-react";
import type { PlayerStats } from "@/components/MemberCard";
import type { Member, MemberTag } from "@/lib/types";
import PlayerStatsModal from "@/components/PlayerStatsModal";
import Jaali from "@/components/Jaali";
import { fetchFullSeries, computeLeaderboards } from "@/lib/series";
import { buildStatsLookup, lookupPlayerStats, type StatsLookup } from "@/lib/player-stats-lookup";
import { teamByName } from "@/lib/teams";
import { getMonogramAvatar } from "@/lib/avatar";
import { PERMANENT_MEMBER_IDS } from "@/lib/permanent-members";
import { focusOf, focusStyle } from "@/lib/photo-focus";

type FilterKey = "all" | MemberTag;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "captain", label: "Captains" },
  { key: "batter", label: "Batters" },
  { key: "bowler", label: "Bowlers" },
  { key: "all-rounder", label: "All-rounders" },
  { key: "wicketkeeper", label: "Keepers" },
];

const LABEL = "text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em]";
const isLeader = (m: Member) => (m.standing ?? "member") !== "member";
const isPermanent = (m: Member) => PERMANENT_MEMBER_IDS.has(m.id);
const cap = (m: Member) => `#${String(m.capNumber ?? 0).padStart(3, "0")}`;

function Photo({ m, className, sizes, priority }: { m: Member; className?: string; sizes: string; priority?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (m.image && !broken) {
    return (
      <Image
        src={m.image.split("#")[0]}
        alt={m.name}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${className ?? ""}`}
        style={focusStyle(focusOf(m.image), 0.42, 0.8)}
        onError={() => setBroken(true)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={getMonogramAvatar(m.name)} alt={m.name} className={`absolute inset-0 h-full w-full object-cover ${className ?? ""}`} />;
}

/** A member as a portrait card, edged in his team's colour. */
function Card({ m, onOpen, priority }: { m: Member; onOpen: () => void; priority?: boolean }) {
  const team = teamByName(m.team);
  const color = team?.primary ?? "#A97824";
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative block h-full w-full overflow-hidden rounded-2xl bg-jcc-blue-deep text-left shadow-[0_18px_40px_-24px_rgba(18,35,63,0.5)] transition-shadow hover:shadow-[0_26px_60px_-24px_rgba(18,35,63,0.6)]"
      style={{ boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      <div className="relative aspect-4/5 overflow-hidden">
        <Photo m={m} priority={priority} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw" className="transition-transform duration-700 group-hover:scale-[1.06]" />
        {/* Navy fade under the name, whatever the team — a gold or teal wash
            under white type fails contrast. The team colour is the card edge
            and the bar below instead. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 38%, rgba(13,23,40,0.82) 78%, #0D1728 100%)" }} />
        <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#FFFFFF]/90 backdrop-blur-sm">
          {cap(m)}
        </span>
        {isLeader(m) && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-jcc-accent text-[#FFFFFF] shadow-lg">
            {m.standing === "captain" ? <Trophy className="h-3.5 w-3.5" /> : m.standing === "founder" ? <Crown className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4" style={{ color: "#FFFFFF" }}>
          <p className="line-clamp-2 font-heading text-xl font-bold leading-tight sm:text-2xl">{m.name}</p>
          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.75)" }}>
            {m.role}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t-[3px] bg-jcc-navy px-4 py-3" style={{ borderTopColor: color }}>
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-jcc-blue">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{team?.name ?? "Unassigned"}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-jcc-blue/75">
          {m.matchesPlayed ?? 0} <span className="text-jcc-blue/70">M</span>
        </span>
      </div>
    </motion.button>
  );
}

/** A member as a list row. */
function Row({ m, onOpen }: { m: Member; onOpen: () => void }) {
  const team = teamByName(m.team);
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-jcc-blue/10 px-2 py-3 text-left transition-colors hover:bg-jcc-accent/5 sm:grid-cols-[3.5rem_auto_1fr_10rem_5rem_4rem]"
    >
      <span className="hidden font-mono text-xs font-bold text-jcc-blue/70 sm:block">{cap(m)}</span>
      <span className="relative h-11 w-11 overflow-hidden rounded-xl bg-jcc-navy-light">
        <Photo m={m} sizes="44px" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-heading text-lg font-bold leading-tight text-jcc-blue">{m.name}</span>
        <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-jcc-text-muted">{m.role}</span>
      </span>
      <span className="hidden items-center gap-2 truncate text-[11px] font-black uppercase tracking-[0.14em] text-jcc-blue sm:flex">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: team?.primary ?? "#667085" }} />
        {team?.name ?? "Unassigned"}
      </span>
      <span className="hidden text-right font-mono text-xs font-bold tabular-nums text-jcc-blue/70 sm:block">{m.matchesPlayed ?? 0} M</span>
      <span className="text-right text-[10px] font-black uppercase tracking-widest text-jcc-accent-dark opacity-0 transition-opacity group-hover:opacity-100">View</span>
    </motion.button>
  );
}

export default function MembersClient({ members }: { members: Member[] }) {
  const [active, setActive] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statsLookup, setStatsLookup] = useState<StatsLookup | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);

  // Stats power the card modal only — fetched after first paint.
  useEffect(() => {
    let cancelled = false;
    fetchFullSeries()
      .then((s) => !cancelled && setStatsLookup(buildStatsLookup(computeLeaderboards(s))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const statsFor = useCallback((name: string): PlayerStats | undefined => lookupPlayerStats(statsLookup, name), [statsLookup]);

  // The seven permanent members get the strip; the directory below is everyone
  // else, so nobody appears twice.
  const permanent = useMemo(() => members.filter(isPermanent), [members]);
  const rest = useMemo(() => members.filter((m) => !isPermanent(m)), [members]);
  const counts = useMemo(
    () => ({
      founders: members.filter((m) => m.standing === "founder").length,
      captains: members.filter((m) => m.tags.includes("captain")).length,
      played: members.filter((m) => (m.matchesPlayed ?? 0) > 0).length,
    }),
    [members],
  );

  const filtered = rest.filter((m) => {
    const inFilter = active === "all" ? true : m.tags.includes(active as MemberTag);
    const q = query.trim().toLowerCase();
    const inSearch =
      !q ||
      [m.name, m.team, m.role, m.cricketRole, m.battingStyle, m.bowlingStyle].some((f) => f?.toLowerCase().includes(q));
    return inFilter && inSearch;
  });

  return (
    <div className="overflow-x-clip">
      {/* ── Hero ── */}
      <section className="theme-static-dark section-bg-royal relative overflow-hidden page-top pb-14 sm:pb-20">
        <Jaali />
        <div className="pointer-events-none absolute -right-40 -top-40 h-136 w-136 rounded-full bg-jcc-accent/15 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${LABEL} inline-flex items-center gap-2 text-jcc-accent`}>
            <Users className="h-3.5 w-3.5" /> The members
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-heading text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.9] tracking-[-0.045em] text-white"
          >
            The Circle<span className="text-jcc-accent">.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Every face behind weekly cricket in Jaipur — founders, committee, captains and everyone who turns up.
          </motion.p>
          <motion.dl
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-12 grid grid-cols-2 border-t border-white/15 sm:grid-cols-4"
          >
            {[
              ["Members", members.length],
              ["Founders", counts.founders],
              ["Captains", counts.captains],
              ["On a scorecard", counts.played],
            ].map(([label, value], i) => (
              <div key={label} className={`py-6 ${i % 2 ? "border-l border-white/15 pl-5" : ""} ${i > 0 ? "sm:border-l sm:border-white/15 sm:pl-6" : ""}`}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">{label}</dt>
                <dd className="mt-3 font-heading text-4xl font-bold leading-none tabular-nums text-white sm:text-5xl">{value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* ── Leadership strip ── */}
      {permanent.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <div>
            <p className={`${LABEL} text-jcc-accent-dark`}>The permanent seven</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-jcc-blue sm:text-4xl">Permanent members</h2>
          </div>
          {/* Equal columns: every card the same width, so the same height. */}
          <div className="scrollbar-hide -mx-5 mt-6 grid auto-cols-[46vw] grid-flow-col gap-3 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:auto-cols-[13rem] sm:px-8 lg:mx-0 lg:grid-flow-row lg:grid-cols-7 lg:overflow-visible lg:px-0">
            {permanent.map((m, i) => (
              <div key={m.id} className="snap-start">
                <Card m={m} onOpen={() => setSelected(m)} priority={i < 4} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Directory ── */}
      <section className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:px-8">
        <div className="sticky top-18 sm:top-22 z-30 -mx-2 rounded-2xl border border-jcc-blue/10 bg-jcc-navy/90 p-2 shadow-[0_12px_40px_-24px_rgba(18,35,63,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative flex flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-jcc-blue/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, team, role…"
                className="w-full rounded-xl bg-jcc-navy-light/70 py-2.5 pl-9 pr-9 text-sm text-jcc-blue placeholder:text-jcc-blue/50 focus:outline-none focus:ring-2 focus:ring-jcc-accent/40"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 rounded-lg p-1 text-jcc-blue/70 hover:text-jcc-blue">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="scrollbar-hide flex gap-1 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActive(f.key)}
                  className={`relative shrink-0 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${
                    active === f.key ? "text-[#FFFFFF]" : "text-jcc-blue/70 hover:text-jcc-blue"
                  }`}
                >
                  {active === f.key && (
                    <motion.span layoutId="members-filter" className="absolute inset-0 rounded-xl bg-jcc-blue" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <span className="relative">{f.label}</span>
                </button>
              ))}
            </div>
            <div className="flex shrink-0 gap-1 rounded-xl bg-jcc-navy-light/70 p-1">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-label={v === "grid" ? "Grid view" : "List view"}
                  className={`rounded-lg p-2 transition-colors ${view === v ? "bg-jcc-navy text-jcc-blue shadow-sm" : "text-jcc-blue/70 hover:text-jcc-blue"}`}
                >
                  {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-jcc-text-muted">
          {filtered.length} of {rest.length} {rest.length === 1 ? "member" : "members"}
        </p>

        {view === "grid" ? (
          <motion.div layout className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((m) => (
                <Card key={m.id} m={m} onOpen={() => setSelected(m)} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div layout className="mt-4 border-t border-jcc-blue/10">
            <AnimatePresence initial={false}>
              {filtered.map((m) => (
                <Row key={m.id} m={m} onOpen={() => setSelected(m)} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-jcc-blue/15 py-16 text-center">
            <p className="text-sm font-bold text-jcc-blue/75">No one matches {query ? `"${query}"` : "that filter"}.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActive("all");
              }}
              className="mt-4 rounded-xl border border-jcc-blue/15 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-jcc-blue/70 hover:border-jcc-accent/50"
            >
              Show everyone
            </button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && <PlayerStatsModal member={selected} stats={statsFor(selected.name)} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
