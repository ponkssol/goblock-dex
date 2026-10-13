import { docMeta } from "../nav";
import { Info, Sec } from "../parts";

export const metadata = docMeta("/docs/brand-link");

export default function BrandLink() {
  return (
    <>
      <Sec id="api" title="On the API">
        <p>
          Add <code>brandWallet</code>, and optionally <code>brand</code>, to a quote request. The swap then carries a
          5 bps fee.
        </p>
        <Info>
          The free key shares fees through <code>platformFeeBps</code> and <code>feeWallet</code> instead, and turns
          down <code>brandWallet</code>.
        </Info>
      </Sec>

      <Sec id="site" title="On the site">
        <p>
          Share <code>/?brand=Name&amp;brandWallet=&lt;address&gt;</code>. Swaps started from that link pay you, with
          no code on your side.
        </p>
      </Sec>

      <Sec id="split" title="Who gets paid">
        <p>
          Half of the fee goes to <code>brandWallet</code> and half to the goblock treasury, inside the same
          transaction.
        </p>
        <Info>The fee is only paid when the transaction lands. A failed swap pays nobody.</Info>
      </Sec>
    </>
  );
}
