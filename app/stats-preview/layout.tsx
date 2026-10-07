import { Inter_Tight } from "next/font/google";
import "./stats-theme.css";

// Display face for the stats page only: a tight grotesk for headlines and
// big numerals. The rest of the site keeps its serif.
const grotesk = Inter_Tight({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export default function StatsPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${grotesk.variable} jcc-stats-page`}>{children}</div>;
}
