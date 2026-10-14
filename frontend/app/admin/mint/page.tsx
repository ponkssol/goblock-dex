import { MintForm } from "../../buyback/settings/mint-form";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { adminMeta } from "../meta";

export const metadata = adminMeta("$GOBLOCK", "/admin/mint", "Set the mint the goblock program buys and burns.");

export default function AdminMintPage() {
  return (
    <>
      <PageHead
        title="$GOBLOCK"
        sub="Paste the $GOBLOCK contract address when the token is live. The team wallet signs it, and the address locks after it lands."
      />
      <Card plain title="Mint address" sub="The contract address for $GOBLOCK. It cannot be edited once it is set on chain.">
        <MintForm />
      </Card>
    </>
  );
}
