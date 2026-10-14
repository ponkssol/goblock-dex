import type { ReactNode } from "react";
import { DashboardShell } from "../dashboard/_ui/shell";
import { DeployerOnly } from "./_ui/shell";
import "../pages.css";
import "../buyback/buyback.css";
import "../dashboard/dashboard.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      <DeployerOnly>{children}</DeployerOnly>
    </DashboardShell>
  );
}
