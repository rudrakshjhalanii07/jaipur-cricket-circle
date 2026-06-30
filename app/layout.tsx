import type { Metadata } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { unstable_cache } from "next/cache";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LazyFloatingWhatsApp from "@/components/LazyFloatingWhatsApp";
import LoaderWrapper from "@/components/LoaderWrapper";
import PageTransition from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import LazyMotionCanvas from "@/components/LazyMotionCanvas";
import ScrollSystem from "@/components/ScrollSystem";
import SectionProgress from "@/components/SectionProgress";
import DeferredStyles from "@/components/DeferredStyles";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Full Fraunces 900 for all headings across the site. No longer preloaded —
// the LCP <h1> uses the tiny wordmark subset below, so the full file can load
// lazily without blocking the critical path.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["900"],
  display: "optional",
  preload: false,
});

// LCP-only font: Fraunces 900 subset to the 11 glyphs in the hero wordmark
// "JAIPUR CRICKET CIRCLE" (~2 KB). Preloaded so it arrives before 2.5s even on
// slow connections, locking LCP to a fast first paint in the real brand font.
const frauncesWordmark = localFont({
  src: "./fonts/fraunces-wordmark.woff2",
  variable: "--font-wordmark",
  weight: "900",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
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
    default: "Jaipur Cricket Circle — Where Sundays Hit Different",
    template: "%s | Jaipur Cricket Circle",
  },
  description:
    "Jaipur Cricket Circle is a premium community cricket club. Every Sunday, we play hard, compete fiercely, and build bonds that go beyond the boundary.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nextMatch = await getNavbarMatch();
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} ${frauncesWordmark.variable} ${plexMono.variable} h-full antialiased`}
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
              <LazyFloatingWhatsApp />
              <SectionProgress />
            </LoaderWrapper>
          </ScrollSystem>
        </Providers>
      </body>
    </html>
  );
}
