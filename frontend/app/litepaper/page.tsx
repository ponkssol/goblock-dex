import Link from "next/link";
import type { ReactNode } from "react";
import { PLANS } from "@/lib/plans";
import { Info, Sec } from "../docs/parts";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { Contents } from "./contents";
import "../home.css";
import "../sections.css";
import "../pages.css";
import "./litepaper.css";

export const metadata = pageMeta({
  title: "Litepaper · goblock",
  description:
    "How goblock quotes five Solana venues in one swap, what it charges, and how its fees collect in an on-chain vault that buys and burns $GOBLOCK.",
  path: "/litepaper",
  keywords: ["goblock litepaper", "GOBLOCK token", "Solana swap aggregator", "buyback and burn"],
});

const PROGRAM = "GBLK6CfBQXsTjYZqzpNs5gxYjp8r3NqnqZiohjuvxMww";
const VAULT = "7bo6FFvvfPfzcBn7tow8hhUrtXmYboeoqCaNmHBqqsaF";
const LEDGER = "5ban1zcyXLS9ZEHo5r5xmDXaDX1jaqAuNigKbp4QUzMr";
const TEAM = "CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo";
const AUTHORITY = "GoBLK9ujNfaaoap2mYr2wA6j4okNcw29K9RTBozrt7zg";

const SECTIONS: [string, string][] = [
  ["overview", "Overview"],
  ["why", "Why goblock"],
  ["swap", "How a swap works"],
  ["router", "The router program"],
  ["fees", "Fees"],
  ["api", "API and plans"],
  ["vault", "The fee vault"],
  ["buyback", "Buyback and burn"],
  ["token", "$GOBLOCK"],
  ["trust", "Trust and risks"],
  ["addresses", "Addresses"],
  ["next", "What comes next"],
  ["disclaimer", "Disclaimer"],
];

const POINTS = [
  ["Free to trade", "The Trade page adds no goblock fee. The trader pays the pool fee and the network fee."],
  ["Five venues, one quote", "PumpSwap, the Pump bonding curve, Raydium, Meteora, and Orca are asked at the same time."],
  ["Checked on chain", "The router program fails the swap if the wallet receives less than the quoted minimum."],
  ["Fees buy and burn", "goblock fees collect in a program vault. 40% buys $GOBLOCK and burns it."],
];

const FEES: [string, string, string][] = [
  ["Trade page", "0 bps", "No key needed."],
  ["Brand link", "5 bps", "Half to the brand wallet, half to goblock."],
  ["Free key: SOL with a stablecoin or an LST", "0 bps", "Pegged pairs pay nothing."],
  ["Free key: SOL with a major token", "3 bps", "For example SOL to JUP."],
  ["Free key: SOL with any other pool token", "5 bps", "Graduated coins and other pool tokens."],
  ["Free key: SOL with a bonding-curve coin", "20 bps", "Coins still on the Pump curve."],
  ["Free key: no SOL on either side", "0 bps", "There is no SOL side to charge."],
  ["Monthly plan", "0 bps", "The subscription replaces the swap fee."],
  ["Integrator fee", "50–255 bps", "Your wallet gets 90%. goblock keeps 10%, or the free-key fee when that is larger."],
];

const ADDRESSES: [string, string, string][] = [
  ["Router program", PROGRAM, `account/${PROGRAM}`],
  ["Fee vault", VAULT, `account/${VAULT}`],
  ["Vault ledger", LEDGER, `account/${LEDGER}`],
  ["Team wallet", TEAM, `account/${TEAM}`],
  ["Upgrade authority", AUTHORITY, `account/${AUTHORITY}`],
];

function Row({ name, value, note }: { name: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={note === undefined ? "d-row two" : "d-row"}>
      <b className="l-cell">{name}</b>
      {note === undefined ? <span>{value}</span> : <span className="d-type">{value}</span>}
      {note === undefined ? null : <span>{note}</span>}
    </div>
  );
}

