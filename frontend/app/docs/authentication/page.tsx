import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Endpoint, Info, Sec } from "../parts";

export const metadata = docMeta("/docs/authentication");

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
  "swapFeeBps": 0,
  "endpoints": ["/api/v1/swap"],
  "limit": "Shared allowlist. Per-plan request caps start when subscription checkout ships."
}`,
  },
];

export default function Authentication() {
  return (
    <>
      <Sec id="header" title="Send the header">
        <p>
          Send your key in the <code>x-api-key</code> header on every request. A missing key, or one that is not
          active, returns <code>401</code>.
        </p>
      </Sec>

      <Sec id="check" title="Check a key">
        <p>Call the key endpoint to see whether a key is active and what it can reach.</p>
        <Endpoint path="/api/v1/key" />
        <CodeBlock className="slim" snippets={KEY_SNIPPETS} />
      </Sec>

      <Sec id="safety" title="Keep it on your server">
        <p>
          Call the API from your backend and pass the result to your app. Anyone who can read your browser bundle can
          read a key shipped inside it.
        </p>
        <Info>
          Checkout is not live yet. Keys are issued by the goblock team for now, and every active key shares one
          allowlist until per-plan caps ship.
        </Info>
      </Sec>
    </>
  );
}
