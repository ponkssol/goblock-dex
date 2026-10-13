import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { CheckoutPay } from "./pay";
import "../home.css";
import "../sections.css";
import "../pages.css";

export const metadata = pageMeta({
  title: "Checkout · goblock",
  description: "Pay for a Builder or Starter key with SOL or USDC. The key adds no goblock fee for 30 days.",
  path: "/checkout",
});

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <main className="stage home subpage">
      <SiteNav />
      <section className="s-sec c-checkout">
        <div className="j-wrap">
          <div className="s-head">
            <span className="s-kick">Checkout</span>
            <h1>Pay for a monthly key.</h1>
            <p className="s-sub">SOL or USDC, sent to the goblock wallet. The key is shown once.</p>
          </div>
          <CheckoutPay initialPlan={plan} />
        </div>
      </section>
      <SiteFoot />
    </main>
  );
}