export default function LitepaperPage() {
  return (
    <main className="stage home subpage">
      <SiteNav />

      <section className="j-wrap p-hero l-hero">
        <span className="s-kick">Litepaper</span>
        <h1>
          goblock, <em>end to end.</em>
        </h1>
        <p>
          A Solana swap aggregator that quotes five venues at once, lets you sign in your own wallet, and sends its fees
          to an on-chain vault that buys and burns $GOBLOCK.
        </p>
        <div className="l-meta">
          <span>Version 1.0</span>
          <span>October 2026</span>
          <span>Solana mainnet</span>
        </div>
      </section>

      <div className="j-wrap d-shell l-shell">
        <Contents items={SECTIONS} />

        <article className="d-main wide l-main">
          <Sec id="overview" title="Overview">
            <p>
              goblock finds the best price for a Solana swap. One quote compares PumpSwap, the Pump bonding curve,
              Raydium, Meteora, and Orca, and goblock builds a single transaction that the trader signs in their own
              wallet. goblock never holds anyone’s funds.
            </p>
            <p>
              It has three parts: the <Link href="/trade">Trade page</Link> for people, the{" "}
              <Link href="/docs">swap API</Link> for bots and apps, and a router program on Solana that checks every
              swap. Fees from the API and from brand links collect in a program vault, and the program splits them:
              60% to the team and 40% to buy and burn $GOBLOCK.
            </p>
            <ul className="l-points">
              {POINTS.map(([title, body]) => (
                <li key={title}>
                  <b>{title}</b>
                  <span>{body}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec id="why" title="Why goblock">
            <p>Three things make a Solana swap cost more than it should.</p>
            <ul>
              <li>
                <b>A fee on top of the pool fee.</b> Jupiter charges 50 bps on a new coin and 10 bps on an ordinary
                one. A swap on the goblock Trade page adds no goblock fee at all.
              </li>
              <li>
                <b>Signing blind.</b> A Pump trader needs to know, before signing, whether a coin is still on the
                bonding curve, what the creator fee is, whether mayhem or cashback is on, and what they would get back
                if they sold straight away. goblock shows all of it next to the quote.
              </li>
              <li>
                <b>Waiting for API access.</b> Some production swap APIs need an application and days of review.
                goblock hands out a free production key in one call.
              </li>
            </ul>
          </Sec>

          <Sec id="swap" title="How a swap works">
            <ol className="d-steps">
              <li>
                <b>Quote</b>
                <span>Every venue is asked at the same time. A venue gets up to four seconds, and a late one is left out.</span>
              </li>
              <li>
                <b>Route</b>
                <span>
                  goblock compares a direct pool, two hops through SOL or USDC, and a 50/50 or 70/30 split across the
                  two best pools, and keeps the one that pays the wallet the most.
                </span>
              </li>
              <li>
                <b>Sign</b>
                <span>The quote comes back with a versioned transaction. The trader signs it in their own wallet.</span>
              </li>
            </ol>
            <h3>What the trader sees first</h3>
            <ul>
              <li>
                <b>Coin receipt:</b> graduated or still on the curve, the creator fee, mayhem, and cashback.
              </li>
              <li>
                <b>Sell-back preview:</b> <code>roundTripOutAmount</code>, the SOL the trader would get if the buy were
                sold straight back.
              </li>
              <li>
                <b>Priority fee:</b> it follows the slot queue at that moment and is capped at 0.0001 SOL, enough to
                land within one or two slots. goblock earns nothing from it.
              </li>
            </ul>
          </Sec>

          <Sec id="router" title="The router program">
            <p>
              Every goblock swap is one instruction to the goblock program{" "}
              <a href={`https://solscan.io/account/${PROGRAM}`} target="_blank" rel="noreferrer">
                <code>GBLK6C…uvxMww</code>
              </a>
              . That instruction forwards the pool swap and then checks the result.
            </p>
            <ul>
              <li>It only forwards to an allowlist of programs: the five venues, the token programs, and Memo.</li>
              <li>
                After the swap it reads the trader’s output token account. If it grew by less than{" "}
                <code>minOutAmount</code>, the whole transaction fails.
              </li>
              <li>
                The fee is paid inside the same instruction, so it is only paid when the swap lands. It can only go to
                the accounts named in the instruction, and one swap can never pay more than 2 SOL in fees.
              </li>
              <li>
                Each swap writes a <code>goblock:</code> log, so goblock volume can be counted from the chain.
              </li>
            </ul>
            <p>
              The program is written in Rust with pinocchio, and its source is public at{" "}
              <a href="https://github.com/ponkssol/goblock-program" target="_blank" rel="noreferrer">
                github.com/ponkssol/goblock-program
              </a>
              .
            </p>
          </Sec>

          <Sec id="fees" title="Fees">
            <p>
              goblock charges in SOL, on the SOL side of the swap only. The pool fee always goes to the pool, and the
              network fee goes to Solana.
            </p>
            <div className="d-table">
              <div className="d-row head">
                <span>Swap</span>
                <span>goblock fee</span>
                <span>Note</span>
              </div>
              {FEES.map(([name, fee, note]) => (
                <Row key={name} name={name} value={fee} note={note} />
              ))}
            </div>
            <Info>
              Every goblock fee goes to the fee vault, not to a personal wallet. The <a href="#vault">vault</a> decides
              what happens next.
            </Info>
          </Sec>

          <Sec id="api" title="API and plans">
            <p>
              <code>GET /api/v1/swap</code> returns the best quote. Add <code>userPublicKey</code> and the same response
              carries a transaction ready to sign. A free key comes from <code>POST /api/v1/key</code>, with no form
              and no review.
            </p>
            <div className="d-table">
              <div className="d-row head">
                <span>Plan</span>
                <span>Price</span>
                <span>Requests</span>
              </div>
              {PLANS.map((plan) => (
                <Row key={plan.id} name={plan.name} value={`${plan.price} ${plan.period}`.trim()} note={plan.cap} />
              ))}
            </div>
            <p>
              Builder and Starter are paid at <Link href="/checkout">checkout</Link> in SOL or USDC. A paid key adds no
              goblock fee for 30 days, then keeps working at the free-key rate. goblock also runs an{" "}
              <Link href="/mcp">MCP server</Link>, so Claude can quote swaps for you. Read the{" "}
              <Link href="/docs">docs</Link> or see <Link href="/pricing">pricing</Link>.
            </p>
          </Sec>

          <Sec id="vault" title="The fee vault">
            <p>
              The vault is a program address,{" "}
              <a href={`https://solscan.io/account/${VAULT}`} target="_blank" rel="noreferrer">
                <code>7bo6FF…BqqsaF</code>
              </a>
              . Nobody has a private key for it. Only the goblock program can move its SOL, and only by the rules
              below.
            </p>
            <ul>
              <li>0.001 SOL always stays in the vault so the account stays open.</li>
              <li>
                New fees are the vault balance, minus that 0.001 SOL, minus the SOL already held for buyback.
              </li>
              <li>
                When new fees reach <b>0.1 SOL</b>, the split can run. It splits all of them: <b>60%</b> goes to the
                team wallet and <b>40%</b> is held in the vault for the buyback.
              </li>
              <li>
                Anyone can run the split with <code>distribute</code>. The caller pays the network fee and gets nothing
                else, so there is no reason to game it.
              </li>
            </ul>
            <p>
              A ledger account,{" "}
              <a href={`https://solscan.io/account/${LEDGER}`} target="_blank" rel="noreferrer">
                <code>5ban1z…4QUzMr</code>
              </a>
              , keeps the running totals: SOL paid to the team, SOL spent on buyback, tokens burned, and rounds. The{" "}
              <Link href="/buyback">Buyback page</Link> reads them live.
            </p>
          </Sec>

          <Sec id="buyback" title="Buyback and burn">
            <p>
              Once the $GOBLOCK address is set, the same <code>distribute</code> transaction spends the held SOL on
              $GOBLOCK. The program checks every step of that buy.
            </p>
            <ul>
              <li>
                Only a Pump bonding-curve buy or a PumpSwap buy of $GOBLOCK is allowed, and the tokens must land in the
                vault’s own token account. Opening, wrapping, and closing the vault’s own accounts are the only other
                steps allowed.
              </li>
              <li>The buy can never spend more than the SOL held for buyback. The team’s 60% is never touched.</li>
              <li>
                Right after the buy, the program burns everything in the vault’s token account and fails if that is
                less than the quoted minimum. The buy allows up to 3% slippage.
              </li>
              <li>
                While $GOBLOCK is on the bonding curve the buy goes to Pump. After it graduates, it goes to PumpSwap.
              </li>
            </ul>
            <Info>
              We ran each rule against a copy of mainnet before launch: a split, a buyback and burn, a buy of the wrong
              token, and a buy that tried to send vault SOL elsewhere. The program blocked the last two.
            </Info>
          </Sec>

          <Sec id="token" title="$GOBLOCK">
            <p>
              $GOBLOCK launches on pump.fun. After launch, the team wallet saves its contract address in the vault
              ledger once, and the program locks it. It can never be changed, so the buyback can only ever buy that
              one token.
            </p>
            <p>
              Until then, the Buyback page reads <b>Not set yet</b>. Any address that claims to be $GOBLOCK before it
              shows up on the <Link href="/buyback">Buyback page</Link> is not ours.
            </p>
            <p>
              $GOBLOCK is the protocol token. Fees collected by goblock fund it: 40% of each distribution buys $GOBLOCK
              and the program burns what it buys. That is the economy in the program today. Holding the token is not a
              share of the company and not a vote. The burn reduces supply. It does not set a price.
            </p>
          </Sec>

          <Sec id="trust" title="Trust and risks">
            <ul>
              <li>
                <b>Self-custody.</b> Every swap is signed in the trader’s wallet. goblock never holds funds.
              </li>
              <li>
                <b>Check it yourself.</b> Every address below opens on Solscan, and the vault totals come straight from
                the chain.
              </li>
              <li>
                <b>Upgrade key.</b> The team keeps the program’s upgrade key to fix bugs. An upgrade could change the
                rules, and every upgrade is public on the program’s page.
              </li>
              <li>
                <b>No audit yet.</b> The program has been tested against mainnet state but has not been audited by a
                third party.
              </li>
              <li>
                <b>Front-running.</b> A buyback is a public trade, so bots can trade around it. The 3% slippage cap and
                small round sizes limit that.
              </li>
              <li>
                <b>Market risk.</b> $GOBLOCK trades on a public market and the price can fall.
              </li>
            </ul>
          </Sec>

          <Sec id="addresses" title="Addresses">
            <div className="d-table">
              <div className="d-row two head">
                <span>Account</span>
                <span>Address</span>
              </div>
              {ADDRESSES.map(([name, address, path]) => (
                <Row
                  key={name}
                  name={name}
                  value={
                    <a className="l-addr" href={`https://solscan.io/${path}`} target="_blank" rel="noreferrer">
                      {address}
                    </a>
                  }
                />
              ))}
              <Row name="$GOBLOCK" value={<Link href="/buyback">Shown on the Buyback page after launch</Link>} />
            </div>
          </Sec>

          <Sec id="next" title="What comes next">
            <ul>
              <li>Launch $GOBLOCK on pump.fun and lock its address in the vault ledger.</li>
            </ul>
          </Sec>

          <Sec id="disclaimer" title="Disclaimer">
            <p className="l-fine">
              This litepaper describes the software and the token economy as they work today. It is not financial
              advice and not an offer to sell a security. $GOBLOCK is the protocol token. Protocol fees buy it and the
              program burns what it buys. That buyback is not a guaranteed price or return. Rules described here can
              change if the program is upgraded. Crypto trading can lose money, so only use funds you can afford to
              lose.
            </p>
          </Sec>
        </article>
      </div>

      <SiteFoot />
    </main>
  );
}
