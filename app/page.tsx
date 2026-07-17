// Revalidate every 5 minutes so match registrations and upcoming matches stay
// fresh without requiring a full rebuild.
export const revalidate = 300;

import HeroSection from "@/components/home/HeroSection";
import HomepageBelowFold from "@/components/home/HomepageBelowFold";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fallbackRivalrySeasons, type RivalrySeason } from "@/lib/rivalry";
import { getTeam, type TeamId } from "@/lib/teams";

// ─── Type aliases used only server-side ──────────────────────────────────────

type SundayMatchRow = {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  player_limit: number;
  status: string;
};

export type ArticleData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image_url: string;
  category: string;
  published_at: string;
  author_name?: string;
};

export type RecentMatch = { id: string; winner: string; date: string; result: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTickerItems(
  nextMatch: SundayMatchRow | null,
  activeSeason: RivalrySeason,
  articles: ArticleData[],
  activeCount: number,
  totalMatches: number
): string[] {
  const items: string[] = [];

  if (nextMatch) {
    const mDate = new Date(nextMatch.match_date).toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    items.push(
      `📍 NEXT BATTLE: ${nextMatch.location_name} · ${mDate} @ ${nextMatch.match_time} · REGISTRATION ${nextMatch.status.toUpperCase()}`
    );
  }

  items.push(
    `🏆 RIVALRY UPDATE: ${activeSeason.title} active! Series score: Mavericks (${activeSeason.mavericks_main_wins}) - (${activeSeason.neurostrikers_main_wins}) NeuroStrikers`
  );

  articles.forEach((art) => {
    const category = art.category ? `[${art.category.toUpperCase()}]` : "NEWS";
    items.push(
      art.excerpt
        ? `📰 ${category}: ${art.title} — "${art.excerpt}"`
        : `📰 ${category}: ${art.title}`
    );
  });

  items.push(`⚡ SQUAD STATS: ${totalMatches} matches recorded`);
  items.push(
    `👥 MEMBERSHIP: ${activeCount} players confirmed in the Circle`
  );

  return items;
}

// ─── Main data fetch ──────────────────────────────────────────────────────────

async function getHomepageData() {
  const today = new Date().toISOString().split("T")[0];

  try {
    // Phase 1: all independent queries in parallel
    const [
      seasonsRes,
      seriesMatchesRes,
      articlesRes,
      nextMatchRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("rivalry_seasons")
        .select("*")
        .order("status")
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("series_matches")
        .select("id, winner_id, match_date, margin_type, margin_value, is_tie")
        .not("winner_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("chewvana_articles")
        .select(
          "id, title, slug, excerpt, match_summary, cover_image_url, category, published_at, created_at, reporter_alias, editor_name, author"
        )
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3),
      supabaseAdmin
        .from("matches")
        .select("*")
        .gte("match_date", today)
        .in("status", ["open", "closed"])
        .order("match_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    // ── Unwrap results ────────────────────────────────────────────────────────
    const seasons: RivalrySeason[] =
      ((seasonsRes.data as RivalrySeason[]) ?? []).length > 0
        ? (seasonsRes.data as RivalrySeason[])
        : fallbackRivalrySeasons;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesMatches: any[] = seriesMatchesRes.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawArticles: any[] = articlesRes.data ?? [];
    const nextMatch: SundayMatchRow | null =
      (nextMatchRes.data as SundayMatchRow) ?? null;

    // ── Derived stats ─────────────────────────────────────────────────────────
    // Fixed marketing figures matching the "Our Journey So Far" flyer, kept
    // in lockstep with StatsSection's tiles — not derived from live club
    // statistics (see lib/statistics.ts for the computed equivalents).
    const activePlayerCount = 58;
    const totalMatchesPlayed = 50;
    const activeSundaysCount = 19;
    const stats = {
      activePlayers: `${activePlayerCount}+`,
      sundayGames: `${totalMatchesPlayed}+`,
      sundaysActive: `${activeSundaysCount}+`,
      communityLove: "∞",
    };

    // ── Rivalry ───────────────────────────────────────────────────────────────
    const activeSeason: RivalrySeason =
      seasons.find((s) => s.status === "active") ??
      seasons[0] ??
      fallbackRivalrySeasons[0];

    const recentMatches: RecentMatch[] = seriesMatches.map((m) => ({
      id: m.id,
      winner: m.winner_id ? getTeam(m.winner_id as TeamId).name : "",
      date: m.match_date ?? "",
      result: m.is_tie
        ? "Match tied"
        : m.margin_value && m.margin_type
        ? `Won by ${m.margin_value} ${m.margin_type}`
        : "Latest result",
    }));

    // ── Articles ──────────────────────────────────────────────────────────────
    const articles: ArticleData[] = rawArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      excerpt: art.excerpt || art.match_summary || "",
      image_url: art.cover_image_url || "",
      category: art.category,
      published_at: art.published_at || art.created_at,
      author_name:
        art.reporter_alias ||
        art.editor_name ||
        art.author ||
        "Boundary Desk",
    }));

    // ── Ticker items (pre-computed on server, no client fetch needed) ─────────
    const tickerItems = buildTickerItems(
      nextMatch,
      activeSeason,
      articles,
      activePlayerCount,
      totalMatchesPlayed
    );

    return {
      hero: stats,
      rivalry: {
        activeSeason,
        recentMatches,
        latestMatch: recentMatches[0] ?? null,
      },
      chewvana: {
        articles,
        tickerItems,
      },
    };
  } catch (error) {
    console.error("Homepage data fetch failed:", error);

    const fallback = fallbackRivalrySeasons[0];
    const fallbackStats = {
      activePlayers: "–",
      sundayGames: "–",
      sundaysActive: "–",
      communityLove: "∞",
    };

    return {
      hero: fallbackStats,
      rivalry: {
        activeSeason: fallback,
        recentMatches: [],
        latestMatch: null,
      },
      chewvana: {
        articles: [],
        tickerItems: [
          `🏆 RIVALRY UPDATE: ${fallback.title} active! Series score: Mavericks (${fallback.mavericks_main_wins}) - (${fallback.neurostrikers_main_wins}) NeuroStrikers`,
          "📰 DISPATCH: New dispatch published every Monday post-match",
        ],
      },
    };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const data = await getHomepageData();

  return (
    <>
      <HeroSection stats={data.hero} />
      <HomepageBelowFold stats={data.hero} chewvana={data.chewvana} />
    </>
  );
}
