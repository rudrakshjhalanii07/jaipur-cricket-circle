"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import NextLink from "next/link";
import { Users, ChevronRight, ShieldCheck, Heart, CalendarCheck, Trophy, Calendar } from "lucide-react";
import { members, clubStats } from "@/lib/data";
import type { Member, MemberTag } from "@/lib/data";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { getDiceBearUrl } from "@/lib/avatar";

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

function findMatchingPlayer(staticName: string, dbPlayers: any[]) {
  const cleanStatic = staticName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Try exact match or inclusion
  let found = dbPlayers.find(p => {
    const cleanDb = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanStatic.includes(cleanDb) || cleanDb.includes(cleanStatic);
  });
  
  if (found) return found;
  
  // Try splitting by words and check intersection
  const staticWords = staticName.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "singh" && w !== "kumar");
  found = dbPlayers.find(p => {
    const dbWords = p.name.toLowerCase().split(/\s+/);
    return staticWords.some(sw => dbWords.includes(sw));
  });
  
  return found;
}

export default function CommunitySection() {
  const [displayMembers, setDisplayMembers] = useState<Member[]>(members.slice(0, 8));
  const [stats, setStats] = useState({
    activePlayers: `${clubStats.totalMembers}+`,
    sundayGames: `${clubStats.matchesPlayed}+`,
    sundaysActive: `${clubStats.sundaysActive}+`,
    communityLove: "∞"
  });

  useEffect(() => {
    async function loadDynamicData() {
      try {
        // 1. Fetch approved and active players from Supabase
        const { data: dbPlayers, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("approval_status", "approved")
          .eq("is_active", true);

        if (playersError) throw playersError;

        // 2. Fetch total matches played from rivalry_seasons (sum across ALL seasons)
        const { data: rivalrySeasons, error: rsError } = await supabase
          .from("rivalry_seasons")
          .select("total_matches_played");

        // Update stats dynamically based on database counts
        const activeCount = dbPlayers ? dbPlayers.length : 0;
        const totalMatches = rivalrySeasons
          ? rivalrySeasons.reduce((sum: number, s: any) => sum + (s.total_matches_played || 0), 0)
          : 0;

        setStats({
          activePlayers: `${activeCount}+`,
          sundayGames: `${totalMatches}+`,
          sundaysActive: `${clubStats.sundaysActive}+`,
          communityLove: "∞"
        });

        // 3. Map dynamic members pool
        if (dbPlayers && dbPlayers.length > 0) {
          // Sort: captains first, then vice-captains, then founding members, then alphabetical by name
          const sortedPlayers = [...dbPlayers].sort((a, b) => {
            const aCaptain = a.group_role === "captain" ? 1 : 0;
            const bCaptain = b.group_role === "captain" ? 1 : 0;
            if (aCaptain !== bCaptain) return bCaptain - aCaptain;

            const aVC = a.group_role === "vice-captain" ? 1 : 0;
            const bVC = b.group_role === "vice-captain" ? 1 : 0;
            if (aVC !== bVC) return bVC - aVC;

            const aFounder = a.member_tag === "founding-member" || a.group_role === "founding-member" ? 1 : 0;
            const bFounder = b.member_tag === "founding-member" || b.group_role === "founding-member" ? 1 : 0;
            if (aFounder !== bFounder) return bFounder - aFounder;

            // Prioritize Rudraksh Jhalani (User) to ensure inclusion in top 8
            const aIsRudraksh = a.name.toLowerCase().includes("rudraksh") ? 1 : 0;
            const bIsRudraksh = b.name.toLowerCase().includes("rudraksh") ? 1 : 0;
            if (aIsRudraksh !== bIsRudraksh) return bIsRudraksh - aIsRudraksh;

            // Hard-push Naman Saini to absolute last position (below all others)
            const aIsNaman = a.name.toLowerCase().includes("naman") ? -1 : 0;
            const bIsNaman = b.name.toLowerCase().includes("naman") ? -1 : 0;
            if (aIsNaman !== bIsNaman) return bIsNaman - aIsNaman;

            return a.name.localeCompare(b.name);
          });

          const mapped: Member[] = sortedPlayers.slice(0, 8).map((p) => {
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
              team: (p.team || "Unassigned") as Member["team"],
              role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role),
              tags: tags,
              image: p.image_url || p.image,
              cricketRole: p.cricket_role as Member["cricketRole"],
              battingStyle: p.batting_style || "Right-hand Bat",
              bowlingStyle: p.bowling_style || "N/A",
              shortBio: p.short_bio || p.bio || "A valued member of the circle.",
              joinedDate: p.approved_at || p.created_at || new Date().toISOString(),
            };
          });

          setDisplayMembers(mapped);
        }
      } catch (err) {
        console.error("Error loading dynamic community section data:", err);
      }
    }

    loadDynamicData();
  }, []);

  return (
    <section id="community" className="py-24 sm:py-32 relative section-bg-navy overflow-hidden">
      {/* Subtle background wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-jcc-navy/50 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-jcc-accent font-black">
            <Users className="w-4 h-4" />
            OUR COMMUNITY
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mt-4">
            The <span className="text-gradient-cyan">Circle</span> Members
          </h2>
          <p className="mt-4 text-jcc-text-soft text-lg max-w-xl mx-auto font-medium">
            A diverse group of professionals, students, and cricket enthusiasts united by the Sunday spirit.
          </p>
        </motion.div>

        {/* Member Grid — Sharp & Premium */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayMembers.map((member, i) => {
            const isMavericks = member.team === "Mavericks";
            const isNeuroStrikers = member.team === "NeuroStrikers";

            const borderHighlight = isMavericks
              ? "border-blue-500/20 hover:border-blue-400/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
              : isNeuroStrikers
              ? "border-red-500/20 hover:border-red-400/60 hover:shadow-[0_0_30px_rgba(255,77,77,0.25)]"
              : "border-white/10 hover:border-jcc-accent/40 hover:shadow-[0_0_30px_rgba(20,184,255,0.15)]";

            const teamTextColor = isMavericks
              ? "text-blue-400 font-bold"
              : isNeuroStrikers
              ? "text-red-400 font-bold"
              : "text-jcc-text-muted";

            const avatarBorder = isMavericks
              ? "border-blue-500/20 group-hover:border-blue-400/50"
              : isNeuroStrikers
              ? "border-red-500/20 group-hover:border-red-400/50"
              : "border-white/10 group-hover:border-jcc-accent/50";

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ delay: i * 0.05 }}
                className={`premium-card p-5 group transition-all duration-300 ${borderHighlight}`}
              >
                <div className="relative mb-4">
                  <div className={`aspect-square rounded-xl overflow-hidden bg-white/5 border relative flex items-center justify-center transition-all duration-300 ${avatarBorder}`}>
                    {member.image ? (
                      <Image
                        src={member.image}
                        alt={member.name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      // DiceBear auto-avatar: deterministic per name, team-colored
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getDiceBearUrl(member.name, member.team)}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                  {member.tags.includes("captain") && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-jcc-accent flex items-center justify-center text-white shadow-lg border-2 border-jcc-navy">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-white truncate">
                    {member.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${teamTextColor}`}>
                      {member.team || "Circle Member"}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${
                      member.tags.includes("captain") ? "bg-jcc-accent/20 text-jcc-accent" : "bg-white/5 text-jcc-text-soft"
                    }`}>
                      {member.role}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Community Stats Strip — Premium Sports Dashboard Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ delay: 0.4 }}
          className="mt-20"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Users, label: "Active Members", value: stats.activePlayers, color: "from-jcc-accent/20 to-transparent", border: "border-jcc-accent/20", textColor: "text-jcc-accent" },
              { icon: Trophy, label: "Matches Played", value: stats.sundayGames, color: "from-yellow-400/20 to-transparent", border: "border-yellow-400/20", textColor: "text-yellow-400" },
              { icon: Calendar, label: "Sundays Active", value: stats.sundaysActive, color: "from-orange-500/20 to-transparent", border: "border-orange-500/20", textColor: "text-orange-400" },
              { icon: Heart, label: "Community Love", value: stats.communityLove, color: "from-jcc-green/20 to-transparent", border: "border-jcc-green/20", textColor: "text-jcc-green" },
            ].map((stat, i) => (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-xl bg-gradient-to-b ${stat.color} border ${stat.border} p-5 cursor-default hover:scale-[1.03] transition-all duration-300 hover:shadow-lg flex flex-col items-center sm:items-start text-center sm:text-left`}
              >
                <div className="p-2 rounded-lg bg-white/5 mb-3 group-hover:scale-110 transition-transform">
                  <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
                </div>
                <div className={`text-2xl font-black ${stat.textColor}`}>{stat.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-20 text-center">
          <NextLink
            href="/members"
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-xl btn-vibrant-blue text-black font-black text-[14px]"
          >
            MEET THE FULL CIRCLE
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </NextLink>
        </div>
      </div>
    </section>
  );
}
