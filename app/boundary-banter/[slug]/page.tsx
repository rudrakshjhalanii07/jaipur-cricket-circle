import type { Metadata } from "next";
import { dayReportBySlug, dayReports } from "@/lib/match-reports";
import ArticleClient from "./ArticleClient";
import DayReportView from "./DayReportView";
import { fetchPlayerPhotos } from "@/lib/player-photos.server";
import { photoFor } from "@/lib/player-photos";

// Two kinds of story share this route: matchday reports, written from the
// scorecard export at build time (lib/match-reports.ts), and articles written
// in the admin panel, loaded from Supabase in the browser. A slug that isn't a
// matchday report falls through to the article loader.

// Reports known at build time are prerendered; a week scored after the build
// renders on its first visit (dynamicParams is on by default).
export async function generateStaticParams() {
  return (await dayReports()).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = await dayReportBySlug(slug);
  if (!report) return { title: "Boundary Banter" };
  return {
    title: `${report.headline} · Boundary Banter`,
    description: report.dek,
    openGraph: { title: report.headline, description: report.dek, type: "article" },
  };
}

export default async function BoundaryBanterStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await dayReportBySlug(slug);
  if (report) {
    // Only the faces the share cards use: the star and each Player of the Match.
    const index = await fetchPlayerPhotos();
    const names = [report.star?.name, ...report.matches.map((m) => m.potm?.name)].filter((n): n is string => !!n);
    const photos = Object.fromEntries(names.map((n) => [n, photoFor(index, n)]));
    return <DayReportView report={report} photos={photos} />;
  }
  return <ArticleClient slug={slug} />;
}
