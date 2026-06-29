"use client";

// This Client Component wrapper exists solely so that next/dynamic() code
// splitting works correctly.  The Next.js docs explicitly note that dynamic()
// imports of Client Components are only code-split when called from within a
// Client Component — not from a Server Component.  All data arrives as
// serialised props from the Server Component in app/page.tsx.

import dynamic from "next/dynamic";
import type { CommunityMember, ArticleData, RecentMatch } from "@/app/page";
import type { RivalrySeason } from "@/lib/rivalry";

// Each of these creates its own webpack chunk, downloaded in parallel but
// parsed/executed only when the browser reaches the component.
const RivalrySection = dynamic(() => import("./RivalrySection"));
const CommunitySection = dynamic(() => import("./CommunitySection"));
const ChewvanaTimesSection = dynamic(() => import("./ChewvanaTimesSection"));
const WhyJCCSection = dynamic(() => import("./WhyJCCSection"));
const FinalCTASection = dynamic(() => import("./FinalCTASection"));

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
