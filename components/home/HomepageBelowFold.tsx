// Server Component — all below-fold sections are Server Components and carry
// zero client JS themselves. Only their small client islands (AnimateIn,
// MemberPhoto, ScorelineCard) are downloaded by the browser.
import GallerySection from "./GallerySection";
import StatsSection from "./StatsSection";
import FranchiseSection from "./FranchiseSection";
import OurStorySection from "./OurStorySection";
import BoundaryBanterSection from "./BoundaryBanterSection";
import WhyJCCSection from "./WhyJCCSection";
import type { ArticleData } from "@/app/page";

interface HomepageBelowFoldProps {
  stats: {
    activePlayers: string;
    weeklyGames: string;
    weeksActive: string;
    communityLove: string;
  };
  chewvana: {
    articles: ArticleData[];
    tickerItems: string[];
  };
}

export default function HomepageBelowFold({
  stats,
  chewvana,
}: HomepageBelowFoldProps) {
  return (
    <>
      <GallerySection />
      <StatsSection stats={stats} />
      <FranchiseSection />
      <OurStorySection />
      <BoundaryBanterSection {...chewvana} />
      <WhyJCCSection />
    </>
  );
}
