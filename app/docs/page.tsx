import type { Metadata } from "next";
import { SiteNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Docs — goblock",
  description: "Quote and build a one-step swap with the goblock API.",
};

export default function DocsPage() {
  return (
    <main className="stage page">
      <SiteNav />
      <header className="hero">
        <i className="orb one" aria-hidden="true" />
        <i className="orb two" aria-hidden="true" />
        <h1>Quote a swap. Sign it yourself.</h1>
        <p className="lede">
          One request compares Pump, Raydium, Meteora, and Orca, then keeps the pool with the most output. Add a
          wallet and the same request returns a transaction.
        </p>
        <div className="hero-actions">
          <a className="btn line" href="#routes">
            See the routes
          </a>
          <a className="btn solid" href="#sign">
            Sign a swap
          </a>
        </div>
      </header>

      <section className="band" id="routes">
        <div>
          <h2>Two routes. Same price.</h2>
          <p className="copy">
            Trade uses the public route. A subscription key uses the other. Neither adds a goblock fee of its own.
          </p>
          <ul className="checks">
            <li>GET /api/swap is public. No key.</li>
            <li>GET /api/v1/swap needs x-api-key. A missing key returns 401.</li>
            <li>brandWallet adds 5 bps, split with the treasury, and only if the swap lands.</li>
          </ul>
        </div>
        <div className="wash" id="query">
          <p>Query</p>
          <ul>
            <li>
              <code>inputMint</code>
              <span>Mint you pay</span>
            </li>
            <li>
              <code>outputMint</code>
              <span>Mint you receive</span>
            </li>
            <li>
              <code>amount</code>
              <span>Atomic units. 10000000 is 0.01 SOL</span>
            </li>
            <li>
              <code>slippageBps</code>
              <span>Default 100. From 1 to 5000</span>
            </li>
            <li>
              <code>userPublicKey</code>
              <span>Omit for a quote. Include to sign</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="band" id="quote">
        <div>
          <h2>Ask for a price, or a transaction.</h2>
          <p className="copy">
            Amounts come back as atomic strings. outAmount is what the wallet receives. minOutAmount is the floor after
            slippage.
          </p>
          <ul className="checks">
            <li>priceImpactPct is a fraction, so 0.01 means 1%.</li>
            <li>roundTripOutAmount is the SOL if the buy is sold straight back.</li>
            <li>venue is the pool that paid the most.</li>
          </ul>
        </div>
        <pre className="wash code">{`GET /api/v1/swap
  ?inputMint=So11111111111111111111111111111111111111112
  &outputMint=TOKEN_MINT
  &amount=10000000
  &slippageBps=100
x-api-key: YOUR_KEY`}</pre>
      </section>

      <section className="ref" id="fields">
        <h2>What the quote tells you</h2>
        <ul className="defs">
          <li>
            <code>venue</code>
            <span>PumpSwap, Bonding curve, Raydium, Meteora, or Orca.</span>
          </li>
          <li>
            <code>receipt.graduated</code>
            <span>True on PumpSwap, false on the bonding curve.</span>
          </li>
          <li>
            <code>receipt.creatorFeeBps</code>
            <span>Creator fee in basis points. 100 bps is 1%.</span>
          </li>
          <li>
            <code>receipt.mayhem</code>
            <span>Mayhem mode on this coin.</span>
          </li>
          <li>
            <code>receipt.cashback</code>
            <span>Cashback coin.</span>
          </li>
          <li>
            <code>feeBps</code>
            <span>0 on a normal swap. 5 when brandWallet is set.</span>
          </li>
          <li>
            <code>networkFeeLamports</code>
            <span>Base signature fee plus a priority fee capped at 0.0001 SOL.</span>
          </li>
          <li>
            <code>brand</code>
            <span>Optional memo, at most 32 characters. Letters, numbers, spaces, periods, and dashes.</span>
          </li>
        </ul>
      </section>

      <section className="ref" id="sign">
        <h2>Sign</h2>
        <p className="copy">Pass userPublicKey. The response then includes a base64 versioned transaction.</p>
        <pre>{`const bytes = Uint8Array.from(atob(body.transaction), (char) => char.charCodeAt(0));
const transaction = VersionedTransaction.deserialize(bytes);
const signature = await sendTransaction(transaction, connection);
await connection.confirmTransaction(
  {
    signature,
    blockhash: transaction.message.recentBlockhash,
    lastValidBlockHeight: body.lastValidBlockHeight,
  },
  "confirmed",
);`}</pre>
      </section>

      <section className="ref" id="errors">
        <h2>Errors</h2>
        <ul className="defs">
          <li>
            <code>401</code>
            <span>Subscription route, and the key is missing or not on the allowlist.</span>
          </li>
          <li>
            <code>400</code>
            <span>Mint, amount, slippage, wallet, or brand name was rejected.</span>
          </li>
          <li>
            <code>404</code>
            <span>No direct pool was found for that pair.</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
