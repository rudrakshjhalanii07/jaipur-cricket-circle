"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Member, MemberTag } from "@/lib/data";

const tagLabels: Record<MemberTag, string> = { 
  "founding-member": "Founder", 
  captain: "Captain", 
  "vice-captain": "Vice Captain", 
  batter: "Batter", 
  bowler: "Bowler", 
  "all-rounder": "All-Rounder", 
  wicketkeeper: "Wicketkeeper" 
};

const teamAccent: Record<string, string> = { 
  Mavericks: "from-jcc-blue/10 to-transparent", 
  NeuroStrikers: "from-jcc-red/10 to-transparent", 
  Unassigned: "from-jcc-muted/5 to-transparent" 
};

const avatarStyle: Record<string, string> = { 
  Mavericks: "bg-jcc-blue/5 text-jcc-blue-deep border-jcc-blue/20", 
  NeuroStrikers: "bg-jcc-red/5 text-jcc-red border-jcc-red/20", 
  Unassigned: "bg-jcc-bg text-jcc-muted border-jcc-border" 
};

export default function MemberCard({ member, index }: { member: Member; index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true }} 
      transition={{ duration: 0.5, delay: index * 0.05 }} 
      whileHover={{ scale: 1.03, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } }} 
      className="group h-full"
    >
      <Link href={`/members/${member.id}`} className="block h-full">
        <div className="glass-card relative overflow-hidden h-full transition-all duration-400 group-hover:border-jcc-blue/30 group-hover:shadow-xl group-hover:shadow-jcc-blue/5">
          <div className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b ${teamAccent[member.team]} opacity-60`} />
          <div className="relative z-10 p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 border ${avatarStyle[member.team]} transition-all duration-300 group-hover:scale-110 overflow-hidden`}>
                {member.image ? (
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  member.initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-jcc-navy truncate font-[var(--font-heading)] group-hover:text-jcc-blue-deep transition-colors">{member.name}</h3>
                <p className="text-[11px] text-jcc-muted mb-2 tracking-wider uppercase font-medium">{member.team}</p>
                <p className="text-[13px] text-jcc-muted leading-relaxed mb-3 line-clamp-2">{member.role}</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.tags.map((tag) => (
                    <span key={tag} className={`tag-${tag} text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-all duration-200 group-hover:scale-105`}>
                      {tagLabels[tag]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </Link>
    </motion.div>
  );
}
