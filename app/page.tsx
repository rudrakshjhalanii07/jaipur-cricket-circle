import HeroSection from "@/components/home/HeroSection";
import SundayMatchSection from "@/components/home/SundayMatchSection";
import RivalrySection from "@/components/home/RivalrySection";
import CommunitySection from "@/components/home/CommunitySection";
import ChewvanaTimesSection from "@/components/home/ChewvanaTimesSection";
import WhyJCCSection from "@/components/home/WhyJCCSection";
import FinalCTASection from "@/components/home/FinalCTASection";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getHeroStats() {
  try {
    const [playersRes, seasonsRes] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("id")
        .eq("approval_status", "approved")
        .eq("is_active", true),
      supabaseAdmin
        .from("rivalry_seasons")
        .select("total_matches_played"),
    ]);

    const activeCount = playersRes.data?.length ?? 0;
    const totalMatches = seasonsRes.data?.reduce(
      (sum: number, s: { total_matches_played: number | null }) =>
        sum + (s.total_matches_played || 0),
      0
    ) ?? 0;

    return {
      activePlayers: `${activeCount}+`,
      sundayGames: `${totalMatches}+`,
      sundaysActive: `${totalMatches}+`,
      communityLove: "∞",
    };
  } catch {
    return {
      activePlayers: "–",
      sundayGames: "–",
      sundaysActive: "–",
      communityLove: "∞",
    };
  }
}

export default async function Home() {
  const stats = await getHeroStats();

  return (
    <>
      <HeroSection stats={stats} />
      <SundayMatchSection />
      <RivalrySection />
      <CommunitySection />
      <ChewvanaTimesSection />
      <WhyJCCSection />
      <FinalCTASection />
    </>
  );
}
