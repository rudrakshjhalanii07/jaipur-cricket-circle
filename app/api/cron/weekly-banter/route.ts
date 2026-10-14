import { NextResponse } from "next/server";
import { refreshScorecards } from "@/lib/scorecards-cache";
import { dayReports } from "@/lib/match-reports";

export const runtime = "nodejs";

// Sunday refresh (vercel.json): rebuilds the Boundary Banter matchday reports
// and everything else read from scorecards, so the week's matches have their
// report up by Sunday morning. Saving a match already refreshes this on the
// spot; the cron is the backstop for anything entered straight into the
// database.

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const adminHeader = request.headers.get("x-admin-password");
  return !!adminPassword && adminHeader === adminPassword;
}

async function run(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  refreshScorecards();
  const reports = await dayReports();
  const latest = reports[reports.length - 1];
  return NextResponse.json({ ok: true, reports: reports.length, latest: latest ? { slug: latest.slug, date: latest.date } : null });
}

// Vercel Cron calls GET.
export const GET = run;
export const POST = run;
