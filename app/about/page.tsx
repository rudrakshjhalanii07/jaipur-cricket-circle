"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Download,
  FileText,
  Users,
  Trophy,
  Calendar,
  Heart,
  Shield,
  Target,
  Zap,
  ChevronRight,
  Newspaper,
  Swords,
  Star,
  Crown,
} from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabase";
import { fetchRivalrySeasons } from "@/lib/rivalry";

// ─── Static committee data ────────────────────────────────────────────────────

const CORE_COMMITTEE = [
  { name: "Opal Chaudhary", role: "Co-Founder", governanceRole: "Core Committee" },
  { name: "Nitin Setia", role: "Co-Founder", governanceRole: "Core Committee" },
  { name: "Sagar Sharma", role: "Co-Founder", governanceRole: "Core Committee" },
  { name: "Nitesh Jhurani", role: "Co-Founder", governanceRole: "Core Committee" },
  { name: "Abhijeet Singh Shekhawat", role: "Co-Founder", governanceRole: "Core Committee" },
];

// In the Executive Committee, co-founders carry their founding role;
// Anil and Rudraksh are permanent members. Sagar, Anil, and Rudraksh
// currently hold captaincy seats (provision for 3–4 captains per season).
const EXEC_COMMITTEE_ROLES: Record<string, { role: string; captainSeat?: boolean }> = {
  "Opal Chaudhary":          { role: "Co-Founder" },
  "Nitin Setia":             { role: "Co-Founder" },
  "Sagar Sharma":            { role: "Co-Founder", captainSeat: true },
  "Nitesh Jhurani":          { role: "Co-Founder" },
  "Abhijeet Singh Shekhawat":{ role: "Co-Founder" },
  "Anil Rawat":              { role: "Permanent Member", captainSeat: true },
  "Rudraksh Jhalani":        { role: "Permanent Member", captainSeat: true },
};

const EXEC_ONLY = [
  { name: "Anil Rawat",      role: "Permanent Member", governanceRole: "Executive Committee" },
  { name: "Rudraksh Jhalani",role: "Permanent Member", governanceRole: "Executive Committee" },
];

