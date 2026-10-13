import { EarningsView } from "../_ui/earnings";
import { dashboardMeta } from "../_ui/meta";

export const metadata = dashboardMeta("Earnings", "/dashboard/earnings", "SOL your fee wallets received from goblock swaps.");

export default function EarningsPage() {
  return <EarningsView />;
}
