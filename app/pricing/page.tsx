import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Pricing — goblock",
  description: "API plans differ by request cap. The swap itself stays free of a goblock fee.",
};

const PLANS = [
  {
    name: "Builder",
    cap: "60",
    detail: "A single bot or script.",
    href: "/keys?plan=builder",
  },
  {
    name: "Desk",
    cap: "300",
    detail: "A trading terminal with a few users.",
    href: "/keys?plan=desk",
    featured: true,
  },
  {
    name: "Venue",
    cap: "1,200",
    detail: "An app that quotes for many wallets.",
    href: "/keys?plan=venue",
  },
];

export default function PricingPage() {
  return (
    <main className="stage page">
      <SiteNav />
      <header className="hero">
        <i className="orb one" aria-hidden="true" />
        <i className="orb two" aria-hidden="true" />
        <h1>Request caps. No fee on the swap.</h1>
        <p className="lede">
          A swap from Trade stays free. A subscribed key does not add a protocol fee either. Plans differ by how many
          quotes you can ask for per minute.
        </p>
        <div className="hero-actions">
          <Link className="btn line" href="/docs">
            Read the docs
          </Link>
          <Link className="btn solid" href="/keys?plan=desk">
            Request Desk
          </Link>
        </div>
      </header>

      <section className="metrics">
        <h2>Three packages. The swap stays free.</h2>
        <div className="metric-grid">
          {PLANS.map((plan) => (
            <Link key={plan.name} href={plan.href} className={plan.featured ? "metric featured" : "metric"}>
              <strong>
                {plan.cap}
                <small> / min</small>
              </strong>
              <span>
                {plan.name}. {plan.detail}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <p className="fine">
        Automatic checkout is next. Until it ships, a key is added to the allowlist by hand, and every active key
        shares that allowlist. The caps above are the packages, not a live meter yet.
      </p>
    </main>
  );
}
