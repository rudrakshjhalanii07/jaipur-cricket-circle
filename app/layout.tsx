import type { Metadata } from "next";
import localFont from "next/font/local";
import { unstable_cache } from "next/cache";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteFloatingWidgets from "@/components/SiteFloatingWidgets";
import LoaderWrapper from "@/components/LoaderWrapper";
import PageTransition from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import ScrollSystem from "@/components/ScrollSystem";
import SectionProgress from "@/components/SectionProgress";
import DeferredStyles from "@/components/DeferredStyles";
import Cursor from "@/components/motion/Cursor";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClubStatistics } from "@/lib/statistics";

// Cached server-side fetch — same 5-min TTL as the homepage.  Avoids a live
// Supabase query on every request while keeping the ticker data fresh.
const getNavbarMatch = unstable_cache(
  async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabaseAdmin
      .from("matches")
      .select("id, match_date, match_time, location_name, player_limit, status")
      .in("status", ["open", "closed"])
      .gte("match_date", today)
      .order("match_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  },
  ["navbar-match"],
  { revalidate: 300 }
);

// Powers the site-wide floating "match details" button (any page, not just
// the homepage) — registrations for whatever match getNavbarMatch resolves.
const getNavbarMatchRegistrations = unstable_cache(
  async (matchId: string) => {
    const { data } = await supabaseAdmin
      .from("registrations")
      .select("id, name, status")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });
    return ((data ?? []) as { id: string; name: string; status: string }[]).filter(
      (r) => r.status === "registered"
    );
  },
  ["navbar-match-registrations"],
  { revalidate: 300 }
);

// Fonts are self-hosted from app/fonts (latin subset, as Google serves it)
// rather than fetched through next/font/google at build time: that loader
// broke the Vercel build on 16 Oct 2026 ("next/font/google queries have
// exactly one entry"), and a build shouldn't depend on Google being reachable.
const inter = localFont({
  variable: "--font-inter",
  src: "./fonts/inter-100-900-normal.woff2",
  weight: "100 900",
  display: "swap",
});

// The display face for every headline and big numeral, site-wide: a tight
// grotesk, first used on /stats and now the whole site's voice.
const grotesk = localFont({
  variable: "--font-grotesk",
  src: "./fonts/inter-tight-500-800-normal.woff2",
  weight: "500 800",
  display: "swap",
});

// Classical serif, kept only for pull quotes in the club's story (--font-serif).
// Not preloaded: nothing above the fold uses it.
const displaySerif = localFont({
  variable: "--font-display",
  src: [
    { path: "./fonts/cormorant-garamond-500-600-normal.woff2", weight: "500 600", style: "normal" },
    { path: "./fonts/cormorant-garamond-500-600-italic.woff2", weight: "500 600", style: "italic" },
  ],
  display: "swap",
  preload: false,
});

// Mono is only used in below-the-fold tickers/labels — don't preload it so it
// stops competing with the critical heading/body fonts on slow connections.
const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex-mono-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-600-normal.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Jaipur Cricket Circle - India's Most Loved Box Cricket Community",
    template: "%s | Jaipur Cricket Circle",
  },
  description:
    "At Jaipur Cricket Circle, cricket is the beginning—not the destination. We are building a modern community where friendships flourish, leaders emerge, and every weekend creates memories that last far beyond the final ball.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [nextMatch, clubStats] = await Promise.all([
    getNavbarMatch(),
    getClubStatistics(),
  ]);
  const registeredPlayers = nextMatch
    ? await getNavbarMatchRegistrations(nextMatch.id)
    : [];

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${grotesk.variable} ${displaySerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Some non-homepage pages still fetch from Supabase client-side.
            dns-prefetch (cheap) NOT preconnect — preconnect opens a TLS
            handshake that competes with the LCP font on slow connections. */}
        <link rel="dns-prefetch" href="https://sogyuojtetdroxnvoulb.supabase.co" />
      </head>
      <body className="min-h-full flex flex-col bg-jcc-bg text-jcc-text-primary">
        <DeferredStyles />
        <Providers>
          <ScrollSystem>
            <LoaderWrapper>
              <Navbar />
              <main className="flex-1">
                <PageTransition>{children}</PageTransition>
              </main>
              <Footer />
              <SiteFloatingWidgets
                match={nextMatch}
                confirmedCount={registeredPlayers.length}
                registeredPlayers={registeredPlayers}
                stats={{ totalMembers: clubStats.activeMembers, matchesPlayed: clubStats.matchesPlayed }}
              />
              <SectionProgress />
              <Cursor />
            </LoaderWrapper>
          </ScrollSystem>
        </Providers>
      </body>
    </html>
  );
}
