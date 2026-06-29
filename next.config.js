const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Inline CSS into HTML to eliminate render-blocking stylesheet requests.
    // Ideal for Tailwind (atomic CSS stays small regardless of page complexity).
    inlineCss: true,
  },
  async redirects() {
    return [
      { source: "/toss", destination: "/tournament", permanent: true },
    ];
  },
  images: {
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
