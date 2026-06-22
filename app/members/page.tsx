"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Filter, Loader2, Search, X, Trophy, Target, Shield, Info } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import type { PlayerStats } from "@/components/MemberCard";
import SectionHeading from "@/components/SectionHeading";
import { members } from "@/lib/data";
import type { Member, MemberTag } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { fetchFullSeries, computeLeaderboards } from "@/lib/series";
import type { BattingLeaderRow, BowlingLeaderRow, AllRounderRow, FieldingRow } from "@/lib/series";
import { getDiceBearUrl } from "@/lib/avatar";

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

function getDisplayRole(memberTag?: string, groupRole?: string, cricketRole?: string): string {
  const isFounder = memberTag === "founding-member" || groupRole === "founding-member";
  if (groupRole === "captain") return isFounder ? "Founder & Captain" : "Captain";
  if (groupRole === "vice-captain") return isFounder ? "Founding Member & Vice Captain" : "Vice Captain";
  if (groupRole === "admin") return isFounder ? "Founding Member & Admin" : "Admin";
  if (isFounder) return "Founding Member";
  if (cricketRole) {
    if (cricketRole === "all-rounder") return "All-Rounder";
    if (cricketRole === "wicketkeeper") return "Wicketkeeper";
    return cricketRole.charAt(0).toUpperCase() + cricketRole.slice(1);
  }
  return "Member";
}

// ── Player Stats Modal ─────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, string> = {
  Mavericks: "#E8A820",
  NeuroStrikers: "#3B6FC4",
  "The Outliers": "#1A7A5E",
  Unassigned: "#8888aa",
};

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-2 py-2">
      <span className="text-xs sm:text-sm font-black text-white tabular-nums">{value}</span>
      <span className="text-[8px] uppercase tracking-widest text-white/30 font-black mt-0.5">{label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-white/30 mb-3">{children}</p>
  );
}

