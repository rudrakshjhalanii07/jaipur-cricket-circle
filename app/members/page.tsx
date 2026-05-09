"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Filter, Loader2 } from "lucide-react";
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

export default function MembersPage() {
  const [active, setActive] = useState<FilterKey>("all");
  const [dbPlayers, setDbPlayers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
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
          if (p.member_tag) tags.push(p.member_tag as MemberTag);
          if (p.cricket_role) tags.push(p.cricket_role as MemberTag);
          
          return {
            id: p.id,
            name: p.name,
            initials: p.name.split(" ").map((n: string) => n[0]).join(""),
            team: p.team || "Unassigned",
            role: p.group_role ? (p.group_role.charAt(0).toUpperCase() + p.group_role.slice(1)) : (p.cricket_role.charAt(0).toUpperCase() + p.cricket_role.slice(1)),
            tags: tags,
            image: p.image,
            cricketRole: p.cricket_role as any,
            battingStyle: p.batting_style || "Right-hand bat",
            bowlingStyle: p.bowling_style || "N/A",
            shortBio: p.bio || "A valued member of the circle.",
          };
        });
        setDbPlayers(mapped);
      }
    } catch (err) {
      console.error("Error fetching players:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentMembers = dbPlayers.length > 0 ? dbPlayers : members;

  const filtered =
    active === "all"
      ? currentMembers
      : currentMembers.filter((m) => m.tags.includes(active as MemberTag));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jcc-bg">
        <Loader2 className="w-8 h-8 text-jcc-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-20 noise-overlay bg-jcc-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-jcc-blue/[0.06] border border-jcc-blue/15 mb-6"
          >
            <Users className="w-3.5 h-3.5 text-jcc-blue-deep" />
            <span className="text-[10px] font-bold text-jcc-blue-deep tracking-[0.25em] uppercase">
              {currentMembers.length} Legends in The Circle
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="The Circle"
          subtitle="Meet the players who make every Sunday unforgettable."
          accentColor="blue"
        />

        {/* Filter Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-16"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-all duration-300 shadow-sm ${
                active === f.key
                  ? "bg-jcc-blue text-white border-jcc-blue shadow-lg shadow-jcc-blue/20"
                  : "bg-white text-jcc-muted border-jcc-border hover:border-jcc-blue/30 hover:text-jcc-blue-deep"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((member, i) => (
              <MemberCard key={member.id} member={member} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-24 glass-card">
            <Filter className="w-8 h-8 text-jcc-muted mx-auto mb-4 opacity-30" />
            <p className="text-jcc-muted italic font-medium">No members found matching the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
