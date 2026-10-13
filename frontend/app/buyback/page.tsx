import Link from "next/link";
import { m } from "../motion";
import { Reveal } from "../reveal";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { BuybackBoard, VaultCard } from "./board";
import "../home.css";
import "../sections.css";
import "../pages.css";
import "./buyback.css";

export const metadata = pageMeta({
  title: "Buyback · goblock",
  description:
    "goblock swap fees collect in an on-chain vault. At 0.1 SOL, 40% buys $GOBLOCK and burns it and 60% goes to the team, enforced by the program.",
  path: "/buyback",
  keywords: ["goblock buyback", "GOBLOCK burn", "Solana fee vault"],
});

const RULES = [
  ["Fees land in a vault", "Every goblock fee goes to a program address. No private key can move it.", "M4 10h16v10H4zM8 10V7a4 4 0 0 1 8 0v3"],
  ["Split at 0.1 SOL", "When new fees reach 0.1 SOL, anyone can run the split. 60% goes to the team wallet.", "M12 3v18M5 8h14M7 16h10"],
  ["40% buys $GOBLOCK", "The other 40% stays in the vault until it buys $GOBLOCK on pump.fun or PumpSwap.", "M4 17l6-6 4 4 6-8M14 7h6v6"],
  ["Every token is burned", "The program burns everything it bought in the same transaction. Supply only goes down.", "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-2 1-4 3-5 0 2 1 3 2 3 0-3 0-5 1-8z"],
];

const FAQ = [
  [
    "Who can move the vault's SOL?",
    "Only the goblock program, and only by its own rules: 60% of new fees to the team wallet, and the rest to a $GOBLOCK buy that is burned. A buy that sends SOL anywhere else fails.",
  ],
  [
    "Why 0.1 SOL?",
    "Small splits waste network fees. Waiting for 0.1 SOL keeps each round worth running.",
  ],
  [
    "Can the buyback token change?",
    "No. The team wallet sets the $GOBLOCK contract address once, and the program locks it after that.",
  ],
  [
    "Who pays to run the split?",
    "Whoever presses Distribute Now pays the network fee. The vault pays for the token accounts the buy needs.",
  ],
  [
    "Can the program be upgraded?",
    "Yes. The team keeps the upgrade key so it can fix bugs. Every upgrade is public on Solana and shows on the program's page.",
  ],
];

export default function BuybackPage() {
  return (
    <main className="stage home subpage">
      <SiteNav />

      <Reveal className="m-top" motion="buyback">
        <div className="j-wrap">
          <section className="m-hero" {...m("rise")}>
            <img className="m-hero-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />

            <div className="j-copy">
              <span className="m-chip" {...m("rise", 80)}>
                <i />
                Buyback
              </span>
              <h1 {...m("rise", 140)}>
                Fees buy
                <br />
                and burn $GOBLOCK.
              </h1>
              <p {...m("rise", 220)}>
                Swap fees collect in an on-chain vault. At 0.1 SOL, 40% buys $GOBLOCK and burns it and 60% pays the team.
                The program enforces the split, and anyone can check it.
              </p>
              <div className="j-actions" {...m("rise", 300)}>
                <a className="j-go" href="#vault">
                  See the Vault
                </a>
                <Link className="j-demo" href="/litepaper">
                  Read the Litepaper
                  <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>

            <div {...m("pop", 260)}>
              <VaultCard />
            </div>
          </section>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="vault">
        <div className="j-wrap" id="vault">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>On chain</span>
              <h2 {...m("rise", 80)}>Every lamport, in the open.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              These numbers come straight from the vault ledger on Solana. Open any address to check it yourself.
            </p>
          </div>
          <div {...m("rise", 200)}>
            <BuybackBoard />
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="rules">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>The rules</span>
            <h2 {...m("rise", 80)}>Written into the program.</h2>
            <p className="s-sub" {...m("rise", 160)}>
              Not a promise on a page. The router program checks each step and fails the transaction if one is wrong.
            </p>
          </div>
          <ul className="p-incl b-rules">
            {RULES.map(([title, body, icon], index) => (
              <li key={title} data-m="lift" style={{ ["--i" as string]: index % 2 }}>
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

      <Reveal className="s-sec" motion="faq">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>Questions</span>
            <h2 {...m("rise", 80)}>How the vault works.</h2>
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
