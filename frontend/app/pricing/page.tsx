import Link from "next/link";
import { PLANS, planHref } from "@/lib/plans";
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
  description:
    "Start with a free Solana swap API key that charges 0 to 5 bps on pool swaps, or pay by the month and add no goblock fee.",
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

type PublicConfig = {
  plans?: { freeRpm: number; builderUsd: number; builderRpm: number; starterUsd: number; starterRpm: number };
  fees?: {
    stableBps: number;
    majorBps: number;
    otherBps: number;
    curveBps: number;
    brandBps: number;
    platformMinBps: number;
    platformMaxBps: number;
  };
};

async function publicConfig(): Promise<PublicConfig | null> {
  try {
    const response = await fetch(`${process.env.BACKEND_URL ?? "http://127.0.0.1:4000"}/api/config`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as PublicConfig;
  } catch {
    return null;
  }
}

const FAQ = [
  [
    "Does a plan add a fee to my users' swaps?",
    "Not on a monthly plan. The free key adds a fee on the SOL side of the swap: 0 bps with a stablecoin or an LST, 3 bps with a major token, 5 bps with any other pool token, and 20 bps on a bonding curve. Pairs without SOL pay nothing.",
  ],
  [
    "Can I charge my own fee?",
    "Yes. Send platformFeeBps from 50 to 255 with a feeWallet. On a monthly plan your wallet gets 90%. On the free key, goblock keeps 10% or the free-key fee for that pair, whichever is larger.",
  ],
  [
    "What counts as a request?",
    "Each call to /api/v1/swap. A quote and a quote with a transaction are both one request.",
  ],
  [
    "How do I get a key?",
    "A free key comes from the API Dashboard or from POST /api/v1/key, and it is limited to 10 requests a minute. Builder and Starter are paid at checkout in SOL or USDC. Enterprise is arranged with the goblock team.",
  ],
  [
    "Can I swap without a plan?",
    "Yes. The Trade page is free and needs no key. Plans are for software that calls the API.",
  ],
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export default async function PricingPage() {
  const config = await publicConfig();
  const plans = config?.plans;
  const fees = config?.fees;
  const shown = PLANS.map((plan) => {
    if (!plans || !fees) return plan;
    if (plan.id === "free") {
      return {
        ...plan,
        cap: `${plans.freeRpm} requests / min`,
        perks: [
          `${fees.stableBps} bps on stablecoins and LSTs`,
          `${fees.majorBps} bps on major tokens, ${fees.otherBps} bps on other pool tokens`,
          `${fees.curveBps} bps on bonding-curve coins`,
          "Add your own fee on top",
        ],
      };
    }
    if (plan.id === "builder") return { ...plan, price: `$${plans.builderUsd}`, cap: `${plans.builderRpm} requests / min` };
    if (plan.id === "starter") return { ...plan, price: `$${plans.starterUsd}`, cap: `${plans.starterRpm} requests / min` };
    return plan;
  });
  const featured = shown.find((plan) => plan.featured) ?? shown[0];
  const brand = fees?.brandBps ?? 5;
  const poolLow = fees ? Math.min(fees.stableBps, fees.majorBps, fees.otherBps) : 0;
  const poolHigh = fees ? Math.max(fees.stableBps, fees.majorBps, fees.otherBps) : 5;
  const poolSpan = poolLow === poolHigh ? `${poolLow} bps` : `${poolLow} to ${poolHigh} bps`;
  const faq = FAQ.map(([question, answer]) => {
    if (!fees || !plans) return [question, answer] as const;
    if (question.startsWith("Does a plan")) {
      return [
        question,
        `Not on a monthly plan. The free key adds a fee on the SOL side of the swap: ${fees.stableBps} bps with a stablecoin or an LST, ${fees.majorBps} bps with a major token, ${fees.otherBps} bps with any other pool token, and ${fees.curveBps} bps on a bonding curve. Pairs without SOL pay nothing.`,
      ] as const;
    }
    if (question.startsWith("Can I charge")) {
      return [
        question,
        `Yes. Send platformFeeBps from ${fees.platformMinBps} to ${fees.platformMaxBps} with a feeWallet. On a monthly plan your wallet gets 90%. On the free key, goblock keeps 10% or the free-key fee for that pair, whichever is larger.`,
      ] as const;
    }
    if (question.startsWith("How do I get")) {
      return [
        question,
        `A free key comes from the API Dashboard or from POST /api/v1/key, and it is limited to ${plans.freeRpm} requests a minute. Builder is $${plans.builderUsd} for ${plans.builderRpm} requests a minute. Starter is $${plans.starterUsd} for ${plans.starterRpm} requests a minute. Enterprise is arranged with the goblock team.`,
      ] as const;
    }
    return [question, answer] as const;
  });
  return (
    <main className="stage home subpage">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(([question, answer]) => ({
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
                Start free.
                <br />
                Pay to drop the fee.
              </h1>
              <p {...m("rise", 220)}>
                The free key has no bill and charges {poolSpan} on pool swaps. Monthly plans add no goblock fee to the
                swap your users sign.
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
                {featured.name} plan
                <em>Recommended</em>
              </div>
              <div className="m-chat-body p-bill">
                <div className="p-bill-price">
                  <strong>{featured.price}</strong>
                  <span>{featured.period}</span>
                </div>
                <dl>
                  <div>
                    <dt>Request cap</dt>
                    <dd>{featured.cap}</dd>
                  </div>
                  <div>
                    <dt>Venues in one quote</dt>
                    <dd>5</dd>
                  </div>
                  <div>
                    <dt>Brand link fee</dt>
                    <dd>{brand} bps, optional</dd>
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
            {shown.map((plan, index) => (
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
                  <Link
                    className={plan.featured ? "p-btn dark" : "p-btn line"}
                    href={planHref(plan.id)}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="p-note">
            Free keys come from the <Link href="/dashboard">API Dashboard</Link>. Builder and Starter are paid at{" "}
            <Link href="/checkout">checkout</Link> in SOL or USDC, and the request cap starts when the key is issued.
            Enterprise is arranged with the goblock team.
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
                Share <code>/?brand=Name&amp;brandWallet=…</code>. Each landed swap pays {brand} bps, half to your wallet and
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
            {faq.map(([question, answer]) => (
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
