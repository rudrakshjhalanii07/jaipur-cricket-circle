import type { Metadata } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import LoaderWrapper from "@/components/LoaderWrapper";
import PageTransition from "@/components/PageTransition";
import { Providers } from "@/components/Providers";
import MotionCanvas from "@/components/MotionCanvas";
import ScrollSystem from "@/components/ScrollSystem";
import SectionProgress from "@/components/SectionProgress";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Heading font — drives the LCP <h1>. Keep it preloaded and lean (no italic
// style file; the few italic headings are synthesized by the browser).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["900"],
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
    default: "Jaipur Cricket Circle — Where Sundays Hit Different",
    template: "%s | Jaipur Cricket Circle",
  },
  description:
    "Jaipur Cricket Circle is a premium community cricket club. Every Sunday, we play hard, compete fiercely, and build bonds that go beyond the boundary.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Below-the-fold sections fetch from Supabase client-side. Use
            dns-prefetch (cheap) NOT preconnect — a preconnect here opens a TLS
            handshake in the first second that competes with the LCP font on
            slow connections. Stats above the fold are fetched server-side. */}
        <link rel="dns-prefetch" href="https://sogyuojtetdroxnvoulb.supabase.co" />
      </head>
      <body className="min-h-full flex flex-col bg-jcc-bg text-jcc-text-primary">
        <Providers>
          <ScrollSystem>
            <MotionCanvas />
            <LoaderWrapper>
              <Navbar />
              <main className="flex-1">
                <PageTransition>{children}</PageTransition>
              </main>
              <Footer />
              <FloatingWhatsApp />
              <SectionProgress />
            </LoaderWrapper>
          </ScrollSystem>
        </Providers>
      </body>
    </html>
  );
}
