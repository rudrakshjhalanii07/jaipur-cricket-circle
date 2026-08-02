"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, ChevronRight, Users } from "lucide-react";
import { staggerContainer, fadeUp, VIEWPORT_CONFIG } from "@/lib/animations";
import { type Season } from "@/lib/seasons";
import { type FullSeries, type SeriesStandingRow, type PlayerPoolRow } from "@/lib/series";
import {
  SeasonHeader,
  SeasonLeagueTable,
  PlayoffBracket,
  SwipeableStandings,
  StatsLeaderboards,
  SectionHeading,
  SeriesCard,
  SeriesProgression,
  PlayerPhotoContext,
  type LeaderboardSet,
} from "../SeasonsPageClient";
import PlayersPoolModal from "@/components/PlayersPoolModal";
import PlayerCareerCardProvider from "@/components/PlayerCareerCardProvider";
import { type PlayerPhotoMap } from "@/lib/player-photos";
import { type ClubRosterRow } from "@/lib/club-roster";

interface SeasonDetailClientProps {
  season: Season;
  series: FullSeries[];
  playersPool: PlayerPoolRow[];
  careerPool: PlayerPoolRow[];
  clubRoster: ClubRosterRow[];
  overallStandings: SeriesStandingRow[];
  currentSeriesStandings: SeriesStandingRow[];
  finalsStandings: SeriesStandingRow[];
  latestSeriesName: string | null;
  seasonLeaderboards: LeaderboardSet;
  careerLeaderboards: LeaderboardSet;
  playerPhotos: PlayerPhotoMap;
}

export default function SeasonDetailClient({
  season,
  series,
  playersPool,
  careerPool,
  clubRoster,
  overallStandings,
  currentSeriesStandings,
  finalsStandings,
  latestSeriesName,
  seasonLeaderboards,
  careerLeaderboards,
  playerPhotos,
}: SeasonDetailClientProps) {
  const [poolOpen, setPoolOpen] = useState(false);

  return (
    <PlayerCareerCardProvider clubRoster={clubRoster} careerLeaderboards={careerLeaderboards}>
    <PlayerPhotoContext.Provider value={playerPhotos}>
    <div className="min-h-screen page-top pb-20 relative overflow-hidden arena-bg theme-static-navy">
      <div className="arena-hatch z-0" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

        {/* ── Header ── */}
        <div className="mb-12">
          <Link
            href="/seasons"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-jcc-accent transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Seasons
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] uppercase tracking-[0.45em] text-jcc-accent-dark font-black">
              Season Archive
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
            {season.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03]">
              <span className="font-mono font-black text-jcc-accent text-sm">{season.total_matches_played}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Matches This Season</span>
            </div>
            <button
              onClick={() => setPoolOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:border-jcc-accent/40 hover:bg-white/[0.06] transition-all"
            >
              <Users className="w-3.5 h-3.5 text-jcc-accent" />
              <span className="font-mono font-black text-jcc-accent text-sm">{playersPool.length}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Players Pool</span>
            </button>
          </div>
        </div>

        {/* ── Season Scoreboard (final tally) ── */}
        <div className="mb-16">
          <SeasonHeader season={season} archived />
        </div>

        {/* ── Final League Table ── */}
        <div className="mb-16">
          <SectionHeading eyebrow="Points · Net Run Rate · Form" title="Final League Table" />
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <SeasonLeagueTable
              standings={overallStandings}
              matches={series.flatMap((s) => s.matches)}
              title="Final Standings"
            />
          </motion.div>
        </div>

        {/* ── Final Week Bracket ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
          <PlayoffBracket series={series} standings={overallStandings} />
        </motion.div>

        {/* ── Standings ── */}
        {overallStandings.length > 0 && (
          <div className="mb-16">
            <SectionHeading eyebrow="Points Table · Swipe to Compare" title="Standings" />
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <SwipeableStandings
                current={currentSeriesStandings}
                overall={overallStandings}
                finals={finalsStandings}
                currentSeriesName={latestSeriesName}
              />
            </motion.div>
          </div>
        )}

        {/* ── Player Stats ── */}
        <div className="mb-16">
          <SectionHeading eyebrow="Batting · Bowling · MVP · Fielding" title="Player Stats" />
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <StatsLeaderboards
              season={seasonLeaderboards}
              career={careerLeaderboards}
              seasonLabel={season.season_label ?? "This Season"}
            />
          </motion.div>
        </div>

        {/* ── Match Archive ── */}
        <div className="mb-16">
          <SectionHeading eyebrow="Complete Scorecards & AI Reports" title="Match Archive" />
          <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={VIEWPORT_CONFIG} className="space-y-4">
            {series.map((s) => (
              <motion.div key={s.id} variants={fadeUp}>
                <SeriesCard series={s} />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Progression Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <SeriesProgression series={series} />
        </motion.div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-jcc-accent/20 bg-gradient-to-br from-[var(--jcc-navy)] to-[var(--jcc-navy-light)] p-8 text-center"
        >
          <Trophy className="w-8 h-8 text-jcc-gold mx-auto mb-3" />
          <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
            The Chapter Closed Here
          </h3>
          <p className="text-white/40 text-sm font-medium mb-5 max-w-sm mx-auto">
            See how the story continues in the current season.
          </p>
          <Link
            href="/seasons"
            className="inline-flex items-center gap-2 btn-vibrant-blue text-sm font-black"
          >
            Back to Current Season
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>

      <PlayersPoolModal
        isOpen={poolOpen}
        onClose={() => setPoolOpen(false)}
        players={playersPool}
        seasonLabel={season.season_label ?? "This Season"}
        roster={clubRoster}
        careerPool={careerPool}
        photos={playerPhotos}
      />
    </div>
    </PlayerPhotoContext.Provider>
    </PlayerCareerCardProvider>
  );
}
