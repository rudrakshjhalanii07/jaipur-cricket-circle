// Revalidate every 5 minutes so match registrations and upcoming matches stay
// fresh without requiring a full rebuild.
export const revalidate = 300;

import HeroSection from "@/components/home/HeroSection";
import SundayMatchSection from "@/components/home/SundayMatchSection";
import HomepageBelowFold from "@/components/home/HomepageBelowFold";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fallbackRivalrySeasons, type RivalrySeason } from "@/lib/rivalry";
import { getTeam, type TeamId } from "@/lib/teams";
import { getClubStatistics } from "@/lib/statistics";
import { getDisplayRole } from "@/lib/member-role";

// ─── Type aliases used only server-side ──────────────────────────────────────

type SundayMatchRow = {
  id: string;
  match_date: string;
  match_time: string;
  location_name: string;
  player_limit: number;
  status: string;
};

type Registration = { id: string; name: string; status: string };

export type CommunityMember = {
  id: string;
  name: string;
  team: "Mavericks" | "NeuroStrikers" | "Unassigned";
  role: string;
  tags: string[];
  image: string | null;
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

// getDisplayRole now lives in lib/member-role.ts — shared with /members,
// /members/[id], and the Profile portal so a player's role reads the same
// everywhere.

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
      playersRes,
      seasonsRes,
      seriesMatchesRes,
      articlesRes,
      nextMatchRes,
      clubStats,
    ] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("*")
        .eq("approval_status", "approved")
        .eq("is_active", true),
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
      getClubStatistics(),
    ]);

    // Phase 2: registrations depend on the match id
    let confirmedRegistrations: Registration[] = [];
    if (nextMatchRes.data) {
      const { data: regData } = await supabaseAdmin
        .from("registrations")
        .select("id, name, status")
        .eq("match_id", nextMatchRes.data.id)
        .order("created_at", { ascending: true });
      confirmedRegistrations = ((regData ?? []) as Registration[]).filter(
        (r) => r.status === "registered"
      );
    }

    // ── Unwrap results ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players: any[] = playersRes.data ?? [];
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
    // Sourced from the centralized statistics service (lib/statistics.ts) so
    // homepage, rivalry, members, and future pages never compute these
    // independently.
    const activePlayerCount = clubStats.activeMembers;
    const totalMatchesPlayed = clubStats.matchesPlayed;
    const stats = {
      activePlayers: `${activePlayerCount}+`,
      sundayGames: `${totalMatchesPlayed}+`,
      sundaysActive: `${clubStats.activeSundays}+`,
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

    // ── Community members (sort + map on the server) ───────────────────────
    const sorted = [...players].sort((a, b) => {
      const aCap = a.group_role === "captain" ? 1 : 0;
      const bCap = b.group_role === "captain" ? 1 : 0;
      if (aCap !== bCap) return bCap - aCap;

      const aVC = a.group_role === "vice-captain" ? 1 : 0;
      const bVC = b.group_role === "vice-captain" ? 1 : 0;
      if (aVC !== bVC) return bVC - aVC;

      const aF =
        a.member_tag === "founding-member" ||
        a.group_role === "founding-member"
          ? 1
          : 0;
      const bF =
        b.member_tag === "founding-member" ||
        b.group_role === "founding-member"
          ? 1
          : 0;
      if (aF !== bF) return bF - aF;

      const aR = a.name.toLowerCase().includes("rudraksh") ? 1 : 0;
      const bR = b.name.toLowerCase().includes("rudraksh") ? 1 : 0;
      if (aR !== bR) return bR - aR;

      const aN = a.name.toLowerCase().includes("naman") ? -1 : 0;
      const bN = b.name.toLowerCase().includes("naman") ? -1 : 0;
      if (aN !== bN) return bN - aN;

      return a.name.localeCompare(b.name);
    });

    const communityMembers: CommunityMember[] = sorted.slice(0, 8).map((p) => {
      const tags: string[] = [];
      if (p.member_tag && p.member_tag !== "member") tags.push(p.member_tag);
      if (p.cricket_role) tags.push(p.cricket_role);
      if (
        p.group_role === "captain" ||
        p.group_role === "vice-captain"
      ) {
        if (!tags.includes(p.group_role)) tags.push(p.group_role);
      }
      return {
        id: p.id,
        name: p.name,
        team: (p.team || "Unassigned") as CommunityMember["team"],
        role: getDisplayRole(p.member_tag, p.group_role, p.cricket_role),
        tags,
        image: p.image_url || p.image || null,
      };
    });

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
      sundayMatch: {
        match: nextMatch,
        confirmedCount: confirmedRegistrations.length,
        registeredPlayers: confirmedRegistrations,
        stats: { totalMembers: activePlayerCount, matchesPlayed: totalMatchesPlayed },
      },
      rivalry: {
        activeSeason,
        recentMatches,
        latestMatch: recentMatches[0] ?? null,
      },
      community: {
        members: communityMembers,
        stats,
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
      sundayMatch: {
        match: null,
        confirmedCount: 0,
        registeredPlayers: [],
        stats: { totalMembers: 0, matchesPlayed: 0 },
      },
      rivalry: {
        activeSeason: fallback,
        recentMatches: [],
        latestMatch: null,
      },
      community: {
        members: [],
        stats: fallbackStats,
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
      <SundayMatchSection {...data.sundayMatch} />
      <HomepageBelowFold
        rivalry={data.rivalry}
        community={data.community}
        chewvana={data.chewvana}
      />
    </>
  );
}
