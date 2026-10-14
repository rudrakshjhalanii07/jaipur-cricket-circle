// The home page below the hero, in order of what people come for:
//
//   analytics first   — the intelligence desk, the stories rail, the unlock
//   teams second      — the franchises as they stand
//   the club last     — the Circle in numbers, the founders' story, Boundary
//                       Banter, the values, the gallery and the closing pitch
//
// Server Components throughout; RevealMotion is the one client island that
// animates them, through data attributes.
import GallerySection from "./GallerySection";
import StatsSection from "./StatsSection";
import OurStorySection from "./OurStorySection";
import BoundaryBanterSection from "./BoundaryBanterSection";
import WhyJCCSection from "./WhyJCCSection";
import IntelDesk from "./IntelDesk";
import TeamsBand from "./TeamsBand";
import FinalCTA from "./FinalCTA";
import RevealMotion from "@/components/RevealMotion";
import type { ArticleData, HomeStats } from "@/app/page";
import type { HomeIntel } from "@/lib/home-intel.server";

interface HomepageBelowFoldProps {
  stats: HomeStats;
  intel: HomeIntel | null;
  chewvana: {
    articles: ArticleData[];
    tickerItems: string[];
  };
}

export default function HomepageBelowFold({ stats, intel, chewvana }: HomepageBelowFoldProps) {
  return (
    <RevealMotion className="overflow-x-clip">
      <IntelDesk intel={intel} />
      <TeamsBand intel={intel} />
      <StatsSection stats={stats} />
      <OurStorySection />
      <BoundaryBanterSection {...chewvana} />
      <WhyJCCSection />
      <GallerySection />
      <FinalCTA />
    </RevealMotion>
  );
}
