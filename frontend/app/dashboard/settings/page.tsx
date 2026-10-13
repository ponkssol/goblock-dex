import { dashboardMeta } from "../_ui/meta";
import { SettingsView } from "../_ui/settings";

export const metadata = dashboardMeta("Settings", "/dashboard/settings", "Your goblock API Console account settings.");

export default function SettingsPage() {
  return <SettingsView />;
}
