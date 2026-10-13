import Link from "next/link";
import { m } from "./motion";
import { Reveal } from "./reveal";

const FACTS = [
  {
    figure: "1–2",
    unit: "slots to land",
    body: "The tip is set for the slots in front of the transaction.",
    lit: true,
  },
  {
    figure: "0.0001",
    unit: "SOL cap",
    body: "Priority follows the queue, then stops. goblock does not keep the tip.",
  },
  {
    figure: "Live",
    unit: "from the cluster",
    body: "The level comes from recent prioritization fees. The cap holds it down.",
  },
  {
    figure: "4",
    unit: "venues at once",
    body: "Raydium, Orca, Meteora, and PumpSwap are priced together. A late venue is left out.",
  },
];

export function LaserInfo() {
  return (
    <Reveal className="s-sec" motion="speed" id="speed">
      <div className="j-wrap">
        <div className="s-head split">
          <div>
            <span className="s-kick" {...m("rise")}>
              Speed
            </span>
            <h2 {...m("rise", 80)}>One or two slots to land.</h2>
            <div className="p-actions" {...m("rise", 160)}>
              <Link className="p-btn" href="/trade">
                Start Trading
              </Link>
              <Link className="p-btn line" href="/pricing">
                Get a key
              </Link>
            </div>
          </div>
          <p className="s-sub" {...m("rise", 160)}>
            The priority fee follows the slot queue at that moment, and it stops at 0.0001 SOL. The tip gets the swap
            in. goblock does not keep it.
          </p>
        </div>
        <ol className="s-speed">
          {FACTS.map((fact, index) => (
            <li key={fact.unit} className={fact.lit ? "lit" : undefined} data-m="lift" style={{ ["--i" as string]: index }}>
              <b className={fact.figure.length > 3 ? "long" : undefined}>{fact.figure}</b>
              <span>{fact.unit}</span>
              <p>{fact.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}
