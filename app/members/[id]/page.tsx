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
  const teamColor = member.team === "Mavericks" ? "text-jcc-blue-deep" : member.team === "NeuroStrikers" ? "text-jcc-red" : "text-jcc-muted";
  const teamBg = member.team === "Mavericks" ? "bg-jcc-blue/[0.04]" : member.team === "NeuroStrikers" ? "bg-jcc-red/[0.04]" : "bg-jcc-bg";

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
            className="inline-flex items-center gap-2 text-[13px] text-jcc-muted hover:text-jcc-blue-deep transition-colors duration-300 group font-bold"
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
            <div className={`relative aspect-square rounded-[32px] overflow-hidden border border-jcc-border ${teamBg} shadow-sm`}>
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-jcc-navy font-[var(--font-heading)]">
                  {member.initials}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-jcc-navy/60 via-transparent to-transparent" />
              
              {/* Team Badge Overlaid */}
              <div className="absolute bottom-6 left-6 flex flex-col gap-1">
                 <span className={`text-[10px] uppercase tracking-widest font-bold ${teamColor}`}>
                    {member.team}
                 </span>
                 <h1 className="text-2xl font-bold text-white font-[var(--font-heading)]">
                    {member.name}
                 </h1>
              </div>
            </div>

            {/* Social Actions */}
            <div className="flex gap-3 mt-6">
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-jcc-border text-jcc-muted hover:text-jcc-blue-deep hover:bg-jcc-bg transition-all duration-300 shadow-sm font-bold">
                    <Share2 className="w-4 h-4" />
                    <span className="text-[12px]">Share Profile</span>
                </button>
                <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-jcc-border text-jcc-muted hover:text-jcc-blue-deep hover:bg-jcc-bg transition-all duration-300 shadow-sm">
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
                  <span key={tag} className={`tag-${tag} text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider`}>
                    {tag.replace("-", " ")}
                  </span>
                ))}
              </div>
              <h2 className="text-3xl font-bold text-jcc-navy font-[var(--font-heading)] mb-4">
                {member.role}
              </h2>
              <p className="text-jcc-muted text-lg leading-relaxed font-medium">
                {member.shortBio}
              </p>
            </div>

            {/* Cricket Specs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Target className="w-4 h-4 text-jcc-blue-deep" />
                        <span className="text-[10px] uppercase tracking-widest text-jcc-muted font-bold">Batting Style</span>
                    </div>
                    <span className="text-jcc-navy font-bold">{member.battingStyle}</span>
                </div>
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Shield className="w-4 h-4 text-jcc-blue-deep" />
                        <span className="text-[10px] uppercase tracking-widest text-jcc-muted font-bold">Bowling Style</span>
                    </div>
                    <span className="text-jcc-navy font-bold">{member.bowlingStyle}</span>
                </div>
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Trophy className="w-4 h-4 text-jcc-blue-deep" />
                        <span className="text-[10px] uppercase tracking-widest text-jcc-muted font-bold">Primary Role</span>
                    </div>
                    <span className="text-jcc-navy font-bold capitalize">{member.cricketRole}</span>
                </div>
                <div className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <Info className="w-4 h-4 text-jcc-blue-deep" />
                        <span className="text-[10px] uppercase tracking-widest text-jcc-muted font-bold">Joined JCC</span>
                    </div>
                    <span className="text-jcc-navy font-bold">
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
                <div key={i} className="glass-card p-6 text-center group hover:border-jcc-blue/30 transition-all duration-300">
                    <div className="text-3xl font-bold text-jcc-navy font-[var(--font-heading)] group-hover:text-jcc-blue-deep transition-colors mb-1">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-jcc-muted font-bold">{stat.label}</div>
                </div>
            ))}
        </div>

        {/* Action Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-white border border-jcc-border shadow-sm">
            <div>
                <h4 className="text-lg font-bold text-jcc-navy mb-1">Building the Circle Together</h4>
                <p className="text-jcc-muted text-[13px] font-medium">Want to play alongside {member.name.split(" ")[0]} this Sunday?</p>
            </div>
            <Link href="/register" className="px-8 py-3.5 rounded-xl bg-jcc-turf text-white font-bold text-[13px] shadow-lg shadow-jcc-turf/20 hover:bg-jcc-turf-dim transition-all duration-300">
                Register for Next Match
            </Link>
        </div>
      </div>
    </div>
  );
}
