import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { WaitlistJoin } from "./join";
import "../home.css";
import "../sections.css";
import "../pages.css";

export const metadata = pageMeta({
  title: "Waitlist · goblock",
  description: "Join the goblock waitlist. An email is enough. A Solana wallet is optional.",
  path: "/waitlist",
});

export default function WaitlistPage() {
  return (
    <main className="stage home subpage">
      <SiteNav />
      <section className="s-sec c-checkout">
        <div className="j-wrap">
          <div className="s-head">
            <span className="s-kick">Waitlist</span>
            <h1>Get a note when it matters.</h1>
            <p className="s-sub">One email. No password. The list itself is only visible to the program deployer.</p>
          </div>
          <WaitlistJoin />
        </div>
      </section>
      <SiteFoot />
    </main>
  );
}
