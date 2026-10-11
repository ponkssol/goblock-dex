import type { ReactNode } from "react";
import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Sec, Table } from "../parts";

export const metadata = docMeta("/docs/response");

const FIELDS: [string, ReactNode][] = [
  ["side", <><code>buy</code> when you pay SOL, <code>sell</code> otherwise.</>],
  ["venue", "PumpSwap, Bonding curve, Raydium, Meteora, or Orca."],
  ["route", <>Set when the swap uses more than one pool, for example <code>Meteora 70% + Orca 30%</code>.</>],
  ["inAmount", "What you pay, in atomic units."],
  ["outAmount", "What the wallet receives, in atomic units."],
  ["minOutAmount", "The floor after slippage. The transaction fails below it."],
  ["priceImpactPct", <>A fraction as a string. <code>0.01</code> means 1%.</>],
  ["feeBps", <><code>0</code> on a normal swap. <code>5</code> when <code>brandWallet</code> is set.</>],
  ["networkFeeLamports", "Base signature fee plus the priority fee."],
  ["roundTripOutAmount", "The SOL back if the buy is sold straight back. Single-pool buys only."],
  ["receipt", <><code>graduated</code>, <code>creatorFeeBps</code>, <code>mayhem</code>, <code>cashback</code>, and <code>creator</code> for the coin.</>],
  ["transaction", <>Base64 versioned transaction. Present when <code>userPublicKey</code> is sent.</>],
  ["lastValidBlockHeight", "Pass it to confirmTransaction with the blockhash."],
];

const RESPONSE_SNIPPETS = [
  {
    label: "Example response",
    code: `{
  "side": "buy",
  "venue": "Meteora",
  "inAmount": "10000000",
  "outAmount": "1093913",
  "minOutAmount": "1082973",
  "priceImpactPct": "0.0018",
  "feeBps": 0,
  "feeAmount": "0",
  "networkFeeLamports": "15000",
  "inputMintDecimals": 9,
  "outputMintDecimals": 6,
  "receipt": {
    "venue": "Meteora",
    "graduated": true,
    "creatorFeeBps": 0,
    "mayhem": false,
    "cashback": false
  }
}`,
  },
];

export default function Response() {
  return (
    <>
      <Sec id="fields" title="Fields">
        <p>
          Amounts are atomic strings. Divide by <code>10 ** outputMintDecimals</code> to show them to the user.
        </p>
        <Table head={["Field", "Meaning"]} rows={FIELDS} />
      </Sec>

      <Sec id="example" title="Example">
        <p>
          A quote without <code>userPublicKey</code> stops at the price. With it, the response also carries{" "}
          <code>transaction</code> and <code>lastValidBlockHeight</code>.
        </p>
        <CodeBlock className="slim" snippets={RESPONSE_SNIPPETS} />
      </Sec>
    </>
  );
}
