import { dashboardMeta } from "./_ui/meta";
import { OverviewView } from "./_ui/overview";

export const metadata = dashboardMeta(
  "Overview",
  "/dashboard",
  "Sign in with your Solana wallet to create goblock swap API keys, rotate or revoke them, and see requests, fees, and integrator earnings.",
);

export default function DashboardPage() {
  return <OverviewView />;
}