type PlayerPhoto = { name: string; image_url: string | null; team: string | null };

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommitteeMemberCard({
  name,
  role,
  governanceRole,
  photoUrl,
  team,
  isCaptain = false,
  delay = 0,
  size = "md",
}: {
  name: string;
  role: string;
  governanceRole: string;
  photoUrl?: string | null;
  team?: string | null;
  isCaptain?: boolean;
  delay?: number;
  size?: "sm" | "md";
}) {
  const isCore = governanceRole === "Core Committee";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay }}
      className={`premium-card flex flex-col items-center text-center group transition-all duration-300 ${
        size === "md" ? "p-7" : "p-5"
      } ${isCore ? "hover:border-jcc-gold/30" : "hover:border-white/20"}`}
    >
      <div className="relative mb-4">
        <PlayerAvatar
          src={photoUrl}
          name={name}
          team={team}
          className={`rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${
            size === "md" ? "w-20 h-20" : "w-14 h-14"
          } ${isCore ? "border-jcc-gold/30 group-hover:border-jcc-gold/60" : "border-white/10 group-hover:border-white/25"}`}
          imgClassName="w-full h-full object-cover"
        />
        {isCore && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-jcc-gold/20 border border-jcc-gold/40 flex items-center justify-center">
            <Star className="w-2.5 h-2.5 text-jcc-gold" />
          </div>
        )}
      </div>
      <p className={`font-black text-white font-[var(--font-heading)] leading-tight mb-0.5 ${size === "md" ? "text-[15px]" : "text-[13px]"}`}>
        {name}
      </p>
      <p className={`text-white/40 font-bold uppercase tracking-widest mb-2 ${size === "md" ? "text-[9px]" : "text-[8px]"}`}>
        {role}
      </p>
      <div className="flex flex-wrap justify-center gap-1">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest ${
          size === "md" ? "text-[8px]" : "text-[7px]"
        } ${
          isCore
            ? "bg-jcc-gold/10 border border-jcc-gold/20 text-jcc-gold"
            : "bg-white/[0.04] border border-white/10 text-white/40"
        }`}>
          {isCore && <Crown className="w-2 h-2" />}
          {governanceRole}
        </span>
        {isCaptain && (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest bg-jcc-accent/10 border border-jcc-accent/30 text-jcc-accent ${
            size === "md" ? "text-[8px]" : "text-[7px]"
          }`}>
            <Trophy className="w-2 h-2" />
            Captain
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Sundays elapsed since the JCC first gathered (March 2026).
const JCC_FOUNDING_SUNDAY = new Date("2026-03-01");
function sundaysElapsed(): number {
  return Math.floor((Date.now() - JCC_FOUNDING_SUNDAY.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function AboutPage() {
  const [photos, setPhotos] = useState<PlayerPhoto[]>([]);
  const [stats] = useState({
    activePlayers: "50+",
    matchesPlayed: "40+",
    sundaysActive: `${sundaysElapsed()}+`,
    communityLove: "∞",
  });

  useEffect(() => {
    async function load() {
      try {
        const { data: playerRows } = await supabase
          .from("players")
          .select("name, image_url, team")
          .eq("approval_status", "approved");

        if (playerRows) setPhotos(playerRows);
      } catch (err) {
        console.error("Error loading about page data:", err);
      }
    }
    load();
  }, []);

  function getPhoto(name: string) {
    const target = name.toLowerCase().replace(/[^a-z]/g, "");
    return (
      photos.find((p) => {
        const dbName = p.name.toLowerCase().replace(/[^a-z]/g, "");
        return dbName === target || dbName.includes(target) || target.includes(dbName);
      }) ?? null
    );
  }

  return (
    <div className="min-h-screen pt-36 pb-24 relative overflow-hidden hero-gradient">
      <div className="absolute inset-0 stadium-glow opacity-50 z-0" />
      <div className="absolute inset-0 noise-overlay opacity-20 pointer-events-none z-0" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">

        {/* ── Hero ── */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-jcc-gold/[0.08] border border-jcc-gold/20 mb-6"
          >
            <Star className="w-3 h-3 text-jcc-gold" />
            <span className="text-[10px] font-black text-jcc-gold/70 tracking-[0.25em] uppercase">
              Community Charter · V1.0 · June 2026
            </span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight leading-none mb-4">
            Jaipur Cricket Circle
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="text-base sm:text-lg text-white/40 font-bold uppercase tracking-[0.2em]"
          >
            United by Cricket, Defined by Character.
          </motion.p>
        </div>

        {/* ── Vision & Mission ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="premium-card p-8 flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center mb-5">
              <Target className="w-5 h-5 text-jcc-accent" />
            </div>
            <h2 className="text-xs font-black text-jcc-accent uppercase tracking-[0.25em] mb-3">Our Vision</h2>
            <p className="text-white/70 text-[15px] leading-relaxed font-medium flex-1">
              To build Jaipur&apos;s most welcoming and enjoyable amateur cricket community where people come together to play competitive cricket, make friendships, stay active and create lasting memories.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: 0.1 }}
            className="premium-card p-8 flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xs font-black text-emerald-400 uppercase tracking-[0.25em] mb-3">Our Mission</h2>
            <ul className="space-y-2.5 flex-1">
              {[
                "Organise fair and enjoyable cricket matches and tournaments.",
                "Provide opportunities for players of all skill levels.",
                "Promote sportsmanship, discipline and mutual respect.",
                "Value participation as much as performance.",
                "Continuously improve the quality and professionalism of our events.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/60 mt-2 shrink-0" />
                  <span className="text-white/60 text-[13px] leading-relaxed font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* ── Community Charter Download ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="premium-card p-8 sm:p-10 mb-14 border-jcc-gold/20 hover:border-jcc-gold/40 transition-colors duration-300"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-jcc-gold/10 border border-jcc-gold/25 flex items-center justify-center shrink-0">
              <FileText className="w-7 h-7 text-jcc-gold" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">
                  Community Charter
                </h2>
                <span className="px-2 py-0.5 rounded bg-jcc-gold/10 border border-jcc-gold/20 text-[9px] font-black text-jcc-gold uppercase tracking-widest">
                  V1.0
                </span>
              </div>
              <p className="text-[11px] text-white/30 font-black uppercase tracking-widest mb-2">
                Published 20 June 2026
              </p>
              <p className="text-white/50 text-sm leading-relaxed font-medium">
                The governing document of Jaipur Cricket Circle — covering our vision, mission, governance structure, conduct standards, tournament policies, and financial principles.
              </p>
            </div>
            <a
              href="/documents/JCC_Community_Charter.pdf"
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jcc-gold/10 border border-jcc-gold/30 text-jcc-gold text-[11px] font-black uppercase tracking-widest hover:bg-jcc-gold/20 transition-colors duration-200 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          </div>
        </motion.div>

        {/* ── Governance: Core Committee ── */}
        <div className="mb-16">
          <SectionHeading
            title="Core Committee"
            subtitle="The highest governing body of JCC — responsible for vision, strategy, and stewardship."
            accentColor="blue"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            {CORE_COMMITTEE.map((member, i) => {
              const p = getPhoto(member.name);
              return (
                <CommitteeMemberCard
                  key={member.name}
                  name={member.name}
                  role={member.role}
                  governanceRole={member.governanceRole}
                  photoUrl={p?.image_url}
                  team={p?.team}
                  delay={i * 0.07}
                  size="md"
                />
              );
            })}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center text-[11px] text-white/25 font-bold uppercase tracking-[0.2em]"
          >
            Decisions of the Core Committee are final and binding on all matters of governance.
          </motion.p>
        </div>

        {/* ── Governance: Executive Committee ── */}
        <div className="mb-24">
          <SectionHeading
            title="Executive Committee"
            subtitle="The operational leadership body — responsible for implementing the vision and running weekly activities."
            accentColor="blue"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...CORE_COMMITTEE, ...EXEC_ONLY].map((member, i) => {
              const p = getPhoto(member.name);
              const execCfg = EXEC_COMMITTEE_ROLES[member.name];
              const isCoreMember = CORE_COMMITTEE.some((c) => c.name === member.name);
              return (
                <CommitteeMemberCard
                  key={member.name}
                  name={member.name}
                  role={execCfg?.role ?? member.role}
                  governanceRole={isCoreMember ? "Core Committee" : "Executive Committee"}
                  photoUrl={p?.image_url}
                  team={p?.team}
                  isCaptain={execCfg?.captainSeat ?? false}
                  delay={i * 0.06}
                  size="sm"
                />
              );
            })}
          </div>
        </div>

        {/* ── Impact Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-24">
          {[
            { icon: Users, value: stats.activePlayers, label: "Active Members", color: "text-jcc-accent" },
            { icon: Trophy, value: stats.matchesPlayed, label: "Matches Played", color: "text-emerald-400" },
            { icon: Calendar, value: stats.sundaysActive, label: "Sundays Active", color: "text-purple-400" },
            { icon: Heart, value: stats.communityLove, label: "Community Love", color: "text-jcc-ball-red" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="premium-card p-6 text-center group hover:border-white/20 transition-all duration-300"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-4 group-hover:scale-110 transition-transform opacity-50`} />
              <div className="text-3xl font-black text-white font-[var(--font-heading)]">{stat.value}</div>
              <div className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-1 font-black">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Core Values ── */}
        <SectionHeading
          title="Our Core Values"
          subtitle="We play with respect, compete with integrity, and grow together as a community."
          accentColor="blue"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-24">
          {[
            { icon: Shield, title: "Sportsmanship", desc: "Respect match outcomes, accept decisions, and treat every participant with dignity — on and off the field.", color: "text-jcc-accent" },
            { icon: Target, title: "Integrity", desc: "We compete with honesty. No manipulation of results, no unsportsmanlike conduct — ever.", color: "text-emerald-400" },
            { icon: Users, title: "Inclusivity", desc: "Membership is open to all who share our values. Participation matters as much as performance.", color: "text-purple-400" },
            { icon: Zap, title: "Accountability", desc: "Every member is responsible for their actions. Commitment to the circle means showing up — for the game and each other.", color: "text-jcc-gold" },
            { icon: Heart, title: "Community First", desc: "Healthy rivalries are encouraged. But community spirit always takes precedence over team loyalty.", color: "text-jcc-ball-red" },
            { icon: Newspaper, title: "Storytelling", desc: "Every match has a story worth telling. Chewvana Times ensures the history of this community is never forgotten.", color: "text-purple-400" },
          ].map((value, i) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="premium-card p-7 group hover:border-white/15 transition-all duration-500"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-5 group-hover:border-white/20 transition-colors">
                <value.icon className={`w-4 h-4 ${value.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
              </div>
              <h3 className="text-[14px] font-black text-white mb-2 font-[var(--font-heading)] uppercase tracking-tight">{value.title}</h3>
              <p className="text-[12px] text-white/40 leading-relaxed font-semibold">{value.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Community Links ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="premium-card p-8 flex flex-col hover:border-purple-400/30 transition-all duration-300"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5">
              <Newspaper className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-black text-white font-[var(--font-heading)] uppercase mb-3">Chewvana Times</h3>
            <p className="text-white/50 text-sm leading-relaxed flex-1 mb-7 font-medium">
              Our weekly match reports and community chronicle — part journalism, part banter, all heart. Every Sunday&apos;s drama gets captured in the pages of the Chewvana Times.
            </p>
            <Link href="/chewvana-times" className="inline-flex items-center gap-2 text-[11px] text-purple-400 font-black uppercase tracking-widest group/link">
              Enter the Newsroom <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="premium-card p-8 flex flex-col hover:border-jcc-ball-red/30 transition-all duration-300"
          >
            <div className="w-11 h-11 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-center justify-center mb-5">
              <Swords className="w-5 h-5 text-jcc-ball-red" />
            </div>
            <h3 className="text-xl font-black text-white font-[var(--font-heading)] uppercase mb-3">The Rivalry</h3>
            <p className="text-white/50 text-sm leading-relaxed flex-1 mb-7 font-medium">
              Three teams. One circle. The competition is structured, the stakes are real, and every Sunday adds a new chapter to a legacy being written in real time.
            </p>
            <Link href="/rivalry" className="inline-flex items-center gap-2 text-[11px] text-jcc-ball-red font-black uppercase tracking-widest group/link">
              Explore Match History <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
