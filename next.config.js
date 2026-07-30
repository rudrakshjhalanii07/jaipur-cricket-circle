const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

// On a DNS64/NAT64 connection, supabase.co resolves to a 64:ff9b:: address
// first; the image optimizer then spends seconds on it before falling back to
// IPv4, and sometimes hits its 7s timeout. Preferring IPv4 locally keeps
// profile photos loading immediately. Dev only — hosting resolves fine.
if (process.env.NODE_ENV === "development") {
  require("dns").setDefaultResultOrder("ipv4first");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Inline CSS into HTML to eliminate render-blocking stylesheet requests.
    // Ideal for Tailwind (atomic CSS stays small regardless of page complexity).
    inlineCss: true,
    // Dev-only: shrink the client router cache to its floor (30s is the
    // minimum this Next.js version accepts) so a page revisit reflects
    // latest markup/CSS almost immediately instead of a stale 5-minute-old
    // render. Left at the Next.js default (5 min) in production for nav
    // performance.
    ...(process.env.NODE_ENV === "development" ? { staleTimes: { static: 30 } } : {}),
  },
  async redirects() {
    return [
      { source: "/chewvana-times", destination: "/boundary-banter", permanent: true },
      { source: "/chewvana-times/:slug*", destination: "/boundary-banter/:slug*", permanent: true },
    ];
  },
  images: {
    // Next 16 refuses to optimize an image whose hostname resolves to any
    // address it considers private. On a DNS64/NAT64 connection, supabase.co
    // resolves to 64:ff9b::… alongside its real public IPs, so every profile
    // photo is rejected locally. Relaxed in development only — in production
    // this stays on, since it is a genuine SSRF guard.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
