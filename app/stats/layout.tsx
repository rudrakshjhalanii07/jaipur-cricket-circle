import "./stats-theme.css";

// The display grotesk is loaded once in the root layout; this only scopes the
// stats page's own paper texture and tokens.
export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <div className="jcc-stats-page">{children}</div>;
}
