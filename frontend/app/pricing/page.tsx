import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { m } from "../motion";
import { Reveal } from "../reveal";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import "../home.css";
import "../sections.css";
import "../pages.css";

export const metadata = pageMeta({
  title: "Pricing · goblock",
  description: "Pay goblock by the month with no swap fee, or skip the bill and pay 5 bps on each landed swap.",
  path: "/pricing",
  keywords: ["Solana swap API pricing", "swap API plans", "DEX aggregator API"],
});

const INCLUDED = [
  ["Five venues", "PumpSwap, the Pump bonding curve, Raydium, Meteora, and Orca in one quote.", "M4 12h16M12 4v16M6 6l12 12"],
  ["Smart routes", "A direct pool, two hops through SOL or USDC, or a split across the top two.", "M5 19c0-8 6-8 7-14M12 5c1 6 7 6 7 14M12 5V3"],
  ["Ready to sign", "Add userPublicKey and the response carries a versioned transaction.", "M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4"],
  ["Coin receipt", "Graduated or still on the curve, creator fee, mayhem, and cashback.", "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4"],
  ["Sell-back preview", "roundTripOutAmount shows the SOL if the buy is sold straight back.", "M4 9h13l-3-3M20 15H7l3 3"],
  ["Minimum on chain", "The route checks the output account gained at least minOutAmount.", "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM9 12l2 2 4-4"],
];

const FAQ = [
  [
    "Does a plan add a fee to my users' swaps?",
    "Not on a monthly plan: those keys return swapFeeBps 0. Pay per swap adds 5 bps to each landed swap instead of a bill, and half of it goes to your wallet.",
  ],
  [
    "What counts as a request?",
    "Each call to /api/v1/swap. A quote and a quote with a transaction are both one request.",
  ],
  [
    "How do I get a key today?",
    "Checkout is not live yet. Keys are issued by the goblock team for now, and every active key shares one allowlist until per-plan caps ship.",
  ],
  [
    "Can I swap without a plan?",
    "Yes. The Trade page is free and needs no key. Plans are for software that calls the API.",
  ],
];

const FEATURED = PLANS.find((plan) => plan.featured) ?? PLANS[0];

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main className="stage home subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map(([question, answer]) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <SiteNav />

      <Reveal className="m-top" motion="pricing">
        <div className="j-wrap">
          <section className="m-hero" {...m("rise")}>
            <img className="m-hero-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />

            <div className="j-copy">
              <span className="m-chip" {...m("rise", 80)}>
                <i />
                Pricing
              </span>
              <h1 {...m("rise", 140)}>
                Pay by the month.
                <br />
                Or by the swap.
              </h1>
              <p {...m("rise", 220)}>
                Monthly plans add no goblock fee to the swap your users sign. Pay per swap has no bill: each landed swap
                pays 5 bps, and half of it goes to your wallet.
              </p>
              <div className="j-actions" {...m("rise", 300)}>
                <a className="j-go" href="#plans">
                  See Plans
                </a>
                <Link className="j-demo" href="/trade">
                  Trade for Free
                  <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </span>
                </Link>
              </div>
              <div className="m-works" {...m("rise", 380)}>
                <small>Every plan</small>
                {["Five venues", "Smart routes", "Ready to sign"].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="m-chat" {...m("pop", 260)}>
              <div className="m-chat-tab">
                <i className="p-bill-dot" />
                {FEATURED.name} plan
                <em>Recommended</em>
              </div>
              <div className="m-chat-body p-bill">
                <div className="p-bill-price">
                  <strong>{FEATURED.price}</strong>
                  <span>{FEATURED.period}</span>
                </div>
                <dl>
                  <div>
                    <dt>Request cap</dt>
                    <dd>{FEATURED.cap}</dd>
                  </div>
                  <div>
                    <dt>Venues in one quote</dt>
                    <dd>5</dd>
                  </div>
                  <div>
                    <dt>Brand link fee</dt>
                    <dd>5 bps, optional</dd>
                  </div>
                </dl>
                <div className="m-approve">
                  <span>
                    <small>goblock fee on the swap</small>
                    Your users pay the pool fee only.
                  </span>
                  <i>0 bps</i>
                </div>
              </div>
            </div>
          </section>

          <div className="p-plans" id="plans">
            {PLANS.map((plan, index) => (
              <article
                key={plan.id}
                className={plan.featured ? "p-plan featured" : "p-plan"}
                data-m="lift"
                style={{ ["--i" as string]: index }}
              >
                <span className="p-plan-tab">
                  <i />
                  {plan.name}
                </span>
                {plan.featured ? <span className="p-flag">Recommended</span> : null}
                <div className="p-plan-body">
                  <div className="p-price">
                    <strong>{plan.price}</strong>
                    {plan.period ? <span>{plan.period}</span> : null}
                  </div>
                  <span className="p-cap">{plan.cap}</span>
                  <p>{plan.detail}</p>
                  <ul className="p-perks">
                    {plan.perks.map((perk) => (
                      <li key={perk}>
                        <Check />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <Link className={plan.featured ? "p-btn dark" : "p-btn line"} href="/docs/authentication">
                    {plan.cta}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="p-note">
            Checkout is not live yet. Keys are issued by hand for now, and request caps and Pay per swap start when
            checkout ships.
          </p>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="included">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>Every plan</span>
            <h2 {...m("rise", 80)}>The same router on every plan.</h2>
            <p className="s-sub" {...m("rise", 160)}>
              The cap changes. The quote, the route, and the transaction do not.
            </p>
          </div>
          <ul className="p-incl">
            {INCLUDED.map(([title, body, icon], index) => (
              <li key={title} data-m="lift" style={{ ["--i" as string]: index % 3 }}>
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d={icon} />
                  </svg>
                </span>
                <b>{title}</b>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="free">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>No plan needed</span>
              <h2 {...m("rise", 80)}>Swapping is still free.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              A plan is for software. People who trade on goblock do not need one.
            </p>
          </div>
          <div className="p-free">
            <article {...m("left", 120)}>
              <strong>0 bps</strong>
              <b>Trade page</b>
              <p>A swap from the Trade page needs no key and adds no goblock fee. The wallet pays the pool fee only.</p>
              <Link className="p-btn line" href="/trade" style={{ width: "fit-content", marginTop: 8 }}>
                Start Trading
              </Link>
            </article>
            <article {...m("right", 200)}>
              <strong>5 bps</strong>
              <b>Brand link</b>
              <p>
                Share <code>/?brand=Name&amp;brandWallet=…</code>. Each landed swap pays 5 bps, half to your wallet and
                half to the goblock treasury.
              </p>
              <Link className="p-btn line" href="/docs/brand-link" style={{ width: "fit-content", marginTop: 8 }}>
                How It Pays
              </Link>
            </article>
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="faq">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>Questions</span>
            <h2 {...m("rise", 80)}>Before you subscribe.</h2>
          </div>
          <div className="p-faq" {...m("rise", 160)}>
            {FAQ.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Reveal>

      <SiteFoot />
    </main>
  );
}
