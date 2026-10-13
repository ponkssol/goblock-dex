import { dashboardMeta } from "../_ui/meta";
import { QuickstartView } from "../_ui/quickstart";

export const metadata = dashboardMeta("Quickstart", "/dashboard/quickstart", "Quote and sign your first goblock swap.");

export default function QuickstartPage() {
  return <QuickstartView />;
}
