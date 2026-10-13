import { dashboardMeta } from "../_ui/meta";
import { PlaygroundView } from "../_ui/playground";

export const metadata = dashboardMeta("Playground", "/dashboard/playground", "Send test requests to the goblock swap API.");

export default function PlaygroundPage() {
  return <PlaygroundView />;
}
