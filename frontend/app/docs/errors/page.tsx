import { CodeBlock } from "../../code-block";
import { docMeta } from "../nav";
import { Sec, Table } from "../parts";

export const metadata = docMeta("/docs/errors");

const ERRORS: [string, string][] = [
  ["400", "A mint, amount, slippage, wallet, or brand value was rejected."],
  ["401", "The x-api-key header is missing, or the key is not active."],
  ["429", "The key is over its requests-per-minute cap."],
];

const ERROR_SNIPPETS = [
  {
    label: "401",
    code: `{
  "msg": "This API requires a subscription key. Send an x-api-key header."
}`,
  },
];

export default function Errors() {
  return (
    <>
      <Sec id="codes" title="Status codes">
        <Table head={["Status", "Meaning"]} rows={ERRORS} />
      </Sec>

      <Sec id="body" title="Body">
        <p>
          Every error is JSON with a <code>msg</code> field you can show to the user.
        </p>
        <CodeBlock className="slim" snippets={ERROR_SNIPPETS} />
      </Sec>
    </>
  );
}
