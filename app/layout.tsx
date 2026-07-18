import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import { unstable_cache } from "next/cache";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteFloatingWidgets from "@/components/SiteFloatingWidgets";
import LoaderWrapper from "@/components/LoaderWrapper";
import PageTransition from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import LazyMotionCanvas from "@/components/LazyMotionCanvas";
import ScrollSystem from "@/components/ScrollSystem";
import SectionProgress from "@/components/SectionProgress";
import DeferredStyles from "@/components/DeferredStyles";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// High-contrast classical serif for all display type (headlines, match names,
// tournament/section titles) — the "editorial institution" register. Weights
// capped at 700 (Cormorant Garamond has no true black); italic is loaded
// since most headline treatments in the design system are italic.
const displaySerif = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Mono is only used in below-the-fold tickers/labels — don't preload it so it
// stops competing with the critical heading/body fonts on slow connections.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${inter.variable} ${displaySerif.variable} ${plexMono.variable} h-full antialiased`}
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
            <LazyMotionCanvas />
            <LoaderWrapper>
              <Navbar nextMatch={nextMatch} />
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
            </LoaderWrapper>
          </ScrollSystem>
        </Providers>
      </body>
    </html>
  );
}
