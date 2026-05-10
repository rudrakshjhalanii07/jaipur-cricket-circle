"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Share2, Globe, Trophy, Target, Shield, Info } from "lucide-react";
import Link from "next/link";
import { members, teams } from "@/lib/data";
import { notFound } from "next/navigation";
import SectionHeading from "@/components/SectionHeading";

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const member = members.find((m) => m.id === id);

  if (!member) {
    notFound();
  }

  const team = member.team !== "Unassigned" ? teams[member.team.toLowerCase()] : null;
  const teamColor = member.team === "Mavericks" ? "text-jcc-accent" : member.team === "NeuroStrikers" ? "text-jcc-ball-red" : "text-white/40";
  const teamBg = member.team === "Mavericks" ? "bg-jcc-accent/5" : member.team === "NeuroStrikers" ? "bg-jcc-ball-red/5" : "bg-white/5";

  return (
    <div className="min-h-screen pt-28 pb-20 noise-overlay bg-jcc-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-[13px] text-white/40 hover:text-jcc-accent transition-colors duration-300 group font-black uppercase tracking-widest"
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
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-white font-[var(--font-heading)]">
                  {member.initials}
                </div>
              )}
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
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 font-black uppercase tracking-widest text-[11px]">
                    <Share2 className="w-4 h-4" />
                    Share Profile
                </button>
                <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300">
                    <Globe className="w-5 h-5" />
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
              <p className="text-white/60 text-lg leading-relaxed font-medium">
                {member.shortBio}
              </p>
            </div>

            {/* Cricket Specs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Target className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Batting Style</span>
                    </div>
                    <span className="text-white font-black uppercase tracking-wide">{member.battingStyle}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Shield className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Bowling Style</span>
                    </div>
                    <span className="text-white font-black uppercase tracking-wide">{member.bowlingStyle}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Trophy className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Primary Role</span>
                    </div>
                    <span className="text-white font-black capitalize tracking-wide">{member.cricketRole}</span>
                </div>
                <div className="premium-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Info className="w-4 h-4 text-jcc-accent" />
                        <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Joined JCC</span>
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
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-black">{stat.label}</div>
                </div>
            ))}
        </div>

        {/* Action Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div>
                <h4 className="text-lg font-black text-white mb-1 uppercase tracking-tight">Building the Circle Together</h4>
                <p className="text-white/50 text-[13px] font-medium">Want to play alongside {member.name.split(" ")[0]} this Sunday?</p>
            </div>
            <Link href="/register" className="btn-vibrant-blue text-[13px]">
                REGISTER FOR NEXT MATCH
            </Link>
        </div>
      </div>
    </div>
  );
}
