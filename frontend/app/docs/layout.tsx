import type { ReactNode } from "react";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { DocsBody, DocsSidebar } from "./docs-nav";
import "../home.css";
import "../sections.css";
import "../pages.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="stage home subpage">
      <SiteNav />
      <div className="j-wrap d-shell">
        <DocsSidebar />
        <DocsBody>{children}</DocsBody>
      </div>
      <SiteFoot />
    </main>
  );
}
