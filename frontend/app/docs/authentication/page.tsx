import Link from "next/link";
import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Endpoint, Info, Sec } from "../parts";

export const metadata = docMeta("/docs/authentication");

const FEES = `"fees": [
    { "pair": "SOL with a stablecoin or an LST", "bps": 0 },
    { "pair": "SOL with a major token", "bps": 3 },
    { "pair": "SOL with any other pool token", "bps": 5 },
    { "pair": "SOL with a bonding-curve token", "bps": 20 },
    { "pair": "No SOL on either side", "bps": 0 }
  ],
  "feeToken": "SOL",
  "platformFee": { "minBps": 50, "maxBps": 255, "goblockShare": "10%" },
  "endpoints": ["/api/v1/swap"]`;

const ISSUE_SNIPPETS = [
  {
    label: "cURL",
    code: `curl -X POST "{origin}/api/v1/key"`,
  },
  {
    label: "Response",
    code: `{
  "key": "gb_free_…",
  "plan": "free",
  ${FEES}
}`,
  },
];

const KEY_SNIPPETS = [
  {
    label: "cURL",
    code: `curl "{origin}/api/v1/key" \\
  -H "x-api-key: $GOBLOCK_API_KEY"`,
  },
  {
    label: "Response",
    code: `{
  "active": true,
  "plan": "free",
  ${FEES},
  "limit": "10 requests / min"
}`,
  },
];

export default function Authentication() {
  return (
    <>
      <Sec id="dashboard" title="Use the dashboard">
        <p>
          Sign in at the <Link href="/dashboard">API Dashboard</Link> with your Solana wallet. From there you can
          create up to five keys, rotate or revoke them, and see requests, errors, and fee-wallet earnings for each
          day. Dashboard keys start with <code>gb_live_</code>.
        </p>
      </Sec>

      <Sec id="free-key" title="Get a free key">
        <p>
          No wallet at hand? One call returns a key that works right away. It is not tied to a wallet, so it does not
          show in the dashboard. It adds a small fee on the SOL side of each swap, listed in{" "}
          <code>fees</code>. Swaps between two tokens that are not SOL pay nothing.
        </p>
        <Endpoint path="/api/v1/key" method="POST" note="No key needed" />
        <CodeBlock className="slim" snippets={ISSUE_SNIPPETS} />
        <Info>Save the key when it comes back. goblock cannot show it to you again.</Info>
      </Sec>

      <Sec id="header" title="Send the header">
        <p>
          Send your key in the <code>x-api-key</code> header on every request. A missing key, or one that is not
          active, returns <code>401</code>. A key over its request cap returns <code>429</code>. A free key is 10
          requests a minute, Builder is 30, and Starter is 120.
        </p>
      </Sec>

      <Sec id="check" title="Check a key">
        <p>Call the key endpoint to see the plan of a key and the fee it adds to each swap.</p>
        <Endpoint path="/api/v1/key" />
        <CodeBlock className="slim" snippets={KEY_SNIPPETS} />
      </Sec>

      <Sec id="safety" title="Keep it on your server">
        <p>
          Call the API from your backend and pass the result to your app. Anyone who can read your browser bundle can
          read a key shipped inside it.
        </p>
        <Info>
          Builder is $20 a month for 30 requests a minute. Starter is $99 a month for 120 requests a minute. Pay in SOL
          or USDC at <Link href="/checkout">checkout</Link>. The key adds no goblock fee for 30 days.
        </Info>
      </Sec>
    </>
  );
}
