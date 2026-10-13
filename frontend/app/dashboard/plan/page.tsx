import { dashboardMeta } from "../_ui/meta";
import { PlanView } from "../_ui/plan";

export const metadata = dashboardMeta("Plan & Fees", "/dashboard/plan", "Your goblock API plan, swap fees, and platform fee.");

export default function PlanPage() {
  return <PlanView />;
}
