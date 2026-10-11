import { docMeta } from "../nav";
import { Sec } from "../parts";

export const metadata = docMeta("/docs/routing");

const VENUES: [string, string][] = [
  ["PumpSwap", "Pools for coins that graduated from Pump."],
  ["Bonding curve", "Pump coins that have not graduated yet."],
  ["Raydium", "Raydium pools, plus LaunchLab coins."],
  ["Meteora", "DLMM, DAMM, and Dynamic Bonding Curve pools."],
  ["Orca", "Whirlpools."],
];

const ROUTES: [string, string, string][] = [
  ["Direct", "One pool", "Used when a single pool pays the wallet the most."],
  ["Two hops", "Through SOL or USDC", "Used when going through SOL or USDC pays more than any direct pool."],
  ["Split", "50/50 or 70/30", "The two best pools share the amount when the sum beats either alone."],
];

export default function Routing() {
  return (
    <>
      <Sec id="venues" title="Venues">
        <p>Every quote asks each venue at the same time.</p>
        <div className="d-routes">
          {VENUES.map(([title, body]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </Sec>

      <Sec id="shapes" title="Route shapes">
        <p>goblock compares three shapes of route and keeps the one with the most output.</p>
        <div className="d-routes">
          {ROUTES.map(([title, tag, body]) => (
            <article key={title}>
              <code>{tag}</code>
              <b>{title}</b>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </Sec>

      <Sec id="timing" title="Timing">
        <p>
          Each venue gets up to four seconds to quote. A venue that answers late is left out of that quote, so one
          slow pool never holds up the swap.
        </p>
      </Sec>
    </>
  );
}
