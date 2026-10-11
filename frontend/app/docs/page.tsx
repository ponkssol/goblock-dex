import Link from "next/link";
import { pageMeta } from "../site";
import { Cards, ICONS, type Card } from "./parts";

export const metadata = pageMeta({
  title: "Docs · goblock",
  description: "Quote a Solana swap across five venues and get a transaction to sign with the goblock API.",
  path: "/docs",
  keywords: ["Solana swap API", "swap API docs", "Solana aggregator API"],
});

const SWAP_CARDS: Card[] = [
  {
    href: "/docs/routing",
    title: "Introduction",
    body: "How one quote compares five Solana venues and keeps the route that pays the wallet the most.",
    icon: ICONS.swap,
  },
  {
    href: "/docs/quickstart",
    title: "Send Your First Swap",
    body: "Quote, sign, and send your first swap in a few lines of code.",
    icon: ICONS.send,
  },
];

const REFERENCE_CARDS: Card[] = [
  {
    href: "/docs/swap",
    title: "API Reference",
    body: "Every query parameter and response field of GET /api/v1/swap.",
    icon: ICONS.code,
  },
  {
    href: "/docs/authentication",
    title: "Authentication",
    body: "Send your key in one header, and check that it is active.",
    icon: ICONS.key,
  },
  {
    href: "/docs/brand-link",
    title: "Brand Link",
    body: "Put your name on a link and earn half of a 5 bps fee on every landed swap.",
    icon: ICONS.tag,
  },
  {
    href: "/docs/errors",
    title: "Errors",
    body: "Status codes, and the message you can show to the user.",
    icon: ICONS.alert,
  },
];

export default function DocsHome() {
  return (
    <>
      <section className="d-hero">
        <img className="d-hero-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />
        <h1>Build on goblock.</h1>
        <p>Integrate Solana swaps into your app with one API.</p>
        <div className="d-hero-actions">
          <Link className="p-btn dark" href="/docs/quickstart">
            Get Started
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link className="p-btn ghost" href="/docs/swap">
            API Reference
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </section>

      <section className="d-group">
        <h2>Swap API</h2>
        <Cards items={SWAP_CARDS} />
      </section>

      <section className="d-group">
        <h2>Tools &amp; Reference</h2>
        <Cards items={REFERENCE_CARDS} />
      </section>
    </>
  );
}
