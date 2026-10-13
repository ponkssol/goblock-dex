import Link from "next/link";
import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Cards, ICONS, Info, QUOTE_SNIPPETS, SIGN_SNIPPETS, Sec } from "../parts";

export const metadata = docMeta("/docs/quickstart");

export default function Quickstart() {
  return (
    <>
      <ol className="d-steps">
        <li>
          <b>Get a key</b>
          <span>
            Create one in the <Link href="/dashboard">Dashboard</Link>.
          </span>
        </li>
        <li>
          <b>Quote</b>
          <span>
            Call <code>GET /api/v1/swap</code> with your key.
          </span>
        </li>
        <li>
          <b>Sign</b>
          <span>The user signs the transaction in their own wallet.</span>
        </li>
      </ol>

      <Sec id="key" title="Get a key">
        <p>
          Every request carries an <code>x-api-key</code> header. Keep the key in an environment variable on your
          server, for example <code>GOBLOCK_API_KEY</code>.
        </p>
        <Info>
          Sign in to the <Link href="/dashboard">Dashboard</Link> and press Create Key for a free key, at 10 requests a
          minute. Builder and Starter are paid at <Link href="/checkout">checkout</Link> and add no goblock fee. See{" "}
          <Link href="/docs/authentication">Authentication</Link>.
        </Info>
      </Sec>

      <Sec id="quote" title="Request a quote">
        <p>
          This asks for 0.01 SOL into USDC. Amounts are atomic units, so 10000000 lamports is 0.01 SOL. Add{" "}
          <code>userPublicKey</code> when you want a transaction back.
        </p>
        <CodeBlock className="slim" snippets={QUOTE_SNIPPETS} />
      </Sec>

      <Sec id="sign" title="Sign and send">
        <p>
          Decode the transaction, let the user&apos;s wallet sign it, and confirm it with the blockhash it carries.
        </p>
        <CodeBlock className="slim" snippets={SIGN_SNIPPETS} />
      </Sec>

      <Sec id="next" title="Next steps">
        <Cards
          items={[
            {
              href: "/docs/swap",
              title: "Quote a swap",
              body: "Every query parameter the endpoint accepts.",
              icon: ICONS.code,
            },
            {
              href: "/docs/response",
              title: "Response",
              body: "What each field of the quote means.",
              icon: ICONS.doc,
            },
          ]}
        />
      </Sec>
    </>
  );
}
