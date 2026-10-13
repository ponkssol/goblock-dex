import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { docMeta } from "../nav";
import { Sec, Table } from "../parts";

export const metadata = docMeta("/docs/plans");

const FREE_FEES: [string, string][] = [
  ["SOL with a stablecoin or an LST", "0 bps"],
  ["SOL with a major token, like JUP or BONK", "3 bps"],
  ["SOL with any other pool token", "5 bps"],
  ["SOL with a bonding-curve token", "20 bps"],
  ["No SOL on either side", "0 bps"],
];

export default function Plans() {
  return (
    <>
      <Sec id="plans" title="Plans">
        <Table
          head={["Plan", "Price", "Limit"]}
          rows={PLANS.map((plan) => [plan.name, `${plan.price}${plan.period ? ` ${plan.period}` : ""}`, plan.cap])}
        />
        <div className="p-actions">
          <Link className="p-btn" href="/pricing">
            See Pricing
          </Link>
          <Link className="p-btn line" href="/trade">
            Try the Trade Page
          </Link>
        </div>
      </Sec>

      <Sec id="free-fees" title="Free key fees">
        <p>
          The fee is taken in SOL, from the input when the user pays SOL and from the output when the user receives
          SOL. A route through more than one pool pays the pool rate. Monthly plans pay 0 bps on every pair.
        </p>
        <Table head={["Pair", "Fee"]} rows={FREE_FEES} />
        <p>
          The <code>feeBps</code> field on each quote shows the rate that swap pays.
        </p>
      </Sec>

      <Sec id="platform-fee" title="Your own fee">
        <p>
          Send <code>platformFeeBps</code>, from 50 to 255, and <code>feeWallet</code> with a quote. That rate replaces
          the free-key fee, and it is paid in SOL in the same transaction.
        </p>
        <p>
          On a monthly plan, 90% goes to <code>feeWallet</code>. On the free key, goblock keeps 10% or the free-key
          fee for that pair, whichever is larger. 100 bps on a 5 bps pool token sends 90 bps to you.
        </p>
      </Sec>

      <Sec id="checkout" title="Checkout">
        <p>
          Builder and Starter are paid at <Link href="/checkout">checkout</Link> with SOL or USDC. A discount code, when
          you have one, is applied on that page before you pay. The payment goes to the goblock wallet. The key lasts
          30 days, adds 0 bps, and uses that plan’s request cap. A free key stays at 10
          requests a minute. Enterprise caps are arranged with the goblock team.
        </p>
      </Sec>
    </>
  );
}
