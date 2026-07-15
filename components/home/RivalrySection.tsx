import Link from "next/link";
import { ChevronRight, Swords, Zap } from "lucide-react";
import ScorelineCard from "@/components/ScorelineCard";
import { AnimateIn } from "@/components/AnimateIn";
import type { RivalrySeason } from "@/lib/rivalry";
import type { RecentMatch } from "@/app/page";
import { TEAMS } from "@/lib/teams";

const DOT_COLOR: Record<string, string> = {
  Mavericks: TEAMS.mavericks.primary,
  NeuroStrikers: TEAMS.neurostrikers.primary,
  "The Outliers": TEAMS.outliers.primary,
};

interface RivalrySectionProps {
  activeSeason: RivalrySeason;
  recentMatches: RecentMatch[];
  latestMatch: RecentMatch | null;
}

export default function RivalrySection({
  activeSeason,
  recentMatches,
  latestMatch,
}: RivalrySectionProps) {
  const isThreeWay = !!activeSeason.outliers_captain;

  return (
    <section id="rivalry" className="py-24 sm:py-32 relative overflow-hidden section-bg-navy">
      <div className="absolute top-0 left-0 right-0 h-px bg-white/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-linear-to-r from-transparent via-jcc-accent to-transparent opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-jcc-accent/10 blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-16">
          <span className="inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.5em] text-jcc-accent font-black">
            <Zap className="w-5 h-5 animate-pulse" />
            ACTIVE {isThreeWay ? "3-CAPTAIN" : "CAPTAIN"} RIVALRY
          </span>
          <h2 className="text-3xl min-[380px]:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter mt-6 uppercase italic leading-tight">
            Mavericks vs
            {isThreeWay ? (
              <>
                <br />
                <span className="text-gradient-cyan">NeuroStrikers</span> vs{" "}
                <span style={{ color: TEAMS.outliers.primary }}>Outliers</span>
              </>
            ) : (
              <>
                {" "}
                <span className="text-gradient-cyan">NeuroStrikers</span>
              </>
            )}
          </h2>
          <p className="mt-4 text-white/65 text-[12px] uppercase tracking-widest font-black">
            {activeSeason.title} — Cap: {activeSeason.mavericks_captain} vs {activeSeason.neurostrikers_captain}
            {isThreeWay && <> vs {activeSeason.outliers_captain}</>}
          </p>
          <p className="mt-6 text-white/70 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Every new captain pairing writes its own chapter. {isThreeWay ? "Three teams" : "Two teams"}, one circle, pure tactical drama.
          </p>
        </AnimateIn>

        <div className="relative">
          {/* VS badge — purely decorative, CSS positioned */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden lg:flex">
            <div className="w-16 h-16 rounded-full bg-jcc-navy-deep border-2 border-jcc-accent/30 shadow-[0_0_30px_rgba(212,175,55,0.2)] flex items-center justify-center">
              <Swords className="w-7 h-7 text-jcc-accent" />
            </div>
          </div>

          {/* ScorelineCard is a Client Component — handles its own animated count-up */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ScorelineCard
              label="Main Series Score"
              team1="Mavericks" team1Score={activeSeason.mavericks_main_wins} team1Color="text-jcc-accent" team1Ties={activeSeason.mavericks_main_ties ?? 0}
              team2="NeuroStrikers" team2Score={activeSeason.neurostrikers_main_wins} team2Color="text-jcc-ball-red" team2Ties={activeSeason.neurostrikers_main_ties ?? 0}
              team3={isThreeWay ? "Outliers" : undefined}
              team3Score={isThreeWay ? activeSeason.outliers_main_wins : undefined}
              team3Color={isThreeWay ? "text-[#1A7A5E]" : undefined}
              team3Ties={isThreeWay ? (activeSeason.outliers_main_ties ?? 0) : undefined}
              isDark={true}
            />
            <ScorelineCard
              label="Exhibition Series Score"
              team1="Mavericks" team1Score={activeSeason.mavericks_exhibition_wins} team1Color="text-jcc-accent" team1Ties={activeSeason.mavericks_exhibition_ties ?? 0}
              team2="NeuroStrikers" team2Score={activeSeason.neurostrikers_exhibition_wins} team2Color="text-jcc-ball-red" team2Ties={activeSeason.neurostrikers_exhibition_ties ?? 0}
              team3={isThreeWay ? "Outliers" : undefined}
              team3Score={isThreeWay ? activeSeason.outliers_exhibition_wins : undefined}
              team3Color={isThreeWay ? "text-[#1A7A5E]" : undefined}
              team3Ties={isThreeWay ? (activeSeason.outliers_exhibition_ties ?? 0) : undefined}
              isDark={false}
            />
          </div>
        </div>

        {latestMatch && (
          <AnimateIn delay={400} className="mt-12 flex justify-center">
            <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-jcc-accent">Latest Match</span>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-sm font-bold text-white">
                {latestMatch.result || "Latest result"}
              </span>
              <div className="w-px h-4 bg-white/20 hidden sm:block" />
              <span
                className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest"
                style={{
                  color: DOT_COLOR[latestMatch.winner] ?? "#fff",
                  backgroundColor: `${DOT_COLOR[latestMatch.winner] ?? "#fff"}20`,
                }}
              >
                {latestMatch.winner} WON
              </span>
            </div>
          </AnimateIn>
        )}

        <AnimateIn delay={500} className="mt-12 flex items-center justify-center gap-3">
          {recentMatches.map((match) => (
            <div
              key={match.id}
              className="w-2.5 h-2.5 rounded-full border border-white/10"
              style={{
                background: DOT_COLOR[match.winner] ?? "rgba(255,255,255,0.2)",
                boxShadow: DOT_COLOR[match.winner] ? `0 0 10px ${DOT_COLOR[match.winner]}66` : "none",
              }}
              title={`${match.date}: ${match.result}`}
            />
          ))}
        </AnimateIn>

        <div className="text-center mt-12">
          <Link href="/rivalry" className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white font-black text-[13px] hover:bg-white/10 hover:border-jcc-accent/50 transition-all duration-300">
            <Swords className="w-4 h-4 text-jcc-accent" />
            FULL RIVALRY HISTORY
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
