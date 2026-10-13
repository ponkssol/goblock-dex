import Link from "next/link";
import type { ReactNode } from "react";
import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Endpoint, Info, QUOTE_SNIPPETS, Sec, Table } from "../parts";

export const metadata = docMeta("/docs/swap");

const PARAMS: [string, ReactNode, ReactNode][] = [
  ["inputMint", <>string<span className="d-req">Required</span></>, "Mint you pay."],
  ["outputMint", <>string<span className="d-req">Required</span></>, "Mint you receive."],
  [
    "amount",
    <>string<span className="d-req">Required</span></>,
    <>Atomic units of <code>inputMint</code>. 10000000 is 0.01 SOL.</>,
  ],
  ["slippageBps", "number", "Default 100. From 1 to 5000."],
  ["userPublicKey", "string", "The wallet that signs. Include it to get a transaction back."],
  ["priorityMode", "max | exact", <>How <code>priorityLamports</code> is used: as a ceiling, or as the exact fee.</>],
  ["priorityLamports", "number", <>From 1 to 10,000,000. Read only when <code>priorityMode</code> is set.</>],
  ["brand", "string", "Memo on the swap. Up to 32 letters, numbers, spaces, periods, or dashes."],
  [
    "platformFeeBps",
    "number",
    <>Your fee, from 50 to 255. Needs <code>feeWallet</code>. See <Link href="/docs/plans#platform-fee">Your own fee</Link>.</>,
  ],
  ["feeWallet", "string", <>Wallet that receives your share of <code>platformFeeBps</code>.</>],
  [
    "brandWallet",
    "string",
    <>Adds the 5 bps brand fee on a monthly key. See <Link href="/docs/brand-link">Brand link</Link>.</>,
  ],
];

export default function QuoteSwap() {
  return (
    <>
      <Sec id="endpoint" title="Endpoint">
        <Endpoint path="/api/v1/swap" />
        <p>
          Leave out <code>userPublicKey</code> for a price only. Add it and the same call also returns a transaction
          for that wallet to sign.
        </p>
      </Sec>

      <Sec id="params" title="Query parameters">
        <Table head={["Name", "Type", "Description"]} rows={PARAMS} />
      </Sec>

      <Sec id="request" title="Request">
        <CodeBlock className="slim" snippets={QUOTE_SNIPPETS} />
        <Info>
          Quotes move with the market. Request a fresh one right before the user signs instead of reusing an old
          transaction.
        </Info>
      </Sec>
    </>
  );
}
