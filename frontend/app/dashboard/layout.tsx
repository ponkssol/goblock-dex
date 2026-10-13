import type { ReactNode } from "react";
import { DashboardShell } from "./_ui/shell";
import "../pages.css";
import "../buyback/buyback.css";
import "./dashboard.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
