"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Filter, Loader2, Search, X } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import SectionHeading from "@/components/SectionHeading";
import { members } from "@/lib/data";
import type { Member, MemberTag } from "@/lib/data";
import { supabase } from "@/lib/supabase";

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
  
  if (groupRole === "captain") {
    return isFounder ? "Founder & Captain" : "Captain";
  }
  if (groupRole === "vice-captain") {
    return isFounder ? "Founding Member & Vice Captain" : "Vice Captain";
  }
  if (groupRole === "admin") {
    return isFounder ? "Founding Member & Admin" : "Admin";
  }
  
  if (isFounder) {
    return "Founding Member";
  }
  
  if (cricketRole) {
    if (cricketRole === "all-rounder") return "All-Rounder";
    if (cricketRole === "wicketkeeper") return "Wicketkeeper";
    return cricketRole.charAt(0).toUpperCase() + cricketRole.slice(1);
  }
  
  return "Member";
}

export default function MembersPage() {
  const [active, setActive] = useState<FilterKey>("all");
  const [dbPlayers, setDbPlayers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
          if (p.member_tag && p.member_tag !== "member") {
            tags.push(p.member_tag as MemberTag);
          }
          if (p.cricket_role) {
            tags.push(p.cricket_role as MemberTag);
          }
          if (p.group_role && (p.group_role === "captain" || p.group_role === "vice-captain")) {
            if (!tags.includes(p.group_role as MemberTag)) {
              tags.push(p.group_role as MemberTag);
            }
          }
          
          return {
            id: p.id,
            name: p.name,
            initials: p.name ? p.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "🏏",
            team: p.team || "Unassigned",
            role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role),
            tags: tags,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlayers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="min-h-screen pt-28 pb-20 relative overflow-hidden hero-gradient">
      {/* Cinematic Background Elements */}
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
            <div className="relative flex items-center bg-[#0C1E30]/60 backdrop-blur-xl border border-white/10 group-focus-within:border-jcc-accent/50 rounded-xl transition duration-300">
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
                  ? "bg-jcc-accent text-black border-jcc-accent shadow-[0_0_20px_rgba(0,194,255,0.25)]"
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
              <MemberCard key={member.id} member={member} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-[#0F2740]/20 border border-white/5 rounded-2xl max-w-md mx-auto">
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
    </div>
  );
}
