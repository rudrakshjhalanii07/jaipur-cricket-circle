"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import NextLink from "next/link";
import { Users, ChevronRight, ShieldCheck, Heart, Trophy, Calendar } from "lucide-react";
import { getDiceBearUrl } from "@/lib/avatar";
import type { CommunityMember } from "@/app/page";

function MemberPhoto({
  src,
  name,
  team,
  className,
}: {
  src?: string | null;
  name: string;
  team?: string | null;
  className?: string;
}) {
  const [photoError, setPhotoError] = useState(false);
  const fallback = getDiceBearUrl(name, team);
  if (src && !photoError) {
    return (
      <Image
        src={src}
        alt={name}
        width={320}
        height={320}
        loading="lazy"
        className={className}
        onError={() => setPhotoError(true)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback} alt={name} className={className} />;
}

interface CommunitySectionProps {
  members: CommunityMember[];
  stats: {
    activePlayers: string;
    sundayGames: string;
    sundaysActive: string;
    communityLove: string;
  };
}

export default function CommunitySection({ members, stats }: CommunitySectionProps) {
  return (
    <section id="community" className="py-24 sm:py-32 relative section-bg-navy overflow-hidden">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
          {members.map((member, i) => {
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
                className={`premium-card p-3 sm:p-5 group transition-all duration-300 ${borderHighlight}`}
              >
                <div className="relative mb-4">
                  <div className={`aspect-square rounded-xl overflow-hidden bg-white/5 border relative flex items-center justify-center transition-all duration-300 ${avatarBorder}`}>
                    <MemberPhoto
                      src={member.image}
                      name={member.name}
                      team={member.team}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {member.tags.includes("captain") && (
                    <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-jcc-accent flex items-center justify-center text-white shadow-lg border-2 border-jcc-navy">
                      <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    {member.name}
                  </h3>
                  <div className="flex flex-col gap-1 items-start sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${teamTextColor}`}>
                      {member.team || "Circle Member"}
                    </span>
                    <span className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md uppercase tracking-tighter ${
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
