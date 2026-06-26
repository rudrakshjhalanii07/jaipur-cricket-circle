"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Share2, Globe, Trophy, Target, Shield, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Member, MemberTag } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import SectionHeading from "@/components/SectionHeading";
import { getDiceBearUrl } from "@/lib/avatar";

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [globeClicked, setGlobeClicked] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleGlobeClick = () => {
    setGlobeClicked(true);
    setTimeout(() => setGlobeClicked(false), 2000);
  };

  // A helper function to build display role
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

  useEffect(() => {
    async function getMember() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.warn(`Player lookup failed for ID ${id}:`, error.message || error);
          setLoading(false);
          return;
        }

        if (data) {
          const tags: MemberTag[] = [];
          if (data.member_tag && data.member_tag !== "member") {
            tags.push(data.member_tag as MemberTag);
          }
          if (data.cricket_role) {
            tags.push(data.cricket_role as MemberTag);
          }
          if (data.group_role && (data.group_role === "captain" || data.group_role === "vice-captain")) {
            if (!tags.includes(data.group_role as MemberTag)) {
              tags.push(data.group_role as MemberTag);
            }
          }

          const mapped: Member = {
            id: data.id,
            name: data.name,
            initials: data.name ? data.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "🏏",
            team: data.team || "Unassigned",
            role: getDisplayRole(data.member_tag, data.group_role, data.cricket_role),
            tags: tags,
            image: data.image_url || data.image,
            cricketRole: data.cricket_role as Member["cricketRole"],
            battingStyle: data.batting_style || "Right-hand bat",
            bowlingStyle: data.bowling_style || "N/A",
            shortBio: data.short_bio || data.bio || "A valued member of the circle.",
            joinedDate: data.approved_at || data.created_at || new Date().toISOString(),
          };
          setMember(mapped);
        }
      } catch (err) {
        console.error("Error in getMember:", err);
      } finally {
        setLoading(false);
      }
    }

    getMember();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-jcc-bg relative">
        <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />
        <Loader2 className="w-8 h-8 text-jcc-accent animate-spin relative z-10" />
      </div>
    );
  }

  if (!member) {
    notFound();
  }

  const teamColor = member.team === "Mavericks" ? "text-jcc-accent" : member.team === "NeuroStrikers" ? "text-jcc-ball-red" : "text-white/40";
  const teamBg = member.team === "Mavericks" ? "bg-jcc-accent/5" : member.team === "NeuroStrikers" ? "bg-jcc-ball-red/5" : "bg-white/5";

  return (
    <div className="min-h-screen pt-36 pb-20 bg-jcc-bg relative">
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-jcc-accent transition-colors duration-300 group font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to The Circle
          </Link>
        </motion.div>

        {/* Profile Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
          {/* Avatar Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="md:col-span-1"
          >
            <div className={`relative aspect-square rounded-[32px] overflow-hidden border border-white/10 ${teamBg} shadow-sm`}>
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
              <div className="absolute inset-0 bg-gradient-to-t from-jcc-bg via-transparent to-transparent" />
              
              {/* Team Badge Overlaid */}
              <div className="absolute bottom-6 left-6 flex flex-col gap-1">
                 <span className={`text-[10px] uppercase tracking-[0.2em] font-black ${teamColor}`}>
                    {member.team}
                 </span>
                 <h1 className="text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">
                    {member.name}
                 </h1>
              </div>
            </div>

            {/* Social Actions */}
             <div className="flex gap-3 mt-6">
                 <button 
                   onClick={handleShare}
                   className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 font-black uppercase tracking-widest text-[11px] cursor-pointer"
                 >
                     {copied ? (
                       <>
                         <span className="text-jcc-green text-sm">✓</span>
                         Copied!
                       </>
                     ) : (
                       <>
                         <Share2 className="w-4 h-4" />
                         Share Profile
                       </>
                     )}
                 </button>
                 <button 
                   onClick={handleGlobeClick}
                   className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300 relative group cursor-pointer"
                   aria-label="Personal Website Profile"
                 >
                     <Globe className="w-5 h-5" />
                     {globeClicked && (
                       <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-jcc-navy-light border border-white/10 rounded-lg whitespace-nowrap shadow-md z-30">
                         Not Linked!
                       </span>
                     )}
                 </button>
             </div>
          </motion.div>

          {/* Info Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-2 space-y-8"
          >
            {/* Title & Role */}
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {member.tags.map((tag) => (
                  <span key={tag} className={`tag-${tag} text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest`}>
                    {tag.replace("-", " ")}
                  </span>
                ))}
              </div>
              <h2 className="text-3xl font-black text-white font-[var(--font-heading)] mb-4 uppercase tracking-tight">
                {member.role}
              </h2>
              <p className="text-white/80 text-lg leading-relaxed font-medium">
                {member.shortBio}
              </p>
            </div>

            {/* Cricket Specs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Target className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/60 font-black">Batting Style</span>
                    </div>
                    <span className="text-white font-black uppercase tracking-wide">{member.battingStyle}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Shield className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/60 font-black">Bowling Style</span>
                    </div>
                    <span className="text-white font-black uppercase tracking-wide">{member.bowlingStyle}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Trophy className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/60 font-black">Primary Role</span>
                    </div>
                    <span className="text-white font-black capitalize tracking-wide">{member.cricketRole}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Info className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/60 font-black">Joined JCC</span>
                    </div>
                    <span className="text-white font-black uppercase tracking-wide">
                        {new Date(member.joinedDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Section Placeholder */}
        <SectionHeading title="Career Highlights" accentColor="blue" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-20">
            {[
                { label: "Matches", value: "24" },
                { label: "Runs", value: "482" },
                { label: "Wickets", value: "12" },
                { label: "High Score", value: "68*" }
            ].map((stat, i) => (
                <div key={i} className="premium-card p-6 text-center group hover:border-jcc-accent/30 transition-all duration-300">
                    <div className="text-3xl font-black text-white font-[var(--font-heading)] group-hover:text-jcc-accent transition-colors mb-1">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 font-black">{stat.label}</div>
                </div>
            ))}
        </div>

        {/* Action Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div>
                <h4 className="text-lg font-black text-white mb-1 uppercase tracking-tight">Building the Circle Together</h4>
                <p className="text-white/77 text-[13px] font-medium">Want to play alongside {member.name.split(" ")[0]} this Sunday?</p>
            </div>
            <Link href="/register" className="btn-vibrant-blue text-[13px]">
                REGISTER FOR NEXT MATCH
            </Link>
        </div>
      </div>
    </div>
  );
}