function PlayerStatsModal({
  member,
  stats,
  onClose,
}: {
  member: Member;
  stats: PlayerStats | undefined;
  onClose: () => void;
}) {
  const { batting, bowling, allRounder, fielding } = stats ?? {};
  const accentColor = TEAM_COLORS[member.team] ?? "#8888aa";
  const hasBatting = !!batting;
  const hasBowling = !!bowling;
  const hasFielding = fielding && fielding.catches > 0;

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-static-dark relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#12101a] shadow-2xl"
        style={{ borderColor: `${accentColor}22` }}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Header ── */}
        <div className="flex items-start gap-4 px-5 pt-4 pb-5" style={{ background: `linear-gradient(to bottom, ${accentColor}0d, transparent)` }}>
          {/* Avatar */}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 overflow-hidden flex-shrink-0"
            style={{ borderColor: `${accentColor}44`, background: `${accentColor}12` }}
          >
            <img
              src={member.image || getDiceBearUrl(member.name, member.team)}
              alt={member.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                const fallback = getDiceBearUrl(member.name, member.team);
                if (img.src !== fallback) img.src = fallback;
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white leading-tight truncate">
              {member.name}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: accentColor }}>
              {member.team} · {member.role}
            </p>
            {member.shortBio && (
              <p className="text-[10px] text-white/45 mt-2 leading-relaxed italic">{member.shortBio}</p>
            )}
          </div>
        </div>

        <div className="px-5 pb-8 space-y-6">

          {/* ── Cricket Profile ── */}
          <div>
            <SectionLabel>Cricket Profile</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Target, label: "Batting Style", value: member.battingStyle },
                { icon: Shield, label: "Bowling Style", value: member.bowlingStyle === "N/A" ? "None" : member.bowlingStyle },
                { icon: Trophy, label: "Primary Role", value: member.role },
                { icon: Info, label: "Joined JCC", value: new Date(member.joinedDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                >
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />
                  <div>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-black">{label}</p>
                    <p className="text-[11px] font-black text-white mt-0.5 leading-snug">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Batting Stats ── */}
          {hasBatting && (
            <div>
              <SectionLabel>Batting Stats</SectionLabel>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: `${accentColor}22`, background: `${accentColor}08` }}
              >
                {/* Top row: headline stats */}
                <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                  <StatCell label="Matches" value={batting!.matches} />
                  <StatCell label="Innings" value={batting!.innings} />
                  <StatCell label="Runs" value={batting!.total_runs} />
                  <StatCell label="High Score" value={batting!.high_score} />
                </div>
                {/* Bottom row: rate stats */}
                <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                  <StatCell label="Avg" value={batting!.batting_average != null ? batting!.batting_average.toFixed(2) : "—"} />
                  <StatCell label="SR" value={batting!.strike_rate != null ? batting!.strike_rate.toFixed(1) : "—"} />
                  <StatCell label="4s" value={batting!.fours} />
                  <StatCell label="6s" value={batting!.sixes} />
                </div>
                {/* Score highlight */}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Batting Score (IPL ranking)</span>
                  <span className="text-lg font-black" style={{ color: accentColor }}>{batting!.batting_score}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Bowling Stats ── */}
          {hasBowling && (
            <div>
              <SectionLabel>Bowling Stats</SectionLabel>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: `${accentColor}22`, background: `${accentColor}08` }}
              >
                <div className="grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                  <StatCell label="Matches" value={bowling!.matches} />
                  <StatCell label="Innings" value={bowling!.innings} />
                  <StatCell label="Wickets" value={bowling!.total_wickets} />
                  <StatCell label="Overs" value={bowling!.total_overs} />
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                  <StatCell label="Runs" value={bowling!.runs_conceded} />
                  <StatCell label="Economy" value={bowling!.economy} />
                  <StatCell label="Avg" value={bowling!.bowling_average != null ? bowling!.bowling_average.toFixed(2) : "—"} />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Bowling Score (IPL ranking)</span>
                  <span className="text-lg font-black" style={{ color: accentColor }}>{bowling!.bowling_score}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── All-Rounder Rating ── */}
          {allRounder && (
            <div>
              <SectionLabel>All-Rounder Rating</SectionLabel>
              <div
                className="rounded-xl border p-4 flex items-center justify-between"
                style={{ borderColor: `${accentColor}22`, background: `${accentColor}08` }}
              >
                <div className="flex gap-6">
                  <div>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-black">Bat Score</p>
                    <p className="text-lg font-black text-white">{allRounder.batting_score}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-black">Bowl Score</p>
                    <p className="text-lg font-black text-white">{allRounder.bowling_score}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[8px] uppercase tracking-widest text-white/30 font-black">Combined</p>
                  <p className="text-3xl font-black" style={{ color: accentColor }}>{allRounder.combined_score}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Fielding ── */}
          {hasFielding && (
            <div>
              <SectionLabel>Fielding</SectionLabel>
              <div
                className="rounded-xl border p-4 flex items-center gap-3"
                style={{ borderColor: `${accentColor}22`, background: `${accentColor}08` }}
              >
                <span className="text-3xl font-black" style={{ color: accentColor }}>
                  {fielding!.catches}
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Catches</p>
                  <p className="text-[9px] text-white/30">Fielding dismissals recorded</p>
                </div>
              </div>
            </div>
          )}

          {/* No stats fallback */}
          {!hasBatting && !hasBowling && !hasFielding && (
            <div className="text-center py-6 border border-white/[0.06] rounded-xl bg-white/[0.02]">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">
                No match stats recorded yet
              </p>
              <p className="text-[9px] text-white/15 mt-1">Stats appear after match data is imported</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

// Scorecard name → member profile name aliases confirmed by admin.
// Key = member's normalized name, values = scorecard aliases for the same person.
const NAME_ALIASES: Record<string, string[]> = {
  "bhairav deep": ["bhairav neurostrikers"],
  "naman saini": ["naman mavericks"],
  "nitesh jhurani": ["nitesh"],
  "rudraksh jhalani": ["rudraksh"],
  "sagar sharma": ["sagar"],
  "sarthak s rathore": ["sarthak rathore"],
};

type StatsLookup = {
  battingByName: Map<string, BattingLeaderRow>;
  bowlingByName: Map<string, BowlingLeaderRow>;
  allRounderByName: Map<string, AllRounderRow>;
  fieldingByName: Map<string, FieldingRow>;
};

export default function MembersPage() {
  const [active, setActive] = useState<FilterKey>("all");
  const [dbPlayers, setDbPlayers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statsLookup, setStatsLookup] = useState<StatsLookup | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  async function fetchPlayers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: Member[] = data.map((p) => {
          const tags: MemberTag[] = [];
          if (p.member_tag && p.member_tag !== "member") tags.push(p.member_tag as MemberTag);
          if (p.cricket_role) tags.push(p.cricket_role as MemberTag);
          if (p.group_role && (p.group_role === "captain" || p.group_role === "vice-captain")) {
            if (!tags.includes(p.group_role as MemberTag)) tags.push(p.group_role as MemberTag);
          }
          return {
            id: p.id,
            name: p.name,
            initials: p.name ? p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "🏏",
            team: p.team || "Unassigned",
            role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role),
            tags,
            image: p.image_url || p.image,
            cricketRole: p.cricket_role as Member["cricketRole"],
            battingStyle: p.batting_style || "Right-hand bat",
            bowlingStyle: p.bowling_style || "N/A",
            shortBio: p.short_bio || p.bio || "A valued member of the circle.",
            joinedDate: p.approved_at || p.created_at || new Date().toISOString(),
          };
        });
        setDbPlayers(mapped);
      }
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const fullSeries = await fetchFullSeries();
      const { batting, bowling, allRounders, fielding } = computeLeaderboards(fullSeries);
      const norm = (n: string) => n.toLowerCase().trim();
      setStatsLookup({
        battingByName: new Map(batting.map((r) => [norm(r.player_name), r])),
        bowlingByName: new Map(bowling.map((r) => [norm(r.player_name), r])),
        allRounderByName: new Map(allRounders.map((r) => [norm(r.player_name), r])),
        fieldingByName: new Map(fielding.map((r) => [norm(r.player_name), r])),
      });
    } catch (err) {
      console.error("Failed to fetch series stats:", err);
    }
  }

  useEffect(() => {
    fetchPlayers();
    fetchStats();
  }, []);

  const getPlayerStats = useCallback(
    (name: string): PlayerStats | undefined => {
      if (!statsLookup) return undefined;
      const norm = name.toLowerCase().trim();
      const aliases = NAME_ALIASES[norm] ?? [];
      const candidates = [norm, ...aliases];
      const find = <T,>(map: Map<string, T>) =>
        candidates.map((c) => map.get(c)).find((v) => v !== undefined);
      return {
        batting: find(statsLookup.battingByName),
        bowling: find(statsLookup.bowlingByName),
        allRounder: find(statsLookup.allRounderByName),
        fielding: find(statsLookup.fieldingByName),
      };
    },
    [statsLookup]
  );

  const currentMembers = dbPlayers.length > 0 ? dbPlayers : members;

  const filtered = currentMembers.filter((m) => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 stadium-glow opacity-30 z-0" />
        <Loader2 className="w-8 h-8 text-jcc-accent animate-spin relative z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-36 pb-20 relative overflow-hidden hero-gradient">
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
              {currentMembers.length} Legends in The Circle
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="The Circle"
          subtitle="Meet the legends who define Sunday cricket in Jaipur."
          accentColor="blue"
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
                  ? "bg-jcc-accent text-black border-jcc-accent shadow-[0_0_20px_rgba(232,83,126,0.25)]"
                  : "bg-white/[0.03] text-white/40 border-white/10 hover:border-jcc-accent/40 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((member, i) => (
              <MemberCard
                key={member.id}
                member={member}
                index={i}
                playerStats={getPlayerStats(member.name)}
                onClick={() => setSelectedMember(member)}
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

      {/* Player Stats Modal */}
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
