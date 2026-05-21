"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Filter, Loader2 } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import SectionHeading from "@/components/SectionHeading";
import { members } from "@/lib/data";
import type { Member, MemberTag } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";

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
          if (p.member_tag) tags.push(p.member_tag as MemberTag);
          if (p.cricket_role) tags.push(p.cricket_role as MemberTag);
          
          return {
            id: p.id,
            name: p.name,
            initials: p.name.split(" ").map((n: string) => n[0]).join(""),
            team: p.team || "Unassigned",
            role: p.group_role ? (p.group_role.charAt(0).toUpperCase() + p.group_role.slice(1)) : (p.cricket_role.charAt(0).toUpperCase() + p.cricket_role.slice(1)),
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

  const filtered =
    active === "all"
      ? currentMembers
      : currentMembers.filter((m) => m.tags.includes(active as MemberTag));

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

        {/* Filter Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-16"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border ${
                active === f.key
                  ? "bg-jcc-accent text-black border-jcc-accent shadow-[0_0_25px_rgba(0,194,255,0.3)]"
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
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT_CONFIG}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((member, i) => (
              <MemberCard key={member.id} member={member} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-24 premium-card">
            <Filter className="w-8 h-8 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 italic font-black uppercase tracking-widest">No members found matching the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
