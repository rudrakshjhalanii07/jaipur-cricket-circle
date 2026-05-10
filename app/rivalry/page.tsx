"use client";

import { motion } from "framer-motion";
import { Swords, Trophy, MapPin, Calendar, Star, TrendingUp, History } from "lucide-react";
import ScorelineCard from "@/components/ScorelineCard";
import SectionHeading from "@/components/SectionHeading";
import { rivalryData, matchHistory } from "@/lib/data";
import { fadeUp, scaleIn, staggerContainer, VIEWPORT_CONFIG } from "@/lib/animations";

export default function RivalryPage() {
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
            <History className="w-3.5 h-3.5 text-jcc-ball-red" />
            <span className="text-[10px] font-black text-white/50 tracking-[0.25em] uppercase">
              {rivalryData.totalMatches} Matches Recorded
            </span>
          </motion.div>
        </div>

        <SectionHeading
          title="The Rivalry"
          subtitle="Mavericks vs NeuroStrikers — the battle that defines the circle."
          accentColor="red"
        />

        {/* Scoreboard Section */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24"
        >
          <motion.div variants={fadeUp}>
            <ScorelineCard
              label="Main Series"
              team1="Mavericks"
              team1Score={rivalryData.mainSeries.mavericks}
              team1Color="text-jcc-accent"
              team2="NeuroStrikers"
              team2Score={rivalryData.mainSeries.neuroStrikers}
              team2Color="text-jcc-ball-red"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <ScorelineCard
              label="Exhibition Series"
              team1="Mavericks"
              team1Score={rivalryData.exhibitionSeries.mavericks}
              team1Color="text-jcc-accent"
              team2="NeuroStrikers"
              team2Score={rivalryData.exhibitionSeries.neuroStrikers}
              team2Color="text-jcc-ball-red"
            />
          </motion.div>
        </motion.div>

        {/* Detailed Match History */}
        <SectionHeading
          title="Match History"
          subtitle="Every run, every wicket, every story from the pitch."
          accentColor="gold"
        />

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="space-y-4 max-w-4xl mx-auto mb-24"
        >
          {matchHistory.map((match, i) => (
            <motion.div
              key={match.id}
              variants={fadeUp}
              className="premium-card p-6 sm:p-8 hover:border-jcc-accent/30 transition-all duration-300 group"
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Score Column */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${match.type === 'main' ? 'bg-jcc-ball-red/10 text-jcc-ball-red' : 'bg-purple-500/10 text-purple-400'}`}>
                        {match.type} match
                    </span>
                    <span className="text-[11px] text-white/40 font-mono font-bold">
                        {new Date(match.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xl font-black font-[var(--font-heading)] uppercase tracking-tight ${match.winner === 'Mavericks' ? 'text-jcc-accent' : 'text-white/40'}`}>Mavericks</span>
                    <span className="text-xl font-mono text-white font-black">{match.team1Score}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xl font-black font-[var(--font-heading)] uppercase tracking-tight ${match.winner === 'NeuroStrikers' ? 'text-jcc-ball-red' : 'text-white/40'}`}>NeuroStrikers</span>
                    <span className="text-xl font-mono text-white font-black">{match.team2Score}</span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden sm:block w-px bg-white/10" />

                {/* Details Column */}
                <div className="flex-1 flex flex-col justify-center">
                    <p className="text-white text-base font-black uppercase tracking-tight mb-2 group-hover:translate-x-1 transition-transform">
                        {match.result}
                    </p>
                    <p className="text-white/80 text-[14px] leading-relaxed line-clamp-2 mb-4 font-medium">
                        {match.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-bold uppercase tracking-widest">
                            <Star className="w-3 h-3 text-jcc-gold" />
                            <span>{match.playerOfTheMatch}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-white/30 uppercase tracking-widest">
                            <MapPin className="w-3 h-3" />
                            <span>{match.venue.split(' ').slice(0, 2).join(' ')}</span>
                        </div>
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Rivalry Stats Grid */}
        <SectionHeading title="Inside the Numbers" accentColor="blue" />
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT_CONFIG}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {[
            { label: "Matches Played", value: rivalryData.totalMatches, icon: History, color: "text-jcc-accent" },
            { label: "Mavericks Wins", value: rivalryData.mainSeries.mavericks + rivalryData.exhibitionSeries.mavericks, icon: Trophy, color: "text-jcc-accent" },
            { label: "NeuroStrikers Wins", value: rivalryData.mainSeries.neuroStrikers + rivalryData.exhibitionSeries.neuroStrikers, icon: Trophy, color: "text-jcc-ball-red" },
            { label: "Win Rate", value: "50%", icon: TrendingUp, color: "text-jcc-gold" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              className="premium-card p-8 text-center group transition-all duration-500 hover:shadow-2xl"
            >
              <stat.icon className={`w-8 h-8 ${stat.color} mx-auto mb-6 opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500`} />
              <div className="text-4xl font-black text-white font-[var(--font-heading)] uppercase leading-none mb-3">
                {stat.value}
              </div>
              <div className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
