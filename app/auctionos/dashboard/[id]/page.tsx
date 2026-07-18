import DashboardShell from "@/components/auctionos/wizard/DashboardShell";

// Minimal server component per the plan: the actual bootstrap fetch needs
// the admin password from sessionStorage (browser-only), so all data
// loading lives in the client DashboardShell — this just resolves the
// route param and hands it off.
export default async function AuctionDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell auctionId={id} />;
}
