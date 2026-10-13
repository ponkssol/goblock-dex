import Link from "next/link";
import { SiteFoot } from "../../site-foot";
import { SiteNav } from "../../site-nav";
import { pageMeta } from "../../site";
import { MintForm } from "./mint-form";
import "../../home.css";
import "../../sections.css";
import "../../pages.css";
import "../buyback.css";

export const metadata = {
  ...pageMeta({
    title: "Buyback settings · goblock",
    description: "Set the $GOBLOCK contract address for the goblock buyback vault.",
    path: "/buyback/settings",
  }),
  robots: { index: false, follow: false },
};

export default function BuybackSettingsPage() {
  return (
    <main className="stage home subpage">
      <SiteNav />
      <section className="s-sec">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick">Team only</span>
            <h2>Buyback settings</h2>
            <p className="s-sub">
              One setting, saved on chain. See the live vault on the <Link href="/buyback">Buyback page</Link>.
            </p>
          </div>
          <MintForm />
        </div>
      </section>
      <SiteFoot />
    </main>
  );
}
