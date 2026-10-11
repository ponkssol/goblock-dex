import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Info, SIGN_SNIPPETS, Sec } from "../parts";

export const metadata = docMeta("/docs/sign");

export default function Sign() {
  return (
    <>
      <Sec id="decode" title="Decode and sign">
        <p>
          Request the quote with <code>userPublicKey</code> set. Decode the base64 transaction, have the user&apos;s
          wallet sign it, and confirm with the blockhash it carries. goblock never holds the tokens or the keys.
        </p>
        <CodeBlock className="slim" snippets={SIGN_SNIPPETS} />
      </Sec>

      <Sec id="guard" title="Slippage guard">
        <p>
          The transaction checks on chain that the output token account gained at least <code>minOutAmount</code>.
        </p>
        <Info>If the price moved past your slippage, the swap fails instead of filling short.</Info>
      </Sec>
    </>
  );
}
