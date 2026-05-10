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
  Mavericks: "from-jcc-accent/20 to-transparent", 
  NeuroStrikers: "from-jcc-ball-red/20 to-transparent", 
  Unassigned: "from-white/5 to-transparent" 
};

const avatarStyle: Record<string, string> = { 
  Mavericks: "bg-jcc-accent/10 text-jcc-accent border-jcc-accent/30", 
  NeuroStrikers: "bg-jcc-ball-red/10 text-jcc-ball-red border-jcc-ball-red/30", 
  Unassigned: "bg-white/5 text-white/40 border-white/10" 
};

export default function MemberCard({ member, index }: { member: Member; index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: false, amount: 0.2 }} 
      transition={{ duration: 0.5, delay: index * 0.05 }} 
      whileHover={{ scale: 1.03, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const } }} 
      className="group h-full"
    >
      <Link href={`/members/${member.id}`} className="block h-full">
        <div className="premium-card relative overflow-hidden h-full transition-all duration-400 group-hover:border-jcc-accent/30 group-hover:shadow-xl group-hover:shadow-jcc-accent/5">
          <div className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b ${teamAccent[member.team]} opacity-60`} />
          <div className="relative z-10 p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black shrink-0 border ${avatarStyle[member.team]} transition-all duration-300 group-hover:scale-110 overflow-hidden shadow-inner`}>
                {member.image ? (
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="drop-shadow-sm">{member.initials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-[17px] font-black truncate font-[var(--font-heading)] uppercase tracking-tight transition-colors ${member.team === 'Mavericks' ? 'text-jcc-accent' : member.team === 'NeuroStrikers' ? 'text-jcc-ball-red' : 'text-white'}`}>{member.name}</h3>
                <p className={`text-[10px] mb-2 tracking-[0.25em] uppercase font-black opacity-60`}>{member.team}</p>
                <p className="text-[14px] text-white/90 leading-relaxed mb-4 line-clamp-2 font-semibold">{member.role}</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.tags.map((tag) => (
                    <span key={tag} className={`tag-${tag} text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-[0.15em] transition-all duration-200 group-hover:scale-105`}>
                      {tagLabels[tag]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jcc-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </Link>
    </motion.div>
  );
}
