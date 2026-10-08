import type { Metadata } from "next";
import { dayReportBySlug, dayReports } from "@/lib/match-reports";
import ArticleClient from "./ArticleClient";
import DayReportView from "./DayReportView";

// Two kinds of story share this route: matchday reports, written from the
// scorecard export at build time (lib/match-reports.ts), and articles written
// in the admin panel, loaded from Supabase in the browser. A slug that isn't a
// matchday report falls through to the article loader.

export function generateStaticParams() {
  return dayReports().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = dayReportBySlug(slug);
  if (!report) return { title: "Boundary Banter" };
  return {
    title: `${report.headline} · Boundary Banter`,
    description: report.dek,
    openGraph: { title: report.headline, description: report.dek, type: "article" },
  };
}

export default async function BoundaryBanterStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = dayReportBySlug(slug);
  if (report) return <DayReportView report={report} />;
  return <ArticleClient slug={slug} />;
}
