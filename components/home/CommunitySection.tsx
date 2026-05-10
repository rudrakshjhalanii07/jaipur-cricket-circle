"use client";

import { motion } from "framer-motion";
import NextLink from "next/link";
import { Users, ChevronRight, ShieldCheck, Heart, CalendarCheck } from "lucide-react";
import { members } from "@/lib/data";
import Image from "next/image";

export default function CommunitySection() {
  const displayMembers = members.slice(0, 8);

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
          {displayMembers.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ delay: i * 0.05 }}
              className="premium-card p-5 group"
            >
              <div className="relative mb-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  <Image
                    src={member.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                    alt={member.name}
                    width={200}
                    height={200}
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-jcc-text-muted">
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
          ))}
        </div>

        {/* Community Stats Strip — Structured */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ delay: 0.4 }}
          className="mt-20 flex flex-wrap justify-center gap-12"
        >
          {[
            { label: "Active Players", value: "48", icon: Users },
            { label: "Sunday Games", value: "150+", icon: CalendarCheck },
            { label: "Community Events", value: "12", icon: Heart },
          ].map((stat, i) => (
            <div key={i} className="text-center group">
              <div className="flex items-center justify-center gap-3 mb-2">
                <stat.icon className="w-5 h-5 text-jcc-accent" />
                <span className="text-3xl font-black text-white group-hover:text-jcc-accent transition-colors">
                  {stat.value}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-jcc-text-muted">
                {stat.label}
              </span>
            </div>
          ))}
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
