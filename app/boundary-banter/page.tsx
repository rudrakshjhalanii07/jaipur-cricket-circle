import type { Metadata } from "next";
import { dayReportPreviews } from "@/lib/match-reports";
import BoundaryBanterClient from "./BoundaryBanterClient";

export const metadata: Metadata = {
  title: "Boundary Banter",
  description: "Matchday reports from every Jaipur Cricket Circle week, written from the official scorecard — plus features, columns and the occasional roast.",
};

export default function BoundaryBanterPage() {
  return <BoundaryBanterClient reports={dayReportPreviews()} />;
}
