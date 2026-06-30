// Server Component — all below-fold sections are Server Components and carry
// zero client JS themselves. Only their small client islands (AnimateIn,
// MemberPhoto, ScorelineCard) are downloaded by the browser.
import RivalrySection from "./RivalrySection";
import CommunitySection from "./CommunitySection";
import ChewvanaTimesSection from "./ChewvanaTimesSection";
import WhyJCCSection from "./WhyJCCSection";
import FinalCTASection from "./FinalCTASection";
import type { CommunityMember, ArticleData, RecentMatch } from "@/app/page";
import type { RivalrySeason } from "@/lib/rivalry";

interface HomepageBelowFoldProps {
  rivalry: {
    activeSeason: RivalrySeason;
    recentMatches: RecentMatch[];
    latestMatch: RecentMatch | null;
  };
  community: {
    members: CommunityMember[];
    stats: {
      activePlayers: string;
      sundayGames: string;
      sundaysActive: string;
      communityLove: string;
    };
  };
  chewvana: {
    articles: ArticleData[];
    tickerItems: string[];
  };
}

export default function HomepageBelowFold({
  rivalry,
  community,
  chewvana,
}: HomepageBelowFoldProps) {
  return (
    <>
      <RivalrySection {...rivalry} />
      <CommunitySection {...community} />
      <ChewvanaTimesSection {...chewvana} />
      <WhyJCCSection />
      <FinalCTASection />
    </>
  );
}
