"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Filter, Search, X } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import type { PlayerStats } from "@/components/MemberCard";
import SectionHeading from "@/components/SectionHeading";
import type { Member, MemberTag } from "@/lib/types";
import PlayerStatsModal from "@/components/PlayerStatsModal";
import { fetchFullSeries, computeLeaderboards } from "@/lib/series";
import {
  buildStatsLookup,
  lookupPlayerStats,
  type StatsLookup,
} from "@/lib/player-stats-lookup";

type FilterKey = "all" | MemberTag;

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Members" },
  { key: "captain", label: "Captains" },
  { key: "founding-member", label: "Founders" },
  { key: "batter", label: "Batters" },
  { key: "bowler", label: "Bowlers" },
  { key: "all-rounder", label: "All-Rounders" },
  { key: "wicketkeeper", label: "Keepers" },
];

export default function MembersClient({ members }: { members: Member[] }) {
  const [active, setActive] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statsLookup, setStatsLookup] = useState<StatsLookup | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Stats are lazy — they power the modal and stat bars but are not LCP-critical.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fullSeries = await fetchFullSeries();
        if (cancelled) return;
        setStatsLookup(buildStatsLookup(computeLeaderboards(fullSeries)));
      } catch {
        // stats are non-critical; cards render with fallback values
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getPlayerStats = useCallback(
    (name: string): PlayerStats | undefined => lookupPlayerStats(statsLookup, name),
    [statsLookup]
  );

  const filtered = members.filter((m) => {
    const matchesCategory =
      active === "all"
        ? true
        : active === "captain"
        ? m.tags.includes("captain") || m.tags.includes("vice-captain")
        : m.tags.includes(active as MemberTag);

    const matchesSearch =
      searchQuery.trim() === ""
        ? true
        : m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.cricketRole && m.cricketRole.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (m.battingStyle && m.battingStyle.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (m.bowlingStyle && m.bowlingStyle.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (m.shortBio && m.shortBio.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen page-top pb-20 relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 mb-6"
          >
            <Users className="w-3.5 h-3.5 text-jcc-accent" />
            <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
              {members.length} Legends in The Circle
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="The Circle"
          subtitle="Meet the legends who define weekly cricket in Jaipur."
          accentColor="blue"
          priority
        />

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md mx-auto mb-8 px-2"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-jcc-accent/20 to-jcc-green/20 rounded-xl blur opacity-30 group-focus-within:opacity-70 transition duration-300" />
            <div className="relative flex items-center bg-jcc-navy/60 backdrop-blur-xl border border-white/10 group-focus-within:border-jcc-accent/50 rounded-xl transition duration-300">
              <Search className="w-4 h-4 text-white/30 ml-4 group-focus-within:text-jcc-accent transition duration-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, team, or role..."
                className="w-full bg-transparent py-3 px-3 text-xs sm:text-sm text-white placeholder-white/20 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-2 mr-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Filter Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-1.5 sm:gap-3 mb-8 sm:mb-16"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all duration-300 border ${
                active === f.key
                  ? "bg-jcc-accent text-black border-jcc-accent shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                  : "bg-white/[0.03] text-white/40 border-white/10 hover:border-jcc-accent/40 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Grid — initial={false} prevents SSR'd cards from flashing invisible on hydration */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 sm:gap-8"
          >
            {filtered.map((member, i) => (
              <MemberCard
                key={member.id}
                member={member}
                index={i}
                playerStats={getPlayerStats(member.name)}
                onClick={() => setSelectedMember(member)}
                priority={i === 0}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-jcc-navy/20 border border-white/5 rounded-2xl max-w-md mx-auto">
            <Filter className="w-6 h-6 text-white/20 mx-auto mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest px-4">
              {searchQuery
                ? `No legends found for "${searchQuery}"`
                : "No members found matching the selected filter."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider transition"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMember && (
          <PlayerStatsModal
            member={selectedMember}
            stats={getPlayerStats(selectedMember.name)}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
