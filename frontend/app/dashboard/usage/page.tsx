import { dashboardMeta } from "../_ui/meta";
import { UsageView } from "../_ui/usage";

export const metadata = dashboardMeta("Usage", "/dashboard/usage", "Requests and errors for each goblock API key, per day.");

export default function UsagePage() {
  return <UsageView />;
}
