"use client";

import { motion } from "framer-motion";
import { Swords, Trophy, MapPin, Calendar, Star, TrendingUp, History } from "lucide-react";
import ScorelineCard from "@/components/ScorelineCard";
import SectionHeading from "@/components/SectionHeading";
import { rivalryData, matchHistory } from "@/lib/data";

export default function RivalryPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 noise-overlay bg-jcc-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-jcc-red/[0.06] border border-jcc-red/15 mb-6"
          >
            <History className="w-3.5 h-3.5 text-jcc-red" />
            <span className="text-[10px] font-bold text-jcc-red tracking-[0.25em] uppercase">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">
          <ScorelineCard
            label="Main Series"
            team1="Mavericks"
            team1Score={rivalryData.mainSeries.mavericks}
            team1Color="text-jcc-blue-deep"
            team2="NeuroStrikers"
            team2Score={rivalryData.mainSeries.neuroStrikers}
            team2Color="text-jcc-red"
          />
          <ScorelineCard
            label="Exhibition Series"
            team1="Mavericks"
            team1Score={rivalryData.exhibitionSeries.mavericks}
            team1Color="text-jcc-blue-deep"
            team2="NeuroStrikers"
            team2Score={rivalryData.exhibitionSeries.neuroStrikers}
            team2Color="text-jcc-red"
          />
        </div>

        {/* Detailed Match History */}
        <SectionHeading
          title="Match History"
          subtitle="Every run, every wicket, every story from the pitch."
          accentColor="gold"
        />

        <div className="space-y-4 max-w-4xl mx-auto mb-24">
          {matchHistory.map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="glass-card p-6 sm:p-8 hover:border-jcc-blue/30 transition-all duration-300 group"
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Score Column */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${match.type === 'main' ? 'bg-jcc-red/10 text-jcc-red' : 'bg-jcc-purple/10 text-jcc-purple'}`}>
                        {match.type} match
                    </span>
                    <span className="text-[11px] text-jcc-muted font-mono">
                        {new Date(match.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-bold font-[var(--font-heading)] ${match.winner === 'Mavericks' ? 'text-jcc-blue-deep' : 'text-jcc-muted'}`}>Mavericks</span>
                    <span className="text-xl font-mono text-jcc-navy font-bold">{match.team1Score}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold font-[var(--font-heading)] ${match.winner === 'NeuroStrikers' ? 'text-jcc-red' : 'text-jcc-muted'}`}>NeuroStrikers</span>
                    <span className="text-xl font-mono text-jcc-navy font-bold">{match.team2Score}</span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden sm:block w-px bg-jcc-border" />

                {/* Details Column */}
                <div className="flex-1 flex flex-col justify-center">
                    <p className="text-jcc-turf text-sm font-bold mb-2 group-hover:translate-x-1 transition-transform">
                        {match.result}
                    </p>
                    <p className="text-jcc-muted text-[13px] leading-relaxed line-clamp-2 mb-4 font-medium">
                        {match.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[11px] text-jcc-muted font-semibold">
                            <Star className="w-3 h-3 text-jcc-gold" />
                            <span>{match.playerOfTheMatch}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-jcc-muted">
                            <MapPin className="w-3 h-3" />
                            <span>{match.venue.split(' ').slice(0, 2).join(' ')}</span>
                        </div>
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Rivalry Stats Grid */}
        <SectionHeading title="Inside the Numbers" accentColor="blue" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: "Matches Played", value: rivalryData.totalMatches, icon: History },
            { label: "Mavericks Wins", value: rivalryData.mainSeries.mavericks + rivalryData.exhibitionSeries.mavericks, icon: Trophy },
            { label: "NeuroStrikers Wins", value: rivalryData.mainSeries.neuroStrikers + rivalryData.exhibitionSeries.neuroStrikers, icon: Trophy },
            { label: "Win Rate", value: "50%", icon: TrendingUp },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card p-6 text-center hover:border-jcc-blue/30 transition-all duration-300"
            >
              <stat.icon className="w-6 h-6 text-jcc-blue-deep mx-auto mb-4 opacity-50" />
              <div className="text-2xl font-bold text-jcc-navy font-[var(--font-heading)]">
                {stat.value}
              </div>
              <div className="text-[9px] text-jcc-muted uppercase tracking-[0.2em] mt-1 font-bold">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
