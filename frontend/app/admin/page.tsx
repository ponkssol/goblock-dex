import { AdminOverview } from "./_ui/overview";
import { adminMeta } from "./meta";

export const metadata = adminMeta("Overview", "/admin", "Program deployer console for goblock keys, payments, and discount codes.");

export default function AdminPage() {
  return <AdminOverview />;
}
