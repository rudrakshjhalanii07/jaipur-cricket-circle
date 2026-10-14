// Revalidate every 5 minutes so match registrations and upcoming matches stay
// fresh without requiring a full rebuild.
export const revalidate = 300;

import IntelHero from "@/components/home/IntelHero";
import HomepageBelowFold from "@/components/home/HomepageBelowFold";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fallbackSeasons, normalizeSeason, seasonScoreline, type Season, type SeasonRow } from "@/lib/seasons";
import { getTeam, type TeamId } from "@/lib/teams";
import { getClubStatistics, type ClubStatistics } from "@/lib/statistics";
import { dayReportPreviews } from "@/lib/match-reports";
import LiveTicker from "@/components/LiveTicker";
import { getHomeIntel } from "@/lib/home-intel.server";
import { articleCovers } from "@/lib/article-covers";

// ─── Type aliases used only server-side ──────────────────────────────────────

type WeeklyMatchRow = {
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

export type HomeStats = {
  activePlayers: string;
  weeklyGames: string;
  weeksActive: string;
  communityLove: string;
  oversBowled: string;
  hoursOfCricket: string;
  biggestGathering: { players: number; date: string } | null;
  competitiveTeams: string;
};

function homeStats(club: ClubStatistics, players: number): HomeStats {
  return {
    activePlayers: `${players}+`,
    weeklyGames: String(club.matchesPlayed),
    weeksActive: String(club.weeksPlayed),
    communityLove: "∞",
    oversBowled: `${club.oversBowled}+`,
    hoursOfCricket: `${club.hoursOfCricket}+`,
    biggestGathering: club.biggestGathering,
    competitiveTeams: String(club.competitiveTeams),
  };
}

function buildTickerItems(
  nextMatch: WeeklyMatchRow | null,
  activeSeason: Season,
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
    `🏆 SEASON UPDATE: ${activeSeason.title} active! Series score: ${seasonScoreline(activeSeason)}`
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
        .select("*, season_teams(*)")
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
        .limit(6),
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
    const seasonRows = (seasonsRes.data as unknown as SeasonRow[]) ?? [];
    const seasons: Season[] =
      seasonRows.length > 0 ? seasonRows.map(normalizeSeason) : fallbackSeasons;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesMatches: any[] = seriesMatchesRes.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawArticles: any[] = articlesRes.data ?? [];
    const nextMatch: WeeklyMatchRow | null =
      (nextMatchRes.data as WeeklyMatchRow) ?? null;

    // ── Derived stats ─────────────────────────────────────────────────────────
    // Players is a fixed marketing figure for now; everything else is counted
    // from the database by lib/statistics.ts, so it moves as matches are saved.
    const club = await getClubStatistics();
    const activePlayerCount = 75;
    const totalMatchesPlayed = club.matchesPlayed;
    const stats = homeStats(club, activePlayerCount);

    // ── Season ────────────────────────────────────────────────────────────────
    const activeSeason: Season =
      seasons.find((s) => s.status === "active") ??
      seasons[0] ??
      fallbackSeasons[0];

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
    // Editor-written pieces and the automatic matchday reports, newest first —
    // a week's report joins the home page as soon as its matches are saved.
    const written: ArticleData[] = rawArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      excerpt: art.excerpt || art.match_summary || "",
      image_url: "",
      category: art.category,
      published_at: art.published_at || art.created_at,
      author_name:
        art.reporter_alias ||
        art.editor_name ||
        art.author ||
        "Boundary Desk",
    }));
    const reports: ArticleData[] = (await dayReportPreviews()).slice(0, 6).map((r) => ({
      id: r.slug,
      title: r.headline,
      slug: r.slug,
      excerpt: r.dek,
      image_url: "",
      category: "Match Report",
      published_at: `${r.date}T20:00:00+05:30`,
      author_name: "JCC Data Desk",
    }));
    // Covers are stock cricket photography only (lib/article-covers.ts), never
    // an uploaded cover or a member's photo — and no two alike on the page.
    const latest = [...written, ...reports]
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
      .slice(0, 5);
    const covers = articleCovers(latest.map((a) => a.slug));
    const articles = latest.map((a, i) => ({ ...a, image_url: covers[i] }));

    // ── Ticker items (pre-computed on server, no client fetch needed) ─────────
    const tickerItems = buildTickerItems(
      nextMatch,
      activeSeason,
      articles,
      activePlayerCount,
      totalMatchesPlayed
    );

    return {
      nextMatch,
      hero: stats,
      season: {
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

    const fallback = fallbackSeasons[0];
    const fallbackStats: HomeStats = {
      activePlayers: "75+",
      weeklyGames: "–",
      weeksActive: "–",
      communityLove: "∞",
      oversBowled: "–",
      hoursOfCricket: "–",
      biggestGathering: null,
      competitiveTeams: "4",
    };

    return {
      nextMatch: null,
      hero: fallbackStats,
      season: {
        activeSeason: fallback,
        recentMatches: [],
        latestMatch: null,
      },
      chewvana: {
        articles: [],
        tickerItems: [
          `🏆 SEASON UPDATE: ${fallback.title} active! Series score: ${seasonScoreline(fallback)}`,
          "📰 DISPATCH: New dispatch published every Monday post-match",
        ],
      },
    };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const [data, intel] = await Promise.all([getHomepageData(), getHomeIntel()]);

  return (
    <>
      <IntelHero intel={intel} />
      <LiveTicker match={data.nextMatch} />
      <HomepageBelowFold stats={data.hero} intel={intel} chewvana={data.chewvana} />
    </>
  );
}
