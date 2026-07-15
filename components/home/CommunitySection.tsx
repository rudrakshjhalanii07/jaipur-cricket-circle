import NextLink from "next/link";
import { Users, ChevronRight, Heart, Trophy, Calendar } from "lucide-react";
import { MemberPhoto } from "./MemberPhoto";
import { AnimateIn } from "@/components/AnimateIn";
import type { CommunityMember } from "@/app/page";

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
    <section id="community" className="theme-static-dark py-24 sm:py-32 relative section-bg-royal overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-b from-black/10 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <AnimateIn className="text-center mb-16">
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
        </AnimateIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-7">
          {members.map((member, i) => {
            const isFounder = member.tags.includes("founding-member");
            const isCaptain = member.tags.includes("captain") || member.tags.includes("vice-captain");
            const cardTier = isFounder ? " id-card--founder" : isCaptain ? " id-card--captain" : "";
            const roleColor = isFounder || isCaptain ? "text-jcc-accent-dark" : "text-jcc-blue/60";

            return (
              <AnimateIn key={member.id} delay={i * 50}>
                <div className="group h-full transition-transform duration-500 ease-out hover:-translate-y-1.5 will-change-transform">
                  <div className={`id-card${cardTier} flex flex-col h-full`}>
                    <div className="portrait-frame relative w-full aspect-4/5 overflow-hidden shrink-0">
                      {/* MemberPhoto is a client island — handles photo-error fallback state */}
                      <MemberPhoto
                        src={member.image}
                        name={member.name}
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-1400 ease-out"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white/80 to-transparent pointer-events-none" />
                      {isFounder && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/jcc_logo.png"
                          alt=""
                          aria-hidden="true"
                          className="id-crest top-2 left-2 sm:top-2.5 sm:left-2.5 w-4 h-4 sm:w-5 sm:h-5 rounded"
                        />
                      )}
                    </div>

                    <div className="flex-1 flex flex-col items-center text-center px-2.5 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4">
                      <h3 className="id-card-name text-[13px] sm:text-base font-black uppercase tracking-tight text-jcc-blue leading-tight truncate max-w-full">
                        {member.name}
                      </h3>
                      <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] mt-1.5 ${roleColor}`}>
                        {member.role}
                      </span>
                      <div className="flex items-center justify-center gap-1.5 mt-1.5 sm:mt-2">
                        <span className="h-px w-3 bg-jcc-blue/15" />
                        <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.18em] text-jcc-blue/40">
                          {member.team || "Circle Member"}
                        </span>
                        <span className="h-px w-3 bg-jcc-blue/15" />
                      </div>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            );
          })}
        </div>

        <AnimateIn delay={400} className="mt-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { Icon: Users,    label: "Active Members",  value: stats.activePlayers, color: "from-jcc-accent/20 to-transparent",   border: "border-jcc-accent/20",   textColor: "text-jcc-accent"   },
              { Icon: Trophy,   label: "Matches Played",  value: stats.sundayGames,   color: "from-jcc-accent/20 to-transparent",  border: "border-jcc-accent/20",  textColor: "text-jcc-accent"  },
              { Icon: Calendar, label: "Sundays Active",  value: stats.sundaysActive, color: "from-jcc-accent-dark/20 to-transparent",  border: "border-jcc-accent-dark/20",  textColor: "text-jcc-accent-dark"  },
              { Icon: Heart,    label: "Community Love",  value: stats.communityLove, color: "from-jcc-green/20 to-transparent",   border: "border-jcc-green/20",   textColor: "text-jcc-green"   },
            ].map((stat, i) => {
              const light = i % 2 === 1;
              return (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-xl border p-5 cursor-default hover:scale-[1.03] transition-all duration-300 hover:shadow-lg flex flex-col items-center sm:items-start text-center sm:text-left ${
                    light ? "border-jcc-accent-dark/25" : `bg-linear-to-b ${stat.color} ${stat.border}`
                  }`}
                  style={light ? { background: "#F6F2E9" } : undefined}
                >
                  <div className={`p-2 rounded-lg mb-3 group-hover:scale-110 transition-transform ${light ? "bg-[#1A1508]/[0.04]" : "bg-white/5"}`}>
                    <stat.Icon className={`w-5 h-5 ${light ? "text-jcc-accent-dark" : stat.textColor}`} />
                  </div>
                  <div className={`text-2xl font-black ${light ? "text-jcc-accent-dark" : stat.textColor}`}>{stat.value}</div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${light ? "text-[#1A1508]/60" : "text-white/40"}`}>{stat.label}</div>
                </div>
              );
            })}
          </div>
        </AnimateIn>

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
